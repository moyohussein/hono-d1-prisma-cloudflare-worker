import { compareSync, hashSync } from "bcrypt-ts";
import { z } from "zod";
import App from "~/app";
import db from "~/db";
import { exclude } from "~/db/utils";
import validationMiddleware from "~/middleware/validationMiddleware";
import Response from "~/utils/response";
import { sign } from "hono/jwt";
import { generateToken, sha256Hex } from "~/utils/crypto";
import { generateVerificationToken, verifyToken } from "~/utils/token";
import { EmailService } from "~/services/email-service";

// Create email service instance with default values
const emailService = new EmailService(
  process.env.BREVO_API_KEY,
  process.env.EMAIL_FROM || 'noreply@leamsp.com',
  'LeamSP'
);

// Extend the base Bindings type to include our custom environment variables
type Bindings = {
  JWT_SECRET: string;
  BREVO_API_KEY: string;  // Added for Brevo email service
  EMAIL_FROM?: string;    // Optional custom email sender
  ENVIRONMENT?: 'development' | 'production';
  DB: D1Database;
  
  // Add index signature to allow dynamic property access
  [key: string]: any;
};

// Helper function to initialize email service with environment variables
async function initEmailService(env: { BREVO_API_KEY: string; EMAIL_FROM?: string }) {
  await emailService.initialize(env.BREVO_API_KEY);
  if (env.EMAIL_FROM) {
    emailService.setDefaultSender(env.EMAIL_FROM, 'LeamSP');
  }
}

const schema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const schemaRegister = z
  .object({
    name: z.string().min(3).max(60),
    email: z.string().min(3).max(60),
    password: z
      .string()
      .min(8)
      .regex(
        new RegExp(
          /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/
        ),
        {
          message:
            "Minimum 8 characters, at least one uppercase letter, one lowercase letter, one number and one special character",
        }
      ),
    password_confirmation: z.string().min(8),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords don't match",
    path: ["password_confirmation"],
  });

// Create router before attaching routes
const Router = App.basePath("/auth");

/**
 * Request email verification
 * Public or authenticated (if authenticated, use current user email)
 */
Router.post("/verify-email", async (c) => {
  try {
    let email: string | undefined;
    const payload: any = c.get("jwtPayload");
    
    // Get email from JWT payload or request body
    if (payload?.email) {
      email = payload.email;
    } else {
      try {
        const body = await c.req.json<{ email?: string }>();
        email = (body.email ?? "").toLowerCase().trim();
      } catch (error) {
        return new Response(c).error("Invalid request body", 400);
      }
    }
    
    if (!email) {
      return new Response(c).error("Email is required", 400);
    }

    // Find user by email
    const user = await db(c.env).users.findFirst({ 
      where: { email },
      select: { id: true, email: true, emailVerified: true, name: true }
    });
    
    // Don't disclose if user exists or not
    if (!user) {
      return new Response(c).success({ 
        success: true, 
        message: "If an account exists with this email, a verification link has been sent." 
      });
    }

    // Skip if already verified
    if (user.emailVerified) {
      return new Response(c).success({ 
        success: true, 
        message: "Email is already verified." 
      });
    }

    try {
      // Generate verification token
      const token = await generateVerificationToken(user.id, user.email, c.env.JWT_SECRET);
      
      // Initialize email service with environment variables
      const env = c.env as unknown as Bindings;
      await initEmailService({
        BREVO_API_KEY: env.BREVO_API_KEY,
        EMAIL_FROM: env.EMAIL_FROM
      });
      
      // Create verification URL
      const verificationUrl = new URL('/auth/verify-email', c.req.url);
      verificationUrl.searchParams.set('token', token);
      
      // Send verification email using Brevo service
      await emailService.sendVerificationEmail(
        user.email,
        verificationUrl.toString(),
        user.name || undefined
      );
      
      return new Response(c).success({ 
        success: true, 
        message: "Verification email sent. Please check your inbox.",
        // In development, include the token for testing
        ...(c.env.ENVIRONMENT === "development" && { devToken: token })
      });
    } catch (error) {
      console.error("Error sending verification email:", error);
      return new Response(c).error("Failed to send verification email. Please try again later.", 500);
    }
  } catch (error) {
    console.error("Error in verify-email endpoint:", error);
    return new Response(c).error("An error occurred while processing your request.", 500);
  }
});

/**
 * Verify email with token
 */
Router.get("/verify-email", async (c) => {
  const url = new URL(c.req.url);
  const token = url.searchParams.get("token") ?? "";
  
  if (!token) {
    return new Response(c).error("Verification token is required", 400);
  }

  try {
    // Verify the JWT token
    const { payload, expired } = await verifyToken(token, c.env.JWT_SECRET);
    
    // Check if token is for email verification
    if (payload.purpose !== 'email-verification') {
      return new Response(c).error("Invalid verification token", 400);
    }
    
    // Check if token is expired
    if (expired) {
      return new Response(c).error("Verification link has expired. Please request a new one.", 400);
    }
    
    // Find the user
    const user = await db(c.env).users.findUnique({
      where: { id: Number(payload.userId) }, // Ensure userId is a number
      select: { id: true, email: true, emailVerified: true }
    });
    
    if (!user) {
      return new Response(c).error("User not found", 404);
    }
    
    // Check if email matches
    if (user.email !== payload.email) {
      return new Response(c).error("Invalid verification token", 400);
    }
    
    // Check if already verified
    if (user.emailVerified) {
      return c.redirect("/email-verified?status=already-verified");
    }
    
    // Update user as verified
    await db(c.env).users.update({
      where: { id: user.id },
      data: { emailVerified: new Date() }
    });
    
    // Redirect to success page (frontend should handle this)
    return c.redirect("/email-verified?status=success");
  } catch (error) {
    console.error("Error verifying email:", error);
    return new Response(c).error("Invalid or expired verification link. Please request a new one.", 400);
  }
});

/**
 * Forgot password (rate-limit recommended)
 */
Router.post("/forgot-password", async (c) => {
  try {
    const body = await c.req.json<{ email?: string }>();
    const email = (body.email ?? "").toLowerCase();
    
    // Always return success to prevent user enumeration
    if (!email) return new Response(c).success({ ok: true });
    
    // Find user by email
    const user = await db(c.env).users.findFirst({ 
      where: { email },
      select: { id: true, email: true, name: true }
    });
    
    // If user doesn't exist, still return success to prevent user enumeration
    if (!user) return new Response(c).success({ ok: true });
    
    // Generate reset token
    const rawToken = await generateToken(32);
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
    
    // Store token in database
    await (db(c.env) as any).tokens.create({
      data: { 
        userId: user.id, 
        type: "reset", 
        tokenHash, 
        expiresAt 
      },
    });
    
    // In development mode, return the token directly
    if (c.env.ENVIRONMENT === 'development' || c.env.DEV_MODE === 'true') {
      return new Response(c).success({ 
        ok: true, 
        devToken: rawToken,
        message: 'In development mode, token is returned directly.'
      });
    }
    
    // Send password reset email
    try {
      // Initialize email service with environment variables
      const env = c.env as unknown as Bindings;
      await initEmailService({
        BREVO_API_KEY: env.BREVO_API_KEY,
        EMAIL_FROM: env.EMAIL_FROM
      });
      
      // Create reset URL
      const resetUrl = new URL('/reset-password', c.req.url);
      resetUrl.searchParams.set('token', rawToken);
      
      // Send password reset email using Brevo service
      await emailService.sendPasswordResetEmail(
        user.email,
        resetUrl.toString(),
        user.name || undefined
      );
      
      return new Response(c).success({ 
        ok: true, 
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      return new Response(c).error('Failed to send password reset email. Please try again later.', 500);
    }
    
  } catch (error) {
    console.error('Error in forgot password:', error);
    // Always return success to prevent user enumeration
    return new Response(c).success({ 
      ok: true,
      message: 'If an account with this email exists, a password reset link has been sent.'
    });
  }
});

/**
 * Reset password
 */
Router.post("/reset-password", async (c) => {
  try {
    const body = await c.req.json<{
      token: string;
      newPassword: string;
      confirmPassword: string;
    }>();
    if (!body?.token || !body?.newPassword || !body?.confirmPassword) {
      return new Response(c).error("Invalid payload", 400 as any);
    }
    if (body.newPassword !== body.confirmPassword) {
      return new Response(c).error("Passwords don't match", 400 as any);
    }
    const tokenHash = await sha256Hex(body.token);
    const now = new Date();
    const rec = await (db(c.env) as any).tokens.findFirst({
      where: { type: "reset", tokenHash, usedAt: null },
    });
    if (!rec || rec.expiresAt < now) {
      return new Response(c).error("Token expired or invalid", 410 as any);
    }
    const hashed = hashSync(body.newPassword, 8);
    await db(c.env).users.update({ where: { id: rec.userId }, data: { password: hashed } });
    await (db(c.env) as any).tokens.update({ where: { id: rec.id }, data: { usedAt: now } });
    return new Response(c).success({ ok: true });
  } catch (err) {
    return new Response(c).error("Failed to reset password", 400 as any);
  }
});

const AuthController = Router
  /**
   * Login
   */
  .post(
    "/login",
    validationMiddleware(schema, (error, c) => {
      return new Response(c).error(error);
    }),
    async (c) => {
      const data = c.req.valid("json");
      const user = await db(c.env).users.findFirst({
        where: {
          email: data.email,
        },
      });

      if (!user) {
        return new Response(c).error(
          "User not found. Please check your credentials or sign up for a new account.",
          401
        );
      }

      const isPasswordCorrect = compareSync(data.password, user?.password);

      if (!isPasswordCorrect) {
        return new Response(c).error(
          "Invalid email or password. Please check your credentials and try again.",
          401
        );
      }

      const filteredUser = exclude(user, ["password"]);

      /**
       * create payload for JWT
       * Note: The payload structure must match what's expected in the profile endpoint
       */
      const payload = {
        data: {
          id: user.id,  // This is the key part - the profile endpoint expects data.id
          email: user.email,
          name: user.name,
          role: user.role
        },
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // Token expires in 1 hour
      };

      /**
       * sign payload
       */
      const token = await sign(payload, c.env.JWT_SECRET);

      return new Response(c).success({
        token,
        user: filteredUser,
      });
    }
  )
  .post(
    "/register",
    validationMiddleware(schemaRegister, (error, c) => {
      return new Response(c).error(error);
    }),
    async (c) => {
      const request = c.req.valid("json");
      const email = (request.email ?? "").toLowerCase();
      const hashedPassword = hashSync(request.password, 8);
      
      try {
        // Initialize email service with API key from environment
        await emailService.initialize(c.env.RESEND_API_KEY);
        
        // Create the user
        const created = await db(c.env).users.create({
          data: {
            password: hashedPassword,
            email,
            name: request.name ?? "",
            emailVerified: null, // Explicitly set to null for new users
          },
        });
        
        // Generate verification token
        const verificationToken = await generateVerificationToken(
          created.id,
          created.email,
          c.env.JWT_SECRET
        );
        
        // Create verification URL
        const verificationUrl = `${c.req.header('Origin') || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
        
        // Send verification email
        await emailService.sendVerificationEmail(
          created.email,
          verificationUrl,
          created.name || undefined
        );
        
        const { password: _pw, ...safe } = created as any;
        return new Response(c).success({
          ...safe,
          message: 'Registration successful! Please check your email to verify your account.'
        });
        
      } catch (error: any) {
        console.error('Registration error:', error);
        
        // Don't expose internal errors in production
        if (c.env.ENVIRONMENT === 'production') {
          return new Response(c).error("An error occurred during registration. Please try again later.", 500);
        }
        
        // In development, provide more detailed error information
        return new Response(c).error({
          name: error?.name,
          message: String(error?.message ?? error),
          stack: error?.stack
        }, 500);
      }
    }
  )
  .get("/me", (c) => {
    /**
     * get user payload
     */
    const { data } = c.get("jwtPayload");
    return new Response(c).success(data);
  })
  // POST /api/auth/delete-account
  .post("/delete-account", async (c) => {
    const payload = c.get("jwtPayload") as { data?: { id?: number } };
    const userId = payload?.data?.id;
    if (!userId) return new Response(c).error("Unauthorized", 401);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return new Response(c).error("Invalid JSON body", 400 as any);
    }
    const ok = (body as any)?.confirm === true;
    if (!ok) return new Response(c).error("Confirmation required", 400 as any);
    const scheduledAt = new Date();
    await db(c.env).users.update({
      where: { id: userId },
      data: { deletedAt: scheduledAt, name: "" } as any,
    });
    return new Response(c).success({ scheduledAt: scheduledAt.toISOString() });
  })
  // POST /api/auth/request-export
  .post("/request-export", async (c) => {
    const payload = c.get("jwtPayload") as { data?: { id?: number; email?: string } };
    const userId = payload?.data?.id;
    if (!userId) return new Response(c).error("Unauthorized", 401);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return new Response(c).error("Invalid JSON body", 400 as any);
    }
    const format = (body as any)?.format;
    if (format !== "json" && format !== "csv") {
      return new Response(c).error("Invalid format", 400 as any);
    }
    // In production, enqueue a job or send an email. In DEV, just return ok.
    return new Response(c).success({ ok: true });
  })
;

export default AuthController;

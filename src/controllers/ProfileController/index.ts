import { z } from "zod";
import App from "~/app";
import db from "~/db";
import Response from "~/utils/response";
import { compareSync, hashSync } from "bcrypt-ts";

/**
 * ProfileController handles current user profile operations under /user
 */
const updateProfileSchema = z.object({
  name: z.string().min(3).max(60).optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z
      .string()
      .min(8)
      .regex(
        /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/,
        {
          message:
            "Minimum 8 characters, at least one uppercase letter, one lowercase letter, one number and one special character",
        }
      ),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const ProfileController = App.basePath("/user")
  // GET /api/user/profile
  .get("/profile", async (c) => {
    const payload = c.get("jwtPayload") as { data?: { id?: number } };
    const userId = payload?.data?.id;
    if (!userId) {
      return new Response(c).error("Unauthorized", 401);
    }
    const user = await db(c.env).users.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return new Response(c).error("User not found", 404 as any);
    }
    return new Response(c).success(user);
  })
  // PUT /api/user/profile
  .put("/profile", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return new Response(c).error("Invalid JSON body", 400 as any);
    }
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(c).error(parsed.error);
    }
    const payload = c.get("jwtPayload") as { data?: { id?: number } };
    const userId = payload?.data?.id;
    if (!userId) {
      return new Response(c).error("Unauthorized", 401);
    }
    const updated = await db(c.env).users.update({
      where: { id: userId },
      data: { name: parsed.data.name ?? undefined },
      select: { id: true, email: true, name: true },
    });
    return new Response(c).success(updated);
  })
  // PUT /api/user/password
  .put("/password", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return new Response(c).error("Invalid JSON body", 400 as any);
    }
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(c).error(parsed.error);
    }
    const payload = c.get("jwtPayload") as { data?: { id?: number } };
    const userId = payload?.data?.id;
    if (!userId) {
      return new Response(c).error("Unauthorized", 401);
    }
    const user = await db(c.env).users.findUnique({ where: { id: userId } });
    if (!user) {
      return new Response(c).error("User not found", 404 as any);
    }
    const ok = compareSync(parsed.data.currentPassword, user.password);
    if (!ok) {
      return new Response(c).error("Current password is incorrect", 400 as any);
    }
    const hashed = hashSync(parsed.data.newPassword, 8);
    await db(c.env).users.update({
      where: { id: userId },
      data: { password: hashed },
    });
    return new Response(c).success({ ok: true });
  });

export default ProfileController;

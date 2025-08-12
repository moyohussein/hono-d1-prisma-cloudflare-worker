import App from "./app";
import UserController from "~/controllers/UserController";
import AuthController from "~/controllers/AuthController";
import ProfileController from "~/controllers/ProfileController";
import IdCardController from "~/controllers/id-card-controller";
import UploadController from "~/controllers/upload-controller";
import { jwt } from "hono/jwt";
import { securityHeaders } from "~/middleware/security-headers";
import { rateLimit } from "~/middleware/rate-limit";
import { openApiSpec } from "~/openapi/spec";
import { openApiYaml } from "~/openapi/spec-yaml";
import { requireAdmin } from "~/middleware/require-admin";
import { cors } from "hono/cors";

const app = App;

// Global security headers
app.use("*", securityHeaders());

// CORS for browser clients (allow your local dev frontend and credentials)
app.use("*", cors({
  origin: [
    "http://localhost:3000",
    // Add additional allowed origins here (e.g., production frontend URL)
    // "https://your-frontend.example.com",
  ],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
}));

// Redirect common paths missing the /api prefix
app.all("/auth/*", (c) => c.redirect(`/api${c.req.path}`, 308));

// Test endpoint to verify CORS configuration
app.get('/api/test-cors', (c) => {
  return c.json({
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    corsHeaders: {
      'Access-Control-Allow-Origin': c.req.header('Origin') || 'Not set',
      'Access-Control-Allow-Credentials': 'true',
    }
  });
});

const guestPage = [
  "/",
  "/favicon.ico",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/verify",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/openapi.json",
  "/api/openapi.yaml",
  "/api/docs",
];

app.use("*", (c, next) => {
  const path = c.req.path;
  // Allow public endpoints
  const isPublic =
    guestPage.includes(path) ||
    path.startsWith("/api/id-card/verify/") ||
    /^\/api\/id-card\/\d+\/image$/.test(path);
  if (isPublic) {
    return next();
  }
  const jwtMiddleware = jwt({
    secret: c.env.JWT_SECRET,
  });
  return jwtMiddleware(c, next);
});

// Public health/home endpoint
app.get("/", (c) => c.text("leamsp-api is running"));

// Public empty favicon to avoid 401 errors in browsers
app.get("/favicon.ico", (c) => c.body(null, 204));

// Serve OpenAPI spec
app.get("/api/openapi.json", (c) => c.json(openApiSpec));
app.get("/api/openapi.yaml", (c) => c.text(openApiYaml, 200, { "Content-Type": "application/yaml" }));

// Serve Swagger UI pointing to the JSON spec
app.get("/api/docs", (c) =>
  c.html(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>leamsp-api Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
      });
    </script>
  </body>
</html>`)
);

// Rate limit sensitive auth endpoints
app.use("/api/auth/login", rateLimit({ windowMs: 60_000, max: 10 }));
app.use("/api/auth/verify-email", rateLimit({ windowMs: 60_000, max: 5 }));
app.use("/api/auth/forgot-password", rateLimit({ windowMs: 60_000, max: 5 }));
app.use("/api/auth/reset-password", rateLimit({ windowMs: 60_000, max: 5 }));

app.route("/api", AuthController);
app.route("/api", UserController);
app.route("/api", ProfileController);
app.route("/api", IdCardController);
app.route("/api", UploadController);

// Admin-only sample route
app.get("/api/admin/ping", requireAdmin(), (c) => c.json({ success: true, data: { pong: true } }));

export default app;

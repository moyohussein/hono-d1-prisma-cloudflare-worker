import type { MiddlewareHandler } from "hono";

export const requireAdmin = (): MiddlewareHandler => {
  return async (c, next) => {
    const payload = c.get("jwtPayload") as any;
    const role = payload?.data?.role;
    if (role !== "ADMIN") {
      return c.json({ success: false, error: "Forbidden" }, 403);
    }
    await next();
  };
};

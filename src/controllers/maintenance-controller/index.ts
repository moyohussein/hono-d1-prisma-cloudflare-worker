import App from "~/app";
import db from "~/db";
import Response from "~/utils/response";

const Router = App.basePath("");

// POST /api/cron/cleanup
Router.post("/cron/cleanup", async (c) => {
  try {
    // Basic internal auth via header or env secret
    const provided = c.req.header("x-cron-secret");
    if (!provided || provided !== c.env.CRON_SECRET) {
      return new Response(c).error("Unauthorized", 401 as any);
    }
    const now = new Date();
    const cutoff = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30); // 30 days

    // Cleanup tokens in two steps to avoid adapter quirks
    const expired = await db(c.env).tokens.deleteMany({ where: { expiresAt: { lt: now } } });
    const used = await db(c.env).tokens.deleteMany({ where: { usedAt: { not: null } } });

    // Purge users soft-deleted more than 30 days ago
    const usersDeleted = await db(c.env).users.deleteMany({
      where: { deletedAt: { not: null, lt: cutoff } },
    });

    return new Response(c).success({ tokensDeleted: expired.count + used.count, usersDeleted: usersDeleted.count });
  } catch (err: any) {
    if (c.env.DEV_MODE === "true") {
      return new Response(c).error({ message: "cleanup failed", error: String(err?.message ?? err) }, 500 as any);
    }
    return new Response(c).error("Internal Server Error", 500 as any);
  }
});

const MaintenanceController = Router;
export default MaintenanceController;

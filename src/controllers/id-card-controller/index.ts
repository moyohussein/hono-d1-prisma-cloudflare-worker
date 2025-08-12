import App from "~/app";
import db from "~/db";
import Response from "~/utils/response";
import { z } from "zod";
import { generateToken, sha256Hex } from "~/utils/crypto";

const createSchema = z.object({
  displayName: z.string().min(1),
  attributes: z.record(z.any()).default({}),
});

const generateSchema = z.object({
  cardId: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  options: z
    .object({
      format: z.enum(["png", "webp"]).optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    })
    .optional(),
});

const Router = App.basePath("/id-card");

// POST /api/id-card
Router.post("/", async (c) => {
  try {
    const payload = c.get("jwtPayload") as { data?: { id?: number } };
    const userId = payload?.data?.id;
    if (!userId) return new Response(c).error("Unauthorized", 401);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return new Response(c).error("Invalid JSON body", 400 as any);
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return new Response(c).error(parsed.error);
    const created = await db(c.env).idCards.create({
      data: {
        userId,
        displayName: parsed.data.displayName,
        attributes: parsed.data.attributes,
      },
      select: { id: true, displayName: true, attributes: true },
    });
    return new Response(c).success(created, 201 as any);
  } catch (error: any) {
    if (c.env?.DEV_MODE === "true") {
      return new Response(c).error({ name: error?.name, message: String(error?.message ?? error) }, 500 as any);
    }
    return new Response(c).error("Internal Server Error", 500 as any);
  }
});

// POST /api/id-card/generate
Router.post("/generate", async (c) => {
  const payload = c.get("jwtPayload") as { data?: { id?: number } };
  const userId = payload?.data?.id;
  if (!userId) return new Response(c).error("Unauthorized", 401);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return new Response(c).error("Invalid JSON body", 400 as any);
  }
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) return new Response(c).error(parsed.error);

  const card = await db(c.env).idCards.findFirst({
    where: { id: parsed.data.cardId, userId },
    select: { id: true, imageUrl: true, publicId: true },
  });
  if (!card) return new Response(c).error("Card not found", 404 as any);

  // If we already have a CDN image, return that
  if (card.imageUrl && card.publicId) {
    return new Response(c).success({ url: card.imageUrl, publicId: card.publicId });
  }

  // Otherwise, mint a short-lived token for retrieval/verification
  const raw = await generateToken(24);
  const tokenHash = await sha256Hex(raw);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes
  await db(c.env).tokens.create({
    data: { userId, type: "idcard", tokenHash, expiresAt },
  });
  return new Response(c).success({ token: raw, expiresAt: expiresAt.toISOString() });
});

// GET /api/id-card/verify/:token
Router.get("/verify/:token", async (c) => {
  const token = c.req.param("token");
  if (!token) return new Response(c).error("Missing token", 400 as any);
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const rec = await db(c.env).tokens.findFirst({
    where: { type: "idcard", tokenHash, usedAt: null },
  });
  if (!rec || rec.expiresAt < now) {
    return new Response(c).error("Token expired or invalid", 410 as any);
  }
  const card = await db(c.env).idCards.findFirst({
    where: { userId: rec.userId },
    select: { id: true, displayName: true, userId: true },
  });
  const owner = await db(c.env).users.findUnique({
    where: { id: rec.userId },
    select: { id: true, name: true },
  });
  return new Response(c).success({ valid: true, cardId: String(card?.id ?? ""), owner });
});

// GET /api/id-card/:id/image
Router.get("/:id/image", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) return new Response(c).error("Invalid id", 400 as any);
  const card = await db(c.env).idCards.findUnique({ where: { id }, select: { imageUrl: true } });
  if (!card) return new Response(c).error("Not found", 404 as any);
  if (card.imageUrl) return new Response(c).success({ url: card.imageUrl });
  return new Response(c).error("No image available", 404 as any);
});

// GET /api/id-card -> latest active card + recent logs
Router.get("/", async (c) => {
  const payload = c.get("jwtPayload") as { data?: { id?: number } };
  const userId = payload?.data?.id;
  if (!userId) return new Response(c).error("Unauthorized", 401);

  const card = await db(c.env).idCards.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, imageUrl: true },
  });
  if (!card) return new Response(c).success(null);

  const user = await db(c.env).users.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  const now = new Date();
  const activeToken = await db(c.env).tokens.findFirst({
    where: { userId, type: "idcard", usedAt: null, expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true },
  });
  const recent = await db(c.env).tokens.findMany({
    where: { userId, type: "idcard", NOT: { usedAt: null } },
    orderBy: { usedAt: "desc" },
    take: 5,
    select: { usedAt: true },
  });

  const result = {
    id: String(card.id),
    expiresAt: activeToken?.expiresAt?.toISOString() ?? null,
    status: "active" as const,
    imageUrl: `/api/id-card/${card.id}/image`,
    user: {
      id: String(user?.id ?? ""),
      name: user?.name ?? "",
      email: user?.email ?? "",
      image: null as unknown as string | null,
      role: user?.role ?? "USER",
    },
    recentVerifications: recent.map((r) => ({
      status: "success" as const,
      verifiedAt: r.usedAt ? new Date(r.usedAt).toISOString() : null,
      ipAddress: null as unknown as string | null,
    })),
    previewUrl: `/api/id-card/preview`,
  };

  return new Response(c).success(result);
});

// GET /api/id-card/list -> paginated list
Router.get("/list", async (c) => {
  const payload = c.get("jwtPayload") as { data?: { id?: number } };
  const userId = payload?.data?.id;
  if (!userId) return new Response(c).error("Unauthorized", 401);
  const page = Number(new URL(c.req.url).searchParams.get("page") ?? 1);
  const pageSize = Number(new URL(c.req.url).searchParams.get("pageSize") ?? 10);
  const take = Math.max(1, Math.min(100, pageSize));
  const skip = (Math.max(1, page) - 1) * take;
  const [items, total] = await Promise.all([
    db(c.env).idCards.findMany({ where: { userId }, skip, take, select: { id: true, displayName: true, attributes: true } }),
    db(c.env).idCards.count({ where: { userId } }),
  ]);
  return new Response(c).success({ items, total, page, pageSize: take });
});

const IdCardController = Router;
export default IdCardController;

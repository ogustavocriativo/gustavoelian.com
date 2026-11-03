// Logo do cliente para a prévia de link da proposta (admin).
//   GET/PUT/DELETE /api/client-logo/:slug   (PUT: corpo binário PNG/JPG/WebP até 1,5 MB)
import type { Config, Context } from "@netlify/functions";
import { fail, getQuote, isAdmin, json } from "../lib/core.mts";
import { sniff } from "../lib/og-card.mts";
import { previewStore } from "./previews.mts";

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  const slug = String(context.params.slug || "").toLowerCase();
  if (!/^[a-z0-9-]{3,60}$/.test(slug) || !(await getQuote(slug))) return fail("Proposta não encontrada", 404);
  const S = previewStore(), key = `quote-logo/${slug}`;
  if (req.method === "GET") return json({ has: !!(await S.getMetadata(key)) });
  if (req.method === "DELETE") { await S.delete(key); return json({ has: false }); }
  if (req.method !== "PUT") return fail("Método não permitido", 405);
  const buf = await req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > 1.5 * 1024 * 1024) return fail("Imagem vazia ou acima de 1,5 MB");
  if (!sniff(new Uint8Array(buf))) return fail("Use uma imagem PNG, JPG ou WebP");
  await S.set(key, buf);
  return json({ has: true });
};
export const config: Config = { path: "/api/client-logo/:slug" };

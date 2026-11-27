// Avaliações de clientes.
//   GET  /api/avaliacoes                      → públicas (aprovadas no Studio e autorizadas pelo cliente), para o site
//   PUT  /api/quotes/:slug/avaliacao          { action?: "publicar"|"ocultar"|"recusar", highlight?, name?, role? } (admin)
//   POST /api/quotes/:slug/avaliacao/pedir    envia agora o e-mail pedindo a avaliação (admin)
import type { Config, Context } from "@netlify/functions";
import { fail, isAdmin, json } from "../lib/core.mts";
import { moderateReview, requestReview, reviews } from "../lib/reviews.mts";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  if (url.pathname === "/api/avaliacoes") {
    if (req.method !== "GET") return fail("Método não permitido", 405);
    const { blobs } = await reviews().list();
    const list = (await Promise.all(blobs.map((b) => reviews().get(b.key, { type: "json" })))).filter(Boolean)
      .sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
    return json({ reviews: list }, 200, { "cache-control": "public, max-age=300" });
  }
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  const { slug } = context.params;
  if (url.pathname.endsWith("/pedir")) {
    if (req.method !== "POST") return fail("Método não permitido", 405);
    const r: any = await requestReview(slug, url.origin);
    return r.error ? fail(r.error, 409) : json(r);
  }
  if (req.method !== "PUT") return fail("Método não permitido", 405);
  const r: any = await moderateReview(slug, await req.json().catch(() => ({})));
  return r.error ? fail(r.error, 409) : json(r);
};

export const config: Config = { path: ["/api/avaliacoes", "/api/quotes/:slug/avaliacao", "/api/quotes/:slug/avaliacao/pedir"] };

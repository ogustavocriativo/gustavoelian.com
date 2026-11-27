// Currículo acadêmico (/academico).
//   GET  /api/academico           → público (o salvo no Studio ou o ponto de partida)
//   PUT  /api/academico           → admin, salva tudo
//   POST /api/academico/upload    → admin, envia slides (PDF), capa ou foto (até 25 MB) e devolve { key, url }
import type { Config, Context } from "@netlify/functions";
import { fail, isAdmin, json, store } from "../lib/core.mts";
import { DEFAULT_ACADEMIC, cleanAcademic } from "../lib/academic.mts";

const data = () => store("portfolio");
const media = () => store("media");
const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const MAX = 25 * 1024 * 1024;
const keysOf = (a: any) => [a?.profile?.photo?.key, ...(a?.items || []).flatMap((i: any) => [i.slides?.key, i.coverMedia?.key])].filter(Boolean);

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const admin = await isAdmin(context);
  if (url.pathname.endsWith("/upload")) {
    if (!admin) return fail("Faça login", 401);
    if (req.method !== "POST") return fail("Método não permitido", 405);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file") as File | null;
    if (!file) return fail("Envie um arquivo");
    if (!TYPES.includes(file.type)) return fail("Use PDF (slides) ou imagem JPG, PNG ou WebP.");
    if (file.size > MAX) return fail("Arquivo acima de 25 MB. Exporte o PDF com qualidade menor.");
    const key = `academico-page-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    await media().set(key, await file.arrayBuffer(), { metadata: { type: file.type, name: file.name.slice(0, 140), size: file.size } });
    return json({ key, type: file.type, name: file.name.slice(0, 140), size: file.size, url: `/api/media/${key}` }, 201);
  }
  if (req.method === "GET") {
    const saved: any = await data().get("academico", { type: "json" });
    return json({ ...(saved || DEFAULT_ACADEMIC), updatedAt: saved?.updatedAt || null, isDefault: !saved }, 200, admin ? { "cache-control": "no-store" } : { "cache-control": "public, max-age=30" });
  }
  if (!admin) return fail("Faça login", 401);
  if (req.method !== "PUT") return fail("Método não permitido", 405);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Dados inválidos");
  const prev: any = await data().get("academico", { type: "json" });
  const next = { ...cleanAcademic(body), updatedAt: new Date().toISOString() };
  await data().setJSON("academico", next);
  // arquivos que saíram do currículo são apagados
  const keep = new Set(keysOf(next));
  await Promise.all(keysOf(prev).filter((k: string) => !keep.has(k)).map((k: string) => media().delete(k).catch(() => {})));
  return json(next);
};

export const config: Config = { path: ["/api/academico", "/api/academico/upload"] };

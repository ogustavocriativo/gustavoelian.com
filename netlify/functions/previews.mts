// Prévias de projeto (admin): sobe um .zip (site, protótipo, apresentação em HTML) e gera um link para o cliente ver e aprovar,
// sem novo deploy no Netlify. Os arquivos ficam no armazenamento do próprio site (Blobs) e são servidos por /v/<código>.
//   GET    /api/previews                    lista
//   POST   /api/previews                    { title, client, quoteSlug } cria
//   GET    /api/previews/:id                detalhe (versões, retornos do cliente)
//   PUT    /api/previews/:id/files?v=&path= envia um arquivo (corpo binário, até 4,4 MB)
//   POST   /api/previews/:id/publish        { v, entry, note, files:[{path,size,type}] } ativa a versão
//   PATCH  /api/previews/:id                { title, client, quoteSlug, active, expiresAt }
//   DELETE /api/previews/:id                apaga a prévia e os arquivos
import type { Config, Context } from "@netlify/functions";
import { addEvent, fail, getQuote, isAdmin, json, shortCode, store } from "../lib/core.mts";

export const previewStore = () => store("previews");
export const FILE_MAX = 4.4 * 1024 * 1024;
const ID_RE = /^[a-z0-9]{8,16}$/;
const str = (v: any, n: number) => String(v ?? "").trim().slice(0, n);

export function cleanPath(p: string) {
  const parts = String(p || "").replace(/\\/g, "/").split("/").filter((x) => x && x !== ".");
  if (!parts.length || parts.some((x) => x === ".." || /[\u0000-\u001f]/.test(x))) return "";
  return parts.join("/").slice(0, 300);
}
export const fileKey = (id: string, v: number, path: string) => `file/${id}/${v}/${path}`;
export async function getMeta(id: string) {
  if (!ID_RE.test(id)) return null;
  return (await previewStore().get(`meta/${id}`, { type: "json" })) as any;
}
/** Link amigável: "lucas-rocha-sistema-de-advocacia". Aceita também o código antigo. */
export const slugOf = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
export const SLUG_OK = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export async function resolveMeta(key: string) {
  const k = String(key || "").toLowerCase();
  if (!k) return null;
  const id = (await previewStore().get(`slug/${k}`, { type: "text" })) as string | null;
  return id ? await getMeta(id) : await getMeta(k);
}
/** Devolve um slug livre (acrescenta -2, -3… se já existir). */
async function freeSlug(base: string, selfId = "") {
  const S = previewStore();
  const b = slugOf(base) || "previa";
  for (let n = 1; n < 50; n++) {
    const cand = n === 1 ? b : `${b.slice(0, 56)}-${n}`;
    if (ID_RE.test(cand) && (await getMeta(cand))) continue;
    const cur = (await S.get(`slug/${cand}`, { type: "text" })) as string | null;
    if (!cur || cur === selfId) return cand;
  }
  return `${b.slice(0, 45)}-${Date.now().toString(36)}`;
}
export const suggestSlug = (client: string, title: string) => slugOf([client, title].filter(Boolean).join(" "));
const summary = (m: any) => {
  const act = (m.versions || []).find((x: any) => x.v === m.active);
  return { id: m.id, slug: m.slug || m.id, title: m.title, client: m.client, quoteSlug: m.quoteSlug || "", createdAt: m.createdAt, updatedAt: m.updatedAt, active: m.active || 0,
    versions: (m.versions || []).map((x: any) => ({ v: x.v, at: x.at, note: x.note, count: x.files.length, size: x.files.reduce((t: number, f: any) => t + f.size, 0), entry: x.entry })),
    status: m.status || "aguardando", feedback: (m.feedback || []).slice(-10), expiresAt: m.expiresAt || "", views: m.views || 0, lastViewAt: m.lastViewAt || "", entry: act?.entry || "" };
};

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  const url = new URL(req.url);
  const { id } = context.params;
  const S = previewStore();

  if (!id) {
    if (req.method === "GET") {
      const { blobs } = await S.list({ prefix: "meta/" });
      const all = (await Promise.all(blobs.map((b) => S.get(b.key, { type: "json" })))).filter(Boolean) as any[];
      return json(all.map(summary).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)));
    }
    if (req.method === "POST") {
      const b = await req.json().catch(() => null);
      const title = str(b?.title, 120);
      if (!title) return fail("Dê um nome para a prévia");
      const quoteSlug = str(b?.quoteSlug, 60);
      if (quoteSlug && !(await getQuote(quoteSlug))) return fail("Proposta não encontrada");
      const nid = shortCode(10);
      const at = new Date().toISOString();
      const client = str(b?.client, 120);
      const wanted = slugOf(b?.slug || "");
      if (b?.slug && (!wanted || !SLUG_OK.test(wanted) || wanted.length < 3)) return fail("Use de 3 a 60 letras, números ou hífens no link");
      const slug = await freeSlug(wanted || suggestSlug(client, title), nid);
      const m = { id: nid, slug, slugs: [slug], title, client, quoteSlug, createdAt: at, updatedAt: at, active: 0, versions: [], status: "aguardando", feedback: [] };
      await S.setJSON(`meta/${nid}`, m);
      await S.set(`slug/${slug}`, nid);
      return json(summary(m), 201);
    }
    return fail("Método não permitido", 405);
  }

  const m = await getMeta(id);
  if (!m) return fail("Prévia não encontrada", 404);

  if (url.pathname.endsWith("/files")) {
    if (req.method !== "PUT") return fail("Método não permitido", 405);
    const v = Number(url.searchParams.get("v"));
    const path = cleanPath(url.searchParams.get("path") || "");
    if (!Number.isInteger(v) || v < 1 || v > 999 || !path) return fail("Caminho inválido");
    if ((m.versions || []).some((x: any) => x.v === v)) return fail("Essa versão já foi publicada. Envie como nova versão.", 409);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return fail("Arquivo vazio");
    if (buf.byteLength > FILE_MAX) return fail("Arquivo acima de 4,4 MB", 413);
    await S.set(fileKey(id, v, path), buf, { metadata: { type: (req.headers.get("content-type") || "application/octet-stream").slice(0, 100) } });
    return json({ ok: true, path, size: buf.byteLength });
  }

  if (url.pathname.endsWith("/publish")) {
    if (req.method !== "POST") return fail("Método não permitido", 405);
    const b = await req.json().catch(() => null);
    const v = Number(b?.v);
    const files = (Array.isArray(b?.files) ? b.files : []).slice(0, 2000).map((f: any) => ({ path: cleanPath(f.path), size: Number(f.size) || 0, type: str(f.type, 100) })).filter((f: any) => f.path);
    if (!Number.isInteger(v) || !files.length) return fail("Nada para publicar");
    const entry = cleanPath(b?.entry || "") || (files.find((f: any) => /(^|\/)index\.html?$/i.test(f.path))?.path ?? files.find((f: any) => /\.html?$/i.test(f.path))?.path ?? "");
    if (!entry) return fail("Não achei um arquivo index.html no pacote");
    // confere que todos os arquivos chegaram
    for (const f of files) if (!(await S.getMetadata(fileKey(id, v, f.path)))) return fail(`O arquivo ${f.path} não chegou. Envie de novo.`, 409);
    const at = new Date().toISOString();
    const next = { ...m, versions: [...(m.versions || []), { v, at, note: str(b?.note, 300), entry, files }], active: v, status: "aguardando", updatedAt: at };
    await S.setJSON(`meta/${id}`, next);
    if (m.quoteSlug) await addEvent(m.quoteSlug, { type: "previa", message: `Prévia «${m.title}» v${v} publicada` });
    return json(summary(next));
  }

  if (req.method === "GET") return json(summary(m));
  if (req.method === "PATCH") {
    const b = await req.json().catch(() => ({}));
    const next = { ...m, updatedAt: new Date().toISOString() };
    if (b.title !== undefined) next.title = str(b.title, 120) || m.title;
    if (b.client !== undefined) next.client = str(b.client, 120);
    if (b.quoteSlug !== undefined) { const qs = str(b.quoteSlug, 60); if (qs && !(await getQuote(qs))) return fail("Proposta não encontrada"); next.quoteSlug = qs; }
    if (b.active !== undefined) { if (!(m.versions || []).some((x: any) => x.v === Number(b.active))) return fail("Versão inexistente"); next.active = Number(b.active); }
    if (b.slug !== undefined && slugOf(b.slug) !== (m.slug || "")) {
      const want = slugOf(b.slug);
      if (!SLUG_OK.test(want) || want.length < 3) return fail("Use de 3 a 60 letras, números ou hífens no link");
      const cur = (await S.get(`slug/${want}`, { type: "text" })) as string | null;
      if ((cur && cur !== id) || (ID_RE.test(want) && want !== id && (await getMeta(want)))) return fail("Esse link já está em uso por outra prévia. Escolha outro.");
      await S.set(`slug/${want}`, id);
      next.slug = want; next.slugs = [...new Set([...(m.slugs || []), want])]; // links antigos continuam funcionando
    }
    if (b.expiresAt !== undefined) next.expiresAt = str(b.expiresAt, 20);
    if (b.status !== undefined && ["aguardando", "aprovado", "ajustes"].includes(b.status)) next.status = b.status;
    await S.setJSON(`meta/${id}`, next);
    return json(summary(next));
  }
  if (req.method === "DELETE") {
    const { blobs } = await S.list({ prefix: `file/${id}/` });
    await Promise.all(blobs.map((x) => S.delete(x.key)));
    for (const sl of new Set([...(m.slugs || []), m.slug].filter(Boolean))) if (((await S.get(`slug/${sl}`, { type: "text" })) as string | null) === id) await S.delete(`slug/${sl}`);
    await S.delete(`meta/${id}`);
    return json({ ok: true });
  }
  return fail("Método não permitido", 405);
};

export const config: Config = { path: ["/api/previews", "/api/previews/:id", "/api/previews/:id/files", "/api/previews/:id/publish"] };

// Modo revisão do site: o admin marca qualquer elemento da página publicada, escreve o que mudar
// e anexa arquivos substitutos. Leitura também liberada por chave (REVIEW_KEY) para aplicar as mudanças.
import type { Config, Context } from "@netlify/functions";
import { fail, isAdmin, json, shortCode, store } from "../lib/core.mts";

const notes = () => store("review");
const blobs = () => store("review-files");
const ID = /^[a-z0-9]{6,16}$/;
const str = (v: any, n: number) => String(v ?? "").slice(0, n);
const MAX = 5.5 * 1024 * 1024;

function clean(b: any, prev: any = {}) {
  return {
    ...prev,
    page: str(b.page ?? prev.page, 200), title: str(b.title ?? prev.title, 160),
    sel: str(b.sel ?? prev.sel, 600), label: str(b.label ?? prev.label, 300), kind: str(b.kind ?? prev.kind, 30),
    src: str(b.src ?? prev.src, 400), tags: (Array.isArray(b.tags) ? b.tags : prev.tags || []).map((t: any) => str(t, 40)).slice(0, 8),
    text: str(b.text ?? prev.text, 4000), link: str(b.link ?? prev.link, 600),
    vw: Number(b.vw ?? prev.vw) || 0, y: Number(b.y ?? prev.y) || 0,
    status: ["aberta", "feita"].includes(b.status) ? b.status : prev.status || "aberta",
  };
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const key = Netlify.env.get("REVIEW_KEY");
  const admin = await isAdmin(context);
  const reader = admin || (!!key && key.length >= 24 && (url.searchParams.get("k") === key || req.headers.get("x-review-key") === key));
  const { id, fid } = context.params;
  const isFile = url.pathname.includes("/files");

  if (req.method === "GET") {
    if (!reader) return fail("Faça login", 401);
    if (isFile && id && fid) {
      const r = await blobs().getWithMetadata(`${id}/${fid}`, { type: "arrayBuffer" });
      if (!r) return fail("Arquivo não encontrado", 404);
      const m: any = r.metadata || {};
      return new Response(r.data as ArrayBuffer, { headers: { "content-type": m.type || "application/octet-stream", "content-disposition": `inline; filename="${encodeURIComponent(m.name || fid)}"`, "cache-control": "private, max-age=3600" } });
    }
    const { blobs: list } = await notes().list();
    const all = (await Promise.all(list.map((b) => notes().get(b.key, { type: "json" })))).filter(Boolean) as any[];
    const page = url.searchParams.get("page");
    return json(all.filter((n) => !page || n.page === page).sort((a, b) => (a.at < b.at ? -1 : 1)));
  }
  if (!admin) return fail("Faça login", 401);

  if (req.method === "POST" && !id) {
    const b = await req.json().catch(() => null);
    if (!b?.page || !(b.text || b.tags?.length)) return fail("Escreva o que mudar");
    const nid = Date.now().toString(36) + shortCode(4);
    const n = { ...clean(b), id: nid, files: [], at: new Date().toISOString() };
    await notes().setJSON(nid, n);
    return json(n, 201);
  }
  if (!id || !ID.test(id)) return fail("Nota não encontrada", 404);
  const n: any = await notes().get(id, { type: "json" });
  if (!n) return fail("Nota não encontrada", 404);

  if (req.method === "POST" && isFile) {
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return fail("Arquivo vazio");
    if (buf.byteLength > MAX) return fail("Arquivo acima de 5,5 MB. Cole um link do Drive no campo de link.", 413);
    if ((n.files || []).length >= 10) return fail("Máximo de 10 arquivos por nota");
    const f = { id: shortCode(8), name: decodeURIComponent(req.headers.get("x-name") || "arquivo").slice(0, 160), type: (req.headers.get("content-type") || "application/octet-stream").slice(0, 80), size: buf.byteLength };
    await blobs().set(`${id}/${f.id}`, buf, { metadata: { name: f.name, type: f.type } });
    const next = { ...n, files: [...(n.files || []), f], updatedAt: new Date().toISOString() };
    await notes().setJSON(id, next);
    return json(next);
  }
  if (req.method === "PATCH") {
    const b = await req.json().catch(() => ({}));
    const next = { ...clean(b, n), updatedAt: new Date().toISOString() };
    await notes().setJSON(id, next);
    return json(next);
  }
  if (req.method === "DELETE") {
    if (isFile && fid) {
      await blobs().delete(`${id}/${fid}`);
      const next = { ...n, files: (n.files || []).filter((f: any) => f.id !== fid) };
      await notes().setJSON(id, next);
      return json(next);
    }
    await Promise.all((n.files || []).map((f: any) => blobs().delete(`${id}/${f.id}`)));
    await notes().delete(id);
    return json({ ok: true });
  }
  return fail("Método não permitido", 405);
};

export const config: Config = { path: ["/api/review", "/api/review/:id", "/api/review/:id/files", "/api/review/:id/files/:fid"] };

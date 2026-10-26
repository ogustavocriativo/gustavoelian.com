// Anexos: upload/remoção pelo admin; leitura pelo cliente quando o anexo está visível.
import type { Config, Context } from "@netlify/functions";
import { fail, files, getQuote, isAdmin, json, quotes, uid } from "../lib/core.mts";

const MAX = 4 * 1024 * 1024; // limite de corpo das functions (~4,5 MB)

export default async (req: Request, context: Context) => {
  const { slug, fid } = context.params;
  const q = await getQuote(slug);
  if (!q) return fail("Orçamento não encontrado", 404);
  const admin = await isAdmin(context);

  if (req.method === "GET" && fid) {
    const meta = (q.attachments || []).find((a: any) => a.id === fid);
    if (!meta) return fail("Arquivo não encontrado", 404);
    if (!admin && (!q.published || !meta.showToClient)) return fail("Arquivo não encontrado", 404);
    const data = await files().get(`${slug}/${fid}`, { type: "arrayBuffer" });
    if (!data) return fail("Arquivo não encontrado", 404);
    const download = new URL(req.url).searchParams.has("download");
    return new Response(data, { headers: {
      "content-type": meta.type || "application/octet-stream",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(meta.name)}"`,
      "cache-control": "private, max-age=300",
    } });
  }

  if (!admin) return fail("Faça login", 401);

  if (req.method === "POST" && !fid) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return fail("Envie um arquivo");
    if (file.size > MAX) return fail("Arquivo acima de 4 MB. Comprima ou envie um link.");
    const id = uid();
    await files().set(`${slug}/${id}`, await file.arrayBuffer());
    const meta = { id, name: file.name, type: file.type, size: file.size, showToClient: true, uploadedAt: new Date().toISOString() };
    const next = { ...q, attachments: [...(q.attachments || []), meta], updatedAt: new Date().toISOString() };
    await quotes().setJSON(`quotes/${slug}`, next);
    return json(meta, 201);
  }
  // Renomear o arquivo (o nome aparece na página do cliente e no download); a extensão original é mantida
  if (req.method === "PATCH" && fid) {
    const body = await req.json().catch(() => ({}));
    const meta = (q.attachments || []).find((a: any) => a.id === fid);
    if (!meta) return fail("Arquivo não encontrado", 404);
    const ext = (meta.name.match(/\.[A-Za-z0-9]{1,6}$/) || [""])[0];
    let name = String(body.name || "").replace(/[\/\\:*?"<>|\u0000-\u001f]/g, "").trim().slice(0, 120);
    if (!name) return fail("Informe um nome");
    if (ext && !name.toLowerCase().endsWith(ext.toLowerCase())) name += ext;
    const attachments = (q.attachments || []).map((a: any) => (a.id === fid ? { ...a, name } : a));
    await quotes().setJSON(`quotes/${slug}`, { ...q, attachments, updatedAt: new Date().toISOString() });
    return json({ ...meta, name });
  }
  if (req.method === "DELETE" && fid) {
    await files().delete(`${slug}/${fid}`);
    const next = { ...q, attachments: (q.attachments || []).filter((a: any) => a.id !== fid), updatedAt: new Date().toISOString() };
    await quotes().setJSON(`quotes/${slug}`, next);
    return json({ ok: true });
  }
  return fail("Método não permitido", 405);
};

export const config: Config = { path: ["/api/quotes/:slug/files", "/api/quotes/:slug/files/:fid"] };

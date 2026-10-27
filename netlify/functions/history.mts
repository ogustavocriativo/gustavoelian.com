// Clientes e contratos anteriores ao sistema. Ficam fora dos totais atuais (Contratos, Financeiro, Início),
// mas guardam valor, datas e recebimentos para o painel financeiro histórico.
//   GET/POST /api/historico          · GET/PUT/DELETE /api/historico/:id
//   POST /api/historico/:id/arquivo  · GET/DELETE /api/historico/:id/arquivo/:fid
import type { Config, Context } from "@netlify/functions";
import { fail, isAdmin, json, shortCode, store } from "../lib/core.mts";

const recs = () => store("history");
const files = () => store("history-files");
const ID = /^[a-z0-9]{8,24}$/;
const MAX = 4 * 1024 * 1024;
const str = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const num = (v: any) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0; };
const day = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
const METHODS = ["pix", "cartao", "transferencia", "dinheiro", "boleto", "outro"];

function clean(b: any, prev: any = {}) {
  const c = b.client || {};
  return {
    ...prev,
    kind: b.kind === "cliente" ? "cliente" : "contrato", // "cliente": só o cadastro, sem contrato
    client: { name: str(c.name, 120), company: str(c.company, 120), doc: str(c.doc, 30), email: str(c.email, 160), phone: str(c.phone, 40), city: str(c.city, 80) },
    title: str(b.title, 200), category: str(b.category, 40),
    value: num(b.value), start: day(b.start), end: day(b.end),
    status: ["concluido", "cancelado", "andamento"].includes(b.status) ? b.status : "concluido",
    payments: (Array.isArray(b.payments) ? b.payments : []).slice(0, 60).map((p: any) => ({ date: day(p?.date), amount: num(p?.amount), method: METHODS.includes(p?.method) ? p.method : "outro", note: str(p?.note, 120) })).filter((p: any) => p.amount > 0),
    notes: str(b.notes, 4000), source: str(b.source, 60),
    files: prev.files || [],
  };
}

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  const url = new URL(req.url);
  const { id, fid } = context.params;
  const isFile = url.pathname.includes("/arquivo");

  if (!id) {
    if (req.method === "GET") {
      const { blobs } = await recs().list();
      const all = (await Promise.all(blobs.map((b) => recs().get(b.key, { type: "json" })))).filter(Boolean) as any[];
      return json(all.sort((a, b) => ((a.start || a.createdAt) < (b.start || b.createdAt) ? 1 : -1)));
    }
    if (req.method === "POST") {
      const b = await req.json().catch(() => null);
      if (!b?.client?.name?.trim()) return fail("Informe o nome do cliente");
      const nid = Date.now().toString(36) + shortCode(5);
      const r = { ...clean(b), id: nid, createdAt: new Date().toISOString() };
      await recs().setJSON(nid, r);
      return json(r, 201);
    }
    return fail("Método não permitido", 405);
  }
  if (!ID.test(id)) return fail("Registro não encontrado", 404);
  const r: any = await recs().get(id, { type: "json" });
  if (!r) return fail("Registro não encontrado", 404);

  if (isFile) {
    if (req.method === "GET" && fid) {
      const f = (r.files || []).find((x: any) => x.id === fid);
      const data = f && (await files().get(`${id}/${fid}`, { type: "arrayBuffer" }));
      if (!data) return fail("Arquivo não encontrado", 404);
      return new Response(data as ArrayBuffer, { headers: { "content-type": f.type || "application/octet-stream", "content-disposition": `inline; filename="${encodeURIComponent(f.name)}"`, "cache-control": "private, max-age=300" } });
    }
    if (req.method === "POST" && !fid) {
      const form = await req.formData().catch(() => null);
      const file = form?.get("file") as File | null;
      if (!file) return fail("Envie um arquivo");
      if (file.size > MAX) return fail("Arquivo acima de 4 MB. Comprima o PDF ou envie um link nas anotações.");
      if ((r.files || []).length >= 10) return fail("Máximo de 10 arquivos por registro");
      const f = { id: shortCode(8), name: file.name.slice(0, 160), type: file.type || "application/octet-stream", size: file.size, at: new Date().toISOString() };
      await files().set(`${id}/${f.id}`, await file.arrayBuffer());
      const next = { ...r, files: [...(r.files || []), f], updatedAt: f.at };
      await recs().setJSON(id, next);
      return json(next);
    }
    if (req.method === "DELETE" && fid) {
      await files().delete(`${id}/${fid}`);
      const next = { ...r, files: (r.files || []).filter((x: any) => x.id !== fid) };
      await recs().setJSON(id, next);
      return json(next);
    }
    return fail("Método não permitido", 405);
  }
  if (req.method === "GET") return json(r);
  if (req.method === "PUT") {
    const b = await req.json().catch(() => null);
    if (!b?.client?.name?.trim()) return fail("Informe o nome do cliente");
    const next = { ...clean(b, r), id, createdAt: r.createdAt, updatedAt: new Date().toISOString() };
    await recs().setJSON(id, next);
    return json(next);
  }
  if (req.method === "DELETE") {
    await Promise.all((r.files || []).map((f: any) => files().delete(`${id}/${f.id}`)));
    await recs().delete(id);
    return json({ ok: true });
  }
  return fail("Método não permitido", 405);
};

export const config: Config = { path: ["/api/historico", "/api/historico/:id", "/api/historico/:id/arquivo", "/api/historico/:id/arquivo/:fid"] };

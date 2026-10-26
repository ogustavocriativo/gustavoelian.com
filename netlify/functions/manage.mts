// Gestão (admin): catálogo de serviços, etapas do contrato e registro de pagamentos.
import type { Config, Context } from "@netlify/functions";
import { addEvent, fail, getQuote, getState, isAdmin, json, patchState, settingsStore, uid } from "../lib/core.mts";

const str = (v: any, max = 400) => String(v ?? "").trim().slice(0, max);
const money = (v: any) => {
  if (typeof v === "number") return Math.round(v * 100) / 100;
  const t = String(v ?? "").replace(/[^\d,.-]/g, "");
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const STAGES = ["aprovado", "producao", "revisao", "entregue", "concluido"];
const METHODS = ["pix", "cartao", "transferencia", "dinheiro", "boleto", "outro"];

/* Recalcula total pago e marca/desmarca quitação. */
async function settle(slug: string, payments: any[], st: any) {
  const paidTotal = Math.round(payments.reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100;
  const total = Number(st.total || 0);
  const patch: any = { payments, paidTotal };
  const quitado = total > 0 && paidTotal >= total - 0.009;
  if (quitado && !st.paidAt) patch.paidAt = new Date().toISOString();
  if (!quitado && st.paidAt && st.payment?.method !== "stripe") patch.paidAt = null;
  return patchState(slug, patch);
}

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  const path = new URL(req.url).pathname;

  /* ---------- Catálogo de serviços ---------- */
  if (path === "/api/catalog") {
    if (req.method === "GET") {
      const c: any = (await settingsStore().get("catalog", { type: "json" })) || { services: [] };
      return json(c);
    }
    if (req.method === "PUT") {
      const body = await req.json().catch(() => null);
      if (!body || !Array.isArray(body.services)) return fail("Dados inválidos");
      const services = body.services.slice(0, 200).map((s: any) => ({
        id: str(s.id, 30) || uid(),
        title: str(s.title, 160),
        category: str(s.category, 40),
        description: str(s.description, 1000),
        deliverables: (Array.isArray(s.deliverables) ? s.deliverables : String(s.deliverables || "").split("\n"))
          .map((d: any) => str(d, 200)).filter(Boolean).slice(0, 20),
        price: money(s.price),
        deadline: str(s.deadline, 80),
        active: s.active !== false,
      })).filter((s: any) => s.title);
      await settingsStore().setJSON("catalog", { services, updatedAt: new Date().toISOString() });
      return json({ services });
    }
    return fail("Método não permitido", 405);
  }

  const { slug, pid } = context.params;
  const q = await getQuote(slug);
  if (!q) return fail("Orçamento não encontrado", 404);
  const st = await getState(slug);

  /* ---------- Etapa do trabalho (contrato) ---------- */
  if (path.endsWith("/work")) {
    if (req.method !== "PUT") return fail("Método não permitido", 405);
    if (!st.approvedAt) return fail("O contrato só existe depois da aprovação", 409);
    const body = await req.json().catch(() => ({}));
    const work = { ...(st.work || {}) };
    if (body.stage !== undefined) {
      if (!STAGES.includes(body.stage)) return fail("Etapa inválida");
      if (body.stage !== work.stage) {
        work.history = [...(work.history || []), { stage: body.stage, at: new Date().toISOString() }].slice(-30);
        await addEvent(slug, { type: "stage", stage: body.stage });
      }
      work.stage = body.stage;
    }
    if (body.dueDate !== undefined) work.dueDate = str(body.dueDate, 20);
    if (body.notes !== undefined) work.notes = str(body.notes, 4000);
    return json(await patchState(slug, { work }));
  }

  /* ---------- Pagamentos recebidos ---------- */
  if (path.includes("/ledger")) {
    const payments = [...(st.payments || [])];
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const amount = money(body?.amount);
      if (!body || amount <= 0) return fail("Informe um valor maior que zero");
      const p = {
        id: uid(),
        amount,
        date: str(body.date, 20) || new Date().toISOString().slice(0, 10),
        method: METHODS.includes(body.method) ? body.method : "pix",
        note: str(body.note, 300),
        receiptId: str(body.receiptId, 40) || null,
        at: new Date().toISOString(),
      };
      payments.push(p);
      const next = await settle(slug, payments, st);
      await addEvent(slug, { type: "payment", total: amount, method: p.method });
      if (body.receiptId && st.paymentNotice?.fileId === body.receiptId) await patchState(slug, { paymentNotice: { ...st.paymentNotice, confirmedAt: p.at } });
      return json(next, 201);
    }
    if (req.method === "DELETE" && pid) {
      const rest = payments.filter((p) => p.id !== pid);
      if (rest.length === payments.length) return fail("Pagamento não encontrado", 404);
      return json(await settle(slug, rest, st));
    }
    return fail("Método não permitido", 405);
  }

  return fail("Rota desconhecida", 404);
};

export const config: Config = {
  path: ["/api/catalog", "/api/quotes/:slug/work", "/api/quotes/:slug/ledger", "/api/quotes/:slug/ledger/:pid"],
};

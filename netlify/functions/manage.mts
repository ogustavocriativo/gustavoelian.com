// Gestão (admin): catálogo de serviços, etapas do contrato e registro de pagamentos.
import type { Config, Context } from "@netlify/functions";
import { addEvent, brl, fail, getQuote, getSettings, getState, isAdmin, json, patchState, priceOf, settingsStore, sha256, uid } from "../lib/core.mts";
import { callGoogle, googleReady } from "../lib/google.mts";

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

  /* ---------- Condições de pagamento combinadas depois da assinatura (aditivo) ----------
     O texto assinado nunca é reescrito: cada mudança vira um aditivo com data, motivo, canal combinado e código de integridade
     encadeado ao do contrato. O contrato em PDF passa a listar os aditivos. */
  if (path.endsWith("/terms")) {
    if (req.method !== "PUT") return fail("Método não permitido", 405);
    if (!st.approvedAt) return fail("As condições só mudam depois da aprovação", 409);
    const b = await req.json().catch(() => null);
    if (!b) return fail("Dados inválidos");
    const settings = await getSettings();
    const method = ["avista", "cartao", "parcelas"].includes(b.method) ? b.method : "avista";
    const total = money(b.total);
    if (total <= 0) return fail("Informe o valor total");
    const channel = ["whatsapp", "email", "presencial", "telefone", "outro"].includes(b.channel) ? b.channel : "whatsapp";
    const reason = str(b.reason, 400);
    if (reason.length < 5) return fail("Escreva em uma linha o que foi combinado");
    let text = "", terms: any = { method, total };
    if (method === "avista") {
      const pct = Math.min(100, Math.max(0, Number(b.entryPct ?? settings.payments.entryPct ?? 60)));
      const entry = Math.round(total * pct) / 100;
      terms.entryPct = pct;
      text = pct >= 100 ? `à vista, ${brl(total)}, em parcela única` : `à vista, ${brl(total)}: entrada de ${pct}% (${brl(entry)}) e ${100 - pct}% (${brl(total - entry)}) na entrega final e aprovação`;
    } else if (method === "cartao") {
      const n = Math.min(12, Math.max(1, Number(b.installments) || 1));
      terms.installments = n;
      text = `cartão de crédito, ${brl(total)} em até ${n}x de ${brl(total / n)}`;
    } else {
      const parcels = (Array.isArray(b.parcels) ? b.parcels : []).slice(0, 24).map((p: any) => ({ label: str(p.label, 60) || "Parcela", amount: money(p.amount), due: str(p.due, 20) })).filter((p: any) => p.amount > 0);
      if (!parcels.length) return fail("Informe ao menos uma parcela com valor");
      const sum = Math.round(parcels.reduce((t: number, p: any) => t + p.amount, 0) * 100) / 100;
      if (Math.abs(sum - total) > 0.011) return fail(`As parcelas somam ${brl(sum)}, diferente do total ${brl(total)}`);
      terms.parcels = parcels;
      text = `${brl(total)} em ${parcels.length} parcela(s): ` + parcels.map((p: any) => `${p.label} ${brl(p.amount)}${p.due ? " em " + p.due.split("-").reverse().join("/") : ""}`).join("; ");
    }
    const amendments = [...(st.amendments || [])];
    const prev = { total: Number(st.total || 0), text: st.paymentText || "" };
    const at = new Date().toISOString();
    const core = { n: amendments.length + 1, at, channel, reason, prev, next: { total, text }, prevHash: amendments.length ? amendments[amendments.length - 1].hash : st.contractHash || "" };
    const amend = { ...core, id: uid(), hash: await sha256(JSON.stringify(core)) };
    amendments.push(amend);
    const next = await settle(slug, st.payments || [], { ...st, total });
    await patchState(slug, { total, paymentText: text, terms: { ...terms, at }, amendments });
    await addEvent(slug, { type: "terms", total, text: text.slice(0, 160), channel });
    // cópia do aditivo na pasta do cliente no Drive (se a ponte estiver ligada e atualizada)
    let drive: any = null;
    if (googleReady()) {
      drive = await callGoogle("amendment", { client: q.client?.company || q.client?.name || slug, n: amend.n, at: new Date(at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), channel, reason, prev, next: amend.next, hash: amend.hash, contractHash: st.contractHash || "", signer: st.signer || {}, link: `${new URL(req.url).origin}/${slug}` }, 45000);
      if (drive?.ok) await patchState(slug, { amendments: amendments.map((a) => (a.id === amend.id ? { ...a, driveUrl: drive.pdfUrl } : a)) });
    }
    return json({ ...(await getState(slug)), driveSaved: !!drive?.ok, driveError: drive && !drive.ok ? String(drive.error || "") : "" });
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
        receiptId: (q.attachments || []).some((a: any) => a.id === str(body.receiptId, 40)) ? str(body.receiptId, 40) : null,
        at: new Date().toISOString(),
      };
      payments.push(p);
      const next = await settle(slug, payments, st);
      await addEvent(slug, { type: "payment", total: amount, method: p.method });
      if (body.receiptId && st.paymentNotice?.fileId === body.receiptId) await patchState(slug, { paymentNotice: { ...st.paymentNotice, confirmedAt: p.at } });
      return json(next, 201);
    }
    if (req.method === "PATCH" && pid) {
      const body = await req.json().catch(() => ({}));
      const cur = payments.find((p) => p.id === pid);
      if (!cur) return fail("Pagamento não encontrado", 404);
      const upd = { ...cur };
      if (body.amount !== undefined) { const a = money(body.amount); if (a <= 0) return fail("Informe um valor maior que zero"); upd.amount = a; }
      if (body.date !== undefined) upd.date = str(body.date, 20) || cur.date;
      if (body.method !== undefined && METHODS.includes(body.method)) upd.method = body.method;
      if (body.note !== undefined) upd.note = str(body.note, 300);
      if (body.receiptId !== undefined) upd.receiptId = (q.attachments || []).some((a: any) => a.id === body.receiptId) ? body.receiptId : null;
      upd.editedAt = new Date().toISOString();
      const next = await settle(slug, payments.map((p) => (p.id === pid ? upd : p)), st);
      await addEvent(slug, { type: "payment-edit", total: upd.amount, method: upd.method });
      return json(next);
    }
    if (req.method === "DELETE" && pid) {
      const gone = payments.find((p) => p.id === pid);
      const rest = payments.filter((p) => p.id !== pid);
      if (!gone) return fail("Pagamento não encontrado", 404);
      const next = await settle(slug, rest, st);
      await addEvent(slug, { type: "payment-delete", total: gone.amount, method: gone.method });
      return json(next);
    }
    return fail("Método não permitido", 405);
  }

  return fail("Rota desconhecida", 404);
};

export const config: Config = {
  path: ["/api/catalog", "/api/quotes/:slug/work", "/api/quotes/:slug/terms", "/api/quotes/:slug/ledger", "/api/quotes/:slug/ledger/:pid"],
};

// Cobranças avulsas por link (gustavoelian.com/pagar/<id>): o admin define valor e cliente no Studio,
// envia o link pelo WhatsApp e o cliente escolhe Pix ou cartão na página pública.
import type { Config, Context } from "@netlify/functions";
import QRCode from "qrcode";
import { brl, fail, getSettings, isAdmin, json, shortCode } from "../lib/core.mts";
import { cardAmountOf, charges, markChargePaid, round2 } from "../lib/charges.mts";
import { pixPayload } from "./pay.mts";

const ID_RE = /^[a-z0-9]{6,12}$/;
const str = (v: any, max: number) => String(v ?? "").trim().slice(0, max);

// versão pública: só o necessário para pagar
const pub = (c: any, s: any) => ({
  id: c.id, amount: c.amount, amountLabel: brl(c.amount), cardAmount: cardAmountOf(c), cardAmountLabel: brl(cardAmountOf(c)), cardFeePct: Number(c.cardFeePct || 0),
  installments: c.installments || 1, desc: c.desc, name: c.name, status: c.status, paidAt: c.paidAt || null, noticeAt: c.noticeAt || null,
  issuer: s.issuer?.name || "Gustavo Elian", pix: !!s.pix?.key, card: !!Netlify.env.get("STRIPE_SECRET_KEY"),
});

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const id = context.params.id || "";
  const action = context.params.action || "";
  const isPublic = url.pathname.startsWith("/api/pagar/");

  /* ---------- público ---------- */
  if (isPublic) {
    if (!ID_RE.test(id)) return fail("Cobrança não encontrada", 404);
    const c: any = await charges().get(id, { type: "json" });
    if (!c || c.status === "cancelada") return fail("Cobrança não encontrada", 404);
    const s = await getSettings();
    if (!action && req.method === "GET") {
      if (!c.openedAt) await charges().setJSON(id, { ...c, openedAt: new Date().toISOString() });
      return json(pub(c, s));
    }
    if (c.status === "paga") return fail("Esta cobrança já foi paga", 409);
    if (action === "pix") {
      if (!s.pix?.key) return fail("Pix ainda não configurado", 404);
      const payload = pixPayload(s.pix.key, s.pix.merchantName, s.pix.merchantCity, Number(c.amount), `GE${id}`);
      const svg = await QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      return json({ payload, svg, amountLabel: brl(c.amount) });
    }
    if (action === "aviso" && req.method === "POST") {
      await charges().setJSON(id, { ...c, noticeAt: new Date().toISOString() });
      return json({ ok: true });
    }
    if (action === "checkout" && req.method === "POST") {
      const key = Netlify.env.get("STRIPE_SECRET_KEY");
      if (!key) return fail("Pagamento com cartão ainda não configurado", 404);
      const amount = cardAmountOf(c);
      const form = new URLSearchParams({
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "brl",
        "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
        "line_items[0][price_data][product_data][name]": (c.desc || `Pagamento para ${s.issuer?.name || "Gustavo Elian"}`).slice(0, 250),
        success_url: `${url.origin}/pagar/${id}?pagamento=ok`,
        cancel_url: `${url.origin}/pagar/${id}?pagamento=cancelado`,
        "metadata[charge]": id,
        locale: "pt-BR",
      });
      if ((c.installments || 1) > 1) form.set("payment_method_options[card][installments][enabled]", "true");
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" }, body: form });
      const data = await r.json();
      if (!r.ok) return fail(data?.error?.message || "Não foi possível iniciar o pagamento", 502);
      return json({ url: data.url });
    }
    return fail("Ação desconhecida", 404);
  }

  /* ---------- admin ---------- */
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  if (!id) {
    if (req.method === "GET") {
      const { blobs } = await charges().list();
      const list = (await Promise.all(blobs.map((b) => charges().get(b.key, { type: "json" })))).filter(Boolean) as any[];
      return json(list.filter((c) => c.status !== "cancelada").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
    }
    if (req.method === "POST") {
      const b = await req.json().catch(() => null);
      const amount = round2(Number(b?.amount));
      if (!(amount >= 1 && amount <= 500000)) return fail("Informe um valor entre R$ 1 e R$ 500 mil");
      const name = str(b?.name, 120);
      if (!name) return fail("Informe para quem é a cobrança");
      let nid = "";
      for (let i = 0; i < 5; i++) { const cand = shortCode(7); if (!(await charges().getMetadata(cand))) { nid = cand; break; } }
      const c = {
        id: nid, amount, name, phone: str(b?.phone, 30).replace(/\D/g, ""), desc: str(b?.desc, 160),
        slug: /^[a-z0-9-]{3,60}$/.test(b?.slug || "") ? b.slug : "",
        cardFeePct: Math.max(0, Math.min(15, Number(b?.cardFeePct) || 0)), installments: Math.max(1, Math.min(12, Number(b?.installments) || 1)),
        status: "aberta", createdAt: new Date().toISOString(),
      };
      await charges().setJSON(nid, c);
      return json(c, 201);
    }
    return fail("Método não permitido", 405);
  }
  if (!ID_RE.test(id)) return fail("Cobrança não encontrada", 404);
  const c: any = await charges().get(id, { type: "json" });
  if (!c) return fail("Cobrança não encontrada", 404);
  if (req.method === "GET") return json(c);
  if (req.method === "PATCH") {
    const b = await req.json().catch(() => ({}));
    if (b.status === "paga") {
      const method = ["pix", "cartao", "transferencia", "dinheiro", "outro"].includes(b.method) ? b.method : "pix";
      return json(await markChargePaid(id, { amount: method === "cartao" ? cardAmountOf(c) : Number(c.amount), method, note: str(b.note, 120) || "Confirmado no Studio" }));
    }
    if (b.status === "cancelada") { const n = { ...c, status: "cancelada", canceledAt: new Date().toISOString() }; await charges().setJSON(id, n); return json(n); }
    return fail("Alteração inválida");
  }
  return fail("Método não permitido", 405);
};

export const config: Config = { path: ["/api/charges", "/api/charges/:id", "/api/pagar/:id", "/api/pagar/:id/:action"] };

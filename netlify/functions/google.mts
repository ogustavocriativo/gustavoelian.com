// Ações do Studio que passam pelo Google: testar a ligação, enviar a proposta por e-mail, gerar o contrato no Drive de novo.
import type { Config, Context } from "@netlify/functions";
import { addEvent, fail, getQuote, getState, isAdmin, json } from "../lib/core.mts";
import { sendMail, callGoogle, esc, firstName, googleReady, sendContractToDrive } from "../lib/google.mts";
import { mails } from "../lib/mails.mts";

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  const url = new URL(req.url);
  if (url.pathname === "/api/google/status") {
    if (!googleReady()) return json({ ready: false });
    const r = await callGoogle("ping", {}, 15000);
    return json({ ready: true, ok: !!r?.ok, user: r?.user || "", error: r?.ok ? "" : r?.error });
  }
  if (req.method !== "POST") return fail("Método não permitido", 405);
  const { slug, action } = context.params;
  const q = await getQuote(slug);
  if (!q) return fail("Proposta não encontrada", 404);

  if (action === "email") {
    if (!q.published) return fail("Ative o link da proposta antes de enviar");
    const to = String(q.client?.email || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return fail("Cadastre o e-mail do cliente na proposta");
    const link = `${url.origin}/${slug}`;
    const r = await sendMail(to, mails.proposta({ name: q.client?.name, title: q.title, company: q.client?.company, link }));
    if (!r?.ok) return fail(r?.error || "Não foi possível enviar", 502);
    await addEvent(slug, { type: "email-sent", to });
    return json({ ok: true, to });
  }
  if (action === "drive") {
    const st = await getState(slug);
    if (!st.approvedAt) return fail("A proposta ainda não foi aprovada");
    const r = await sendContractToDrive(slug, q, st, url.origin);
    if (!r?.ok) return fail(r?.error || "Não foi possível gerar o contrato", 502);
    return json({ ok: true, ...r });
  }
  return fail("Ação desconhecida", 404);
};

export const config: Config = { path: ["/api/google/status", "/api/quotes/:slug/google/:action"] };

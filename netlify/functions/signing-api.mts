// Studio: assinatura pelo Google
//   POST /api/quotes/:slug/assinatura  { acao: "verificar" | "preparar" }
import type { Config, Context } from "@netlify/functions";
import { fail, getState, isAdmin, json } from "../lib/core.mts";
import { checkGoogleSignatures, prepareGoogleSigning } from "../lib/signing.mts";

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  if (req.method !== "POST") return fail("Método não permitido", 405);
  const { slug } = context.params;
  const st: any = await getState(slug);
  if (!st.approvedAt) return fail("A proposta ainda não foi aprovada", 409);
  const b: any = await req.json().catch(() => ({}));
  if (b.acao === "preparar") {
    await prepareGoogleSigning(slug, new URL(req.url).origin);
    return json({ ok: true, state: await getState(slug) });
  }
  const r = await checkGoogleSignatures(slug);
  if (r.error) return fail(r.error, 502);
  return json({ ok: true, signed: r.signed.includes(slug), state: await getState(slug) });
};

export const config: Config = { path: "/api/quotes/:slug/assinatura" };

// Login do app de orçamentos (senha única em ADMIN_PASSWORD).
import type { Config, Context } from "@netlify/functions";
import { checkPassword, clearSession, createSession, fail, isAdmin, json } from "../lib/core.mts";

export default async (req: Request, context: Context) => {
  const path = new URL(req.url).pathname;
  if (path === "/api/me") return json({ admin: await isAdmin(context) });
  if (path === "/api/logout") { clearSession(context); return json({ ok: true }); }
  if (req.method !== "POST") return fail("Método não permitido", 405);
  if ((Netlify.env.get("SESSION_SECRET") || "").length < 24 || !Netlify.env.get("ADMIN_PASSWORD")) return fail("O Studio ainda não foi configurado: falta cadastrar a senha no Netlify.", 503);
  const { password } = await req.json().catch(() => ({}));
  if (!checkPassword(String(password || ""))) {
    await new Promise((r) => setTimeout(r, 600)); // desacelera tentativas
    return fail("Senha incorreta", 401);
  }
  await createSession(context);
  return json({ ok: true });
};

export const config: Config = {
  path: ["/api/login", "/api/logout", "/api/me"],
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};

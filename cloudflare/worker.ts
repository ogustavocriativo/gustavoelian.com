import { RT } from "./rt";
import { prepareResvg } from "./resvg";
import { loadPdfImages } from "../netlify/lib/assets.mts";
import * as m_auth from "../netlify/functions/auth.mts";
import * as m_charges from "../netlify/functions/charges.mts";
import * as m_client from "../netlify/functions/client.mts";
import * as m_clientlogo from "../netlify/functions/clientlogo.mts";
import * as m_delivery from "../netlify/functions/delivery.mts";
import * as m_files from "../netlify/functions/files.mts";
import * as m_google from "../netlify/functions/google.mts";
import * as m_history from "../netlify/functions/history.mts";
import * as m_inbox from "../netlify/functions/inbox.mts";
import * as m_infinitepay from "../netlify/functions/infinitepay.mts";
import * as m_manage from "../netlify/functions/manage.mts";
import * as m_og from "../netlify/functions/og.mts";
import * as m_pay from "../netlify/functions/pay.mts";
import * as m_pdf from "../netlify/functions/pdf.mts";
import * as m_portfolio from "../netlify/functions/portfolio.mts";
import * as m_preview from "../netlify/functions/preview.mts";
import * as m_previews from "../netlify/functions/previews.mts";
import * as m_public from "../netlify/functions/public.mts";
import * as m_quotes from "../netlify/functions/quotes.mts";
import * as m_review from "../netlify/functions/review.mts";
import * as m_settings from "../netlify/functions/settings.mts";
import ogEdge from "../netlify/edge-functions/proposta-og.ts";
const MODS: any[] = [m_auth,m_charges,m_client,m_clientlogo,m_delivery,m_files,m_google,m_history,m_inbox,m_infinitepay,m_manage,m_og,m_pay,m_pdf,m_portfolio,m_preview,m_previews,m_public,m_quotes,m_review,m_settings];

// ---------- rotas: os mesmos caminhos do netlify (config.path) ----------
type Route = { re: RegExp; keys: string[]; score: number; mod: any };
const ROUTES: Route[] = [];
for (const m of MODS) {
  const paths = ([] as string[]).concat(m.config?.path || []);
  for (const p of paths) {
    const keys: string[] = [];
    let score = 0;
    const re = "^" + p.split("/").map((seg) => {
      if (seg === "*") { score -= 1; return "(?:/.*)?"; }
      if (seg.startsWith(":")) { keys.push(seg.slice(1)); return "/([^/]+)"; }
      if (!seg) return ""; score += 10; return "/" + seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("").replace(/^\/\(\?:\/\.\*\)\?/, "(?:/.*)?") + "/?$";
    ROUTES.push({ re: new RegExp(re), keys, score: score + keys.length, mod: m });
  }
}
// wildcard "/v/:id/*" → captura o resto sem barra dupla
ROUTES.sort((a, b) => b.score - a.score);

function parseCookies(h: string | null) {
  const out: Record<string, string> = {};
  for (const part of (h || "").split(/;\s*/)) { const i = part.indexOf("="); if (i > 0) out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1)); }
  return out;
}
function makeContext(req: Request, params: Record<string, string>, ctx: ExecutionContext, setCookies: string[]) {
  const jar = parseCookies(req.headers.get("cookie"));
  const cf: any = (req as any).cf || {};
  return {
    params, ip: req.headers.get("cf-connecting-ip") || "", geo: { city: cf.city || "", country: { code: cf.country || "" } },
    waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
    cookies: {
      get: (n: string) => jar[n],
      set: (c: any) => {
        let s = `${c.name}=${encodeURIComponent(c.value)}; Path=${c.path || "/"}`;
        if (c.expires) s += `; Expires=${new Date(c.expires).toUTCString()}`;
        if (c.maxAge != null) s += `; Max-Age=${c.maxAge}`;
        if (c.httpOnly) s += "; HttpOnly"; if (c.secure) s += "; Secure"; if (c.sameSite) s += `; SameSite=${c.sameSite}`;
        setCookies.push(s);
      },
      delete: (c: any) => { const name = typeof c === "string" ? c : c.name; setCookies.push(`${name}=; Path=${(c && c.path) || "/"}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`); },
    },
    site: { url: new URL(req.url).origin },
  };
}
const withHeaders = (res: Response, extra: Record<string, string>, cookies: string[] = []) => {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(extra)) if (!r.headers.has(k)) r.headers.set(k, v);
  for (const c of cookies) r.headers.append("set-cookie", c);
  return r;
};
const BASE_HEADERS = { "x-robots-tag": "noindex, nofollow" }; // pré-lançamento, igual ao netlify.toml

async function asset(env: any, origin: string, path: string, req: Request) {
  return env.ASSETS.fetch(new Request(origin + path, { headers: req.headers, method: "GET" }));
}

// chamadas do próprio site para si mesmo (ex.: /api/og) passam direto pelo roteador, sem sair para a rede
const netFetch = globalThis.fetch.bind(globalThis);
let SELF: { origin: string; env: any; ctx: ExecutionContext } | null = null;
globalThis.fetch = (async (input: any, init?: any) => {
  const u = new URL(typeof input === "string" ? input : input.url);
  if (SELF && u.origin === SELF.origin) return handler.fetch(new Request(input, init), SELF.env, SELF.ctx);
  return netFetch(input, init);
}) as any;

const handler = {
  async fetch(req: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    RT.env = env; RT.ctx = ctx; SELF = { origin: new URL(req.url).origin, env, ctx };
    const url = new URL(req.url);
    const path = url.pathname;
    // www → domínio principal
    if (url.hostname.startsWith("www.")) { url.hostname = url.hostname.slice(4); return Response.redirect(url.toString(), 301); }

    for (const r of ROUTES) {
      const m = r.re.exec(path);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      if (path.startsWith("/api/pdf/")) await loadPdfImages(url.origin);
      if (path.startsWith("/api/og/") || /^\/api\/previa\/[^/]+\/capa/.test(path)) await prepareResvg(url.origin);
      const setCookies: string[] = [];
      try {
        const res: Response = await r.mod.default(req, makeContext(req, params, ctx, setCookies));
        return withHeaders(res || new Response(null, { status: 204 }), BASE_HEADERS, setCookies);
      } catch (x: any) {
        console.error(path, x?.stack || x);
        return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: { "content-type": "application/json" } });
      }
    }

    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Not found", { status: 404 });
    const extra: Record<string, string> = { ...BASE_HEADERS };
    if (path.startsWith("/app/")) extra["cache-control"] = "no-cache";
    let res = await env.ASSETS.fetch(req);
    if (res.status !== 404) return withHeaders(res, extra);

    // reescritas do netlify.toml
    if (path.startsWith("/projetos/")) return withHeaders(await asset(env, url.origin, "/projeto", req), extra);
    if (path.startsWith("/pagar/")) return withHeaders(await asset(env, url.origin, "/pagar", req), extra);
    if (/\.[a-z0-9]{1,6}$/i.test(path)) return withHeaders(res, extra);
    // proposta do cliente: /<slug>, com as metatags de prévia (antiga edge function)
    const page = () => asset(env, url.origin, "/proposta", req);
    const og = await (ogEdge as any)(req, { next: page });
    return withHeaders(og || (await page()), extra);
  },
};
export default handler;

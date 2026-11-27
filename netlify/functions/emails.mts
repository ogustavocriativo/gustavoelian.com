// Galeria dos modelos de e-mail (admin): todos os disparos ao cliente, na ordem da jornada, com dados de exemplo.
//   GET /api/emails/modelos            → página com todos os modelos
//   GET /api/emails/modelos?n=3        → um modelo isolado (como chega na caixa de entrada)
import type { Config, Context } from "@netlify/functions";
import { fail, isAdmin } from "../lib/core.mts";
import { emailHtml } from "../lib/email.mts";
import { sampleMails } from "../lib/mails.mts";

const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export default async (req: Request, context: Context) => {
  if (!(await isAdmin(context))) return fail("Faça login", 401);
  const url = new URL(req.url);
  const list = sampleMails(url.origin);
  const html = (m: any) => emailHtml({ title: m.title, subject: m.subject, html: m.html, button: m.button, eyebrow: m.eyebrow });
  const n = url.searchParams.get("n");
  if (n !== null) {
    const it = list[Number(n)];
    if (!it) return fail("Modelo não encontrado", 404);
    return new Response(html(it[1]), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
  const page = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Modelos de e-mail · Studio</title>
<style>@font-face{font-family:'LT Wave';src:url(/fonts/LTWave-Regular.woff2) format('woff2');font-weight:400}@font-face{font-family:'LT Wave';src:url(/fonts/LTWave-Medium.woff2) format('woff2');font-weight:500}
body{margin:0;background:#E4E4E7;font-family:'LT Wave';color:#0E0E10}header{padding:32px 20px 8px;max-width:1280px;margin:auto}h1{font-weight:400;font-size:28px;margin:0 0 6px}p{margin:0;color:#55575E}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:24px;padding:20px;max-width:1280px;margin:auto}
section{background:#fff;border-radius:24px;overflow:hidden}section h2{font-size:14px;font-weight:500;margin:0;padding:14px 18px;border-bottom:1px solid #ECECEE}section h2 small{display:block;font-weight:400;color:#6B6E76;margin-top:4px}
iframe{width:100%;height:760px;border:0;display:block}</style></head><body>
<header><h1>Modelos de e-mail</h1><p>Todos os disparos ao cliente, na ordem da jornada. Dados de exemplo.</p></header><main>
${list.map(([name, m], i) => `<section><h2>${i + 1}. ${esc(name)}<small>Assunto: ${esc(m.subject)}</small></h2><iframe loading="lazy" src="?n=${i}" title="${esc(name)}"></iframe></section>`).join("")}
</main></body></html>`;
  return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
};

export const config: Config = { path: "/api/emails/modelos" };

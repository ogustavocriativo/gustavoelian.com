// Prévias (público): serve o projeto enviado pelo Studio em /v/<código>/ e recebe a aprovação do cliente.
//   GET  /v/:id            → redireciona para /v/:id/
//   GET  /v/:id/*          → arquivo da versão ativa (HTML ganha a barra "Aprovar / Pedir ajustes")
//   GET  /api/previa/:id/capa → imagem 1200×630 para a prévia de link (WhatsApp)
//   POST /api/previa/:id/feedback { kind: "aprovado"|"ajustes", name, message }
import type { Config, Context } from "@netlify/functions";
import { addEvent, fail, getSettings, json } from "../lib/core.mts";
import { callGoogle, esc, googleReady } from "../lib/google.mts";
import { CARD_V, hash, esc as xesc, renderCard, sniff } from "../lib/og-card.mts";
import { store } from "../lib/core.mts";
import { cleanPath, fileKey, previewStore, resolveMeta } from "./previews.mts";

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", pdf: "application/pdf", txt: "text/plain; charset=utf-8", xml: "application/xml", map: "application/json",
};
const typeOf = (p: string) => TYPES[(p.split(".").pop() || "").toLowerCase()] || "application/octet-stream";
const noindex = { "x-robots-tag": "noindex, nofollow, noarchive", "referrer-policy": "no-referrer" };

/** Reescreve caminhos que começam com "/" para dentro da prévia, para o projeto funcionar fora da raiz do domínio. */
function rewrite(html: string, base: string) {
  const fix = (u: string) => (u.startsWith("/") && !u.startsWith("//") && !u.startsWith(base) ? base + u.slice(1) : u);
  return html
    .replace(/(\s(?:href|src|action|poster|data-src|data-href)\s*=\s*)(["'])(\/[^"']*)\2/gi, (_m, a, q, u) => `${a}${q}${fix(u)}${q}`)
    .replace(/url\(\s*(["']?)(\/(?!\/)[^)"']*)\1\s*\)/gi, (_m, q, u) => `url(${q}${fix(u)}${q})`)
    .replace(/(\ssrcset\s*=\s*)(["'])([^"']*)\2/gi, (_m, a, q, v) => `${a}${q}${v.split(",").map((s: string) => { const t = s.trim(); return t.startsWith("/") ? fix(t.split(/\s+/)[0]) + t.slice(t.split(/\s+/)[0].length) : t; }).join(", ")}${q}`);
}

function bar(id: string, title: string, status: string) {
  const T = JSON.stringify(title), S = JSON.stringify(status), I = JSON.stringify(id);
  return `<script>(function(){if(window.top!==window.self&&0)return;var ID=${I},TITLE=${T},ST=${S};
var host=document.createElement('div');host.id='ge-previa';host.style.cssText='all:initial;position:fixed;left:0;right:0;bottom:0;z-index:2147483647';
var r=host.attachShadow({mode:'open'});
r.innerHTML='<style>*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}.bar{margin:0 auto;max-width:720px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#111;color:#fff;padding:10px 14px calc(10px + env(safe-area-inset-bottom));border-radius:14px 14px 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.25)}.t{font-size:13px;line-height:1.3;min-width:0;flex:1 1 180px}.t b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.t span{opacity:.7}.b{display:flex;gap:8px;flex:0 0 auto}button{font:600 14px system-ui;min-height:44px;padding:0 16px;border-radius:10px;border:1px solid #fff4;background:transparent;color:#fff;cursor:pointer}button.p{background:#fff;color:#111;border-color:#fff}button:focus-visible{outline:3px solid #7cc4ff;outline-offset:2px}.sh{position:fixed;inset:0;background:#0008;display:none;align-items:flex-end;justify-content:center}.sh.on{display:flex}.card{background:#fff;color:#111;width:100%;max-width:520px;border-radius:18px 18px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom))}h3{margin:0 0 6px;font-size:18px}p{margin:0 0 12px;font-size:14px;color:#444}label{display:block;font-size:13px;font-weight:600;margin:10px 0 4px}input,textarea{width:100%;font:16px system-ui;padding:10px 12px;border:1px solid #bbb;border-radius:10px}textarea{min-height:96px;resize:vertical}.row{display:flex;gap:8px;margin-top:14px}.row button{flex:1;border-color:#bbb;color:#111}.row button.p{background:#111;color:#fff;border-color:#111}.err{color:#b00020;font-size:13px;margin-top:8px}.t span.ok{color:#7ee2a0;opacity:1}</style><div class="bar"><div class="t"><b></b><span></span></div><div class="b"><button data-k="ajustes">Pedir ajustes</button><button class="p" data-k="aprovado">Aprovar</button></div></div><div class="sh"><div class="card" role="dialog" aria-modal="true"><h3></h3><p></p><label>Seu nome<input id="n" autocomplete="name"></label><label id="ml">Mensagem<textarea id="m"></textarea></label><div class="err" role="alert"></div><div class="row"><button data-x>Voltar</button><button class="p" data-s>Enviar</button></div></div></div>';
var q=function(s){return r.querySelector(s)};q('.t b').textContent=TITLE;
var lab={aguardando:'Aguardando a sua avaliação',aprovado:'Você aprovou esta versão',ajustes:'Ajustes enviados, obrigado!'};q('.t span').textContent=lab[ST]||lab.aguardando;
var kind='';function open(k){kind=k;q('h3').textContent=k==='aprovado'?'Aprovar esta versão':'Pedir ajustes';q('p').textContent=k==='aprovado'?'Confirmo que vi a prévia e que está de acordo.':'Conte o que precisa mudar. Pode ser em tópicos.';q('#ml').firstChild.nodeValue=k==='aprovado'?'Comentário (opcional)':'O que ajustar';q('.err').textContent='';q('.sh').classList.add('on');try{q('#n').value=localStorage.getItem('ge-prev-n')||''}catch(e){}q(k==='aprovado'?'#n':'#m').focus()}
r.querySelectorAll('[data-k]').forEach(function(b){b.onclick=function(){open(b.dataset.k)}});
q('[data-x]').onclick=function(){q('.sh').classList.remove('on')};
q('.sh').addEventListener('keydown',function(e){if(e.key==='Escape')q('.sh').classList.remove('on')});
q('[data-s]').onclick=function(){var n=q('#n').value.trim(),m=q('#m').value.trim(),e=q('.err');if(n.length<2){e.textContent='Digite o seu nome.';return}if(kind==='ajustes'&&m.length<3){e.textContent='Descreva o ajuste.';return}
var b=q('[data-s]');b.disabled=true;b.textContent='Enviando…';
fetch('/api/previa/'+ID+'/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:kind,name:n,message:m})}).then(function(x){return x.json().then(function(j){if(!x.ok)throw new Error(j.error||'Erro')})}).then(function(){try{localStorage.setItem('ge-prev-n',n)}catch(e){}q('.sh').classList.remove('on');q('.t span').textContent=lab[kind];q('.t span').className='ok'}).catch(function(x){e.textContent=x.message||'Não consegui enviar.'}).finally(function(){b.disabled=false;b.textContent='Enviar'})};
function add(){document.body.appendChild(host);document.body.style.paddingBottom='calc('+(getComputedStyle(document.body).paddingBottom||'0px')+' + 72px)'}
if(document.body)add();else document.addEventListener('DOMContentLoaded',add)})();</script>`;
}

/** Troca as metatags de compartilhamento do projeto pelas da prévia ("<Cliente>, sua prévia está pronta para aprovação"). */
function withOg(html: string, origin: string, key: string, m: any) {
  const who = m.client || "Gustavo Elian";
  const title = `${who}, sua prévia está pronta para aprovação`;
  const desc = `${m.title}. Abra o link, veja o projeto e aprove ou peça ajustes.`;
  const img = `${origin}/api/previa/${key}/capa?v=${hash(`${m.coverAt || ""}${m.logoAt || ""}${m.updatedAt || ""}${m.client}${m.title}`)}`;
  const tags = `<meta property="og:type" content="website"><meta property="og:title" content="${xesc(title)}"><meta property="og:description" content="${xesc(desc)}"><meta property="og:image" content="${xesc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${xesc(`${origin}/v/${key}/`)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${xesc(title)}"><meta name="twitter:description" content="${xesc(desc)}"><meta name="twitter:image" content="${xesc(img)}">`;
  html = html.replace(/<meta\s+[^>]*(?:property|name)\s*=\s*["'](?:og:[^"']*|twitter:[^"']*)["'][^>]*>/gi, "");
  // atenção: "<header>" também começa com "<head"; só vale a tag <head> de verdade
  const meta = `<meta charset="utf-8">` + tags;
  if (/<head(\s[^>]*)?>/i.test(html)) return html.replace(/<head(\s[^>]*)?>/i, (h) => h + meta);
  if (/<html(\s[^>]*)?>/i.test(html)) return html.replace(/<html(\s[^>]*)?>/i, (h) => h + "<head>" + meta + "</head>");
  return "<!doctype html><head>" + meta + "</head>" + html;
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const key = context.params.id;       // o que veio na URL: link amigável ou código antigo
  const m = await resolveMeta(key);
  const id = m?.id || key;

  // ---- capa para WhatsApp: a enviada pelo Studio ou, na falta dela, um cartão com a logo do cliente ----
  if (url.pathname.endsWith("/capa")) {
    if (!m) return new Response("Não encontrado", { status: 404 });
    const S = previewStore();
    const IMG = { "cache-control": "public, max-age=3600", "netlify-cdn-cache-control": "public, durable, s-maxage=31536000, immutable", "x-robots-tag": "noindex" };
    const cover = m.coverAt ? await S.get(`cover/${id}`, { type: "arrayBuffer" }) : null;
    if (cover) return new Response(cover, { headers: { "content-type": `image/${sniff(new Uint8Array(cover)) || "png"}`, ...IMG } });
    const logo = (m.logoAt ? await S.get(`logo/${id}`, { type: "arrayBuffer" }) : null) || (m.quoteSlug ? await S.get(`quote-logo/${m.quoteSlug}`, { type: "arrayBuffer" }) : null);
    const ck = `prev-${id}-${hash(`${m.client}|${m.title}|${m.logoAt || ""}|${logo ? logo.byteLength : 0}|${CARD_V}`)}.png`;
    const og = store("og-images");
    const saved = await og.get(ck, { type: "arrayBuffer" }).catch(() => null);
    if (saved) return new Response(saved as ArrayBuffer, { headers: { "content-type": "image/png", ...IMG } });
    const png = renderCard({ kicker: m.client || "Gustavo Elian", headline: "Sua prévia está pronta para aprovação.", sub: m.title, cta: "Ver e aprovar", logo });
    await og.set(ck, png).catch(() => {});
    return new Response(png, { headers: { "content-type": "image/png", ...IMG } });
  }

  // ---- retorno do cliente ----
  if (url.pathname.startsWith("/api/previa/")) {
    if (req.method !== "POST") return fail("Método não permitido", 405);
    if (!m) return fail("Prévia não encontrada", 404);
    const b = await req.json().catch(() => null);
    const kind = b?.kind === "aprovado" ? "aprovado" : b?.kind === "ajustes" ? "ajustes" : "";
    const name = String(b?.name ?? "").trim().slice(0, 80), message = String(b?.message ?? "").trim().slice(0, 2000);
    if (!kind || name.length < 2) return fail("Informe seu nome");
    if (kind === "ajustes" && message.length < 3) return fail("Descreva o ajuste");
    const at = new Date().toISOString();
    const fb = { at, kind, name, message, v: m.active, ip: context.ip || "" };
    const next = { ...m, status: kind, updatedAt: at, feedback: [...(m.feedback || []), fb].slice(-50) };
    await previewStore().setJSON(`meta/${id}`, next);
    const label = kind === "aprovado" ? "aprovou" : "pediu ajustes em";
    await addEvent(m.quoteSlug || `previa-${id}`, { type: "previa", message: `${name} ${label} a prévia «${m.title}» v${m.active}${message ? `: ${message.slice(0, 200)}` : ""}` });
    if (googleReady()) {
      context.waitUntil((async () => {
        const s = await getSettings();
        await callGoogle("email", { to: s.issuer.email, subject: `${kind === "aprovado" ? "✅ Aprovado" : "✏️ Ajustes"}: ${m.title} (v${m.active})`, title: "Retorno da prévia",
          html: `<p><b>${esc(name)}</b> ${label} <b>${esc(m.title)}</b> (v${m.active}).</p>${message ? `<blockquote>${esc(message).replace(/\n/g, "<br>")}</blockquote>` : ""}<p>Veja no Studio, em Prévias.</p>` }, 20000);
      })().catch(() => {}));
    }
    return json({ ok: true });
  }

  // ---- arquivos ----
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const gone = (msg: string, status = 404) => new Response(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${msg}</title><body style="font:16px system-ui;display:grid;place-items:center;min-height:100vh;margin:0;color:#333;text-align:center;padding:24px"><p>${msg}</p>`, { status, headers: { "content-type": "text/html; charset=utf-8", ...noindex } });
  if (!m || !m.active) return gone("Prévia não encontrada.");
  if (m.expiresAt && Date.parse(m.expiresAt + "T23:59:59") < Date.now()) return gone("Este link de prévia expirou. Peça um novo.", 410);
  const ver = (m.versions || []).find((x: any) => x.v === m.active);
  if (!ver) return gone("Prévia ainda sem arquivos.");

  const base = `/v/${key}/`;
  const rest = decodeURIComponent(url.pathname.slice(base.length - 1)).replace(/^\/+/, "");
  if (url.pathname === `/v/${key}`) return Response.redirect(new URL(base + url.search, url.origin).toString(), 302);

  let path = cleanPath(rest) || ver.entry;
  const has = (p: string) => ver.files.some((f: any) => f.path === p);
  if (!has(path)) {
    const idx = [path.replace(/\/$/, "") + "/index.html", path + ".html"].find(has);
    if (idx) path = idx;
    else if (!/\.[a-z0-9]{1,6}$/i.test(path) && has(ver.entry)) path = ver.entry; // rota de SPA
    else return gone("Arquivo não encontrado.");
  }
  const blob = await previewStore().get(fileKey(id, ver.v, path), { type: "arrayBuffer" });
  if (!blob) return gone("Arquivo não encontrado.");
  const type = typeOf(path);
  const headers: Record<string, string> = { "content-type": type, ...noindex };

  if (type.startsWith("text/html")) {
    let html = new TextDecoder().decode(blob);
    html = rewrite(html, base);
    html = withOg(html, url.origin, key, m);
    const tag = bar(id, m.title, m.status || "aguardando");
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => tag + "</body>") : html + tag;
    headers["cache-control"] = "no-store";
    return new Response(req.method === "HEAD" ? null : html, { headers });
  }
  if (type.startsWith("text/css")) {
    headers["cache-control"] = "public, max-age=60";
    return new Response(req.method === "HEAD" ? null : rewrite(new TextDecoder().decode(blob), base), { headers });
  }
  headers["cache-control"] = "public, max-age=300";
  return new Response(req.method === "HEAD" ? null : blob, { headers });
};

export const config: Config = {
  path: ["/v/:id", "/v/:id/*", "/api/previa/:id/feedback", "/api/previa/:id/capa"],
  rateLimit: { windowLimit: 600, windowSize: 60, aggregateBy: ["ip", "domain"] },
};

// Layout dos e-mails enviados aos clientes, na identidade do site (gustavoelian.com):
// logo oficial, apenas a tipografia LT Wave (fonte web, sem fonte reserva), tinta #0E0E10,
// destaque #6699FF/#2F5FD0, cartões #F4F4F5 com cantos arredondados e botão em pílula.
const ORIGIN = "https://gustavoelian.com";
// texto corrido: LT Wave quando o leitor carrega a fonte; senão Georgia. Título, rótulo, botões e destaques vão como imagem na LT Wave (emailtext.mts)
const FONT = `'LT Wave', Georgia, serif`;
const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export type EmailParts = { title?: string; subject?: string; html?: string; button?: { href: string; label?: string } | null; eyebrow?: string };

/** Cartão de link dentro do corpo do e-mail (sistema entregue, manual, certificado). */
import { richFromHtml, textImg } from "./emailtext.mts";

export function linkCard(href: string, label: string, sub = "") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 14px"><tr><td style="background:#F4F4F5;border-radius:20px;padding:18px 22px"><a href="${esc(href)}" style="text-decoration:none;display:block">${textImg("destaque", label)}</a>${sub ? textImg("sub", sub, "margin-top:6px") : ""}</td></tr></table>`;
}

export function emailHtml(p: EmailParts) {
  const title = String(p.title || p.subject || "").trim();
  const eyebrow = p.eyebrow || "Gustavo Elian · Studio";
  const btn = p.button?.href ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 4px"><tr><td style="border-radius:999px;background:#0E0E10"><a href="${esc(p.button.href)}" style="display:inline-block;padding:16px 30px;font-family:${FONT};font-size:16px;font-weight:500;color:#FFFFFF;text-decoration:none;border-radius:999px">${textImg("botao", p.button.label || "Abrir")}</a></td></tr></table>` : "";
  // corpo: cada parágrafo, lista e caixa de destaque vira imagem na LT Wave (o texto vai no alt); só o rodapé fica em texto
  const body = String(p.html || "")
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner) => `<div style="margin:0 0 14px">${textImg("corpo", [...String(inner).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => "•  " + richFromHtml(x[1]).trim()).join("\n"))}</div>`)
    .replace(/<p( style="([^"]*)")?>([\s\S]*?)<\/p>/gi, (_m, _a, st = "", inner) => {
      const txt = richFromHtml(inner).trim();
      if (!txt) return "";
      if (/background/i.test(st)) return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px"><tr><td style="background:#F4F4F5;border-radius:18px;padding:16px 20px">${textImg("nota", txt)}</td></tr></table>`;
      const mt = (st.match(/margin-top:\s*(\d+)px/) || [])[1];
      return `<div style="margin:${mt ? mt + "px" : "0"} 0 14px">${textImg("corpo", txt)}</div>`;
    });
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title>
<style>
@font-face{font-family:'LT Wave';src:url(${ORIGIN}/fonts/LTWave-Light.woff2) format('woff2');font-weight:300}
@font-face{font-family:'LT Wave';src:url(${ORIGIN}/fonts/LTWave-Regular.woff2) format('woff2');font-weight:400}
@font-face{font-family:'LT Wave';src:url(${ORIGIN}/fonts/LTWave-Medium.woff2) format('woff2');font-weight:500}
a{color:#2F5FD0}
@media (max-width:620px){.card{padding:28px 22px!important;border-radius:24px!important}.wrap{padding:16px 10px!important}}
</style></head>
<body style="margin:0;padding:0;background:#ECECEE">
<div style="display:none;max-height:0;overflow:hidden">${esc(title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECECEE"><tr><td class="wrap" align="center" style="padding:36px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 6px 20px"><a href="${ORIGIN}"><img src="${ORIGIN}/img/logo_gustavo.png" width="168" height="31" alt="@gustavoelian" style="display:block;border:0;width:168px;height:auto"></a></td></tr>
<tr><td class="card" style="font-family:${FONT};color:#2E2F33;background:#FFFFFF;border-radius:32px;padding:40px 44px">
<div style="margin:0 0 18px">${textImg("rotulo", eyebrow)}</div>
${title ? `<h1 style="margin:0 0 22px;font-size:0;line-height:0">${textImg("titulo", title)}</h1>` : ""}
${body}${btn}
</td></tr>
<tr><td style="padding:24px 10px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#6B6E76">
<p style="margin:0 0 6px"><b style="font-weight:500;color:#0E0E10">Gustavo Elian</b> · design, marca, sites e sistemas · CNPJ 56.891.693/0001-04</p>
<p style="margin:0"><a href="${ORIGIN}" style="color:#2F5FD0;text-decoration:none">gustavoelian.com</a> · <a href="https://wa.me/5538984120719" style="color:#2F5FD0;text-decoration:none">WhatsApp (38) 98412-0719</a> · <a href="${ORIGIN}/acompanhar" style="color:#2F5FD0;text-decoration:none">Área do cliente</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

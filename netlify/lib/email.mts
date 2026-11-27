// Layout dos e-mails enviados aos clientes, na identidade do site (gustavoelian.com):
// logo oficial, tipografia LT Wave (título em imagem + fonte web onde o leitor aceitar), tinta #0E0E10,
// destaque #6699FF/#2F5FD0, cartões #F4F4F5 com cantos arredondados e botão em pílula.
const ORIGIN = "https://gustavoelian.com";
const FONT = `'LT Wave','Avenir Next','Segoe UI',Helvetica,Arial,sans-serif`;
const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export type EmailParts = { title?: string; subject?: string; html?: string; button?: { href: string; label?: string } | null; eyebrow?: string };

export function emailHtml(p: EmailParts) {
  const title = String(p.title || p.subject || "").trim();
  const eyebrow = p.eyebrow || "Gustavo Elian · Studio";
  const btn = p.button?.href ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 4px"><tr><td style="border-radius:999px;background:#0E0E10"><a href="${esc(p.button.href)}" style="display:inline-block;padding:16px 30px;font-family:${FONT};font-size:16px;font-weight:500;color:#FFFFFF;text-decoration:none;border-radius:999px">${esc(p.button.label || "Abrir")}</a></td></tr></table>` : "";
  // corpo: parágrafos e listas vindos do sistema recebem o estilo do site
  const body = String(p.html || "")
    .replace(/<p>/g, `<p style="margin:0 0 14px;font-family:${FONT};font-size:16px;line-height:1.6;color:#2E2F33">`)
    .replace(/<ul>/g, `<ul style="margin:0 0 14px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.6;color:#2E2F33">`)
    .replace(/<li>/g, `<li style="margin:0 0 6px">`)
    .replace(/<b>/g, `<b style="font-weight:500;color:#0E0E10">`);
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
<p style="margin:0 0 18px;font-family:${FONT};font-size:12px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:#55575E"><span style="color:#6699FF;font-size:14px">●</span>&nbsp; ${esc(eyebrow)}</p>
${title ? `<h1 style="margin:0 0 20px;font-family:${FONT};font-size:34px;line-height:1.15;font-weight:300;letter-spacing:-.02em;color:#0E0E10"><img src="${ORIGIN}/api/email/titulo?t=${encodeURIComponent(title)}" alt="${esc(title)}" width="504" style="display:block;border:0;width:100%;max-width:504px;height:auto;font-family:${FONT};font-size:30px;font-weight:300;color:#0E0E10"></h1>` : ""}
${body}${btn}
</td></tr>
<tr><td style="padding:24px 10px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#6B6E76">
<p style="margin:0 0 6px"><b style="font-weight:500;color:#0E0E10">Gustavo Elian</b> · design, marca, sites e sistemas · CNPJ 56.891.693/0001-04</p>
<p style="margin:0"><a href="${ORIGIN}" style="color:#2F5FD0;text-decoration:none">gustavoelian.com</a> · <a href="https://wa.me/5538984120719" style="color:#2F5FD0;text-decoration:none">WhatsApp (38) 98412-0719</a> · <a href="${ORIGIN}/acompanhar" style="color:#2F5FD0;text-decoration:none">Área do cliente</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

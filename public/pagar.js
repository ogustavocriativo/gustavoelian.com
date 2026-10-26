// Link de pagamento avulso: /pagar/<id>. O cliente escolhe Pix ou cartão.
const app = document.getElementById("app");
const id = (location.pathname.split("/")[2] || "").toLowerCase();
const WA = "5538984120719";
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else if (k === "html") el.innerHTML = v; else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const toastEl = document.getElementById("toast");
const toast = (m) => { toastEl.textContent = m; toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.hidden = true), 2600); };
const money = (label) => { const [a, b] = label.replace("R$", "").trim().split(","); return h("span", { class: "pg-amt" }, h("small", {}, "R$"), a, h("small", { style: "margin:0 0 0 2px" }, "," + (b || "00"))); };
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const api = async (path, opts) => { const r = await fetch(path, opts); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Erro"); return d; };

function paid(c, just) {
  app.replaceChildren(h("section", { class: "pg-ok" },
    h("span", { class: "ck", html: CHECK }), h("h1", {}, c.amountLabel), h("p", {}, just ? "Pagamento recebido. Obrigado!" : `Pago para ${c.issuer}`),
    h("a", { class: "btn dark", href: `https://wa.me/${WA}?text=${encodeURIComponent(`Olá, Gustavo! Acabei de pagar ${c.amountLabel}${c.desc ? ` (${c.desc})` : ""}.`)}`, target: "_blank", rel: "noopener", style: "margin-top:16px;max-width:320px" }, "Avisar no WhatsApp")));
}

async function main() {
  let c;
  try { c = await api(`/api/pagar/${encodeURIComponent(id)}`); }
  catch { app.replaceChildren(h("div", { class: "pg-card" }, h("div", { class: "pg-head" }, h("h1", {}, "Link indisponível"), h("p", { class: "pg-desc" }, "Este link de pagamento não existe ou foi cancelado. Peça um novo para o Gustavo."), h("a", { class: "btn primary", href: `https://wa.me/${WA}` }, "Falar no WhatsApp")))); return; }
  const q = new URLSearchParams(location.search);
  if (c.status === "paga") return paid(c, q.get("pagamento") === "ok");
  if (q.get("pagamento") === "ok") return paid(c, true); // webhook ainda processando
  if (q.get("pagamento") === "cancelado") setTimeout(() => toast("Pagamento no cartão cancelado. Você pode tentar de novo ou usar Pix."), 300);

  const methods = [c.pix && "pix", c.card && "cartao"].filter(Boolean);
  let cur = methods[0];
  const pane = h("div", { class: "pg-pane" });
  const head = h("div", { class: "pg-head" }, h("span", { class: "pg-to" }, `${c.name ? c.name.split(" ")[0] + ", seu" : "Seu"} pagamento para ${c.issuer}`), money(c.amountLabel), c.desc ? h("p", { class: "pg-desc" }, c.desc) : null);
  const segBtns = methods.map((m) => h("button", { type: "button", "aria-pressed": String(m === cur), onclick: () => { cur = m; segBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(methods[i] === m))); draw(); } }, m === "pix" ? "Pix" : "Cartão"));
  const seg = methods.length > 1 ? h("div", { class: "seg", role: "group", "aria-label": "Forma de pagamento" }, ...segBtns) : null;

  async function draw() {
    if (!cur) { pane.replaceChildren(h("p", { class: "pg-note" }, "Formas de pagamento em configuração. Fale com o Gustavo."), h("a", { class: "btn primary", href: `https://wa.me/${WA}` }, "Falar no WhatsApp")); return; }
    if (cur === "pix") {
      pane.replaceChildren(h("div", { class: "pg-qr", "aria-busy": "true" }));
      try {
        const p = await api(`/api/pagar/${id}/pix`);
        const copy = h("button", { class: "btn small primary", type: "button", style: "width:auto;min-height:40px", onclick: async () => { try { await navigator.clipboard.writeText(p.payload); toast("Código Pix copiado"); } catch { toast("Não deu para copiar. Segure o código para copiar."); } } }, "Copiar");
        const done = h("button", { class: "btn ghost", type: "button", onclick: async () => { done.disabled = true; try { await api(`/api/pagar/${id}/aviso`, { method: "POST" }); } catch {} done.textContent = "Obrigado! O Gustavo vai confirmar o recebimento."; } }, "Já paguei");
        pane.replaceChildren(
          h("div", { class: "pg-qr", role: "img", "aria-label": `QR Code Pix de ${p.amountLabel}`, html: p.svg }),
          h("p", { class: "pg-note" }, "Abra o app do banco, escolha Pix › Ler QR Code. No celular, use o Pix copia e cola:"),
          h("div", { class: "pg-code" }, h("code", {}, p.payload), copy),
          h("p", { class: "pg-note" }, "Sem taxa. Cai na hora."), done);
      } catch (x) { pane.replaceChildren(h("p", { class: "pg-note" }, x.message)); }
    } else {
      const go = h("button", { class: "btn primary", type: "button", onclick: async () => { go.disabled = true; go.textContent = "Abrindo pagamento seguro…"; try { const r = await api(`/api/pagar/${id}/checkout`, { method: "POST" }); location.href = r.url; } catch (x) { toast(x.message); go.disabled = false; go.textContent = `Pagar ${c.cardAmountLabel}`; } } }, `Pagar ${c.cardAmountLabel}`);
      pane.replaceChildren(
        c.cardFeePct > 0 ? h("div", { class: "pg-row" }, h("span", {}, "No cartão"), h("b", {}, c.cardAmountLabel)) : null,
        c.cardFeePct > 0 ? h("p", { class: "pg-note" }, `Inclui a taxa da operadora (${String(c.cardFeePct).replace(".", ",")}%). No Pix o valor é ${c.amountLabel}.`) : null,
        c.installments > 1 ? h("p", { class: "pg-note" }, `Parcele em até ${c.installments}x na próxima tela.`) : null,
        go, h("p", { class: "pg-note" }, "Crédito, débito, Apple Pay ou Google Pay, na página segura do Stripe."));
    }
  }
  app.replaceChildren(h("div", { class: "pg-card" }, head, seg, pane),
    h("div", { class: "pg-trust" }, h("span", { html: LOCK + "Pagamento protegido" }), h("span", {}, "·"), h("span", {}, "Dúvidas? ", h("a", { href: `https://wa.me/${WA}` }, "WhatsApp"))));
  draw();
}
main();

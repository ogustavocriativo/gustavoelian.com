// Página da proposta do cliente: gustavoelian.com/<nome-codigo>
const app = document.getElementById("app");
const slug = location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
const toastEl = document.getElementById("toast");
const brl = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}
function toast(m) { toastEl.textContent = m; toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.hidden = true), 3000); }
async function post(action, body) {
  const r = await fetch(`/api/p/${slug}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Não foi possível enviar. Tente de novo.");
  return d;
}
const dateLong = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

let D, catalog, sel;

function price(selection) {
  const q = D.quote;
  if (selection.packageId) {
    const p = q.packages.find((x) => x.id === selection.packageId);
    if (p) {
      const full = q.items.filter((i) => p.itemIds.includes(i.id)).reduce((s, i) => s + Number(i.price || 0), 0);
      return { label: p.name, full, cash: p.cash || full, card: p.card || p.cash || full, n: p.installments || 1 };
    }
  }
  const ids = selection.itemIds?.length ? selection.itemIds : q.items.map((i) => i.id);
  const full = q.items.filter((i) => ids.includes(i.id)).reduce((s, i) => s + Number(i.price || 0), 0);
  return { label: "Serviços escolhidos", full, cash: full, card: full, n: q.defaultInstallments || 1 };
}

function waLink(text) {
  return `https://wa.me/${D.issuer.whatsapp}?text=${encodeURIComponent(text)}`;
}

/* ---------- blocos ---------- */
function hero() {
  const q = D.quote, s = D.state;
  const valid = new Date(new Date(q.date + "T12:00:00").getTime() + (q.validDays || 15) * 864e5);
  return h("section", { class: "blk hero" },
    D.preview ? h("p", { class: "notice" }, "Pré-visualização: o link está desativado para o cliente.") : null,
    h("span", { class: "eyebrow" }, `Proposta · ${dateLong(q.date)}`),
    h("h1", {}, h("small", {}, "Para"), q.client.name),
    q.title ? h("p", { class: "lead", style: "color:var(--fg);font-weight:500" }, q.title) : null,
    q.intro ? h("p", { class: "lead" }, q.intro) : null,
    h("div", { class: "meta" },
      s.approvedAt ? h("span", { class: "pill ok" }, "Proposta aprovada") : h("span", { class: "pill" }, `Válida até ${valid.toLocaleDateString("pt-BR")}`),
      h("span", { class: "pill" }, `${q.items.length} ${q.items.length > 1 ? "serviços" : "serviço"}`)),
    h("div", { class: "ctas" },
      h("a", { class: "btn primary", href: s.approvedAt ? "#pagamento" : "#escolha" }, s.approvedAt ? "Ir para o pagamento" : "Escolher e aprovar"),
      h("a", { class: "btn ghost", href: `/api/pdf/${slug}/orcamento?download` }, "Baixar PDF")));
}

function services() {
  const q = D.quote;
  return h("section", { class: "blk", id: "servicos" }, h("span", { class: "eyebrow" }, "Serviços"), h("h2", {}, "O que está incluso"),
    h("div", { class: "items" }, ...q.items.map((it, i) => h("article", { class: "item" },
      h("div", {}, h("span", { class: "n" }, String(i + 1).padStart(2, "0")), h("h3", {}, it.title)),
      h("div", {}, h("div", { class: "price" }, brl(it.price)), it.deadline ? h("div", { class: "dl" }, `Prazo: ${it.deadline}`) : null),
      it.description ? h("p", {}, it.description) : null,
      it.deliverables?.length ? h("ul", {}, ...it.deliverables.map((d) => h("li", {}, d))) : null))));
}

function chooser() {
  const q = D.quote, locked = !!D.state.approvedAt;
  const summary = h("div", { class: "summary", "aria-live": "polite" });
  const methodBtns = {};
  const drawSummary = () => {
    const p = price(sel);
    const pct = D.payments.entryPct;
    summary.replaceChildren(...[
      h("small", {}, `${p.label} · ${sel.method === "cartao" ? "cartão de crédito" : "à vista"}`),
      sel.method === "cartao"
        ? [h("div", { class: "big" }, `${p.n}x de ${brl(p.card / p.n)}`), h("small", {}, `Total ${brl(p.card)} no cartão`)]
        : [h("div", { class: "big" }, brl(p.cash)), h("small", {}, `Entrada de ${pct}% (${brl((p.cash * pct) / 100)}) e ${100 - pct}% (${brl(p.cash - (p.cash * pct) / 100)}) na entrega`)],
      p.full > (sel.method === "cartao" ? p.card : p.cash) ? h("small", {}, `Você economiza ${brl(p.full - (sel.method === "cartao" ? p.card : p.cash))} em relação aos valores avulsos`) : null].flat().filter(Boolean));
    Object.entries(methodBtns).forEach(([k, b]) => b.setAttribute("aria-pressed", String(sel.method === k)));
  };
  let saveT;
  const persist = () => { drawSummary(); clearTimeout(saveT); saveT = setTimeout(async () => { try { const r = await post("select", sel); D.contractPreview = r.contractPreview; const c = document.getElementById("contractText"); if (c) c.textContent = r.contractPreview; } catch (x) { toast(x.message); } }, 500); };

  const opts = h("div", { class: "opts", role: "radiogroup", "aria-label": "Opções" });
  const itemChecks = h("div", { class: "subitems" }, ...q.items.map((it) => h("label", {}, h("input", { type: "checkbox", value: it.id, disabled: locked, checked: !sel.packageId && (sel.itemIds?.length ? sel.itemIds.includes(it.id) : true), onchange: () => {
    sel.itemIds = [...itemChecks.querySelectorAll("input:checked")].map((x) => x.value);
    if (!sel.itemIds.length) { toast("Escolha pelo menos um serviço"); sel.itemIds = [it.id]; itemChecks.querySelector(`input[value="${it.id}"]`).checked = true; }
    persist();
  } }), `${it.title} · ${brl(it.price)}`)));
  const radio = (id, content) => h("label", { class: "opt" }, h("input", { type: "radio", name: "opt", value: id, disabled: locked, checked: (sel.packageId || "avulso") === id, onchange: () => {
    sel.packageId = id === "avulso" ? null : id;
    if (!sel.packageId && !sel.itemIds?.length) sel.itemIds = q.items.map((i) => i.id);
    itemChecks.querySelectorAll("input").forEach((x) => (x.disabled = locked || !!sel.packageId));
    persist();
  } }), ...content);
  for (const p of q.packages) {
    const pr = price({ packageId: p.id });
    opts.append(radio(p.id, [h("div", {}, h("strong", {}, p.name), p.highlight ? h("span", { class: "tag" }, p.tag || "Maior economia") : null),
      h("div", { class: "v" }, pr.full > pr.cash ? h("s", {}, brl(pr.full)) : null, brl(pr.cash)),
      h("small", {}, `${q.items.filter((i) => p.itemIds.includes(i.id)).map((i) => i.title).join(" + ")} · ou ${pr.n}x de ${brl(pr.card / pr.n)} no cartão`)]));
  }
  opts.append(radio("avulso", [h("div", {}, h("strong", {}, q.packages.length ? "Escolher serviços avulsos" : "Serviços")), h("div", { class: "v" }), itemChecks]));
  itemChecks.querySelectorAll("input").forEach((x) => (x.disabled = locked || !!sel.packageId));

  const seg = h("div", { class: "seg", role: "group", "aria-label": "Forma de pagamento" },
    (methodBtns.avista = h("button", { type: "button", disabled: locked, onclick: () => { sel.method = "avista"; persist(); } }, "À vista")),
    (methodBtns.cartao = h("button", { type: "button", disabled: locked, onclick: () => { sel.method = "cartao"; persist(); } }, "Cartão de crédito")));
  drawSummary();
  return h("section", { class: "blk", id: "escolha" }, h("span", { class: "eyebrow" }, "Sua escolha"), h("h2", {}, locked ? "Condição aprovada" : "Monte a sua proposta"),
    locked ? null : h("p", { class: "lead" }, "Escolha um pacote ou os serviços avulsos e a forma de pagamento. O valor atualiza na hora."),
    opts, seg, summary);
}

function bonuses() {
  if (!D.quote.bonuses?.length) return null;
  return h("section", { class: "blk" }, h("span", { class: "eyebrow" }, "Bônus"), h("h2", {}, "Incluído ao fechar"),
    h("div", { class: "bonus" }, ...D.quote.bonuses.map((b) => h("div", {}, h("strong", {}, b.title), b.text ? h("p", {}, b.text) : null))),
    D.quote.notes ? h("p", { class: "lead", style: "font-size:1rem" }, D.quote.notes) : null);
}

function works() {
  const ids = D.quote.projectIds || [];
  const list = catalog.projects.filter((p) => ids.includes(p.id));
  if (!list.length) return null;
  return h("section", { class: "blk", id: "trabalhos" }, h("span", { class: "eyebrow" }, "Trabalhos parecidos"), h("h2", {}, "O que já entregamos"),
    h("p", { class: "lead" }, "Projetos próximos ao que vamos fazer juntos. Toque para abrir."),
    h("div", { class: "works" }, ...list.map((p) => h(p.case || p.url ? "a" : "div", { class: "work", ...(p.case ? { href: `/projetos/${p.id}`, target: "_blank" } : p.url ? { href: p.url, target: "_blank", rel: "noopener" } : {}) },
      p.cover ? h("img", { src: "/" + p.cover, alt: `${p.title}: ${p.kind}`, loading: "lazy" }) : null,
      h("div", {}, h("small", {}, p.kind), h("strong", {}, p.title), h("p", {}, p.summary))))),
    h("a", { class: "btn ghost", href: "/#projetos", style: "align-self:flex-start" }, "Ver portfólio completo"));
}

function attachments() {
  const a = D.quote.attachments || [];
  if (!a.length) return null;
  return h("section", { class: "blk" }, h("span", { class: "eyebrow" }, "Arquivos"), h("h2", {}, "Materiais desta proposta"),
    h("div", { class: "files" }, ...a.map((f) => h("a", { href: `/api/quotes/${slug}/files/${f.id}`, target: "_blank" }, h("span", {}, f.name), h("span", {}, "Abrir")))));
}

function signaturePad() {
  const wrap = h("div", { class: "sig" });
  const c = h("canvas", { "aria-label": "Área para assinar com o dedo ou o mouse" });
  const hint = h("span", {}, "Assine aqui (opcional)");
  let drawing = false, has = false, ctx;
  const fit = () => { const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; c.width = r.width * dpr; c.height = r.height * dpr; ctx = c.getContext("2d"); ctx.scale(dpr, dpr); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1d1e22"; };
  const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.addEventListener("pointerdown", (e) => { drawing = true; c.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); hint.hidden = true; });
  c.addEventListener("pointermove", (e) => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); has = true; });
  c.addEventListener("pointerup", () => (drawing = false));
  const clear = h("button", { type: "button", class: "btn ghost small", onclick: () => { fit(); has = false; hint.hidden = false; } }, "Limpar");
  wrap.append(c, hint, clear);
  requestAnimationFrame(fit);
  wrap.getData = () => {
    if (!has) return "";
    // exporta em fundo branco e tamanho reduzido
    const out = document.createElement("canvas"); out.width = 600; out.height = Math.round((600 * c.height) / c.width);
    const o = out.getContext("2d"); o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, out.height); o.drawImage(c, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.92); // JPEG opaco: o PDF do contrato fica sem transparência
  };
  return wrap;
}

function approve() {
  const s = D.state;
  if (s.approvedAt) {
    return h("section", { class: "blk", id: "aprovar" }, h("div", { class: "done" },
      h("strong", {}, `Proposta aprovada por ${s.signer?.name} em ${new Date(s.approvedAt).toLocaleString("pt-BR")}.`),
      D.quote.contractEnabled ? h("a", { href: `/api/pdf/${slug}/contrato?download` }, "Baixar contrato assinado (PDF)") : null,
      h("a", { href: `/api/pdf/${slug}/orcamento?download` }, "Baixar proposta (PDF)")));
  }
  const err = h("p", { class: "err", role: "alert" });
  const pad = signaturePad();
  const inp = (id, label, type = "text", attrs = {}) => h("label", { class: "f", for: id }, label, h("input", { id, name: id, type, required: true, ...attrs }));
  const form = h("form", { class: "stack", onsubmit: async (e) => {
    e.preventDefault(); err.textContent = "";
    const fd = new FormData(form);
    if (!fd.get("accept")) { err.textContent = "Para aprovar, marque que leu e aceita os termos."; return; }
    const btn = form.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Registrando…";
    try {
      await post("approve", { name: fd.get("name"), doc: fd.get("doc"), email: fd.get("email"), phone: fd.get("phone"), accept: true, signature: pad.getData() });
      await load(); toast("Proposta aprovada. Obrigado!"); location.hash = "#pagamento";
    } catch (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = "Aprovar proposta"; }
  } },
    h("div", { class: "grid2" }, inp("name", "Nome completo *", "text", { autocomplete: "name", value: D.quote.client.name || "" }), inp("doc", "CPF ou CNPJ *", "text", { inputmode: "numeric", autocomplete: "off" })),
    h("div", { class: "grid2" }, inp("email", "E-mail *", "email", { autocomplete: "email" }), h("label", { class: "f", for: "phone" }, "WhatsApp", h("input", { id: "phone", name: "phone", type: "tel", autocomplete: "tel" }))),
    D.quote.contractEnabled ? [h("p", { style: "font-weight:500" }, "Termos de contratação"), h("div", { class: "contract", id: "contractText", tabindex: "0" }, D.contractPreview)] : null,
    D.quote.contractEnabled ? pad : null,
    h("label", { class: "accept" }, h("input", { type: "checkbox", name: "accept", value: "1" }), D.quote.contractEnabled ? "Li e aceito os termos de contratação. Entendo que este aceite eletrônico tem validade de assinatura e fica registrado com data, hora e endereço IP." : "Aprovo esta proposta nas condições escolhidas acima."),
    err, h("button", { class: "btn primary", type: "submit" }, "Aprovar proposta"));
  return h("section", { class: "blk", id: "aprovar" }, h("span", { class: "eyebrow" }, "Aprovação"), h("h2", {}, D.quote.contractEnabled ? "Aprovar e assinar" : "Aprovar proposta"),
    h("p", { class: "lead" }, "Confira a condição escolhida, preencha seus dados e aprove. Você recebe o contrato em PDF na hora."), form);
}

async function payment() {
  const s = D.state;
  if (!s.approvedAt) return null;
  const sec = h("section", { class: "blk", id: "pagamento" }, h("span", { class: "eyebrow" }, "Pagamento"), h("h2", {}, s.paidAt ? "Pagamento confirmado" : "Pagar e começar"));
  const params = new URLSearchParams(location.search);
  if (s.paidAt || params.get("pagamento") === "ok") { sec.append(h("div", { class: "done" }, h("strong", {}, "Recebemos o seu pagamento. Obrigado! Em breve entro em contato para começarmos."))); return sec; }
  if (s.paymentNotice) sec.append(h("div", { class: "done" }, h("strong", {}, "Comprovante recebido. Assim que o valor for confirmado, começamos.")));
  const method = s.selection?.method || "avista";
  if (method === "cartao" && D.payments.card) {
    sec.append(h("p", { class: "lead" }, "Pague com cartão de crédito, Apple Pay ou Google Pay em ambiente seguro."),
      h("button", { class: "btn dark", type: "button", onclick: async (e) => {
        e.currentTarget.disabled = true;
        try { const r = await fetch(`/api/pay/${slug}/checkout`, { method: "POST" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); location.href = d.url; }
        catch (x) { toast(x.message); e.currentTarget.disabled = false; }
      } }, "Pagar com cartão ou Apple Pay"));
  }
  if (D.payments.pix) {
    try {
      const r = await fetch(`/api/pay/${slug}/pix`); const pix = await r.json();
      if (r.ok) {
        const code = h("code", {}, pix.payload);
        sec.append(h("p", { class: "lead" }, method === "cartao" && D.payments.card ? "Prefere Pix? Pague a entrada à vista:" : `Pague a entrada de ${D.payments.entryPct}% por Pix. O restante fica para a entrega.`),
          h("div", { class: "pix" }, h("div", { class: "qr", html: pix.svg, role: "img", "aria-label": "QR Code Pix" }),
            h("div", { class: "stack" }, h("strong", { style: "font-size:1.75rem" }, pix.amountLabel), h("small", {}, pix.label), code,
              h("button", { class: "btn primary", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(pix.payload); toast("Código Pix copiado"); } catch { const r2 = document.createRange(); r2.selectNodeContents(code); getSelection().removeAllRanges(); getSelection().addRange(r2); toast("Código selecionado: copie e cole no app do banco"); } } }, "Copiar código Pix"))));
        const fileIn = h("input", { type: "file", accept: "image/*,application/pdf", style: "display:none", onchange: async (e) => {
          const f = e.target.files[0]; if (!f) return;
          const fd = new FormData(); fd.append("file", f);
          const r3 = await fetch(`/api/p/${slug}/receipt`, { method: "POST", body: fd }); const d3 = await r3.json().catch(() => ({}));
          if (!r3.ok) return toast(d3.error || "Não foi possível enviar");
          toast("Comprovante enviado. Obrigado!"); await load();
        } });
        sec.append(h("button", { class: "btn ghost", type: "button", onclick: () => fileIn.click() }, "Enviar comprovante do Pix"), fileIn);
      }
    } catch {}
  }
  if (!D.payments.pix && !(method === "cartao" && D.payments.card)) {
    sec.append(h("p", { class: "lead" }, "Vou te enviar os dados de pagamento pelo WhatsApp."),
      h("a", { class: "btn primary", href: waLink(`Olá, Gustavo! Aprovei a proposta (${slug}). Pode me enviar os dados para pagamento?`), target: "_blank", rel: "noopener" }, "Combinar pagamento no WhatsApp"));
  }
  return sec;
}

function questions() {
  const err = h("p", { class: "err", role: "alert" });
  const ta = h("textarea", { id: "msg", name: "msg", required: true, placeholder: "Escreva sua dúvida ou pedido de ajuste" });
  const nm = h("input", { id: "cname", type: "text", autocomplete: "name", value: D.quote.client.name || "" });
  const form = h("form", { class: "stack", onsubmit: async (e) => {
    e.preventDefault(); err.textContent = "";
    try { await post("comment", { name: nm.value, message: ta.value }); ta.value = ""; toast("Mensagem enviada. Respondo em breve."); }
    catch (x) { err.textContent = x.message; }
  } }, h("label", { class: "f", for: "cname" }, "Seu nome", nm), h("label", { class: "f", for: "msg" }, "Mensagem", ta), err,
    h("div", { class: "ctas" }, h("button", { class: "btn dark", type: "submit" }, "Enviar mensagem"),
      h("a", { class: "btn ghost", href: waLink(`Olá, Gustavo! Estou vendo a proposta (${location.href}) e tenho uma dúvida.`), target: "_blank", rel: "noopener" }, "Falar no WhatsApp")));
  return h("section", { class: "blk", id: "duvidas" }, h("span", { class: "eyebrow" }, "Dúvidas"), h("h2", {}, "Ficou alguma pergunta?"), form);
}

async function load() {
  const r = await fetch(`/api/p/${slug}`);
  if (!r.ok) {
    document.title = "Proposta não encontrada · Gustavo Elian";
    app.replaceChildren(h("section", { class: "blk hero" }, h("h1", {}, "Proposta não encontrada"), h("p", { class: "lead" }, "Confira o link recebido ou fale comigo."),
      h("div", { class: "ctas" }, h("a", { class: "btn primary", href: "https://wa.me/5538984120719", target: "_blank", rel: "noopener" }, "Falar no WhatsApp"), h("a", { class: "btn ghost", href: "/" }, "Ver portfólio"))));
    document.getElementById("topPdf").hidden = true;
    return;
  }
  D = await r.json();
  catalog = catalog || (await fetch("/data/projects.json").then((x) => x.json()));
  sel = D.state.selection || { packageId: (D.quote.packages.find((p) => p.highlight) || D.quote.packages[0])?.id || null, itemIds: D.quote.items.map((i) => i.id), method: "avista" };
  document.title = `Proposta · ${D.quote.client.name} · Gustavo Elian`;
  document.getElementById("topPdf").href = `/api/pdf/${slug}/orcamento?download`;
  const pay = await payment();
  app.replaceChildren(...[hero(), services(), chooser(), bonuses(), works(), attachments(), approve(), pay, questions()].filter(Boolean));
  document.getElementById("foot").replaceChildren(h("span", {}, `${D.issuer.name} · ${D.issuer.doc}`), h("span", {}, D.issuer.email), h("a", { href: "/" }, D.issuer.site));
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}

load().catch(() => { app.replaceChildren(h("p", { class: "loading" }, "Não foi possível carregar a proposta. Atualize a página.")); });

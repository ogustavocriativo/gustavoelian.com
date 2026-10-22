// App de orçamentos de Gustavo Elian — SPA simples, sem dependências.
const root = document.getElementById("root");
const toastEl = document.getElementById("toast");
let catalog = { fronts: [], projects: [] };
let lastSeenInbox = Number(localStorageGet("ge_inbox_seen") || 0);

/* ---------- utilidades ---------- */
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
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
const brl = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseMoney = (s) => { if (typeof s === "number") return s; const t = String(s || "").replace(/[^\d,.-]/g, ""); if (!t) return 0; return t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) || 0 : Number(t) || 0; };
const fmtMoneyInput = (v) => (v ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
const rid = () => Math.random().toString(36).slice(2, 8);
const when = (iso) => { const d = new Date(iso); const diff = (Date.now() - d) / 1000; if (diff < 60) return "agora"; if (diff < 3600) return `há ${Math.floor(diff / 60)} min`; if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`; return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.hidden = true), 2600); }
async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: "same-origin", headers: opts.body && !(opts.body instanceof FormData) ? { "content-type": "application/json" } : {}, ...opts, body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/login") { renderLogin(); throw new Error("login"); }
  if (!res.ok) throw new Error(data.error || "Algo deu errado");
  return data;
}
const icon = (name) => {
  const p = {
    back: '<path d="M15 18l-6-6 6-6"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
    pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  }[name];
  return h("span", { html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`, style: "display:inline-flex" });
};
function statusOf(q) {
  const s = q.state || {};
  if (s.paidAt) return ["Pago", "ok"];
  if (s.paymentNotice) return ["Comprovante enviado", "warn"];
  if (s.approvedAt) return ["Aprovado", "ok"];
  if (s.firstViewAt) return ["Visto", "blue"];
  if (q.published) return ["Enviado", ""];
  return ["Rascunho", ""];
}
const evText = (e) => ({
  view: "Abriu a proposta" + (e.city ? ` · ${e.city}` : ""),
  select: `Escolheu ${e.label} · ${e.method === "cartao" ? "cartão" : "à vista"} · ${brl(e.total)}`,
  comment: `${e.name || "Cliente"} comentou`,
  approve: `${e.name} aprovou e assinou · ${brl(e.total)}`,
  "payment-notice": "Enviou comprovante de pagamento (Pix)",
  "checkout-start": `Iniciou pagamento com cartão · ${brl(e.total)}`,
  paid: `Pagamento confirmado · ${brl(e.total)}`,
}[e.type] || e.type);
function shell(title, { back, actions = [], nav = true } = {}, ...content) {
  root.replaceChildren(
    h("header", { class: "top" }, h("div", { class: "wrap" },
      back ? h("a", { class: "iconbtn", href: back, "aria-label": "Voltar" }, icon("back")) : null,
      h("h1", {}, title), ...actions)),
    h("main", { class: "wrap stack", style: "padding-top:16px" }, ...content),
    ...(nav ? [navBar()] : []),
  );
  window.scrollTo(0, 0);
}
function navBar() {
  const r = location.hash || "#/";
  const item = (href, label, ic, on, badge) => h("a", { href, class: on ? "on" : "" }, icon(ic), label, badge ? h("span", { class: "badge" }, badge) : null);
  const b = h("nav", { class: "nav", "aria-label": "Principal" }, h("div", { class: "wrap" },
    item("#/", "Orçamentos", "list", r === "#/" || r.startsWith("#/q")),
    item("#/inbox", "Atividade", "inbox", r === "#/inbox", null),
    item("#/ajustes", "Ajustes", "gear", r === "#/ajustes")));
  api("/api/inbox").then((evs) => {
    const n = evs.filter((e) => e.type !== "view" && Date.parse(e.at) > lastSeenInbox).length;
    if (n) b.querySelectorAll("a")[1].append(h("span", { class: "badge" }, String(n)));
  }).catch(() => {});
  return b;
}

/* ---------- login ---------- */
function renderLogin() {
  const err = h("p", { class: "err", role: "alert" });
  const pw = h("input", { type: "password", id: "pw", autocomplete: "current-password", required: true, placeholder: "Senha" });
  root.replaceChildren(h("main", { class: "wrap login" }, h("form", {
    onsubmit: async (e) => {
      e.preventDefault(); err.textContent = "";
      try { await api("/api/login", { method: "POST", body: { password: pw.value } }); route(); }
      catch (x) { err.textContent = x.message; }
    },
  }, h("div", { class: "logo-mark", role: "img", "aria-label": "@gustavoelian" }),
    h("h1", { style: "text-align:center;font-size:1.25rem" }, "Orçamentos"),
    h("label", { class: "f", for: "pw" }, "Senha de acesso", pw), err,
    h("button", { class: "btn primary", type: "submit" }, "Entrar"))));
  pw.focus();
}

/* ---------- lista ---------- */
async function renderList() {
  shell("Orçamentos", {}, h("p", { class: "empty" }, "Carregando…"));
  const list = await api("/api/quotes");
  let filter = "todos";
  const box = h("div", { class: "list" });
  const draw = () => {
    const items = list.filter((q) => filter === "todos" || statusOf(q)[0].toLowerCase().startsWith(filter));
    box.replaceChildren(...(items.length ? items.map((q) => {
      const [st, cls] = statusOf(q);
      return h("a", { class: "qcard", href: `#/q/${q.slug}` },
        h("div", { class: "t" }, h("strong", {}, q.client?.name || "Sem nome"), h("span", {}, brl(q.total))),
        h("div", { class: "m" }, h("span", { class: `chip ${cls}` }, st), q.title ? h("span", {}, q.title) : null),
        h("div", { class: "m" }, h("small", {}, `Atualizado ${when(q.updatedAt)}`), q.state?.views ? h("small", {}, `· ${q.state.views} visualizaç${q.state.views > 1 ? "ões" : "ão"}`) : null));
    }) : [h("p", { class: "empty" }, list.length ? "Nada neste filtro." : "Nenhum orçamento ainda. Toque em Novo orçamento para começar.")]));
  };
  const tabs = h("div", { class: "tabs", role: "tablist" }, ...["todos", "rascunho", "enviado", "visto", "aprovado", "pago"].map((f) =>
    h("button", { class: "btn small" + (f === filter ? " on" : ""), role: "tab", onclick: (e) => { filter = f; tabs.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); draw(); } }, f[0].toUpperCase() + f.slice(1))));
  draw();
  shell("Orçamentos", {}, tabs, box, h("a", { class: "btn primary fab", href: "#/novo" }, icon("plus"), "Novo orçamento"));
}

/* ---------- editor ---------- */
const blankQuote = () => ({
  client: { name: "", company: "", email: "", phone: "" }, title: "", intro: "", date: new Date().toISOString().slice(0, 10), validDays: 15, category: "",
  items: [{ id: rid(), title: "", description: "", deliverables: [], price: 0, deadline: "" }], packages: [], defaultInstallments: 3,
  bonuses: [], notes: "", projectIds: [], attachments: [], contract: { enabled: true, text: "" }, published: false,
});

async function renderEditor(slug) {
  let q = slug ? (await api(`/api/quotes/${slug}`)).quote : blankQuote();
  let dirty = false;
  const markDirty = () => { dirty = true; saveBtn.textContent = "Salvar"; };
  const bind = (obj, key, attrs = {}, kind = "text") => {
    const tag = kind === "textarea" ? "textarea" : "input";
    const el = h(tag, { ...attrs, ...(tag === "input" ? { type: kind === "money" ? "text" : kind } : {}) });
    if (kind === "money") { el.inputMode = "decimal"; el.value = fmtMoneyInput(obj[key]); el.addEventListener("input", () => { obj[key] = parseMoney(el.value); markDirty(); recalc(); }); el.addEventListener("blur", () => (el.value = fmtMoneyInput(obj[key]))); }
    else { el.value = obj[key] ?? ""; el.addEventListener("input", () => { obj[key] = kind === "number" ? Number(el.value) : el.value; markDirty(); recalc(); }); }
    return el;
  };
  const field = (label, el) => h("label", { class: "f" }, label, el);

  // Cliente
  const secClient = h("section", { class: "section" }, h("h2", {}, "Cliente"),
    field("Nome do cliente *", bind(q.client, "name", { required: true, autocomplete: "off", placeholder: "Ex.: Larissa Torquato" })),
    field("Empresa ou marca", bind(q.client, "company")),
    h("div", { class: "row" }, field("WhatsApp", bind(q.client, "phone", { inputmode: "tel", placeholder: "(38) 99999-9999" }, "tel")), field("E-mail", bind(q.client, "email", {}, "email"))));

  // Proposta
  const frontSel = h("select", { onchange: (e) => { q.category = e.target.value; markDirty(); } }, h("option", { value: "" }, "Escolha a frente"), ...catalog.fronts.map((f) => h("option", { value: f.id, selected: q.category === f.id }, f.label)));
  const secProp = h("section", { class: "section" }, h("h2", {}, "Proposta"),
    field("Título", bind(q, "title", { placeholder: "Ex.: Identidade visual, site e sistema" })),
    field("Apresentação (o que você propõe e por quê)", bind(q, "intro", { rows: 4 }, "textarea")),
    h("div", { class: "row3" }, field("Data", bind(q, "date", {}, "date")), field("Validade (dias)", bind(q, "validDays", { min: 1 }, "number")), field("Frente", frontSel)));

  // Serviços
  const itemsBox = h("div", { class: "stack" });
  const sumEl = h("div", { class: "total" });
  const drawItems = () => {
    itemsBox.replaceChildren(...q.items.map((it, i) => {
      const del = h("textarea", { rows: 3, placeholder: "Um entregável por linha" }); del.value = (it.deliverables || []).join("\n");
      del.addEventListener("input", () => { it.deliverables = del.value.split("\n"); markDirty(); });
      return h("div", { class: "repeat" },
        h("div", { class: "head" }, h("strong", {}, `Serviço ${String(i + 1).padStart(2, "0")}`),
          h("div", { style: "display:flex;gap:6px" },
            i > 0 ? h("button", { class: "btn small", type: "button", "aria-label": "Mover para cima", onclick: () => { [q.items[i - 1], q.items[i]] = [q.items[i], q.items[i - 1]]; markDirty(); drawItems(); drawPackages(); } }, "↑") : null,
            h("button", { class: "btn small danger", type: "button", onclick: () => { q.items.splice(i, 1); q.packages.forEach((p) => (p.itemIds = p.itemIds.filter((x) => x !== it.id))); markDirty(); drawItems(); drawPackages(); recalc(); } }, "Remover"))),
        field("Produto ou serviço *", bind(it, "title", { placeholder: "Ex.: Site institucional" })),
        field("Descrição", bind(it, "description", { rows: 2 }, "textarea")),
        field("Especificações e entregáveis", del),
        h("div", { class: "row" }, field("Preço (R$)", bind(it, "price", { placeholder: "0,00" }, "money")), field("Prazo", bind(it, "deadline", { placeholder: "Ex.: 10 dias úteis" }))));
    }));
    recalc();
  };
  const secItems = h("section", { class: "section" }, h("h2", {}, "Serviços"), itemsBox,
    h("button", { class: "btn", type: "button", onclick: () => { q.items.push({ id: rid(), title: "", description: "", deliverables: [], price: 0, deadline: "" }); markDirty(); drawItems(); drawPackages(); } }, icon("plus"), "Adicionar serviço"),
    sumEl, field("Parcelas no cartão para serviços avulsos", bind(q, "defaultInstallments", { min: 1, max: 12 }, "number")));

  // Pacotes
  const pkBox = h("div", { class: "stack" });
  const drawPackages = () => {
    pkBox.replaceChildren(...q.packages.map((p, i) => {
      const full = q.items.filter((it) => p.itemIds.includes(it.id)).reduce((s, it) => s + Number(it.price || 0), 0);
      const fullEl = h("small", { class: "hint" }, `Soma avulsa: ${brl(full)}${p.cash && full > p.cash ? ` · economia à vista ${brl(full - p.cash)}` : ""}`);
      const inst = h("small", { class: "hint" }, p.card && p.installments ? `${p.installments}x de ${brl(p.card / p.installments)}` : "");
      return h("div", { class: "repeat" },
        h("div", { class: "head" }, h("strong", {}, `Pacote ${i + 1}`), h("button", { class: "btn small danger", type: "button", onclick: () => { q.packages.splice(i, 1); markDirty(); drawPackages(); } }, "Remover")),
        field("Nome do pacote", bind(p, "name", { placeholder: "Ex.: Pacote completo" })),
        h("div", { class: "checks" }, ...q.items.map((it) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: p.itemIds.includes(it.id), onchange: (e) => { p.itemIds = e.target.checked ? [...p.itemIds, it.id] : p.itemIds.filter((x) => x !== it.id); markDirty(); drawPackages(); } }), h("span", {}, it.title || "(sem título)", h("small", {}, brl(it.price)))))),
        fullEl,
        h("div", { class: "row3" }, field("À vista (R$)", bind(p, "cash", {}, "money")), field("Cartão (R$)", bind(p, "card", {}, "money")), field("Parcelas", bind(p, "installments", { min: 1, max: 12 }, "number"))), inst,
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!p.highlight, onchange: (e) => { p.highlight = e.target.checked; markDirty(); } }), "Destacar este pacote"),
        field("Etiqueta do destaque", bind(p, "tag", { placeholder: "Maior economia" })));
    }));
  };
  const secPk = h("section", { class: "section" }, h("h2", {}, "Pacotes"), h("p", { class: "hint" }, "Opcional. Agrupe serviços com preço especial à vista e no cartão."), pkBox,
    h("button", { class: "btn", type: "button", onclick: () => { q.packages.push({ id: rid(), name: "", itemIds: q.items.map((i) => i.id), cash: 0, card: 0, installments: 4, highlight: false, tag: "" }); markDirty(); drawPackages(); } }, icon("plus"), "Adicionar pacote"));

  // Bônus e observações
  const bnBox = h("div", { class: "stack" });
  const drawBonus = () => bnBox.replaceChildren(...q.bonuses.map((b, i) => h("div", { class: "repeat" },
    h("div", { class: "head" }, h("strong", {}, `Bônus ${i + 1}`), h("button", { class: "btn small danger", type: "button", onclick: () => { q.bonuses.splice(i, 1); markDirty(); drawBonus(); } }, "Remover")),
    field("Título", bind(b, "title")), field("Detalhe", bind(b, "text")))));
  const secBonus = h("section", { class: "section" }, h("h2", {}, "Bônus e observações"), bnBox,
    h("button", { class: "btn", type: "button", onclick: () => { q.bonuses.push({ title: "", text: "" }); markDirty(); drawBonus(); } }, icon("plus"), "Adicionar bônus"),
    field("Observações (domínio, materiais que o cliente envia, validade...)", bind(q, "notes", { rows: 3 }, "textarea")));

  // Projetos relacionados
  const pgrid = h("div", { class: "projgrid" });
  const drawProjects = (front) => {
    const list = catalog.projects.filter((p) => !p.draft && (!front || p.fronts.includes(front)));
    pgrid.replaceChildren(...list.map((p) => h("button", { type: "button", class: "proj", "aria-pressed": String(q.projectIds.includes(p.id)), onclick: (e) => {
      q.projectIds = q.projectIds.includes(p.id) ? q.projectIds.filter((x) => x !== p.id) : [...q.projectIds, p.id];
      e.currentTarget.setAttribute("aria-pressed", String(q.projectIds.includes(p.id))); markDirty();
    } }, p.cover ? h("img", { src: "/" + p.cover, alt: "", loading: "lazy" }) : h("div", { class: "ph" }), h("span", {}, p.title), h("small", {}, p.kind))));
  };
  let pfront = q.category || "";
  const ptabs = h("div", { class: "tabs" }, ...[{ id: "", label: "Todos" }, ...catalog.fronts].map((f) => h("button", { type: "button", class: "btn small" + (pfront === f.id ? " on" : ""), onclick: (e) => { pfront = f.id; ptabs.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); drawProjects(pfront); } }, f.label)));
  const secProj = h("section", { class: "section" }, h("h2", {}, "Trabalhos relacionados"), h("p", { class: "hint" }, "Toque para escolher os projetos que aparecem na página do cliente e no PDF."), ptabs, pgrid);

  // Anexos
  const filesBox = h("div", { class: "stack" });
  const drawFiles = () => filesBox.replaceChildren(...(q.attachments || []).map((a) => h("div", { class: "file" },
    h("span", {}, a.fromClient ? `Do cliente: ${a.name}` : a.name),
    h("label", { class: "check", style: "padding:0" }, h("input", { type: "checkbox", checked: a.showToClient, onchange: (e) => { a.showToClient = e.target.checked; markDirty(); } }), h("small", {}, "Cliente vê")),
    h("a", { class: "btn small", href: `/api/quotes/${q.slug}/files/${a.id}`, target: "_blank" }, "Abrir"),
    h("button", { class: "btn small danger", type: "button", "aria-label": `Remover ${a.name}`, onclick: async () => { await api(`/api/quotes/${q.slug}/files/${a.id}`, { method: "DELETE" }); q.attachments = q.attachments.filter((x) => x.id !== a.id); drawFiles(); toast("Arquivo removido"); } }, icon("trash")))));
  const fileInput = h("input", { type: "file", multiple: true, accept: "image/*,application/pdf,.ai,.svg,.zip", style: "display:none", onchange: async (e) => {
    if (!q.slug) { toast("Salve o orçamento antes de anexar arquivos"); return; }
    for (const f of e.target.files) {
      const fd = new FormData(); fd.append("file", f);
      try { const meta = await api(`/api/quotes/${q.slug}/files`, { method: "POST", body: fd }); q.attachments = [...(q.attachments || []), meta]; toast(`${f.name} anexado`); }
      catch (x) { toast(`${f.name}: ${x.message}`); }
    }
    e.target.value = ""; drawFiles();
  } });
  const secFiles = h("section", { class: "section" }, h("h2", {}, "Arquivos"), h("p", { class: "hint" }, "Logo atual, referências, mockups. Até 4 MB cada."), filesBox,
    h("button", { class: "btn", type: "button", onclick: () => fileInput.click() }, icon("plus"), "Anexar arquivos"), fileInput);

  // Contrato
  const ctText = h("textarea", { rows: 8, placeholder: "Deixe em branco para usar o modelo padrão dos Ajustes." }); ctText.value = q.contract?.text || "";
  ctText.addEventListener("input", () => { q.contract.text = ctText.value; markDirty(); });
  const secContract = h("section", { class: "section" }, h("h2", {}, "Contrato e aceite"),
    h("label", { class: "switch" }, "Pedir aceite do contrato na aprovação", h("input", { type: "checkbox", role: "switch", checked: q.contract?.enabled !== false, onchange: (e) => { q.contract.enabled = e.target.checked; markDirty(); } })),
    h("p", { class: "hint" }, "Campos automáticos: {{cliente}}, {{documento}}, {{servicos}}, {{valor}}, {{pagamento}}, {{prazo}}, {{data}}, {{emissor}}, {{emissor_doc}}."),
    field("Texto específico deste cliente", ctText));

  // Publicação
  const linkBox = h("div");
  const drawLink = () => linkBox.replaceChildren(q.slug ? h("div", { class: "linkbox" }, h("code", {}, `${location.host}/${q.slug}`),
    h("button", { class: "iconbtn", type: "button", "aria-label": "Copiar link", onclick: () => copy(`${location.origin}/${q.slug}`) }, icon("copy"))) : h("p", { class: "hint" }, "O link é criado ao salvar: nome do cliente + código curto."));
  const secPub = h("section", { class: "section" }, h("h2", {}, "Link do cliente"),
    h("label", { class: "switch" }, "Link ativo (cliente pode abrir)", h("input", { type: "checkbox", role: "switch", checked: !!q.published, onchange: (e) => { q.published = e.target.checked; markDirty(); } })),
    linkBox, slug ? h("button", { class: "btn danger", type: "button", onclick: async () => {
      if (!confirmInline(secPub, "Excluir este orçamento, arquivos e histórico?", async () => { await api(`/api/quotes/${q.slug}`, { method: "DELETE" }); toast("Orçamento excluído"); location.hash = "#/"; })) return;
    } }, icon("trash"), "Excluir orçamento") : null);

  function recalc() { sumEl.replaceChildren(h("span", {}, "Soma dos serviços"), h("span", {}, brl(q.items.reduce((s, i) => s + Number(i.price || 0), 0)))); }

  async function save({ silent } = {}) {
    if (!q.client.name.trim()) { toast("Informe o nome do cliente"); secClient.querySelector("input").focus(); return null; }
    const payload = { ...q, items: q.items.map((i) => ({ ...i, deliverables: (i.deliverables || []).filter((d) => String(d).trim()) })) };
    saveBtn.disabled = true;
    try {
      q = slug || q.slug ? await api(`/api/quotes/${q.slug}`, { method: "PUT", body: payload }) : await api("/api/quotes", { method: "POST", body: payload });
      dirty = false; saveBtn.textContent = "Salvo"; if (!silent) toast("Orçamento salvo");
      if (!slug) { history.replaceState(null, "", `#/q/${q.slug}`); slug = q.slug; }
      drawLink(); return q;
    } catch (x) { toast(x.message); return null; } finally { saveBtn.disabled = false; }
  }
  const ensureSaved = async () => (dirty || !q.slug ? await save({ silent: true }) : q);
  const saveBtn = h("button", { class: "btn primary", type: "button", onclick: () => save() }, slug ? "Salvo" : "Salvar");
  const bar = h("div", { class: "bar" }, h("div", { class: "wrap" }, saveBtn,
    h("button", { class: "btn", type: "button", onclick: async () => { const r = await ensureSaved(); if (r) window.open(`/${r.slug}`, "_blank"); } }, icon("eye"), "Ver"),
    h("button", { class: "btn", type: "button", onclick: async () => { const r = await ensureSaved(); if (r) window.open(`/api/pdf/${r.slug}/orcamento?download`, "_blank"); } }, icon("pdf"), "PDF"),
    h("button", { class: "btn", type: "button", onclick: async () => { const r = await ensureSaved(); if (r) shareQuote(r); } }, icon("share"), "Enviar")));

  drawItems(); drawPackages(); drawBonus(); drawProjects(pfront); drawFiles(); drawLink();
  shell(slug ? q.client.name : "Novo orçamento", { back: "#/", nav: false, actions: slug ? [h("a", { class: "iconbtn", href: `#/q/${slug}/atividade`, "aria-label": "Atividade do cliente" }, icon("activity"))] : [] },
    secClient, secProp, secItems, secPk, secBonus, secProj, secFiles, secContract, secPub, h("div", { style: "height:24px" }));
  root.append(bar);
  window.onbeforeunload = () => (dirty ? true : undefined);
}

function confirmInline(container, msg, onYes) {
  const box = h("div", { class: "repeat", role: "alertdialog" }, h("p", { style: "margin:0" }, msg),
    h("div", { style: "display:flex;gap:8px" }, h("button", { class: "btn danger", type: "button", onclick: () => { box.remove(); onYes(); } }, "Sim, excluir"), h("button", { class: "btn", type: "button", onclick: () => box.remove() }, "Cancelar")));
  container.append(box); box.querySelector("button").focus();
  return false;
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Link copiado"); }
  catch { prompt("Copie o link:", text); }
}
function shareQuote(q) {
  const url = `${location.origin}/${q.slug}`;
  if (!q.published) toast("Atenção: o link está desativado. Ative em Link do cliente.");
  const text = `Olá, ${q.client.name.split(" ")[0]}! Preparei sua proposta. Você pode ver os detalhes, escolher a condição e aprovar por aqui:`;
  const phone = (q.client.phone || "").replace(/\D/g, "");
  const wa = `https://wa.me/${phone ? (phone.length <= 11 ? "55" + phone : phone) : ""}?text=${encodeURIComponent(text + " " + url)}`;
  const sheet = h("div", { class: "section", style: "position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:40;box-shadow:0 12px 40px rgba(0,0,0,.25)" },
    h("h2", {}, "Enviar para o cliente"), h("div", { class: "linkbox" }, h("code", {}, url)),
    h("a", { class: "btn primary", href: wa, target: "_blank", rel: "noopener" }, "Abrir no WhatsApp"),
    navigator.share ? h("button", { class: "btn", type: "button", onclick: () => navigator.share({ title: `Proposta · ${q.client.name}`, text, url }).catch(() => {}) }, icon("share"), "Outras opções") : null,
    h("button", { class: "btn", type: "button", onclick: () => copy(url) }, icon("copy"), "Copiar link"),
    h("a", { class: "btn", href: `/api/pdf/${q.slug}/orcamento?download`, target: "_blank" }, icon("pdf"), "Baixar PDF"),
    h("button", { class: "btn", type: "button", onclick: () => sheet.remove() }, "Fechar"));
  document.body.append(sheet);
}

/* ---------- atividade de um orçamento ---------- */
async function renderActivity(slug) {
  const { quote: q, state: s, events } = await api(`/api/quotes/${slug}`);
  const [st, cls] = statusOf({ ...q, state: s });
  const kv = (k, v) => [h("dt", {}, k), h("dd", {}, v)];
  const sum = h("section", { class: "section" }, h("h2", {}, "Situação"), h("div", {}, h("span", { class: `chip ${cls}` }, st)),
    h("dl", { class: "kv" },
      ...kv("Visualizações", String(s.views || 0)),
      ...(s.firstViewAt ? kv("Primeira visita", when(s.firstViewAt)) : []),
      ...(s.selection ? kv("Escolha atual", `${s.selection.packageId ? (q.packages.find((p) => p.id === s.selection.packageId)?.name || "Pacote") : "Serviços avulsos"} · ${s.selection.method === "cartao" ? "cartão" : "à vista"}`) : []),
      ...(s.approvedAt ? [...kv("Aprovado por", `${s.signer?.name} · ${s.signer?.doc}`), ...kv("Quando", new Date(s.approvedAt).toLocaleString("pt-BR")), ...kv("Valor", `${brl(s.total)} · ${s.paymentText}`), ...kv("E-mail", s.signer?.email || "—")] : []),
      ...(s.paidAt ? kv("Pago em", new Date(s.paidAt).toLocaleString("pt-BR")) : [])),
    h("div", { style: "display:flex;gap:8px;flex-wrap:wrap" },
      s.approvedAt && s.contractText ? h("a", { class: "btn", href: `/api/pdf/${slug}/contrato?download`, target: "_blank" }, icon("pdf"), "Contrato assinado") : null,
      s.paymentNotice ? h("a", { class: "btn", href: `/api/quotes/${slug}/files/${s.paymentNotice.fileId}`, target: "_blank" }, "Ver comprovante") : null,
      h("a", { class: "btn", href: `/api/pdf/${slug}/orcamento?download`, target: "_blank" }, icon("pdf"), "Proposta")));
  const timeline = h("section", { class: "section" }, h("h2", {}, "Linha do tempo"),
    events.length ? h("div", {}, ...events.map(evRow)) : h("p", { class: "hint" }, "Nenhuma interação ainda."));
  shell(q.client.name, { back: `#/q/${slug}`, nav: false }, sum, timeline);
}
function evRow(e, withName) {
  return h("div", { class: "ev" }, h("span", { class: `dot ${e.type}` }),
    h("div", {}, h("p", {}, withName && !["approve", "comment"].includes(e.type) ? h("strong", {}, `${e.slug.replace(/-[a-z0-9]{3}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} · `) : null, evText(e)),
      e.message ? h("blockquote", {}, e.message) : null, h("small", {}, when(e.at))));
}

/* ---------- caixa de atividade geral ---------- */
async function renderInbox() {
  const evs = await api("/api/inbox");
  lastSeenInbox = Date.now(); localStorageSet("ge_inbox_seen", String(lastSeenInbox));
  let showViews = false;
  const box = h("section", { class: "section" });
  const draw = () => {
    const list = evs.filter((e) => showViews || e.type !== "view");
    box.replaceChildren(h("h2", {}, "Interações dos clientes"),
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: showViews, onchange: (e) => { showViews = e.target.checked; draw(); } }), "Mostrar visualizações"),
      list.length ? h("div", {}, ...list.map((e) => { const row = evRow(e, true); row.style.cursor = "pointer"; row.onclick = () => (location.hash = `#/q/${e.slug}/atividade`); return row; })) : h("p", { class: "hint" }, "Nada por aqui ainda."));
  };
  draw();
  shell("Atividade", {}, box);
}

/* ---------- ajustes ---------- */
async function renderSettings() {
  const s = await api("/api/settings");
  const bind = (obj, key, attrs = {}, type = "text") => { const el = h(type === "textarea" ? "textarea" : "input", { ...attrs, ...(type !== "textarea" ? { type } : {}) }); el.value = obj[key] ?? ""; el.addEventListener("input", () => (obj[key] = type === "number" ? Number(el.value) : el.value)); return el; };
  const f = (l, el) => h("label", { class: "f" }, l, el);
  const tpl = bind(s, "contractTemplate", { rows: 14 }, "textarea");
  shell("Ajustes", {},
    h("section", { class: "section" }, h("h2", {}, "Seus dados"),
      f("Nome", bind(s.issuer, "name")), f("Documento", bind(s.issuer, "doc")),
      h("div", { class: "row" }, f("E-mail", bind(s.issuer, "email", {}, "email")), f("Site", bind(s.issuer, "site"))),
      h("div", { class: "row" }, f("WhatsApp (só números, com 55)", bind(s.issuer, "whatsapp", { inputmode: "numeric" })), f("WhatsApp exibido", bind(s.issuer, "whatsappLabel")))),
    h("section", { class: "section" }, h("h2", {}, "Pagamento"),
      h("div", { class: "row" }, f("Entrada à vista (%)", bind(s.payments, "entryPct", { min: 0, max: 100 }, "number")), f("Máx. parcelas", bind(s.payments, "maxInstallments", { min: 1, max: 12 }, "number"))),
      f("Chave Pix", bind(s.pix, "key", { placeholder: "CNPJ, e-mail, telefone ou chave aleatória" })),
      h("div", { class: "row" }, f("Nome no Pix", bind(s.pix, "merchantName")), f("Cidade no Pix", bind(s.pix, "merchantCity"))),
      h("p", { class: "hint" }, s.stripeEnabled ? "Cartão e Apple Pay: ativos (Stripe conectado)." : "Cartão e Apple Pay: aguardando conexão com o Stripe (chave configurada na hospedagem).")),
    h("section", { class: "section" }, h("h2", {}, "Modelo de contrato"), h("p", { class: "hint" }, "Usado quando o orçamento não tem texto próprio. Revise com um advogado antes de usar."), tpl),
    h("button", { class: "btn primary", type: "button", onclick: async () => { try { await api("/api/settings", { method: "PUT", body: s }); toast("Ajustes salvos"); } catch (x) { toast(x.message); } } }, "Salvar ajustes"),
    h("button", { class: "btn", type: "button", onclick: async () => { await api("/api/logout", { method: "POST" }); renderLogin(); } }, "Sair"),
    h("div", { style: "height:24px" }));
}

/* ---------- roteamento ---------- */
async function route() {
  window.onbeforeunload = null;
  document.querySelectorAll("body > .section").forEach((x) => x.remove());
  try {
    const me = await api("/api/me");
    if (!me.admin) return renderLogin();
    if (!catalog.projects.length) catalog = await fetch("/data/projects.json").then((r) => r.json());
    const r = location.hash.replace(/^#/, "") || "/";
    let m;
    if (r === "/") return await renderList();
    if (r === "/novo") return await renderEditor(null);
    if (r === "/inbox") return await renderInbox();
    if (r === "/ajustes") return await renderSettings();
    if ((m = r.match(/^\/q\/([a-z0-9-]+)\/atividade$/))) return await renderActivity(m[1]);
    if ((m = r.match(/^\/q\/([a-z0-9-]+)$/))) return await renderEditor(m[1]);
    location.hash = "#/";
  } catch (x) { if (x.message !== "login") { root.replaceChildren(h("main", { class: "wrap empty" }, h("p", {}, x.message), h("a", { class: "btn", href: "#/" }, "Voltar"))); } }
}
window.addEventListener("hashchange", route);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/app/sw.js").catch(() => {});
route();

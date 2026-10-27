// Studio · gestão de propostas, contratos, serviços e pagamentos de Gustavo Elian.
// SPA sem dependências. Rotas por hash; dados nas Netlify Functions (/api/*).
const root = document.getElementById("root");
const toastEl = document.getElementById("toast");
let catalog = { fronts: [], projects: [] };
let settingsCache = null;
let lastSeenInbox = Number(lsGet("ge_inbox_seen") || 0);

/* ================= utilidades ================= */
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
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
const brlShort = (v) => { const n = Number(v || 0); if (Math.abs(n) >= 1e6) return "R$ " + (n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi"; if (Math.abs(n) >= 1e4) return "R$ " + (n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil"; return brl(n); };
/* número grande: "R$" pequeno + valor + centavos discretos */
const bigMoney = (v) => { const [int, dec] = Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(","); return h("span", {}, h("small", {}, "R$"), int, h("small", { style: "margin:0 0 0 2px" }, "," + dec)); };
const parseMoney = (s) => { if (typeof s === "number") return s; const t = String(s || "").replace(/[^\d,.-]/g, ""); if (!t) return 0; return t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) || 0 : Number(t) || 0; };
const fmtMoneyInput = (v) => (v ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
const rid = () => Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const dateBR = (iso) => (iso ? new Date(iso.length === 10 ? iso + "T12:00" : iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "—");
const when = (iso) => { const d = new Date(iso); const diff = (Date.now() - d) / 1000; if (diff < 60) return "agora"; if (diff < 3600) return `há ${Math.floor(diff / 60)} min`; if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`; if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`; return dateBR(iso); };
const initials = (n) => String(n || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const hue = (s) => [...String(s || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
function toast(msg) { toastEl.textContent = msg; toastEl.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.hidden = true), 2800); }
function haptic() { try { navigator.vibrate?.(8); } catch {} }

async function api(path, opts = {}) {
  const isForm = opts.body instanceof FormData;
  const res = await fetch(path, { credentials: "same-origin", ...opts, headers: opts.body && !isForm ? { "content-type": "application/json" } : {}, body: opts.body && !isForm ? JSON.stringify(opts.body) : opts.body });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/login") { renderLogin(); throw new Error("login"); }
  if (!res.ok) throw new Error(data.error || "Algo deu errado");
  return data;
}
async function getSettings() { if (!settingsCache) settingsCache = await api("/api/settings"); return settingsCache; }

const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 18l6-6-6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/><path d="M6 6V5a2 2 0 0 1 2-2h9"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>', send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>', box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  down: '<path d="M12 5v14M5 12l7 7 7-7"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', wa: '<path d="M21 12a9 9 0 0 1-13.4 7.9L3 21l1.2-4.4A9 9 0 1 1 21 12z"/><path d="M8.5 9.5c.5 2.5 3.5 5.5 6 6l1.5-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z"/>',
};
const icon = (name) => h("span", { html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`, style: "display:inline-flex" });

/* ================= regras de negócio ================= */
const STAGES = [["aprovado", "Aprovado"], ["producao", "Produção"], ["revisao", "Revisão"], ["entregue", "Entregue"], ["concluido", "Concluído"]];
const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const stageLabel = (s) => (STAGES.find((x) => x[0] === s) || STAGES[0])[1];
const METHODS = { pix: "Pix", cartao: "Cartão", transferencia: "Transferência", dinheiro: "Dinheiro", boleto: "Boleto", outro: "Outro" };
const paidOf = (q) => Number(q.state?.paidTotal ?? (q.state?.paidAt ? q.state?.total || q.total : 0));
const totalOf = (q) => Number(q.state?.approvedAt ? q.state.total : q.total) || 0;
const expiresAt = (q) => { const d = new Date((q.date || q.createdAt?.slice(0, 10) || today()) + "T23:59"); d.setDate(d.getDate() + Number(q.validDays || 15)); return d; };
function statusOf(q) {
  const s = q.state || {};
  if (s.approvedAt) {
    const paid = paidOf(q), tot = totalOf(q);
    if (tot > 0 && paid >= tot - 0.01) return ["Quitado", "ok", "pago"];
    if (s.paymentNotice && !s.paymentNotice.confirmedAt) return ["Comprovante", "warn", "aprovado"];
    return ["Aprovado", "ok", "aprovado"];
  }
  if (!q.published) return ["Rascunho", "", "rascunho"];
  if (expiresAt(q) < new Date()) return ["Expirada", "danger", "expirada"];
  if (s.firstViewAt) return ["Visualizada", "info", "visto"];
  return ["Enviada", "", "enviado"];
}
/* plano de recebimento de um contrato: entrada + saldo (à vista) ou valor cheio (cartão) */
function planOf(q, pct) {
  const s = q.state || {}, tot = totalOf(q), paid = paidOf(q);
  if (!s.approvedAt) return [];
  if (s.selection?.method === "cartao") return [{ label: "Cartão de crédito", amount: tot, due: s.approvedAt.slice(0, 10), done: paid >= tot - 0.01 }];
  const entry = Math.round(tot * pct) / 100;
  return [
    { label: `Entrada (${pct}%)`, amount: entry, due: s.approvedAt.slice(0, 10), done: paid >= entry - 0.01 },
    { label: `Saldo na entrega (${100 - pct}%)`, amount: tot - entry, due: s.work?.dueDate || "", done: paid >= tot - 0.01 },
  ];
}
const evText = (e) => ({
  view: "Abriu a proposta" + (e.city ? ` em ${e.city}` : ""),
  select: `Escolheu ${e.label} · ${e.method === "cartao" ? "cartão" : "à vista"} · ${brl(e.total)}`,
  comment: `${e.name || "Cliente"} comentou`,
  approve: `${e.name} aprovou e assinou · ${brl(e.total)}`,
  "payment-notice": "Enviou comprovante de Pix",
  "checkout-start": `Iniciou pagamento no cartão · ${brl(e.total)}`,
  paid: `Pagamento confirmado · ${brl(e.total)}`,
  payment: `Recebimento registrado · ${brl(e.total)} (${METHODS[e.method] || e.method})`,
  stage: `Contrato → ${stageLabel(e.stage)}`,
  "email-sent": e.what === "entrega" ? "Entrega final enviada por e-mail" : `Proposta enviada por e-mail para ${e.to || "o cliente"}`,
  "email-error": "E-mail da entrega não saiu",
  delivery: e.certificate ? `Entrega final gerada · certificado ${e.certificate}` : "Entrega final gerada · certificado aguarda quitação",
  drive: "Contrato salvo no Drive e enviado por e-mail",
  "drive-error": `Contrato não foi para o Drive: ${e.message || "erro"}`,
}[e.type] || e.type);
const nameFromSlug = (slug) => slug.replace(/-[a-z0-9]{3}$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ================= estrutura de tela ================= */
function shell({ title, eyebrow, back, actions = [], nav = true, compact = false, fab = null }, ...content) {
  document.querySelectorAll(".scrim,.sheet").forEach((x) => x.remove());
  const header = h("header", { class: "top" + (compact ? " compact" : "") }, h("div", { class: "wrap" },
    back ? h("a", { class: "ibtn", href: back, "aria-label": "Voltar" }, icon("back")) : null,
    h("div", { class: "title" }, eyebrow ? h("div", { class: "eyebrow" }, eyebrow) : null, h("h1", {}, title)),
    ...actions));
  root.replaceChildren(header, h("main", { class: "wrap view" }, ...content), ...(nav ? [navBar()] : []), ...(fab ? [fab] : []));
  window.scrollTo(0, 0);
}
function navBar() {
  const r = location.hash || "#/";
  const on = (...p) => p.some((x) => (x === "#/" ? r === "#/" || r === "" : r.startsWith(x)));
  const item = (href, label, ic, active) => h("a", { href, class: active ? "on" : "", "aria-current": active ? "page" : null }, icon(ic), label);
  return h("nav", { class: "nav glass", "aria-label": "Principal" },
    item("#/", "Início", "home", on("#/")),
    item("#/propostas", "Propostas", "doc", on("#/propostas", "#/q/", "#/novo")),
    item("#/contratos", "Contratos", "pen", on("#/contratos", "#/c/")),
    item("#/financeiro", "Financeiro", "wallet", on("#/financeiro")),
    item("#/servicos", "Serviços", "grid", on("#/servicos")));
}
function headerActions() {
  const bell = h("a", { class: "ibtn", href: "#/atividade", "aria-label": "Atividade dos clientes" }, icon("bell"));
  api("/api/inbox").then((evs) => { if (evs.some((e) => e.type !== "view" && Date.parse(e.at) > lastSeenInbox)) { bell.append(h("span", { class: "dot", "aria-hidden": "true" })); bell.setAttribute("aria-label", "Atividade dos clientes, há novidades"); } }).catch(() => {});
  return [bell, h("a", { class: "ibtn", href: "#/portfolio", "aria-label": "Portfólio do site" }, icon("image")), h("a", { class: "ibtn", href: "#/ajustes", "aria-label": "Ajustes" }, icon("gear"))];
}
const fabNew = () => h("a", { class: "fab", href: "#/novo", "aria-label": "Nova proposta" }, icon("plus"));
const secH = (t, link) => h("div", { class: "sec-h" }, h("h2", {}, t), link || null);
const loading = (title) => shell({ title }, h("div", { class: "stack", style: "padding-top:8px" }, h("div", { class: "skel" }), h("div", { class: "skel" }), h("div", { class: "skel" })));
function emptyState(text, action) { return h("div", { class: "empty glass" }, h("div", { class: "orb", "aria-hidden": "true" }), h("p", {}, text), action || null); }
function avatar(name, cls) { return h("span", { class: "avatar", "data-h": String(hue(name)), "aria-hidden": "true" }, initials(name), cls != null ? h("i", { class: "st " + cls }) : null); }

/* folha inferior acessível */
function sheet(title, build, { onClose } = {}) {
  const prev = document.activeElement;
  const close = () => { scrim.remove(); box.remove(); document.removeEventListener("keydown", esc); prev?.focus?.(); onClose?.(); };
  const esc = (e) => { if (e.key === "Escape") close(); };
  const scrim = h("div", { class: "scrim", onclick: close });
  const box = h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": title }, h("div", { class: "grip", "aria-hidden": "true" }), h("h2", {}, title));
  box.append(...[].concat(build(close)));
  document.body.append(scrim, box); document.addEventListener("keydown", esc);
  setTimeout(() => (box.querySelector("input,select,textarea,button:not(.ghost)") || box).focus(), 60);
  return close;
}
function confirmSheet(title, text, yesLabel, onYes) {
  sheet(title, (close) => [h("p", { class: "muted" }, text), h("div", { class: "btns grid2" },
    h("button", { class: "btn", type: "button", onclick: close }, "Cancelar"),
    h("button", { class: "btn danger", type: "button", onclick: async () => { close(); await onYes(); } }, yesLabel))]);
}

/* ================= login ================= */
function renderLogin() {
  const err = h("p", { class: "err", role: "alert" });
  const pw = h("input", { class: "in", type: "password", id: "pw", autocomplete: "current-password", required: true, placeholder: "••••••••" });
  const btn = h("button", { class: "btn primary block", type: "submit" }, "Entrar");
  // rótulo visível + mostrar/ocultar senha (evita erro de digitação no celular)
  const eye = h("button", { class: "pw-eye", type: "button", "aria-label": "Mostrar senha", "aria-pressed": "false", onclick: () => {
    const show = pw.type === "password"; pw.type = show ? "text" : "password";
    eye.setAttribute("aria-pressed", String(show)); eye.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha"); eye.textContent = show ? "Ocultar" : "Mostrar"; pw.focus();
  } }, "Mostrar");
  const field = h("div", { class: "pw-field" }, h("label", { for: "pw", class: "pw-label" }, "Senha de acesso"), h("div", { class: "pw-wrap" }, pw, eye));
  root.replaceChildren(h("main", { class: "login" },
    h("div", { class: "mark", role: "img", "aria-label": "@gustavoelian" }),
    h("div", { class: "orbit", "aria-hidden": "true" }),
    h("h1", {}, "Studio"),
    h("p", { class: "muted" }, "Propostas, contratos e recebimentos num lugar só."),
    h("form", { onsubmit: async (e) => {
      e.preventDefault(); err.textContent = ""; btn.disabled = true; btn.textContent = "Entrando…";
      try { await api("/api/login", { method: "POST", body: { password: pw.value } }); haptic(); if (!location.hash || location.hash === "#") location.hash = "#/"; route(); }
      catch (x) { err.textContent = x.message; pw.select(); } finally { btn.disabled = false; btn.textContent = "Entrar"; }
    } }, field, err, btn)));
  setTimeout(() => pw.focus(), 80);
}

/* ================= início (painel) ================= */
async function renderHome() {
  loading("Início");
  const [list, evs, settings] = await Promise.all([api("/api/quotes"), api("/api/inbox").catch(() => []), getSettings()]);
  const pct = Number(settings.payments?.entryPct ?? 60);
  const now = new Date(), ym = (d) => d.toISOString().slice(0, 7);
  const allPayments = list.flatMap((q) => (q.state?.payments || []).map((p) => ({ ...p, q })));
  const months = [...Array(6)].map((_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") }; });
  const byMonth = Object.fromEntries(months.map((m) => [m.key, 0]));
  allPayments.forEach((p) => { const k = String(p.date || p.at).slice(0, 7); if (k in byMonth) byMonth[k] += Number(p.amount || 0); });
  const cur = byMonth[months[5].key], prev = byMonth[months[4].key];
  const approved = list.filter((q) => q.state?.approvedAt);
  const receivable = approved.reduce((s, q) => s + Math.max(0, totalOf(q) - paidOf(q)), 0);
  const open = list.filter((q) => q.published && !q.state?.approvedAt && expiresAt(q) >= now);
  const pipeline = open.reduce((s, q) => s + totalOf(q), 0);
  const since = Date.now() - 90 * 864e5;
  const sent90 = list.filter((q) => q.published && Date.parse(q.createdAt) > since);
  const rate = sent90.length ? Math.round((sent90.filter((q) => q.state?.approvedAt).length / sent90.length) * 100) : null;
  const active = approved.filter((q) => (q.state?.work?.stage || "aprovado") !== "concluido");

  const hello = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const max = Math.max(...Object.values(byMonth), 1);
  const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  const hero = h("section", { class: "hero glass", "aria-label": "Recebido no mês" },
    h("p", { class: "lbl" }, `Recebido em ${now.toLocaleDateString("pt-BR", { month: "long" })}`),
    h("p", { class: "big" }, bigMoney(cur)),
    delta == null ? h("p", { class: "delta" }, cur ? "Primeiro mês com recebimentos registrados" : "Nenhum recebimento registrado ainda") : h("p", { class: "delta " + (delta >= 0 ? "up" : "down") }, h("b", {}, `${delta >= 0 ? "+" : ""}${delta}%`), " em relação ao mês anterior"),
    h("div", { class: "bars", role: "img", "aria-label": "Recebido por mês nos últimos seis meses: " + months.map((m) => `${m.label} ${brl(byMonth[m.key])}`).join(", ") },
      ...months.map((m, i) => h("div", { class: "b" + (i === 5 ? " cur" : ""), tabindex: "0", "aria-hidden": "true" },
        h("span", { style: `height:${Math.max(2, (byMonth[m.key] / max) * 100)}%` }), h("div", { class: "tip" }, `${m.label}: ${brl(byMonth[m.key])}`)))),
    h("div", { class: "bars-x", "aria-hidden": "true" }, ...months.map((m, i) => h("span", { class: i === 5 ? "cur" : "" }, m.label))));

  const tile = (href, ic, k, v, s) => h("a", { class: "tile glass", href }, h("span", { class: "k" }, icon(ic), k), h("span", { class: "v" }, v), h("span", { class: "s" }, s));
  const tiles = h("div", { class: "tiles" },
    tile("#/financeiro", "wallet", "A receber", brlShort(receivable), pl(approved.filter((q) => totalOf(q) - paidOf(q) > 0.01).length, "contrato em aberto", "contratos em aberto")),
    tile("#/propostas", "send", "Em negociação", brlShort(pipeline), pl(open.length, "proposta no ar", "propostas no ar")),
    tile("#/propostas", "trend", "Aprovação", rate == null ? "—" : `${rate}%`, "propostas dos últimos 90 dias"),
    tile("#/contratos", "pen", "Em andamento", String(active.length), "contratos ativos"));

  // Precisa de você: coisas que pedem uma ação agora
  const todos = [];
  approved.forEach((q) => { const n = q.state.paymentNotice; if (n && !n.confirmedAt && totalOf(q) - paidOf(q) > 0.01) todos.push({ cls: "warn", ic: "receipt", t: `Confirmar Pix de ${q.client.name}`, s: `Comprovante enviado ${when(n.at)}`, href: `#/c/${q.slug}` }); });
  approved.forEach((q) => { const due = q.state.work?.dueDate; const st = q.state.work?.stage || "aprovado"; if (due && due < today() && !["entregue", "concluido"].includes(st)) todos.push({ cls: "danger", ic: "alert", t: `Entrega atrasada · ${q.client.name}`, s: `Prevista para ${dateBR(due)}`, href: `#/c/${q.slug}` }); });
  approved.forEach((q) => { if (!q.state.payments?.length && totalOf(q) > 0) { const pl = planOf(q, pct)[0]; if (pl && !pl.done && Date.now() - Date.parse(q.state.approvedAt) > 2 * 864e5) todos.push({ cls: "warn", ic: "wallet", t: `Cobrar entrada · ${q.client.name}`, s: `${brl(pl.amount)} desde ${dateBR(q.state.approvedAt)}`, href: `#/c/${q.slug}` }); } });
  const recentComments = evs.filter((e) => e.type === "comment" && Date.now() - Date.parse(e.at) < 7 * 864e5).slice(0, 3);
  recentComments.forEach((e) => todos.push({ cls: "info", ic: "chat", t: `${e.name || nameFromSlug(e.slug)} comentou`, s: (e.message || "").slice(0, 70), href: `#/q/${e.slug}/detalhe` }));
  open.forEach((q) => { const d = (expiresAt(q) - now) / 864e5; if (q.state?.firstViewAt && Date.now() - Date.parse(q.state.lastViewAt || q.state.firstViewAt) > 3 * 864e5) todos.push({ cls: "info", ic: "send", t: `Follow-up com ${q.client.name}`, s: `Viu ${q.state.views || 1}x, último acesso ${when(q.state.lastViewAt || q.state.firstViewAt)}`, href: `#/q/${q.slug}/detalhe` }); else if (d <= 3) todos.push({ cls: "warn", ic: "clock", t: `Proposta vence em ${Math.max(0, Math.ceil(d))} dia(s)`, s: q.client.name, href: `#/q/${q.slug}/detalhe` }); });
  const drafts = list.filter((q) => !q.published && !q.state?.approvedAt);
  if (drafts.length) todos.push({ cls: "", ic: "doc", t: pl(drafts.length, "rascunho para finalizar", "rascunhos para finalizar"), s: drafts.slice(0, 2).map((q) => q.client.name).join(", "), href: "#/propostas?f=rascunho" });
  const todoBox = todos.length
    ? h("div", { class: "list" }, ...todos.slice(0, 6).map((t) => h("a", { class: "todo glass " + t.cls, href: t.href }, h("span", { class: "ic" }, icon(t.ic)), h("div", {}, h("p", {}, t.t), h("small", {}, t.s)), h("span", { class: "go" }, icon("chev")))))
    : h("div", { class: "todo glass ok" }, h("span", { class: "ic" }, icon("check")), h("div", {}, h("p", {}, "Tudo em dia"), h("small", {}, "Nenhuma pendência agora.")), h("span", {}));

  const recent = evs.filter((e) => e.type !== "view").slice(0, 4);
  shell({ title: `${hello}, Gustavo`, eyebrow: now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }), actions: headerActions(), fab: fabNew() },
    hero, h("div", { style: "height:10px" }), tiles,
    secH("Precisa de você"), todoBox,
    secH("Atividade recente", h("a", { href: "#/atividade" }, "Ver tudo")),
    recent.length ? h("div", { class: "glass card" }, ...recent.map((e) => evRow(e, true))) : emptyState("As interações dos clientes aparecem aqui."));
}

/* ================= propostas ================= */
async function renderProposals() {
  loading("Propostas");
  const list = await api("/api/quotes");
  const qs = new URLSearchParams(location.hash.split("?")[1] || "");
  let filter = qs.get("f") || "todas", term = "";
  const FILTERS = [["todas", "Todas"], ["rascunho", "Rascunhos"], ["enviado", "Enviadas"], ["visto", "Visualizadas"], ["aprovado", "Aprovadas"], ["pago", "Quitadas"], ["expirada", "Expiradas"]];
  const count = (f) => (f === "todas" ? list.length : list.filter((q) => statusOf(q)[2] === f).length);
  const box = h("div", { class: "list", "aria-live": "polite" });
  const draw = () => {
    const t = term.toLowerCase();
    const items = list.filter((q) => (filter === "todas" || statusOf(q)[2] === filter) && (!t || `${q.client?.name} ${q.client?.company} ${q.title}`.toLowerCase().includes(t)));
    box.replaceChildren(...(items.length ? items.map((q) => {
      const [st, cls] = statusOf(q);
      const meta = [st, q.title || q.client?.company, q.state?.views ? `${q.state.views} visita${q.state.views > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ");
      return h("a", { class: "row-card glass", href: q.state?.approvedAt ? `#/c/${q.slug}` : `#/q/${q.slug}/detalhe` },
        avatar(q.client?.name, cls || ""),
        h("div", { class: "who" }, h("strong", {}, q.client?.name || "Sem nome"), h("div", { class: "sub" }, meta)),
        h("div", { class: "amt" }, brlShort(totalOf(q)), h("small", {}, when(q.updatedAt))));
    }) : [emptyState(list.length ? "Nada com esse filtro." : "Nenhuma proposta ainda. Crie a primeira no botão +.", list.length ? null : h("a", { class: "btn primary", href: "#/novo" }, icon("plus"), "Nova proposta"))]));
  };
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Filtrar por situação" }, ...FILTERS.map(([id, label]) =>
    h("button", { class: "chip", type: "button", "aria-pressed": String(id === filter), onclick: (e) => { filter = id; chips.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); draw(); } }, label, h("b", {}, String(count(id))))));
  const search = h("label", { class: "search glass" }, icon("search"), h("span", { class: "sr" }, "Buscar"), h("input", { type: "search", placeholder: "Buscar cliente ou projeto", oninput: (e) => { term = e.target.value; draw(); } }));
  draw();
  shell({ title: "Propostas", eyebrow: `${list.length} no total`, actions: headerActions(), fab: fabNew() }, search, chips, h("div", { style: "height:6px" }), box);
}

/* detalhe de uma proposta (antes da aprovação) */
async function renderProposalDetail(slug) {
  loading("Proposta");
  const { quote: q, state: s, events } = await api(`/api/quotes/${slug}`);
  const full = { ...q, state: s, total: (q.items || []).reduce((t, i) => t + Number(i.price || 0), 0) };
  if (s.approvedAt) { location.replace(`#/c/${slug}`); return; }
  const [st, cls] = statusOf(full);
  const exp = expiresAt(full);
  const hero = h("section", { class: "hero glass" },
    h("div", { style: "display:flex;justify-content:space-between;gap:10px;align-items:center" }, h("span", { class: "pill " + cls }, st), h("span", { class: "faint", style: "font-size:var(--t-sm)" }, `Válida até ${dateBR(exp.toISOString())}`)),
    h("p", { class: "big" }, bigMoney(full.total)),
    h("p", { class: "lbl" }, q.title || "Sem título"),
    h("div", { class: "tiles", style: "margin-top:16px" },
      h("div", { class: "tile glass", style: "min-height:auto" }, h("span", { class: "k" }, icon("eye"), "Visitas"), h("span", { class: "v" }, String(s.views || 0)), h("span", { class: "s" }, s.lastViewAt ? `última ${when(s.lastViewAt)}` : "ainda não abriu")),
      h("div", { class: "tile glass", style: "min-height:auto" }, h("span", { class: "k" }, icon("box"), "Escolha"), h("span", { class: "v", style: "font-size:var(--t-md)" }, s.selection ? (s.selection.packageId ? q.packages.find((p) => p.id === s.selection.packageId)?.name || "Pacote" : "Avulsos") : "—"), h("span", { class: "s" }, s.selection ? (s.selection.method === "cartao" ? "no cartão" : "à vista") : "sem seleção"))));
  const actions = h("div", { class: "btns grid2", style: "margin-top:12px" },
    h("a", { class: "btn primary", href: `#/q/${slug}` }, icon("pen"), "Editar"),
    h("button", { class: "btn", type: "button", onclick: () => shareQuote(full) }, icon("send"), "Enviar"),
    h("a", { class: "btn", href: `/${slug}`, target: "_blank", rel: "noopener" }, icon("eye"), "Ver página"),
    h("a", { class: "btn", href: `/api/pdf/${slug}/orcamento?download`, target: "_blank" }, icon("pdf"), "PDF"));
  shell({ title: q.client?.name || "Proposta", eyebrow: "Proposta", back: "#/propostas", compact: true, nav: false },
    hero, actions,
    secH("Linha do tempo"), events.length ? h("div", { class: "glass card" }, ...events.map((e) => evRow(e))) : emptyState("Nenhuma interação ainda. Envie o link para o cliente."),
    h("div", { class: "gap24" }));
}

/* ================= editor ================= */
const blankQuote = () => ({
  client: { name: "", company: "", email: "", phone: "" }, title: "", intro: "", date: today(), validDays: 15, category: "",
  items: [{ id: rid(), title: "", description: "", deliverables: [], price: 0, deadline: "" }], packages: [], defaultInstallments: 3,
  bonuses: [], notes: "", projectIds: [], attachments: [], contract: { enabled: true, text: "" }, published: false,
});

async function renderEditor(slug) {
  loading(slug ? "Editar" : "Nova proposta");
  let q = slug ? (await api(`/api/quotes/${slug}`)).quote : blankQuote();
  const services = await api("/api/catalog").then((c) => (c.services || []).filter((s) => s.active !== false)).catch(() => []);
  let dirty = false;
  const markDirty = () => { dirty = true; saveBtn.lastChild.textContent = "Salvar"; };
  const bind = (obj, key, attrs = {}, kind = "text") => {
    const tag = kind === "textarea" ? "textarea" : "input";
    const el = h(tag, { class: "in" + (kind === "money" ? " money" : ""), ...attrs, ...(tag === "input" ? { type: kind === "money" ? "text" : kind } : {}) });
    if (kind === "money") { el.inputMode = "decimal"; el.value = fmtMoneyInput(obj[key]); el.addEventListener("input", () => { obj[key] = parseMoney(el.value); markDirty(); recalc(); }); el.addEventListener("blur", () => (el.value = fmtMoneyInput(obj[key]))); }
    else { el.value = obj[key] ?? ""; el.addEventListener("input", () => { obj[key] = kind === "number" ? Number(el.value) : el.value; markDirty(); recalc(); }); }
    return el;
  };
  const field = (label, el) => h("label", { class: "f" }, h("span", {}, label), el);
  const card = (title, ...kids) => h("section", { class: "form-card glass" }, h("h2", {}, title), ...kids);

  const secClient = card("Cliente",
    field("Nome do cliente *", bind(q.client, "name", { required: true, autocomplete: "off", placeholder: "Ex.: Larissa Torquato" })),
    field("Empresa ou marca", bind(q.client, "company")),
    field("WhatsApp", bind(q.client, "phone", { inputmode: "tel", placeholder: "(38) 99999-9999" }, "tel")), field("E-mail", bind(q.client, "email", {}, "email")));

  const frontSel = h("select", { class: "in", onchange: (e) => { q.category = e.target.value; markDirty(); } }, h("option", { value: "" }, "Escolha"), ...catalog.fronts.map((f) => h("option", { value: f.id, selected: q.category === f.id }, f.label)));
  const secProp = card("Proposta",
    field("Título", bind(q, "title", { placeholder: "Ex.: Identidade visual, site e sistema" })),
    field("Apresentação: o que você propõe e por quê", bind(q, "intro", { rows: 4 }, "textarea")),
    h("div", { class: "r3" }, field("Data", bind(q, "date", {}, "date")), field("Validade (dias)", bind(q, "validDays", { min: 1, inputmode: "numeric" }, "number")), field("Frente", frontSel)));

  const itemsBox = h("div", { class: "stack" });
  const sumEl = h("div", { class: "total" });
  const drawItems = () => {
    itemsBox.replaceChildren(...q.items.map((it, i) => {
      const del = h("textarea", { class: "in", rows: 3, placeholder: "Um entregável por linha" }); del.value = (it.deliverables || []).join("\n");
      del.addEventListener("input", () => { it.deliverables = del.value.split("\n"); markDirty(); });
      return h("div", { class: "repeat" },
        h("div", { class: "head" }, h("strong", {}, `Serviço ${String(i + 1).padStart(2, "0")}`),
          h("div", { class: "btns" },
            i > 0 ? h("button", { class: "btn sm", type: "button", "aria-label": "Mover para cima", onclick: () => { [q.items[i - 1], q.items[i]] = [q.items[i], q.items[i - 1]]; markDirty(); drawItems(); drawPackages(); } }, "↑") : null,
            h("button", { class: "btn sm danger", type: "button", "aria-label": `Remover serviço ${i + 1}`, onclick: () => { q.items.splice(i, 1); q.packages.forEach((p) => (p.itemIds = p.itemIds.filter((x) => x !== it.id))); markDirty(); drawItems(); drawPackages(); recalc(); } }, icon("trash")))),
        field("Produto ou serviço *", bind(it, "title", { placeholder: "Ex.: Site institucional" })),
        field("Descrição", bind(it, "description", { rows: 2 }, "textarea")),
        field("Entregáveis", del),
        h("div", { class: "r2" }, field("Preço (R$)", bind(it, "price", { placeholder: "0,00" }, "money")), field("Prazo", bind(it, "deadline", { placeholder: "10 dias úteis" }))));
    }));
    recalc();
  };
  const fromCatalog = () => sheet("Adicionar do catálogo", (close) => services.length ? [
    h("div", { class: "list" }, ...services.map((s) => h("button", { class: "row-card glass", type: "button", onclick: () => {
      const blankFirst = q.items.length === 1 && !q.items[0].title && !q.items[0].price;
      const item = { id: rid(), title: s.title, description: s.description, deliverables: [...(s.deliverables || [])], price: s.price, deadline: s.deadline };
      if (blankFirst) q.items = [item]; else q.items.push(item);
      if (!q.category && s.category) q.category = s.category;
      markDirty(); drawItems(); drawPackages(); haptic(); toast(`${s.title} adicionado`); close();
    } }, h("span", { class: "avatar", "data-h": String(hue(s.title)) }, icon("box")), h("div", { class: "who" }, h("strong", {}, s.title), h("div", { class: "sub" }, s.deadline || s.description || "")), h("div", { class: "amt" }, brlShort(s.price)))))
  ] : [h("p", { class: "muted" }, "Seu catálogo está vazio."), h("a", { class: "btn primary", href: "#/servicos", onclick: close }, "Cadastrar serviços")]);
  const secItems = card("Serviços", itemsBox,
    h("div", { class: "btns grid2" },
      h("button", { class: "btn", type: "button", onclick: fromCatalog }, icon("grid"), "Do catálogo"),
      h("button", { class: "btn", type: "button", onclick: () => { q.items.push({ id: rid(), title: "", description: "", deliverables: [], price: 0, deadline: "" }); markDirty(); drawItems(); drawPackages(); } }, icon("plus"), "Em branco")),
    sumEl, field("Parcelas no cartão (serviços avulsos)", bind(q, "defaultInstallments", { min: 1, max: 12, inputmode: "numeric" }, "number")));

  const pkBox = h("div", { class: "stack" });
  const drawPackages = () => {
    pkBox.replaceChildren(...q.packages.map((p, i) => {
      const full = q.items.filter((it) => p.itemIds.includes(it.id)).reduce((s, it) => s + Number(it.price || 0), 0);
      return h("div", { class: "repeat" },
        h("div", { class: "head" }, h("strong", {}, `Pacote ${i + 1}`), h("button", { class: "btn sm danger", type: "button", "aria-label": `Remover pacote ${i + 1}`, onclick: () => { q.packages.splice(i, 1); markDirty(); drawPackages(); } }, icon("trash"))),
        field("Nome do pacote", bind(p, "name", { placeholder: "Ex.: Pacote completo" })),
        h("div", { class: "checks" }, ...q.items.map((it) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: p.itemIds.includes(it.id), onchange: (e) => { p.itemIds = e.target.checked ? [...p.itemIds, it.id] : p.itemIds.filter((x) => x !== it.id); markDirty(); drawPackages(); } }), h("span", {}, it.title || "(sem título)", h("small", {}, brl(it.price)))))),
        h("p", { class: "hint" }, `Soma avulsa: ${brl(full)}${p.cash && full > p.cash ? ` · economia de ${brl(full - p.cash)} à vista` : ""}`),
        h("div", { class: "r3" }, field("À vista", bind(p, "cash", {}, "money")), field("Cartão", bind(p, "card", {}, "money")), field("Parcelas", bind(p, "installments", { min: 1, max: 12, inputmode: "numeric" }, "number"))),
        h("label", { class: "switch" }, "Destacar este pacote", h("input", { type: "checkbox", role: "switch", checked: !!p.highlight, onchange: (e) => { p.highlight = e.target.checked; markDirty(); } })),
        field("Etiqueta do destaque", bind(p, "tag", { placeholder: "Maior economia" })));
    }));
  };
  const secPk = card("Pacotes", h("p", { class: "hint" }, "Opcional. Agrupe serviços com preço especial à vista e no cartão."), pkBox,
    h("button", { class: "btn", type: "button", onclick: () => { q.packages.push({ id: rid(), name: "", itemIds: q.items.map((i) => i.id), cash: 0, card: 0, installments: 4, highlight: false, tag: "" }); markDirty(); drawPackages(); } }, icon("plus"), "Adicionar pacote"));

  const bnBox = h("div", { class: "stack" });
  const drawBonus = () => bnBox.replaceChildren(...q.bonuses.map((b, i) => h("div", { class: "repeat" },
    h("div", { class: "head" }, h("strong", {}, `Bônus ${i + 1}`), h("button", { class: "btn sm danger", type: "button", "aria-label": `Remover bônus ${i + 1}`, onclick: () => { q.bonuses.splice(i, 1); markDirty(); drawBonus(); } }, icon("trash"))),
    field("Título", bind(b, "title")), field("Detalhe", bind(b, "text")))));
  const secBonus = card("Bônus e observações", bnBox,
    h("button", { class: "btn", type: "button", onclick: () => { q.bonuses.push({ title: "", text: "" }); markDirty(); drawBonus(); } }, icon("plus"), "Adicionar bônus"),
    field("Observações (domínio, materiais do cliente, validade)", bind(q, "notes", { rows: 3 }, "textarea")));

  const pgrid = h("div", { class: "projgrid" });
  const drawProjects = (front) => {
    const list = catalog.projects.filter((p) => !p.draft && (!front || (p.fronts || []).includes(front)));
    pgrid.replaceChildren(...list.map((p) => h("button", { type: "button", class: "proj", "aria-pressed": String(q.projectIds.includes(p.id)), onclick: (e) => {
      q.projectIds = q.projectIds.includes(p.id) ? q.projectIds.filter((x) => x !== p.id) : [...q.projectIds, p.id];
      e.currentTarget.setAttribute("aria-pressed", String(q.projectIds.includes(p.id))); markDirty(); haptic();
    } }, p.cover ? h("img", { src: "/" + p.cover, alt: "", loading: "lazy" }) : h("div", { class: "ph" }), h("span", {}, p.title), h("small", {}, p.kind))));
  };
  let pfront = q.category || "";
  const pchips = h("div", { class: "chips", role: "group", "aria-label": "Filtrar trabalhos" }, ...[{ id: "", label: "Todos" }, ...catalog.fronts].map((f) => h("button", { type: "button", class: "chip", "aria-pressed": String(pfront === f.id), onclick: (e) => { pfront = f.id; pchips.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); drawProjects(pfront); } }, f.label)));
  const secProj = card("Trabalhos relacionados", h("p", { class: "hint" }, "Aparecem na página do cliente e no PDF."), pchips, pgrid);

  const filesBox = h("div", { class: "stack" });
  const drawFiles = () => filesBox.replaceChildren(...(q.attachments || []).map((a) => h("div", { class: "file" },
    h("span", {}, a.fromClient ? `Do cliente: ${a.name}` : a.name),
    h("label", { class: "check", style: "padding:0" }, h("input", { type: "checkbox", checked: a.showToClient, onchange: (e) => { a.showToClient = e.target.checked; markDirty(); } }), h("small", {}, "Visível")),
    h("button", { class: "btn sm", type: "button", "aria-label": `Renomear ${a.name}`, onclick: () => renameFile(a), title: "Renomear" }, icon("pen")),
    h("a", { class: "btn sm", href: `/api/quotes/${q.slug}/files/${a.id}`, target: "_blank" }, "Abrir"),
    h("button", { class: "btn sm danger", type: "button", "aria-label": `Remover ${a.name}`, onclick: async () => { await api(`/api/quotes/${q.slug}/files/${a.id}`, { method: "DELETE" }); q.attachments = q.attachments.filter((x) => x.id !== a.id); drawFiles(); toast("Arquivo removido"); } }, icon("trash")))));
  // renomear arquivo: o nome novo aparece para o cliente e no download (a extensão é mantida)
  const renameFile = (a) => sheet("Renomear arquivo", (close) => {
    const ext = (a.name.match(/\.[A-Za-z0-9]{1,6}$/) || [""])[0];
    const inpt = h("input", { class: "in", id: "fileName", value: ext ? a.name.slice(0, -ext.length) : a.name, autocomplete: "off" });
    const err = h("p", { class: "err", role: "alert" });
    const go = h("button", { class: "btn primary block", type: "button", onclick: async () => {
      const name = inpt.value.trim();
      if (!name) { err.textContent = "Informe um nome."; inpt.focus(); return; }
      go.disabled = true;
      try { const m = await api(`/api/quotes/${q.slug}/files/${a.id}`, { method: "PATCH", body: { name: name + ext } }); a.name = m.name; drawFiles(); close(); toast("Arquivo renomeado"); }
      catch (x) { err.textContent = x.message; go.disabled = false; }
    } }, "Salvar nome");
    inpt.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
    setTimeout(() => inpt.select(), 80);
    return [h("label", { class: "f", for: "fileName" }, h("span", {}, ext ? `Nome do arquivo (${ext} é mantido)` : "Nome do arquivo"), inpt), err, go];
  });
  const fileInput = h("input", { type: "file", multiple: true, accept: "image/*,application/pdf,.ai,.svg,.zip", hidden: true, onchange: async (e) => {
    if (!q.slug) { const r = await save({ silent: true }); if (!r) return; }
    for (const f of e.target.files) {
      const fd = new FormData(); fd.append("file", f);
      try { const meta = await api(`/api/quotes/${q.slug}/files`, { method: "POST", body: fd }); q.attachments = [...(q.attachments || []), meta]; toast(`${f.name} anexado`); }
      catch (x) { toast(`${f.name}: ${x.message}`); }
    }
    e.target.value = ""; drawFiles();
  } });
  const secFiles = card("Arquivos", h("p", { class: "hint" }, "Logo atual, referências, mockups. Até 4 MB cada."), filesBox,
    h("button", { class: "btn", type: "button", onclick: () => fileInput.click() }, icon("plus"), "Anexar arquivos"), fileInput);

  const ctText = h("textarea", { class: "in", rows: 8, placeholder: "Em branco: usa o modelo padrão dos Ajustes." }); ctText.value = q.contract?.text || "";
  ctText.addEventListener("input", () => { q.contract.text = ctText.value; markDirty(); });
  const ctExtra = h("textarea", { class: "in", rows: 4, placeholder: "Ex.: vigência de 3 meses, fidelidade de 6 meses após renovação, multa de 30% sobre os meses restantes, 8 captações por mês." }); ctExtra.value = q.contract?.extra || "";
  ctExtra.addEventListener("input", () => { q.contract.extra = ctExtra.value; markDirty(); });
  const secContract = card("Contrato e aceite",
    h("label", { class: "switch" }, "Pedir aceite do contrato na aprovação", h("input", { type: "checkbox", role: "switch", checked: q.contract?.enabled !== false, onchange: (e) => { q.contract.enabled = e.target.checked; markDirty(); } })),
    h("p", { class: "hint" }, "Campos automáticos: {{cliente}}, {{documento}}, {{endereco}}, {{servicos}}, {{valor}}, {{pagamento}}, {{prazo}}, {{data}}, {{cidade}}, {{emissor}}, {{emissor_doc}}, {{especificas}}."),
    field("Condições específicas deste cliente (entram na cláusula 11)", ctExtra),
    h("details", {}, h("summary", { class: "hint" }, "Substituir o contrato inteiro (avançado)"), field("Texto próprio deste cliente", ctText)));

  const linkBox = h("div");
  const drawLink = () => linkBox.replaceChildren(...(q.slug ? [h("div", { class: "linkbox" }, h("code", {}, `${location.host}/${q.slug}`),
    h("button", { class: "ibtn", type: "button", "aria-label": "Editar link", onclick: () => editLink() }, icon("pen")),
    h("button", { class: "ibtn", type: "button", "aria-label": "Copiar link", onclick: () => copy(`${location.origin}/${q.slug}`) }, icon("copy"))),
    q.previousSlugs?.length ? h("p", { class: "hint" }, `Links antigos que continuam funcionando: ${q.previousSlugs.map((x) => "/" + x).join(", ")}`) : null].filter(Boolean) : [h("p", { class: "hint" }, "O link nasce ao salvar: nome do cliente + código curto.")]));
  // trocar o link: o endereço antigo continua abrindo a proposta
  const editLink = () => sheet("Editar link da proposta", (close) => {
    const toSlug = (v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    const prev = h("code", {}, `${location.host}/${q.slug}`);
    const inpt = h("input", { class: "in", id: "slugIn", value: q.slug, autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-describedby": "slugHint",
      oninput: () => { prev.textContent = `${location.host}/${toSlug(inpt.value) || "…"}`; } });
    const err = h("p", { class: "err", role: "alert" });
    const go = h("button", { class: "btn primary block", type: "button", onclick: async () => {
      const v = toSlug(inpt.value);
      if (v.length < 3) { err.textContent = "Use pelo menos 3 letras ou números."; inpt.focus(); return; }
      if (v === q.slug) { close(); return; }
      if (dirty && !(await save({ silent: true }))) return;
      go.disabled = true; go.textContent = "Trocando…";
      try {
        q = await api(`/api/quotes/${q.slug}/rename`, { method: "POST", body: { slug: v } });
        slug = q.slug; history.replaceState(null, "", `#/q/${q.slug}`); drawLink(); close(); toast("Link atualizado"); haptic(); warmPreview(q.slug);
      } catch (x) { err.textContent = x.message; go.disabled = false; go.textContent = "Salvar novo link"; }
    } }, "Salvar novo link");
    inpt.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
    return [h("label", { class: "f", for: "slugIn" }, h("span", {}, "Endereço depois de gustavoelian.com/"), inpt),
      h("div", { class: "linkbox" }, prev), err,
      h("p", { class: "hint", id: "slugHint" }, "Use letras, números e hífen. O link antigo continua abrindo esta proposta, então quem já recebeu não perde o acesso."),
      go];
  });
  const secPub = card("Link do cliente",
    h("label", { class: "switch" }, "Link ativo (o cliente pode abrir)", h("input", { type: "checkbox", role: "switch", checked: !!q.published, onchange: (e) => { q.published = e.target.checked; markDirty(); } })),
    linkBox, slug ? h("button", { class: "btn danger", type: "button", onclick: () => confirmSheet("Excluir proposta?", "Apaga a proposta, os arquivos e o histórico. Não dá para desfazer.", "Excluir", async () => { await api(`/api/quotes/${q.slug}`, { method: "DELETE" }); dirty = false; toast("Proposta excluída"); location.hash = "#/propostas"; }) }, icon("trash"), "Excluir proposta") : null);

  function recalc() { sumEl.replaceChildren(h("span", { class: "muted" }, "Soma dos serviços"), h("b", {}, brl(q.items.reduce((s, i) => s + Number(i.price || 0), 0)))); }
  async function save({ silent } = {}) {
    if (!q.client.name.trim()) { toast("Informe o nome do cliente"); secClient.querySelector("input").focus(); return null; }
    const payload = { ...q, items: q.items.map((i) => ({ ...i, deliverables: (i.deliverables || []).filter((d) => String(d).trim()) })) };
    saveBtn.disabled = true;
    try {
      q = q.slug ? await api(`/api/quotes/${q.slug}`, { method: "PUT", body: payload }) : await api("/api/quotes", { method: "POST", body: payload });
      dirty = false; saveBtn.lastChild.textContent = "Salvo"; haptic(); if (!silent) toast("Proposta salva"); warmPreview(q.slug);
      if (!slug) { history.replaceState(null, "", `#/q/${q.slug}`); slug = q.slug; }
      drawLink(); return q;
    } catch (x) { toast(x.message); return null; } finally { saveBtn.disabled = false; }
  }
  const ensureSaved = async () => (dirty || !q.slug ? await save({ silent: true }) : q);
  const saveBtn = h("button", { class: "btn primary", type: "button", onclick: () => save() }, icon("check"), h("span", {}, slug ? "Salvo" : "Salvar"));
  const bar = h("div", { class: "bar glass" }, saveBtn,
    h("button", { class: "btn", type: "button", onclick: async () => { const r = await ensureSaved(); if (r) window.open(`/${r.slug}`, "_blank"); } }, icon("eye"), "Ver"),
    h("button", { class: "btn", type: "button", onclick: async () => { const r = await ensureSaved(); if (r) window.open(`/api/pdf/${r.slug}/orcamento?download`, "_blank"); } }, icon("pdf"), "PDF"),
    h("button", { class: "btn", type: "button", onclick: async () => { const r = await ensureSaved(); if (r) shareQuote({ ...r }); } }, icon("send"), "Enviar"));

  drawItems(); drawPackages(); drawBonus(); drawProjects(pfront); drawFiles(); drawLink();
  shell({ title: slug ? q.client.name : "Nova proposta", eyebrow: slug ? "Editar proposta" : "Rascunho", back: slug ? `#/q/${slug}/detalhe` : "#/propostas", nav: false, compact: true },
    h("div", { class: "stack" }, secClient, secProp, secItems, secPk, secBonus, secProj, secFiles, secContract, secPub), h("div", { class: "gap24" }));
  root.append(bar);
  window.onbeforeunload = () => (dirty ? true : undefined);
}

// gera a prévia do WhatsApp antes do envio, para o cliente ver o banner na hora
function warmPreview(slug) {
  if (!slug) return;
  fetch(`/api/og/${slug}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((m) => { if (m?.image) fetch(m.image.replace(location.origin, "")).catch(() => {}); }).catch(() => {});
  fetch(`/${slug}`, { cache: "no-store" }).catch(() => {});
}
async function copy(text) { try { await navigator.clipboard.writeText(text); toast("Link copiado"); haptic(); } catch { prompt("Copie o link:", text); } }
function shareQuote(q) {
  warmPreview(q.slug);
  const url = `${location.origin}/${q.slug}`;
  const first = String(q.client?.name || "").split(" ")[0];
  const text = `Olá, ${first}! Preparei sua proposta. Por aqui você vê os detalhes, escolhe a condição e aprova:`;
  const phone = (q.client?.phone || "").replace(/\D/g, "");
  const wa = `https://wa.me/${phone ? (phone.length <= 11 ? "55" + phone : phone) : ""}?text=${encodeURIComponent(text + " " + url)}`;
  sheet("Enviar para o cliente", (close) => [
    !q.published ? h("p", { class: "pill warn" }, "O link está desativado. Ative em Link do cliente.") : null,
    h("div", { class: "linkbox" }, h("code", {}, url), h("button", { class: "ibtn", type: "button", "aria-label": "Copiar link", onclick: () => copy(url) }, icon("copy"))),
    h("a", { class: "btn primary block", href: wa, target: "_blank", rel: "noopener", onclick: close }, icon("wa"), "Enviar pelo WhatsApp"),
    q.client?.email ? h("button", { class: "btn block", type: "button", onclick: async (ev) => {
      const b = ev.currentTarget; b.disabled = true; b.textContent = "Enviando…";
      try { const r = await api(`/api/quotes/${q.slug}/google/email`, { method: "POST" }); toast(`E-mail enviado para ${r.to}`); close(); } catch (x) { toast(x.message); b.disabled = false; b.textContent = "Enviar por e-mail (Gmail)"; }
    } }, icon("send"), "Enviar por e-mail (Gmail)") : h("p", { class: "hint" }, "Cadastre o e-mail do cliente para enviar pelo Gmail."),
    navigator.share ? h("button", { class: "btn block", type: "button", onclick: () => navigator.share({ title: `Proposta · ${q.client?.name}`, text, url }).catch(() => {}) }, icon("share"), "Outras opções") : null,
    h("a", { class: "btn block", href: `/api/pdf/${q.slug}/orcamento?download`, target: "_blank" }, icon("pdf"), "Baixar PDF"),
  ].filter(Boolean));
}

/* ================= contratos ================= */
async function renderContracts() {
  loading("Contratos");
  const [list, settings] = await Promise.all([api("/api/quotes"), getSettings()]);
  const items = list.filter((q) => q.state?.approvedAt).sort((a, b) => (a.state.approvedAt < b.state.approvedAt ? 1 : -1));
  let filter = "ativos";
  const box = h("div", { class: "list" });
  const draw = () => {
    const sel = items.filter((q) => { const st = q.state.work?.stage || "aprovado"; return filter === "todos" || (filter === "ativos" ? st !== "concluido" : st === "concluido"); });
    box.replaceChildren(...(sel.length ? sel.map((q) => contractCard(q)) : [emptyState(items.length ? "Nada neste filtro." : "Quando um cliente aprovar e assinar, o contrato aparece aqui.")]));
  };
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Filtrar contratos" }, ...[["ativos", "Em andamento"], ["concluidos", "Concluídos"], ["todos", "Todos"]].map(([id, l]) =>
    h("button", { type: "button", class: "chip", "aria-pressed": String(id === filter), onclick: (e) => { filter = id; chips.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); draw(); } }, l)));
  draw();
  const contracted = items.reduce((s, q) => s + totalOf(q), 0), received = items.reduce((s, q) => s + paidOf(q), 0);
  shell({ title: "Contratos", eyebrow: `${items.length} assinados · ${brlShort(contracted)}`, actions: headerActions() },
    h("section", { class: "glass card" }, h("div", { class: "prog-l" }, h("span", {}, "Recebido do total contratado"), h("b", {}, `${contracted ? Math.round((received / contracted) * 100) : 0}%`)),
      h("div", { class: "prog", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(contracted ? Math.round((received / contracted) * 100) : 0), "aria-label": "Recebido do total contratado" }, h("i", { style: `width:${contracted ? Math.min(100, (received / contracted) * 100) : 0}%` })),
      h("div", { class: "prog-l" }, h("span", {}, brl(received)), h("span", {}, brl(contracted)))),
    chips, h("div", { style: "height:6px" }), box);
}
function contractCard(q) {
  const tot = totalOf(q), paid = paidOf(q), pc = tot ? Math.min(100, (paid / tot) * 100) : 0;
  const stage = q.state.work?.stage || "aprovado";
  const [st, cls] = statusOf(q);
  return h("a", { class: "glass card", href: `#/c/${q.slug}`, style: "display:block;text-decoration:none;color:inherit" },
    h("div", { style: "display:flex;gap:12px;align-items:center" }, avatar(q.client?.name),
      h("div", { style: "flex:1;min-width:0" }, h("strong", { style: "display:block;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" }, q.client?.name), h("div", { class: "faint", style: "font-size:var(--t-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" }, q.title || "Contrato")),
      h("span", { class: "pill " + (stage === "concluido" ? "ok" : "info") }, stageLabel(stage))),
    h("div", { class: "prog", "aria-hidden": "true" }, h("i", { style: `width:${pc}%` })),
    h("div", { class: "prog-l" }, h("span", {}, cls === "warn" ? "Comprovante para conferir" : `Recebido ${brl(paid)}`), h("b", {}, brl(tot))));
}

async function renderContract(slug) {
  loading("Contrato");
  const [{ quote: q0, state: s, events }, settings] = await Promise.all([api(`/api/quotes/${slug}`), getSettings()]);
  if (!s.approvedAt) { location.replace(`#/q/${slug}/detalhe`); return; }
  const pct = Number(settings.payments?.entryPct ?? 60);
  const q = { ...q0, state: s, total: s.total };
  const tot = totalOf(q), paid = paidOf(q), rest = Math.max(0, tot - paid);
  const stage = s.work?.stage || "aprovado";
  const idx = STAGES.findIndex((x) => x[0] === stage);

  const setWork = async (patch, msg) => { try { await api(`/api/quotes/${slug}/work`, { method: "PUT", body: patch }); haptic(); if (msg) toast(msg); renderContract(slug); } catch (x) { toast(x.message); } };
  const hero = h("section", { class: "hero glass" },
    h("div", { style: "display:flex;justify-content:space-between;gap:10px;align-items:center" }, h("span", { class: "pill " + (rest < 0.01 ? "ok" : "info") }, rest < 0.01 ? "Quitado" : `Falta ${brl(rest)}`), h("span", { class: "faint", style: "font-size:var(--t-sm)" }, `Assinado ${dateBR(s.approvedAt)}`)),
    h("p", { class: "big" }, bigMoney(tot)),
    h("p", { class: "lbl" }, s.paymentText || q.title || ""),
    h("div", { class: "prog", role: "progressbar", "aria-label": "Recebido", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(tot ? (paid / tot) * 100 : 0)) }, h("i", { style: `width:${tot ? Math.min(100, (paid / tot) * 100) : 0}%` })),
    h("div", { class: "prog-l" }, h("span", {}, "Recebido"), h("b", {}, brl(paid))));

  const steps = h("div", { class: "steps", role: "group", "aria-label": "Etapa do trabalho" }, ...STAGES.map(([id, label], i) =>
    h("button", { type: "button", class: i < idx ? "done" : i === idx ? "now" : "", "aria-pressed": String(i === idx), onclick: () => i !== idx && setWork({ stage: id }, `Etapa: ${label}`) }, h("i", {}), label)));
  const due = h("input", { class: "in", type: "date", value: s.work?.dueDate || "", "aria-label": "Prazo de entrega", onchange: (e) => setWork({ dueDate: e.target.value }, "Prazo atualizado") });
  const notes = h("textarea", { class: "in", rows: 3, placeholder: "Anotações internas: links, combinados, próximos passos" }); notes.value = s.work?.notes || "";
  notes.addEventListener("blur", () => { if (notes.value !== (s.work?.notes || "")) api(`/api/quotes/${slug}/work`, { method: "PUT", body: { notes: notes.value } }).then(() => toast("Anotação salva")).catch((x) => toast(x.message)); });
  const workCard = h("section", { class: "form-card glass" }, h("h2", {}, "Andamento"), steps, h("label", { class: "f" }, h("span", {}, "Prazo de entrega"), due), h("label", { class: "f" }, h("span", {}, "Anotações"), notes));

  // pagamentos
  const plan = planOf(q, pct);
  const notice = s.paymentNotice && !s.paymentNotice.confirmedAt ? s.paymentNotice : null;
  const payCard = h("section", { class: "form-card glass" }, h("h2", {}, "Recebimentos"),
    notice ? h("div", { class: "todo warn", style: "padding:0" }, h("span", { class: "ic" }, icon("receipt")), h("div", {}, h("p", {}, "Comprovante de Pix enviado"), h("small", {}, when(notice.at))),
      h("div", { class: "btns" }, h("a", { class: "btn sm", href: `/api/quotes/${slug}/files/${notice.fileId}`, target: "_blank" }, "Ver"), h("button", { class: "btn sm primary", type: "button", onclick: () => paymentSheet(slug, plan.find((p) => !p.done)?.amount || rest, notice.fileId) }, "Confirmar"))) : null,
    h("div", {}, ...plan.map((p) => h("div", { class: "plan" }, h("span", {}, p.label, " ", h("span", { class: "pill " + (p.done ? "ok" : "") }, p.done ? "Recebido" : "Pendente")), h("small", {}, p.due ? `Vencimento ${dateBR(p.due)}` : "Vence na entrega · defina o prazo"), h("span", { class: "v" }, brl(p.amount))))),
    (s.payments || []).length ? h("div", {}, ...[...s.payments].reverse().map((p) => h("div", { class: "ledger" },
      h("span", { class: "ic" }, icon("check")), h("div", {}, h("span", {}, METHODS[p.method] || p.method), h("small", {}, `${dateBR(p.date)}${p.note ? " · " + p.note : ""}`)),
      h("span", { class: "v" }, brl(p.amount)),
      h("button", { class: "ibtn", type: "button", style: "width:36px;height:36px", "aria-label": `Excluir recebimento de ${brl(p.amount)}`, onclick: () => confirmSheet("Excluir recebimento?", `${brl(p.amount)} em ${dateBR(p.date)} sai do histórico.`, "Excluir", async () => { await api(`/api/quotes/${slug}/ledger/${p.id}`, { method: "DELETE" }); toast("Recebimento excluído"); renderContract(slug); }) }, icon("trash"))))) : h("p", { class: "hint" }, "Nenhum recebimento registrado."),
    h("button", { class: "btn primary", type: "button", onclick: () => paymentSheet(slug, plan.find((p) => !p.done)?.amount || rest) }, icon("plus"), "Registrar recebimento"));

  const sg = s.signer || {};
  const docCard = h("section", { class: "form-card glass" }, h("h2", {}, "Contrato assinado"),
    h("dl", { class: "kv" }, h("dt", {}, "Assinante"), h("dd", {}, sg.name || "—"), h("dt", {}, "Documento"), h("dd", {}, sg.doc || "—"), h("dt", {}, "E-mail"), h("dd", {}, sg.email || "—"), h("dt", {}, "Quando"), h("dd", {}, new Date(s.approvedAt).toLocaleString("pt-BR")), h("dt", {}, "IP"), h("dd", {}, sg.ip || "—")),
    s.contractHash ? h("p", { class: "hash" }, "SHA-256 ", s.contractHash) : null,
    h("div", { class: "btns grid2" },
      s.contractText ? h("a", { class: "btn", href: `/api/pdf/${slug}/contrato?download`, target: "_blank" }, icon("pdf"), "Contrato") : null,
      h("a", { class: "btn", href: `/api/pdf/${slug}/orcamento?download`, target: "_blank" }, icon("doc"), "Proposta"),
      q0.client?.phone ? h("a", { class: "btn", href: `https://wa.me/${(q0.client.phone || "").replace(/\D/g, "").replace(/^(?=\d{10,11}$)/, "55")}`, target: "_blank", rel: "noopener" }, icon("wa"), "WhatsApp") : null,
      h("a", { class: "btn", href: `/${slug}`, target: "_blank", rel: "noopener" }, icon("eye"), "Página")),
    s.drive?.folderUrl ? h("div", { class: "btns grid2" },
      h("a", { class: "btn", href: s.drive.pdfUrl, target: "_blank", rel: "noopener" }, icon("pdf"), "PDF no Drive"),
      h("a", { class: "btn", href: s.drive.folderUrl, target: "_blank", rel: "noopener" }, icon("box"), "Pasta do cliente"),
      h("a", { class: "btn block", style: "grid-column:1/-1", href: s.drive.docUrl, target: "_blank", rel: "noopener" }, icon("pen"), "Abrir no Google Docs para pedir eSignature")) : null,
    h("button", { class: "btn ghost block", type: "button", onclick: async (ev) => {
      const b = ev.currentTarget; b.disabled = true; b.textContent = "Gerando no Drive…";
      try { await api(`/api/quotes/${slug}/google/drive`, { method: "POST" }); toast("Contrato salvo no Drive"); renderContract(slug); } catch (x) { toast(x.message); b.disabled = false; b.textContent = "Tentar de novo"; }
    } }, icon("box"), s.drive ? "Gerar de novo no Drive" : "Salvar contrato no Drive e enviar por e-mail"));

  shell({ title: q0.client?.name || "Contrato", eyebrow: q0.title || "Contrato", back: "#/contratos", compact: true, nav: false },
    hero, h("div", { style: "height:12px" }), h("div", { class: "stack" }, workCard, payCard, deliveryCard(slug, q0, s, rest), docCard),
    secH("Linha do tempo"), h("div", { class: "glass card" }, ...events.map((e) => evRow(e))), h("div", { class: "gap24" }));
}
/* Entrega final: certificado de cessão, integridade dos arquivos, licenças, acessos e recomendações de conformidade. */
function deliveryCard(slug, q0, s, rest) {
  const d = s.delivery;
  const box = h("section", { class: "form-card glass" }, h("h2", {}, "Entrega final"));
  const files = (q0.attachments || []).filter((a) => a.showToClient && !a.fromClient);
  if (d) {
    box.append(
      h("p", { class: "pill wrap " + (d.certificate ? "ok" : "") }, d.certificate ? `Certificado ${d.certificate.code} emitido em ${dateBR(d.at)}` : `Entregue em ${dateBR(d.at)} · certificado aguarda quitação`),
      h("p", { class: "hint" }, `${d.files.length} arquivo(s) com código de integridade · ${d.recommendations.length} recomendações ao cliente.`),
      d.certificate ? h("a", { class: "btn block", href: `/certificado?c=${d.certificate.code}`, target: "_blank", rel: "noopener" }, icon("doc"), "Ver certificado") : null);
  }
  box.append(h("p", { class: "hint" }, files.length ? `Vão na entrega os ${files.length} arquivo(s) marcados como visíveis ao cliente em Arquivos.` : "Nenhum arquivo visível ao cliente ainda. Anexe as entregas na proposta antes de gerar."),
    rest > 0.01 ? h("p", { class: "pill wrap" }, "Ainda há saldo em aberto: a entrega sai, mas o certificado de cessão só é emitido após a quitação (cláusula 7.1).") : null,
    h("button", { class: "btn primary block", type: "button", onclick: () => deliverySheet(slug, d) }, icon("check"), d ? "Gerar entrega de novo" : "Preparar entrega final"));
  return box;
}
async function deliverySheet(slug, prev) {
  const info = await api(`/api/quotes/${slug}/delivery`);
  const chosen = new Set(prev?.kinds || info.suggested);
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Tipo de projeto" }, ...Object.entries(info.kinds).map(([k, label]) => {
    const b = h("button", { type: "button", class: "chip", "aria-pressed": String(chosen.has(k)), onclick: () => { chosen.has(k) ? chosen.delete(k) : chosen.add(k); b.setAttribute("aria-pressed", String(chosen.has(k))); } }, label); return b; }));
  const ta = (v, ph, rows = 3) => { const t = h("textarea", { class: "in", rows, placeholder: ph }); t.value = (v || []).join ? (v || []).join("\n") : v || ""; return t; };
  const lic = ta(prev?.licenses, "Uma por linha. Ex.: Fonte Gilroy · licença desktop comercial · comprar em nome da empresa");
  const acc = ta(prev?.accesses, "Uma por linha, sem senhas. Ex.: Hospedagem Hostinger · conta transferida para contato@empresa.com");
  const sup = ta(prev?.support, "Opcional. Ex.: correção de erros técnicos sem custo por 30 dias após a entrega.", 2);
  const send = h("input", { type: "checkbox", checked: true });
  const err = h("p", { class: "err", role: "alert" });
  sheet("Entrega final", (close) => [
    h("p", { class: "hint" }, "O cliente recebe os arquivos com código de integridade (SHA-256), o certificado de autoria e cessão de direitos (se quitado) e as recomendações de segurança e conformidade do tipo de projeto."),
    h("label", { class: "f" }, h("span", {}, "Tipo de projeto (define as recomendações)"), chips),
    h("label", { class: "f" }, h("span", {}, "Licenças de terceiros"), lic),
    h("label", { class: "f" }, h("span", {}, "Acessos transferidos"), acc),
    h("label", { class: "f" }, h("span", {}, "Suporte pós-entrega"), sup),
    h("label", { class: "switch" }, "Enviar e-mail ao cliente", send), err,
    h("button", { class: "btn primary block", type: "button", onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true; b.textContent = "Gerando…";
      try {
        const r = await api(`/api/quotes/${slug}/delivery`, { method: "POST", body: { kinds: [...chosen], licenses: lic.value, accesses: acc.value, support: sup.value, send: send.checked } });
        haptic(); close(); toast(r.emailError ? r.emailError : r.emailed ? "Entrega enviada ao cliente" : "Entrega gerada"); renderContract(slug);
      } catch (x) { err.textContent = x.message; b.disabled = false; b.textContent = "Gerar entrega"; }
    } }, icon("check"), "Gerar entrega")]);
}
function paymentSheet(slug, suggested, receiptId) {
  const amount = h("input", { class: "in money", inputmode: "decimal", value: fmtMoneyInput(suggested), "aria-label": "Valor recebido" });
  const date = h("input", { class: "in", type: "date", value: today(), "aria-label": "Data" });
  const method = h("select", { class: "in", "aria-label": "Forma de pagamento" }, ...Object.entries(METHODS).map(([k, v]) => h("option", { value: k }, v)));
  const note = h("input", { class: "in", placeholder: "Ex.: entrada, parcela 2/3", "aria-label": "Observação" });
  const err = h("p", { class: "err", role: "alert" });
  sheet(receiptId ? "Confirmar comprovante" : "Registrar recebimento", (close) => [
    h("label", { class: "f" }, h("span", {}, "Valor (R$)"), amount),
    h("div", { class: "r2" }, h("label", { class: "f" }, h("span", {}, "Data"), date), h("label", { class: "f" }, h("span", {}, "Forma"), method)),
    h("label", { class: "f" }, h("span", {}, "Observação"), note), err,
    h("button", { class: "btn primary block", type: "button", onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { await api(`/api/quotes/${slug}/ledger`, { method: "POST", body: { amount: parseMoney(amount.value), date: date.value, method: method.value, note: note.value, receiptId } }); haptic(); toast("Recebimento registrado"); close(); renderContract(slug); }
      catch (x) { err.textContent = x.message; e.currentTarget.disabled = false; }
    } }, icon("check"), "Salvar recebimento")]);
}

/* ================= financeiro ================= */
async function renderFinance() {
  loading("Financeiro");
  const [list, settings] = await Promise.all([api("/api/quotes"), getSettings()]);
  const pct = Number(settings.payments?.entryPct ?? 60);
  const year = new Date().getFullYear();
  const pays = list.flatMap((q) => (q.state?.payments || []).map((p) => ({ ...p, q }))).sort((a, b) => (a.date < b.date ? 1 : -1));
  const yearTotal = pays.filter((p) => String(p.date).startsWith(String(year))).reduce((s, p) => s + Number(p.amount), 0);
  const months = [...Array(12)].map((_, i) => { const k = `${year}-${String(i + 1).padStart(2, "0")}`; return { k, label: new Date(year, i, 1).toLocaleDateString("pt-BR", { month: "narrow" }), long: new Date(year, i, 1).toLocaleDateString("pt-BR", { month: "long" }), v: pays.filter((p) => String(p.date).startsWith(k)).reduce((s, p) => s + Number(p.amount), 0) }; });
  const max = Math.max(...months.map((m) => m.v), 1), cm = new Date().getMonth();
  const recv = list.filter((q) => q.state?.approvedAt && totalOf(q) - paidOf(q) > 0.01).map((q) => ({ q, rest: totalOf(q) - paidOf(q), next: planOf(q, pct).find((p) => !p.done) }));
  const recvTotal = recv.reduce((s, r) => s + r.rest, 0);

  const csv = () => {
    const rows = [["Data", "Cliente", "Proposta", "Forma", "Valor", "Observação"], ...pays.map((p) => [p.date, p.q.client?.name, p.q.slug, METHODS[p.method] || p.method, String(p.amount).replace(".", ","), p.note || ""])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `recebimentos-${year}.csv` }); document.body.append(a); a.click(); a.remove();
  };
  const hero = h("section", { class: "hero glass" }, h("p", { class: "lbl" }, `Recebido em ${year}`), h("p", { class: "big" }, bigMoney(yearTotal)),
    h("p", { class: "delta" }, `A receber: `, h("b", {}, brl(recvTotal))),
    h("div", { class: "bars", role: "img", "aria-label": `Recebido por mês em ${year}: ` + months.map((m) => `${m.long} ${brl(m.v)}`).join(", ") },
      ...months.map((m, i) => h("div", { class: "b" + (i === cm ? " cur" : ""), tabindex: "0", "aria-hidden": "true" }, h("span", { style: `height:${Math.max(2, (m.v / max) * 100)}%` }), h("div", { class: "tip" }, `${m.long}: ${brl(m.v)}`)))),
    h("div", { class: "bars-x", "aria-hidden": "true" }, ...months.map((m, i) => h("span", { class: i === cm ? "cur" : "" }, m.label))));
  shell({ title: "Financeiro", eyebrow: "Recebimentos e cobranças", actions: headerActions() },
    hero,
    secH("A receber", h("span", { class: "faint", style: "font-size:var(--t-sm)" }, brl(recvTotal))),
    recv.length ? h("div", { class: "list" }, ...recv.map(({ q, rest, next }) => h("a", { class: "row-card glass", href: `#/c/${q.slug}` }, avatar(q.client?.name, next?.due && next.due < today() ? "danger" : "warn"),
      h("div", { class: "who" }, h("strong", {}, q.client?.name), h("div", { class: "sub" }, next ? `${next.label}${next.due ? " · " + dateBR(next.due) : ""}` : "Saldo")), h("div", { class: "amt" }, brlShort(rest), h("small", {}, `de ${brlShort(totalOf(q))}`))))) : emptyState("Nada a receber. Tudo quitado."),
    secH("Recebimentos", pays.length ? h("button", { type: "button", onclick: csv }, "Exportar CSV") : null),
    pays.length ? h("div", { class: "glass card" }, ...pays.slice(0, 40).map((p) => h("a", { class: "ledger", href: `#/c/${p.q.slug}`, style: "text-decoration:none;color:inherit;grid-template-columns:auto 1fr auto" },
      h("span", { class: "ic" }, icon("down")), h("div", {}, h("span", {}, p.q.client?.name), h("small", {}, `${dateBR(p.date)} · ${METHODS[p.method] || p.method}${p.note ? " · " + p.note : ""}`)), h("span", { class: "v" }, brl(p.amount))))) : emptyState("Registre os recebimentos nos contratos para acompanhar aqui."));
}

/* ================= serviços (catálogo) ================= */
async function renderServices() {
  loading("Serviços");
  let { services = [] } = await api("/api/catalog");
  const persist = async (msg) => { try { ({ services } = await api("/api/catalog", { method: "PUT", body: { services } })); haptic(); toast(msg); draw(); } catch (x) { toast(x.message); } };
  const box = h("div", { class: "stack" });
  const label = (id) => catalog.fronts.find((f) => f.id === id)?.label || "Outros";
  const draw = () => {
    const groups = {};
    services.forEach((s) => (groups[s.category || ""] ||= []).push(s));
    box.replaceChildren(...(services.length ? Object.entries(groups).map(([cat, arr]) => h("div", {}, secH(label(cat)),
      h("div", { class: "list" }, ...arr.map((s) => h("button", { class: "row-card glass", type: "button", style: s.active === false ? "opacity:.55" : "", onclick: () => editService(s) },
        h("span", { class: "avatar", "data-h": String(hue(s.title)) }, icon("box")),
        h("div", { class: "who" }, h("strong", {}, s.title), h("div", { class: "sub" }, [s.deadline, s.active === false ? "Pausado" : null, `${(s.deliverables || []).length} entregáveis`].filter(Boolean).join(" · "))),
        h("div", { class: "amt" }, brlShort(s.price))))))) : [emptyState("Monte seu catálogo uma vez e adicione serviços às propostas com um toque.", h("button", { class: "btn primary", type: "button", onclick: () => editService(null) }, icon("plus"), "Primeiro serviço"))]));
  };
  const editService = (s) => {
    const it = s ? { ...s, deliverables: [...(s.deliverables || [])] } : { id: "", title: "", category: "", description: "", deliverables: [], price: 0, deadline: "", active: true };
    const t = h("input", { class: "in", value: it.title, placeholder: "Ex.: Landing page", "aria-label": "Nome do serviço" });
    const cat = h("select", { class: "in", "aria-label": "Frente" }, h("option", { value: "" }, "Outros"), ...catalog.fronts.map((f) => h("option", { value: f.id, selected: it.category === f.id }, f.label)));
    const price = h("input", { class: "in money", inputmode: "decimal", value: fmtMoneyInput(it.price), placeholder: "0,00", "aria-label": "Preço" });
    const dl = h("input", { class: "in", value: it.deadline, placeholder: "Ex.: 15 dias úteis", "aria-label": "Prazo" });
    const desc = h("textarea", { class: "in", rows: 2, "aria-label": "Descrição" }); desc.value = it.description;
    const dv = h("textarea", { class: "in", rows: 4, placeholder: "Um entregável por linha", "aria-label": "Entregáveis" }); dv.value = (it.deliverables || []).join("\n");
    const act = h("input", { type: "checkbox", role: "switch", checked: it.active !== false });
    sheet(s ? "Editar serviço" : "Novo serviço", (close) => [
      h("label", { class: "f" }, h("span", {}, "Nome"), t),
      h("div", { class: "r2" }, h("label", { class: "f" }, h("span", {}, "Preço base (R$)"), price), h("label", { class: "f" }, h("span", {}, "Frente"), cat)),
      h("label", { class: "f" }, h("span", {}, "Prazo"), dl), h("label", { class: "f" }, h("span", {}, "Descrição"), desc), h("label", { class: "f" }, h("span", {}, "Entregáveis"), dv),
      h("label", { class: "switch" }, "Disponível nas propostas", act),
      h("div", { class: "btns grid2" },
        s ? h("button", { class: "btn danger", type: "button", onclick: () => { close(); confirmSheet("Excluir serviço?", `${s.title} sai do catálogo. Propostas já feitas não mudam.`, "Excluir", async () => { services = services.filter((x) => x.id !== s.id); await persist("Serviço excluído"); }); } }, icon("trash"), "Excluir") : h("button", { class: "btn", type: "button", onclick: close }, "Cancelar"),
        h("button", { class: "btn primary", type: "button", onclick: async () => {
          if (!t.value.trim()) { t.focus(); toast("Dê um nome ao serviço"); return; }
          const next = { ...it, title: t.value.trim(), category: cat.value, price: parseMoney(price.value), deadline: dl.value, description: desc.value, deliverables: dv.value.split("\n").map((x) => x.trim()).filter(Boolean), active: act.checked };
          services = s ? services.map((x) => (x.id === s.id ? next : x)) : [...services, next];
          close(); await persist(s ? "Serviço atualizado" : "Serviço criado");
        } }, icon("check"), "Salvar"))]);
  };
  draw();
  shell({ title: "Serviços", eyebrow: "Catálogo e preços base", actions: headerActions(), fab: h("button", { class: "fab", type: "button", "aria-label": "Novo serviço", onclick: () => editService(null) }, icon("plus")) }, box);
}

/* ================= atividade ================= */
function evRow(e, withName) {
  return h("div", { class: "ev" }, h("span", { class: `d ${e.type}`, "aria-hidden": "true" }),
    h("div", {}, h("p", {}, withName && !["approve", "comment"].includes(e.type) ? h("strong", { style: "font-weight:500" }, `${nameFromSlug(e.slug)} · `) : null, evText(e)),
      e.message ? h("blockquote", {}, e.message) : null, h("small", {}, when(e.at))));
}
async function renderInbox() {
  loading("Atividade");
  const evs = await api("/api/inbox");
  lastSeenInbox = Date.now(); lsSet("ge_inbox_seen", String(lastSeenInbox));
  let showViews = false;
  const box = h("div");
  const draw = () => {
    const list = evs.filter((e) => showViews || e.type !== "view");
    box.replaceChildren(list.length ? h("div", { class: "glass card" }, ...list.map((e) => { const row = evRow(e, true); row.style.cursor = "pointer"; row.tabIndex = 0; row.setAttribute("role", "link"); const go = () => (location.hash = `#/q/${e.slug}/detalhe`); row.onclick = go; row.onkeydown = (k) => k.key === "Enter" && go(); return row; })) : emptyState("Nada por aqui ainda."));
  };
  draw();
  shell({ title: "Atividade", eyebrow: "Interações dos clientes", back: "#/", compact: true },
    h("div", { class: "glass card", style: "margin-bottom:12px;padding:6px 18px" }, h("label", { class: "switch" }, "Mostrar visualizações", h("input", { type: "checkbox", role: "switch", onchange: (e) => { showViews = e.target.checked; draw(); } }))), box);
}

/* ================= ajustes ================= */
async function renderSettings() {
  loading("Ajustes");
  const s = await api("/api/settings");
  const bind = (obj, key, attrs = {}, type = "text") => { const el = h(type === "textarea" ? "textarea" : "input", { class: "in", ...attrs, ...(type !== "textarea" ? { type } : {}) }); el.value = obj[key] ?? ""; el.addEventListener("input", () => (obj[key] = type === "number" ? Number(el.value) : el.value)); return el; };
  const f = (l, el) => h("label", { class: "f" }, h("span", {}, l), el);
  shell({ title: "Ajustes", back: "#/", compact: true, nav: false },
    h("div", { class: "stack" },
      h("section", { class: "form-card glass" }, h("h2", {}, "Seus dados"),
        f("Nome", bind(s.issuer, "name")), f("Documento", bind(s.issuer, "doc")),
        f("E-mail", bind(s.issuer, "email", {}, "email")), f("Site", bind(s.issuer, "site")),
        f("Endereço (vai no contrato)", bind(s.issuer, "address")), f("Cidade e foro", bind(s.issuer, "city")),
        f("WhatsApp (só números, com 55)", bind(s.issuer, "whatsapp", { inputmode: "numeric" })), f("WhatsApp exibido no PDF", bind(s.issuer, "whatsappLabel"))),
      (() => { const st = h("p", { class: "hint" }, "Verificando…");
        api("/api/google/status").then((r) => { st.textContent = !r.ready ? "Ainda não configurado. Falta cadastrar GOOGLE_SCRIPT_URL e GOOGLE_SCRIPT_SECRET no Netlify." : r.ok ? `Ligado como ${r.user}. Contratos vão para Meu Drive › @adm › @clientes.` : `Configurado, mas com erro: ${r.error}`; st.className = "pill wrap " + (r.ready && r.ok ? "ok" : ""); }).catch(() => (st.textContent = "Não foi possível verificar."));
        return h("section", { class: "form-card glass" }, h("h2", {}, "Gmail e Google Drive"), st); })(),
      h("section", { class: "form-card glass" }, h("h2", {}, "Pagamento"),
        h("div", { class: "r2" }, f("Entrada à vista (%)", bind(s.payments, "entryPct", { min: 0, max: 100, inputmode: "numeric" }, "number")), f("Máx. parcelas", bind(s.payments, "maxInstallments", { min: 1, max: 12, inputmode: "numeric" }, "number"))),
        f("Chave Pix", bind(s.pix, "key", { placeholder: "CNPJ, e-mail, telefone ou aleatória" })),
        f("Nome no Pix", bind(s.pix, "merchantName")), f("Cidade no Pix", bind(s.pix, "merchantCity")),
        h("p", { class: "pill " + (s.stripeEnabled ? "ok" : "") }, s.stripeEnabled ? "Cartão e Apple Pay ativos" : "Cartão: aguardando chave do Stripe")),
      h("section", { class: "form-card glass" }, h("h2", {}, "Modelo de contrato"), h("p", { class: "hint" }, "Usado em todas as propostas. Revise com um advogado."), (() => { const ta = bind(s, "contractTemplate", { rows: 14 }, "textarea"); return [ta, h("button", { class: "btn ghost small", type: "button", onclick: async () => { const d = await api("/api/settings/default-contract"); s.contractTemplate = ta.value = d.text; toast("Modelo padrão restaurado. Salve para aplicar."); } }, "Restaurar modelo padrão")]; })()),
      h("button", { class: "btn primary block", type: "button", onclick: async () => { try { const { stripeEnabled, ...body } = s; await api("/api/settings", { method: "PUT", body }); settingsCache = null; haptic(); toast("Ajustes salvos"); } catch (x) { toast(x.message); } } }, icon("check"), "Salvar ajustes"),
      h("button", { class: "btn block ghost", type: "button", onclick: async () => { await api("/api/logout", { method: "POST" }); renderLogin(); } }, icon("out"), "Sair do Studio")),
    h("div", { class: "gap24" }));
}

/* ================= portfólio do site =================
   Canal entre o Studio e o site: ordem e visibilidade dos projetos, projetos novos, thumb animada,
   banner com moldura de mockup, galeria/moodboard, números por seção e depoimentos.
   Salvo em /api/portfolio; o site lê /api/portfolio e aplica sobre data/projects.json. */
const PF_CHANNELS = { whatsapp: "WhatsApp", email: "E-mail", instagram: "Instagram", reuniao: "Reunião / áudio", outro: "Outro" };
const PF_SECTIONS = ["Resultados", "Alcance", "Engajamento", "Vendas", "Evento", "Entregas", "Prazo"];
const PF_FRAMES = { laptop: "Notebook", phone: "Celular", browser: "Navegador", tablet: "Tablet", none: "Sem moldura" };
const PF_SIZES = { s: "Pequeno", wide: "Largo", tall: "Alto", l: "Grande" };
const pfMedia = (m) => (m?.key ? `/api/media/${m.key}` : "");
const pfMediaEl = (m, alt = "") => (m?.type?.startsWith("video") ? h("video", { src: pfMedia(m), muted: true, playsinline: true, autoplay: true, loop: true, "aria-hidden": "true" }) : h("img", { src: pfMedia(m), alt, loading: "lazy" }));
const pfFramed = (m, frame, alt) => h("figure", { class: `mk mk-${frame || "none"}` }, h("div", { class: "mk-screen" }, pfMediaEl(m, alt)));
const pfStatus = (e) => {
  const n = (e?.metrics || []).reduce((a, s) => a + s.items.length, 0);
  return [e?.thumb ? "thumb" : null, e?.banner ? "banner" : null, (e?.gallery || []).length ? pl(e.gallery.length, "imagem", "imagens") : null,
    n ? pl(n, "número", "números") : null, (e?.feedback || []).length ? pl(e.feedback.length, "depoimento", "depoimentos") : null].filter(Boolean);
};
/* ordem final: a salva no painel, depois os projetos base na ordem do arquivo, depois os novos */
function pfOrder(srv) {
  const base = catalog.projects.filter((p) => !p.draft).map((p) => p.id);
  const custom = Object.keys(srv.items).filter((id) => srv.items[id]?.custom);
  const all = new Set([...base, ...custom]);
  return [...new Set([...srv.order.filter((id) => all.has(id)), ...base, ...custom])];
}
const pfInfo = (id, srv) => { const b = catalog.projects.find((p) => p.id === id) || {}; const e = srv.items[id] || {}; return { ...b, ...Object.fromEntries(Object.entries(e).filter(([, v]) => v != null && v !== "")), id, base: b, entry: e }; };

async function renderPortfolioList() {
  loading("Portfólio");
  const srv = await api("/api/portfolio?all=1");
  let order = pfOrder(srv);
  const list = h("div", { class: "list" });
  const saveOrder = async () => { try { await api("/api/portfolio", { method: "PUT", body: { order } }); haptic(); } catch (x) { toast(x.message); } };
  const secOf = (id) => { const e = srv.items[id] || {}; const b = catalog.projects.find((x) => x.id === id) || {}; return (e.section || b.section) === "list" ? "list" : "creative"; };
  const row = (id, group) => {
    const p = pfInfo(id, srv), st = pfStatus(p.entry), i = group.indexOf(id);
    const pic = p.entry.thumb ? pfMediaEl(p.entry.thumb) : p.cover ? h("img", { src: "/" + p.cover, alt: "", loading: "lazy" }) : h("span", { class: "pf-ph" }, initials(p.title));
    const mv = (d) => { const nb = group[i + d]; if (!nb) return; const a = order.indexOf(id), b = order.indexOf(nb); [order[a], order[b]] = [order[b], order[a]]; draw(); saveOrder(); };
    const tags = [p.entry.hidden ? "Oculto no site" : null, secOf(id) === "list" ? (p.entry.topicOnly ? "Só tópico" : "Com página") : null, p.entry.custom ? "Criado no painel" : null];
    return h("div", { class: "pf-row glass" + (p.entry.hidden ? " is-off" : "") },
      h("a", { class: "pf-row-main", href: `#/portfolio/${id}` },
        h("span", { class: "pf-pic" }, pic),
        h("div", { class: "who" }, h("strong", {}, p.title), h("div", { class: "sub" }, [...tags, ...(st.length ? st : ["Sem dados ainda"])].filter(Boolean).join(" · ")))),
      h("div", { class: "pf-ord" },
        h("button", { class: "ibtn sm", type: "button", "aria-label": `Subir ${p.title}`, disabled: i === 0, onclick: () => mv(-1) }, "↑"),
        h("button", { class: "ibtn sm", type: "button", "aria-label": `Descer ${p.title}`, disabled: i === group.length - 1, onclick: () => mv(1) }, "↓")));
  };
  const draw = () => {
    const cr = order.filter((id) => secOf(id) === "creative"), ls = order.filter((id) => secOf(id) === "list");
    list.replaceChildren(
      secH(`Projetos criativos · ${cr.length}`), ...cr.map((id) => row(id, cr)),
      h("div", { class: "gap24" }),
      secH(`Lista de experiência · ${ls.length}`), ...(ls.length ? ls.map((id) => row(id, ls)) : [h("p", { class: "hint" }, "Nenhum item. Em um projeto, escolha \"Lista de experiência\" em Onde aparece.")]));
  };
  draw();
  const visible = order.filter((id) => !srv.items[id]?.hidden).length;
  const newProject = () => {
    const t = h("input", { class: "in", placeholder: "Ex.: Café Serra · loja virtual", "aria-label": "Nome do projeto" });
    const picked = new Set(["web"]);
    const chips = h("div", { class: "chips" }, ...catalog.fronts.map((f) => { const b = h("button", { class: "chip" + (picked.has(f.id) ? " on" : ""), type: "button", "aria-pressed": String(picked.has(f.id)), onclick: () => { picked.has(f.id) ? picked.delete(f.id) : picked.add(f.id); b.classList.toggle("on"); b.setAttribute("aria-pressed", String(picked.has(f.id))); } }, f.label); return b; }));
    let section = "creative";
    const segSec = h("div", { class: "seg", role: "radiogroup", "aria-label": "Onde aparece" });
    const drawSeg = () => segSec.replaceChildren(...[["creative", "Projetos criativos"], ["list", "Lista de experiência"]].map(([k, l]) => h("button", { type: "button", role: "radio", "aria-checked": String(section === k), class: section === k ? "on" : "", onclick: () => { section = k; drawSeg(); } }, l)));
    drawSeg();
    sheet("Novo projeto", (close) => [
      h("label", { class: "f" }, h("span", {}, "Nome"), t), h("div", { class: "f" }, h("span", {}, "Onde aparece"), segSec), h("div", { class: "f" }, h("span", {}, "Frentes"), chips),
      h("p", { class: "hint" }, "Ele entra no topo da lista do site, oculto até você completar e ligar \"Mostrar no site\"."),
      h("div", { class: "btns grid2" }, h("button", { class: "btn", type: "button", onclick: close }, "Cancelar"),
        h("button", { class: "btn primary", type: "button", onclick: async () => {
          if (!t.value.trim()) { t.focus(); return toast("Dê um nome ao projeto"); }
          try { const r = await api("/api/portfolio", { method: "POST", body: { title: t.value.trim(), fronts: [...picked], section } });
            await api(`/api/portfolio/${r.id}`, { method: "PUT", body: { ...r, hidden: true } }); close(); location.hash = `#/portfolio/${r.id}`; } catch (x) { toast(x.message); }
        } }, icon("plus"), "Criar"))]);
  };
  shell({ title: "Portfólio", eyebrow: "O que aparece no site", back: "#/", compact: true, fab: h("button", { class: "fab", type: "button", "aria-label": "Novo projeto", onclick: newProject }, icon("plus")) },
    h("div", { class: "stack" },
      h("div", { class: "glass card pf-intro" },
        h("p", {}, `${visible} de ${order.length} projetos visíveis no site. A ordem abaixo é a ordem da página inicial: use as setas para reorganizar.`),
        h("div", { class: "btns" }, h("a", { class: "btn small primary", href: "#/editor" }, icon("pen"), "Editor visual"), h("a", { class: "btn small", href: "#/portfolio/moodboard" }, icon("box"), "Moodboard"), h("a", { class: "btn small", href: "#/portfolio/sobre" }, icon("pen"), "Textos da página inicial"), h("a", { class: "btn ghost small", href: "/", target: "_blank", rel: "noopener" }, icon("eye"), "Abrir o site"))),
      list), h("div", { class: "gap24" }));
}

/* prepara o arquivo: reduz imagens grandes para WebP (GIF e vídeo seguem intactos) e mede o tamanho */
async function pfPrepare(file, maxW) {
  const isStatic = /^image\/(jpeg|png|webp|avif)$/.test(file.type);
  let d = {};
  if (file.type.startsWith("video/")) d = await new Promise((ok) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => ok({ w: v.videoWidth, h: v.videoHeight }); v.onerror = () => ok({}); v.src = URL.createObjectURL(file); });
  else { try { const b = await createImageBitmap(file); d = { w: b.width, h: b.height, bmp: b }; } catch {} }
  if (!isStatic || !d.bmp || d.w <= maxW) return { file, w: d.w, h: d.h };
  const w = maxW, hh = Math.round((d.h / d.w) * maxW);
  const c = document.createElement("canvas"); c.width = w; c.height = hh; c.getContext("2d").drawImage(d.bmp, 0, 0, w, hh);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/webp", 0.86));
  return blob ? { file: new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" }), w, h: hh } : { file, w: d.w, h: d.h };
}

/* ===== recorte na importação =====
   Igual para foto, GIF e vídeo: a moldura mostra exatamente o que vai aparecer; arraste para enquadrar e use o zoom.
   Foto: o recorte é gerado no aparelho. GIF e vídeo: a animação fica inteira e o enquadramento (posição + zoom) é salvo e respeitado pelo site. */
const PF_RATIOS = { orig: ["Original", null], "16:10": ["16:10", 16 / 10], "16:9": ["16:9", 16 / 9], "1:1": ["1:1", 1], "4:5": ["4:5", 4 / 5], "9:16": ["9:16", 9 / 16], "4:3": ["4:3", 4 / 3] };
function pfCropper(file, { ratio = "orig", title = "Ajustar recorte", animated = false } = {}) {
  return new Promise((done) => {
    const url = URL.createObjectURL(file);
    const isVid = file.type.startsWith("video/");
    const media = isVid ? h("video", { src: url, muted: true, autoplay: true, loop: true, playsinline: true }) : h("img", { src: url, alt: "", draggable: "false" });
    const stage = h("div", { class: "cr-stage" }, media);
    const frameEl = h("div", { class: "cr-frame", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i"));
    const wrap = h("div", { class: "cr-wrap" }, stage, frameEl);
    const zoom = h("input", { type: "range", min: 1, max: 4, step: 0.01, value: 1, "aria-label": "Zoom" });
    const zLbl = h("output", { class: "cr-zv" }, "100%");
    let nat = { w: 1, h: 1 }, cur = PF_RATIOS[ratio] ? ratio : "orig", sc = 1, ox = 0, oy = 0;
    const close = (v) => { scrim.remove(); box.remove(); document.removeEventListener("keydown", keys); URL.revokeObjectURL(url); done(v); };
    const ar = () => PF_RATIOS[cur][1] || nat.w / nat.h;
    // a moldura ocupa a área disponível com a proporção escolhida; a mídia cobre a moldura no zoom 1
    const geo = () => {
      const W = wrap.clientWidth, H = wrap.clientHeight, r = ar(), pad = 24;
      let fw = W - pad * 2, fh = fw / r; if (fh > H - pad * 2) { fh = H - pad * 2; fw = fh * r; }
      return { W, H, fw, fh, fx: (W - fw) / 2, fy: (H - fh) / 2, base: Math.max(fw / nat.w, fh / nat.h) };
    };
    const layout = () => {
      const G = geo(), k = G.base * sc, mw = nat.w * k, mh = nat.h * k;
      ox = Math.min(0, Math.max(G.fw - mw, ox)); oy = Math.min(0, Math.max(G.fh - mh, oy));
      Object.assign(frameEl.style, { left: G.fx + "px", top: G.fy + "px", width: G.fw + "px", height: G.fh + "px" });
      Object.assign(media.style, { width: mw + "px", height: mh + "px", left: G.fx + ox + "px", top: G.fy + oy + "px" });
      zLbl.textContent = Math.round(sc * 100) + "%";
      return { ...G, k, mw, mh };
    };
    const center = () => { const G = geo(), k = G.base * sc; ox = (G.fw - nat.w * k) / 2; oy = (G.fh - nat.h * k) / 2; layout(); };
    const setZoom = (z) => { const L = layout(), cx = L.fw / 2 - ox, cy = L.fh / 2 - oy, old = sc; sc = Math.max(1, Math.min(4, z)); zoom.value = sc; ox = L.fw / 2 - cx * (sc / old); oy = L.fh / 2 - cy * (sc / old); layout(); };
    // arrastar com mouse ou dedo; pinça para zoom no celular
    const pts = new Map(); let drag = null, pinch = null;
    wrap.addEventListener("pointerdown", (e) => { wrap.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, ox, oy }; else { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: sc }; drag = null; } });
    wrap.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; setZoom(pinch.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d); return; }
      if (drag) { ox = drag.ox + e.clientX - drag.x; oy = drag.oy + e.clientY - drag.y; layout(); }
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
    wrap.addEventListener("pointerup", up); wrap.addEventListener("pointercancel", up);
    wrap.addEventListener("wheel", (e) => { e.preventDefault(); setZoom(sc - e.deltaY * 0.002); }, { passive: false });
    wrap.addEventListener("dblclick", () => { sc = 1; zoom.value = 1; center(); });
    zoom.addEventListener("input", () => setZoom(Number(zoom.value)));
    const keys = (e) => {
      if (e.key === "Escape") return close(null);
      if (e.key === "Enter") return ok.click();
      const st = e.shiftKey ? 20 : 4, mv = { ArrowLeft: [st, 0], ArrowRight: [-st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
      if (mv && document.activeElement !== zoom) { e.preventDefault(); ox += mv[0]; oy += mv[1]; layout(); }
    };
    const chips = h("div", { class: "seg cr-ratios", role: "radiogroup", "aria-label": "Proporção" });
    const drawChips = () => chips.replaceChildren(...Object.entries(PF_RATIOS).map(([k, [l]]) => h("button", { type: "button", role: "radio", "aria-checked": String(k === cur), class: k === cur ? "on" : "", onclick: () => { cur = k; sc = 1; zoom.value = 1; drawChips(); center(); } }, l)));
    const ok = h("button", { class: "btn primary", type: "button", onclick: async () => {
      const L = layout();
      if (animated) {
        // posição para object-fit:cover + zoom com origem calculada: reproduz exatamente a moldura
        const m1w = nat.w * L.base, m1h = nat.h * L.base, o1x = (L.fw - m1w) / 2, o1y = (L.fh - m1h) / 2;
        const pos = (o, m, f) => (Math.abs(f - m) < 0.5 ? 50 : Math.round((o / (f - m)) * 1000) / 10);
        if (sc <= 1.001) return close({ file, focus: { x: pos(ox, m1w, L.fw), y: pos(oy, m1h, L.fh) } });
        const orx = ((ox - sc * o1x) / (1 - sc)) / L.fw * 100, ory = ((oy - sc * o1y) / (1 - sc)) / L.fh * 100;
        return close({ file, focus: { x: 50, y: 50, z: Math.round(sc * 100) / 100, ox: Math.round(orx * 10) / 10, oy: Math.round(ory * 10) / 10 } });
      }
      const sx = -ox / L.k, sy = -oy / L.k, sw = L.fw / L.k, sh = L.fh / L.k;
      if (cur === "orig" && sc === 1) return close({ file });
      const outW = Math.round(Math.min(sw, 2400)), outH = Math.round(outW * (sh / sw));
      const c = document.createElement("canvas"); c.width = outW; c.height = outH;
      c.getContext("2d").drawImage(media, sx, sy, sw, sh, 0, 0, outW, outH);
      const type = file.type === "image/png" ? "image/png" : "image/webp";
      const blob = await new Promise((r) => c.toBlob(r, type, 0.88));
      close(blob ? { file: new File([blob], file.name.replace(/\.\w+$/, "") + (type === "image/png" ? ".png" : ".webp"), { type }) } : { file });
    } }, icon("check"), "Usar este recorte");
    const scrim = h("div", { class: "scrim", onclick: () => close(null) });
    const box = h("div", { class: "sheet cr", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "grip", "aria-hidden": "true" }), h("h2", {}, title),
      chips, wrap,
      h("div", { class: "cr-tools" },
        h("button", { class: "ibtn", type: "button", "aria-label": "Menos zoom", onclick: () => setZoom(sc - 0.25) }, "−"), zoom,
        h("button", { class: "ibtn", type: "button", "aria-label": "Mais zoom", onclick: () => setZoom(sc + 0.25) }, "+"), zLbl,
        h("button", { class: "btn small ghost", type: "button", onclick: () => { sc = 1; zoom.value = 1; center(); } }, "Centralizar")),
      h("p", { class: "hint" }, animated ? "O que está dentro da moldura é o que aparece no site. GIF e vídeo continuam animados." : "O que está dentro da moldura é o que aparece no site. Arraste para enquadrar, use o zoom (ou a pinça no celular)."),
      h("div", { class: "btns grid2" }, h("button", { class: "btn", type: "button", onclick: () => close(null) }, "Cancelar"), ok));
    document.body.append(scrim, box); document.addEventListener("keydown", keys);
    const ready = () => { nat = isVid ? { w: media.videoWidth || 16, h: media.videoHeight || 9 } : { w: media.naturalWidth, h: media.naturalHeight }; drawChips(); center(); };
    if (isVid) media.addEventListener("loadedmetadata", ready, { once: true }); else if (media.complete && media.naturalWidth) ready(); else media.addEventListener("load", ready, { once: true });
    addEventListener("resize", () => box.isConnected && layout());
  });
}
/* pergunta o recorte antes de enviar; null = cancelado */
async function pfCropThen(file, ratio, title) {
  const animated = file.type === "image/gif" || file.type.startsWith("video/");
  if (!/^image\/|^video\//.test(file.type)) return { file };
  return pfCropper(file, { ratio, title, animated });
}

async function pfUpload(id, kind, f, maxW, focus) {
  if (f.size > 25 * 1024 * 1024) throw new Error(`${f.name}: arquivo grande demais.`);
  const prep = await pfPrepare(f, maxW);
  if (prep.file.size > 4.5 * 1024 * 1024) throw new Error(`${f.name}: acima de 4,5 MB. Exporte animações em MP4 (bem mais leve).`);
  const fd = new FormData(); fd.append("file", prep.file); fd.append("kind", kind);
  const r = await api(`/api/portfolio/${id}/upload`, { method: "POST", body: fd });
  return { key: r.key, type: r.type, w: prep.w || null, h: prep.h || null, ...(focus ? { fx: focus.x, fy: focus.y, ...(focus.z > 1 ? { z: focus.z, ox: focus.ox, oy: focus.oy } : {}) } : {}) };
}

/* Moodboard da página inicial: montado do zero com imagens, GIFs e vídeos curtos. */
async function renderMoodboard() {
  loading("Moodboard");
  const [mb, srv] = await Promise.all([api("/api/moodboard"), api("/api/portfolio?all=1")]);
  let tiles = (mb.tiles || []).map((t) => ({ ...t })), dirty = false, saving = false;
  const projects = [...new Map([...catalog.projects.map((p) => [p.id, p.title]), ...Object.entries(srv.items || {}).filter(([, e]) => e.title).map(([k, e]) => [k, e.title])]).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const status = h("span", { class: "pf-state", role: "status" }, tiles.length ? `${tiles.length} peças no site` : "Moodboard vazio: a seção fica oculta no site");
  const touch = () => { dirty = true; status.textContent = "Alterações não salvas"; status.className = "pf-state warn"; };
  window.onbeforeunload = () => (dirty ? true : null);
  const SIZES = [["auto", "Automático"], ["s", "Pequeno"], ["wide", "Largo"], ["tall", "Alto"], ["l", "Grande"]];
  const grid = h("div", { class: "mb-grid" });
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= tiles.length) return; [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; touch(); draw(); };
  function draw() {
    grid.replaceChildren(...tiles.map((t, i) => {
      const url = `/api/media/${t.media.key}`, vid = /^video\//.test(t.media.type);
      return h("div", { class: "mb-item" },
        h("div", { class: "mb-thumb" }, vid ? h("video", { src: url, muted: "", autoplay: "", loop: "", playsinline: "" }) : h("img", { src: url, alt: t.alt || "" }), h("span", { class: "mb-n" }, String(i + 1))),
        h("label", { class: "f" }, h("span", {}, "Tamanho no mosaico"), h("select", { class: "in", onchange: (e) => { t.size = e.target.value; touch(); } }, ...SIZES.map(([k, l]) => h("option", { value: k, selected: (t.size || "auto") === k ? "" : null }, l)))),
        h("label", { class: "f" }, h("span", {}, "Leva para o projeto"), h("select", { class: "in", onchange: (e) => { t.link = e.target.value; touch(); } }, h("option", { value: "" }, "Nenhum"), ...projects.map(([k, l]) => h("option", { value: k, selected: t.link === k ? "" : null }, l)))),
        h("label", { class: "f" }, h("span", {}, "Descrição (acessibilidade)"), (() => { const x = h("input", { class: "in", value: t.alt || "", placeholder: "O que a imagem mostra" }); x.addEventListener("input", () => { t.alt = x.value; touch(); }); return x; })()),
        h("div", { class: "btns mb-act" },
          h("button", { class: "ibtn", type: "button", "aria-label": `Mover peça ${i + 1} para trás`, disabled: i === 0 ? "" : null, onclick: () => move(i, -1) }, "←"),
          h("button", { class: "ibtn", type: "button", "aria-label": `Mover peça ${i + 1} para frente`, disabled: i === tiles.length - 1 ? "" : null, onclick: () => move(i, 1) }, "→"),
          h("button", { class: "ibtn", type: "button", "aria-label": `Tirar peça ${i + 1}`, onclick: () => { tiles.splice(i, 1); touch(); draw(); } }, icon("trash"))));
    }));
    if (!tiles.length) grid.append(h("p", { class: "hint", style: "grid-column:1/-1" }, "Nenhuma peça ainda. Adicione imagens, GIFs ou vídeos curtos (MP4)."));
  }
  const input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm", multiple: "", style: "display:none", onchange: async (e) => {
    const files = [...e.target.files]; e.target.value = "";
    for (const f of files) {
      status.textContent = `Enviando ${f.name}…`;
      try { const m = await pfUpload("mood", "mood", f, 1600); tiles.push({ media: m, size: "auto", alt: "", link: "" }); touch(); draw(); }
      catch (x) { toast(x.message); }
    }
    status.textContent = "Alterações não salvas";
  } });
  async function save() {
    if (saving) return; saving = true;
    try { const r = await api("/api/moodboard", { method: "PUT", body: { tiles } }); tiles = r.tiles; dirty = false; status.textContent = `Salvo · ${tiles.length} peças · no site em até 1 min`; status.className = "pf-state ok"; haptic(); toast("Moodboard atualizado"); draw(); }
    catch (x) { toast(x.message); } finally { saving = false; }
  }
  draw();
  shell({ title: "Moodboard", eyebrow: "Página inicial", back: "#/portfolio", compact: true, nav: false },
    h("div", { class: "stack" },
      h("section", { class: "form-card glass" },
        h("p", { class: "hint" }, "O mosaico do site usa só as peças daqui, na ordem abaixo. \"Automático\" sorteia o tamanho a cada visita conforme o formato da imagem. GIFs e vídeos até 4,5 MB (para animações, MP4 fica bem mais leve)."),
        status,
        h("div", { class: "btns grid2" },
          h("button", { class: "btn primary", type: "button", onclick: () => input.click() }, icon("plus"), "Adicionar imagens"),
          h("button", { class: "btn", type: "button", onclick: save }, icon("check"), "Salvar")),
        tiles.length ? h("button", { class: "btn ghost block", type: "button", onclick: () => confirmSheet("Zerar o moodboard?", "Todas as peças saem do site e os arquivos são apagados ao salvar.", "Zerar", async () => { tiles = []; touch(); draw(); await save(); }) }, icon("trash"), "Zerar moodboard") : null,
        input),
      grid), h("div", { class: "gap24" }));
}

async function renderPortfolioEdit(id) {
  loading("Portfólio");
  const srv = await api("/api/portfolio?all=1");
  const base = catalog.projects.find((x) => x.id === id);
  let e = srv.items[id] || (base ? {} : null);
  if (!e) { location.hash = "#/portfolio"; return; }
  e = { hidden: false, thumb: null, banner: null, bannerFrame: "laptop", bannerAlt: "", gallery: [], metrics: [], feedback: [], insta: [], instaTitle: "", instaCredit: "", ...e };
  const b = base || {};
  let dirty = false, saving = false;
  const status = h("span", { class: "pf-state", role: "status" }, "Tudo salvo");
  const saveBtn = h("button", { class: "btn primary", type: "button", onclick: () => save() }, icon("check"), "Salvar");
  const touch = () => { dirty = true; status.textContent = "Alterações não salvas"; status.className = "pf-state warn"; };
  window.onbeforeunload = () => (dirty ? true : null);
  async function save(quiet) {
    if (saving) return; saving = true; saveBtn.disabled = true; status.textContent = "Salvando…";
    try {
      e = { ...e, ...(await api(`/api/portfolio/${id}`, { method: "PUT", body: e })) };
      dirty = false; status.textContent = "Salvo · no site em até 1 min"; status.className = "pf-state ok"; haptic(); if (!quiet) toast("Portfólio atualizado");
    } catch (x) { status.textContent = x.message; status.className = "pf-state warn"; toast(x.message); }
    finally { saving = false; saveBtn.disabled = false; }
  }
  const inp = (obj, key, attrs = {}, tag = "input") => { const el = h(tag, { class: "in", ...attrs }); el.value = obj[key] ?? ""; el.addEventListener("input", () => { obj[key] = el.value; touch(); }); return el; };
  const f = (l, el) => h("label", { class: "f" }, h("span", {}, l), el);
  const move = (arr, i, d, redraw) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; touch(); redraw(); };
  const seg = (options, value, onPick, label) => {
    const wrap = h("div", { class: "seg", role: "radiogroup", "aria-label": label });
    const draw = (v) => wrap.replaceChildren(...Object.entries(options).map(([k, t]) => h("button", { type: "button", role: "radio", "aria-checked": String(k === v), class: k === v ? "on" : "", onclick: () => { onPick(k); draw(k); } }, t)));
    draw(value); return wrap;
  };

  /* slot de mídia único (thumb, banner, foto, print) */
  function mediaSlot({ kind, label, accept, ratio, maxW, get, set, frame, cropRatio }) {
    const input = h("input", { type: "file", accept, hidden: true });
    const box = h("div", { class: "pf-slot", style: ratio ? `aspect-ratio:${ratio}` : "" });
    const actions = h("div", { class: "btns" });
    const draw = () => {
      const m = get();
      box.replaceChildren(m ? (frame ? pfFramed(m, frame(), label) : pfMediaEl(m, label)) : h("button", { class: "pf-empty", type: "button", onclick: () => input.click() }, icon("plus"), h("span", {}, `Enviar ${label.toLowerCase()}`)));
      box.classList.toggle("framed", !!(m && frame));
      actions.replaceChildren(...(m ? [h("button", { class: "btn small", type: "button", onclick: () => input.click() }, "Trocar"), h("button", { class: "btn small", type: "button", onclick: recrop }, m.type === "image/gif" || m.type.startsWith("video") ? "Ajustar foco" : "Recortar"), h("button", { class: "btn ghost small", type: "button", onclick: () => { set(null); touch(); draw(); } }, icon("trash"), "Remover")] : []));
    };
    input.onchange = async () => {
      const file = input.files[0]; input.value = ""; if (!file) return;
      await sendWithCrop(file);
    };
    const sendWithCrop = async (file) => {
      const c = await pfCropThen(file, typeof cropRatio === "function" ? cropRatio() : cropRatio || "orig", `Recorte · ${label}`);
      if (!c) return;
      box.replaceChildren(h("span", { class: "pf-load" }, "Enviando…"));
      try { set(await pfUpload(id, kind, c.file, maxW, c.focus)); await save(true); toast(`${label} enviado`); } catch (x) { toast(x.message); }
      draw();
    };
    const recrop = async () => {
      const m = get(); if (!m) return;
      try { const blob = await fetch(pfMedia(m)).then((r) => r.blob()); await sendWithCrop(new File([blob], `${kind}.${(m.type.split("/")[1] || "jpg").replace("jpeg", "jpg")}`, { type: m.type })); } catch { toast("Não foi possível abrir a imagem"); }
    };
    draw();
    return { el: h("div", { class: "pf-media" }, box, input, actions), redraw: draw };
  }

  /* card do projeto */
  const fr = new Set(e.fronts || b.fronts || []);
  const frontChips = h("div", { class: "chips" }, ...catalog.fronts.map((x) => { const bt = h("button", { class: "chip" + (fr.has(x.id) ? " on" : ""), type: "button", "aria-pressed": String(fr.has(x.id)), onclick: () => { fr.has(x.id) ? fr.delete(x.id) : fr.add(x.id); bt.classList.toggle("on"); bt.setAttribute("aria-pressed", String(fr.has(x.id))); e.fronts = [...fr]; touch(); } }, x.label); return bt; }));
  const NEEDS_L = { reposicionar: "Reposicionar marca", "criar-marca": "Criar marca", site: "Site", sistema: "Sistema" };
  const nd = new Set(e.needs || []);
  const needChips = h("div", { class: "chips" }, ...Object.entries(NEEDS_L).map(([k, l]) => { const bt = h("button", { class: "chip" + (nd.has(k) ? " on" : ""), type: "button", "aria-pressed": String(nd.has(k)), onclick: () => { nd.has(k) ? nd.delete(k) : nd.add(k); bt.classList.toggle("on"); bt.setAttribute("aria-pressed", String(nd.has(k))); e.needs = [...nd]; touch(); } }, l); return bt; }));
  const hint = (v) => (v ? `Atual: ${String(v).slice(0, 60)}${String(v).length > 60 ? "…" : ""}` : "");
  const curSec = () => (e.section || b.section) === "list" ? "list" : "creative";
  const topicSw = h("label", { class: "switch" }, h("span", {}, "Só tópico, sem página", h("small", { class: "hint", style: "display:block" }, "Aparece só na lista. Se tiver link do projeto no ar, o tópico abre o link.")),
    h("input", { type: "checkbox", role: "switch", checked: !!e.topicOnly, onchange: (ev) => { e.topicOnly = ev.target.checked; touch(); } }));
  topicSw.hidden = curSec() !== "list";
  const placeSec = h("section", { class: "form-card glass" }, h("h2", {}, "Onde aparece no site"),
    seg({ creative: "Projetos criativos", list: "Lista de experiência" }, curSec(), (k) => { e.section = k; topicSw.hidden = k !== "list"; touch(); }, "Vitrine"),
    h("p", { class: "hint" }, "Projetos criativos viram cards com imagem. A lista de experiência mostra tópicos compactos (canais, marcas menores, participações)."),
    topicSw);
  const cardSec = h("section", { class: "form-card glass" }, h("h2", {}, "Card do projeto"),
    base ? h("p", { class: "hint" }, "Campos vazios mantêm o texto atual do site.") : null,
    f("Título", inp(e, "title", { placeholder: b.title || "Nome do projeto" })),
    h("div", { class: "r2" }, f("Tipo de trabalho", inp(e, "kind", { placeholder: b.kind || "Ex.: Site e loja virtual" })), f("Ano", inp(e, "year", { placeholder: b.year || "2026", inputmode: "numeric" }))),
    f("Cliente", inp(e, "client", { placeholder: b.client || "Ex.: Café Serra" })),
    f("Resumo", inp(e, "summary", { rows: 3, placeholder: b.summary || "Uma ou duas frases sobre o que foi feito e para quem." }, "textarea")),
    f("Link do projeto no ar (opcional)", inp(e, "url", { type: "url", placeholder: b.url || "https://", inputmode: "url" })),
    h("div", { class: "f" }, h("span", {}, "Frentes"), frontChips),
    h("div", { class: "f" }, h("span", {}, "Aparece para quem escolhe (pop-up de interesses)"), needChips,
      h("small", { class: "hint" }, "Sem marcação, o site decide pelo tipo de trabalho.")));

  /* banner com moldura */
  let banner;
  banner = mediaSlot({ kind: "banner", label: "Banner", cropRatio: () => ({ laptop: "16:10", browser: "16:10", tablet: "4:3", phone: "9:16", none: "orig" })[e.bannerFrame] || "orig", accept: "image/jpeg,image/png,image/webp,image/gif,video/mp4", maxW: 2400, get: () => e.banner, set: (m) => (e.banner = m), frame: () => e.bannerFrame });
  const bgPick = h("input", { type: "color", value: e.bannerBg || (b.theme?.bg && /^#[0-9a-f]{6}$/i.test(b.theme.bg) ? b.theme.bg : "#F4F4F5"), "aria-label": "Cor do fundo", oninput: (ev) => { e.bannerBg = ev.target.value; touch(); } });
  const brandColors = [b.theme?.bg, b.theme?.panel, b.theme?.accent, "#FFFFFF", "#F4F4F5", "#0E0E10"].filter((c) => /^#[0-9a-f]{6}$/i.test(c || ""));
  const bgRow = h("div", { class: "pg-colors", hidden: !e.bannerBg },
    h("label", { class: "pg-color" }, bgPick, h("span", {}, "Cor")),
    ...brandColors.map((c) => h("button", { type: "button", class: "pg-swatch", style: `background:${c}`, "aria-label": `Usar ${c}`, onclick: () => { bgPick.value = c; e.bannerBg = c; touch(); } })),
    h("label", { class: "switch sm" }, h("span", {}, "Respiro em volta"), h("input", { type: "checkbox", role: "switch", checked: e.bannerPad !== false, onchange: (ev) => { e.bannerPad = ev.target.checked; touch(); } })));
  const bannerSec = h("section", { class: "form-card glass" }, h("h2", {}, "Banner da página"),
    h("p", { class: "hint" }, "Envie a tela da interface. A moldura escolhida é aplicada automaticamente no site."),
    seg(PF_FRAMES, e.bannerFrame, (k) => { e.bannerFrame = k; touch(); banner.redraw(); }, "Moldura do banner"),
    h("div", { class: "pg-style" },
      h("label", { class: "switch" }, "Fundo colorido atrás do banner", h("input", { type: "checkbox", role: "switch", checked: !!e.bannerBg, onchange: (ev) => { e.bannerBg = ev.target.checked ? (bgPick.value || "#F4F4F5") : ""; bgRow.hidden = !ev.target.checked; touch(); } })),
      bgRow),
    banner.el, f("Descrição do banner (acessibilidade)", inp(e, "bannerAlt", { placeholder: "Ex.: Tela inicial da loja no computador" })));

  /* galeria / moodboard */
  const galBox = h("div", { class: "pf-gal" });
  const galInput = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm", multiple: true, hidden: true });
  const drawGallery = () => {
    galBox.replaceChildren(...e.gallery.map((g, gi) => h("div", { class: "pf-gitem" },
      h("div", { class: `pf-gprev sz-${g.size}`, style: g.bg ? `background:${g.bg}` : null }, pfFramed(g.media, g.frame, g.caption)),
      seg(PF_FRAMES, g.frame, (k) => { g.frame = k; touch(); drawGallery(); }, "Moldura"),
      seg(PF_SIZES, g.size, (k) => { g.size = k; touch(); drawGallery(); }, "Tamanho no mosaico"),
      h("div", { class: "pg-colors" }, h("span", { class: "pf-lbl", style: "margin:0" }, "Fundo"),
        ...["", "#FFFFFF", "#F4F4F5", "#0E0E10", b.theme?.bg, b.theme?.panel].filter((c, k, a) => (c === "" || /^#[0-9a-f]{6}$/i.test(c || "")) && a.indexOf(c) === k).map((c) => h("button", { type: "button", class: "pg-swatch" + ((g.bg || "") === c ? " on" : "") + (c ? "" : " none"), style: c ? `background:${c}` : "", "aria-label": c ? `Fundo ${c}` : "Sem fundo", "aria-pressed": String((g.bg || "") === c), onclick: () => { g.bg = c; touch(); drawGallery(); } })),
        h("input", { type: "color", value: g.bg || "#F4F4F5", "aria-label": "Outra cor de fundo", onchange: (ev) => { g.bg = ev.target.value; touch(); drawGallery(); } })),
      f("Legenda (opcional)", inp(g, "caption", { placeholder: "Ex.: Cardápio digital" })),

      h("div", { class: "btns" },
        h("button", { class: "ibtn sm", type: "button", "aria-label": "Mover para trás", onclick: () => move(e.gallery, gi, -1, drawGallery) }, "←"),
        h("button", { class: "ibtn sm", type: "button", "aria-label": "Mover para frente", onclick: () => move(e.gallery, gi, 1, drawGallery) }, "→"),
        h("button", { class: "btn small", type: "button", onclick: async () => {
          try { const blob = await fetch(pfMedia(g.media)).then((r) => r.blob()); const file = new File([blob], "imagem." + (g.media.type.split("/")[1] || "jpg"), { type: g.media.type });
            const c = await pfCropThen(file, "orig", "Recorte · galeria"); if (!c) return; toast("Enviando…");
            g.media = await pfUpload(id, "gallery", c.file, 2000, c.focus); await save(true); drawGallery(); toast("Recorte aplicado"); } catch (x) { toast(x.message || "Não foi possível abrir a imagem"); }
        } }, g.media.type === "image/gif" || g.media.type.startsWith("video") ? "Foco" : "Recortar"),
h("button", { class: "btn ghost small", type: "button", onclick: () => { e.gallery.splice(gi, 1); touch(); drawGallery(); } }, icon("trash"), "Remover")))),
      e.gallery.length < 24 ? h("button", { class: "pf-empty pf-gadd", type: "button", onclick: () => galInput.click() }, icon("plus"), h("span", {}, "Adicionar imagens"), h("small", {}, "Várias de uma vez")) : null);
  };
  galInput.onchange = async () => {
    const files = [...galInput.files].slice(0, 24 - e.gallery.length); galInput.value = "";
    let ok = 0;
    for (const [n, file] of files.entries()) {
      const c = await pfCropThen(file, "orig", `Recorte · imagem ${n + 1} de ${files.length}`);
      if (!c) continue;
      try { const m = await pfUpload(id, "gallery", c.file, 2000, c.focus); e.gallery.push({ media: m, frame: "none", size: m.w && m.h ? (m.w / m.h > 1.6 ? "wide" : m.h / m.w > 1.3 ? "tall" : "s") : "s", caption: "", mood: true }); ok++; drawGallery(); }
      catch (x) { toast(x.message); }
    }
    if (ok) { await save(true); toast(pl(ok, "imagem enviada", "imagens enviadas")); }
  };
  drawGallery();

  /* fotos do acervo do projeto para o moodboard da página inicial */
  e.moodPicks = e.moodPicks || [];
  const moodLib = ((await fetch("/data/moodboard.json").then((r) => r.json()).catch(() => ({}))).lib || {})[id] || [];
  const pickBox = h("div", { class: "pf-picks" });
  const pickCount = h("span", { class: "hint" });
  const drawPicks = () => {
    pickCount.textContent = `${e.moodPicks.length} de 16 escolhidas`;
    pickBox.replaceChildren(...moodLib.map((x) => {
      const on = e.moodPicks.includes(x.path);
      return h("button", { type: "button", class: "pf-pick" + (on ? " on" : ""), "aria-pressed": String(on), "aria-label": on ? "Tirar do moodboard" : "Pôr no moodboard", onclick: () => {
        if (on) e.moodPicks = e.moodPicks.filter((y) => y !== x.path);
        else if (e.moodPicks.length < 16) e.moodPicks = [...e.moodPicks, x.path];
        else return toast("Limite de 16 fotos por projeto");
        touch(); drawPicks();
      } }, h("img", { src: "/" + x.src, alt: "", loading: "lazy" }), on ? h("span", { class: "pf-pick-ok", "aria-hidden": "true" }, icon("check")) : null);
    }));
  };
  drawPicks();

  /* números por seção */
  const metricsBox = h("div", { class: "stack" });
  const drawMetrics = () => {
    metricsBox.replaceChildren(...e.metrics.map((s, si) => h("div", { class: "pf-sec" },
      h("div", { class: "pf-sec-h" }, f("Nome da seção", inp(s, "title", { list: "pf-sec-list", placeholder: "Ex.: Resultados" })),
        h("div", { class: "pf-tools" },
          h("button", { class: "ibtn sm", type: "button", "aria-label": "Subir seção", onclick: () => move(e.metrics, si, -1, drawMetrics) }, "↑"),
          h("button", { class: "ibtn sm", type: "button", "aria-label": "Descer seção", onclick: () => move(e.metrics, si, 1, drawMetrics) }, "↓"),
          h("button", { class: "ibtn sm", type: "button", "aria-label": "Excluir seção", onclick: () => { e.metrics.splice(si, 1); touch(); drawMetrics(); } }, icon("trash")))),
      f("Texto de apoio (opcional)", inp(s, "note", { placeholder: "Ex.: Primeiro mês após o lançamento" })),
      ...s.items.map((it, ii) => h("div", { class: "pf-item" },
        h("div", { class: "r3" }, f("Número", inp(it, "value", { placeholder: "+38" })), f("Unidade", inp(it, "unit", { placeholder: "%" })), f("Barra 0–100", inp(it, "progress", { type: "number", min: 0, max: 100, inputmode: "numeric", placeholder: "opcional" }))),
        f("O que o número mede", inp(it, "label", { placeholder: "Ex.: aumento nas vendas da loja" })),
        f("Detalhe (opcional)", inp(it, "note", { placeholder: "Ex.: comparado a setembro" })),
        h("button", { class: "btn ghost small", type: "button", onclick: () => { s.items.splice(ii, 1); touch(); drawMetrics(); } }, icon("trash"), "Remover número"))),
      s.items.length < 8 ? h("button", { class: "btn small", type: "button", onclick: () => { s.items.push({ value: "", unit: "", label: "", note: "", progress: "" }); touch(); drawMetrics(); } }, icon("plus"), "Adicionar número") : null)),
      e.metrics.length < 8 ? h("button", { class: "btn block", type: "button", onclick: () => { e.metrics.push({ title: e.metrics.length ? "" : "Resultados", note: "", items: [{ value: "", unit: "", label: "", note: "", progress: "" }] }); touch(); drawMetrics(); } }, icon("plus"), "Nova seção de números") : null);
  };

  /* depoimentos */
  const fbBox = h("div", { class: "stack" });
  const drawFeedback = () => {
    fbBox.replaceChildren(...e.feedback.map((fb, fi) => h("div", { class: "pf-sec" },
      h("div", { class: "pf-sec-h" }, h("strong", {}, fb.name || `Depoimento ${fi + 1}`),
        h("div", { class: "pf-tools" },
          h("button", { class: "ibtn sm", type: "button", "aria-label": "Subir", onclick: () => move(e.feedback, fi, -1, drawFeedback) }, "↑"),
          h("button", { class: "ibtn sm", type: "button", "aria-label": "Descer", onclick: () => move(e.feedback, fi, 1, drawFeedback) }, "↓"),
          h("button", { class: "ibtn sm", type: "button", "aria-label": "Excluir depoimento", onclick: () => confirmSheet("Excluir depoimento?", "Ele sai do site ao salvar.", "Excluir", async () => { e.feedback.splice(fi, 1); touch(); drawFeedback(); }) }, icon("trash")))),
      h("div", { class: "r2" }, f("Nome do cliente", inp(fb, "name", { placeholder: "Ex.: Vanusa Alves" })), f("Cargo ou empresa", inp(fb, "role", { placeholder: "Ex.: Fazenda Encantada" }))),
      h("div", { class: "r2" }, f("Canal", h("select", { class: "in", onchange: (ev) => { fb.channel = ev.target.value; touch(); } }, ...Object.entries(PF_CHANNELS).map(([k, v]) => h("option", { value: k, selected: fb.channel === k }, v)))), f("Data", inp(fb, "date", { type: "date" }))),
      f("Mensagem original do cliente", inp(fb, "message", { rows: 5, placeholder: "Cole a mensagem como ele escreveu. Quebras de linha e emojis são mantidos." }, "textarea")),
      f("Frase em destaque (opcional)", inp(fb, "highlight", { placeholder: "Trecho curto que vira a citação grande" })),
      h("div", { class: "r2 pf-small-media" },
        h("div", {}, h("span", { class: "pf-lbl" }, "Foto do cliente"), mediaSlot({ kind: "avatar", label: "Foto", cropRatio: "1:1", accept: "image/jpeg,image/png,image/webp", ratio: "1", maxW: 400, get: () => fb.avatar, set: (m) => (fb.avatar = m) }).el),
        h("div", {}, h("span", { class: "pf-lbl" }, "Print da conversa"), mediaSlot({ kind: "print", label: "Print", accept: "image/jpeg,image/png,image/webp", ratio: "9/16", maxW: 1080, get: () => fb.print, set: (m) => (fb.print = m) }).el)),
      h("label", { class: "switch" }, h("span", {}, "Cliente autorizou publicar", h("small", { class: "hint", style: "display:block" }, "Sem autorização o depoimento fica salvo, mas não aparece no site.")),
        h("input", { type: "checkbox", role: "switch", checked: !!fb.authorized, onchange: (ev) => { fb.authorized = ev.target.checked; touch(); } })))),
      e.feedback.length < 12 ? h("button", { class: "btn block", type: "button", onclick: () => { e.feedback.push({ id: rid(), name: "", role: "", channel: "whatsapp", date: today(), message: "", highlight: "", avatar: null, print: null, authorized: false }); touch(); drawFeedback(); } }, icon("plus"), "Novo depoimento") : null);
  };
  /* publicações do Instagram: cola o link do post ou reel; a página mostra o embed oficial (toca com som) */
  const IG_RE = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reels?|tv)\/([A-Za-z0-9_-]{5,40})/;
  const igBox = h("div", { class: "stack" });
  const igIn = h("input", { class: "in", type: "url", inputmode: "url", placeholder: "https://www.instagram.com/reel/…", "aria-label": "Link da publicação" });
  const igAdd = () => {
    const m = igIn.value.trim().match(IG_RE);
    if (!m) { toast("Cole o link de um post ou reel do Instagram"); igIn.focus(); return; }
    const url = `https://www.instagram.com/${m[1].startsWith("reel") ? "reel" : m[1]}/${m[2]}/`;
    if (e.insta.some((x) => x.url === url)) { toast("Essa publicação já está na lista"); return; }
    if (e.insta.length >= 12) { toast("Máximo de 12 publicações"); return; }
    e.insta.push({ url, caption: "" }); igIn.value = ""; touch(); drawInsta();
  };
  igIn.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); igAdd(); } });
  const drawInsta = () => {
    igBox.replaceChildren(
      h("div", { class: "r2" }, f("Título do bloco (opcional)", inp(e, "instaTitle", { placeholder: "Ex.: No feed do cliente" })), f("Crédito (opcional)", inp(e, "instaCredit", { placeholder: "Ex.: Reprodução @perfil" }))),
      ...e.insta.map((it, k) => h("div", { class: "pf-sec" },
        h("div", { class: "pf-sec-h" },
          h("a", { href: it.url, target: "_blank", rel: "noopener", style: "word-break:break-all;font-size:13px" }, `${/\/reel\//.test(it.url) ? "Reel" : "Post"} · ${it.url.split("/").filter(Boolean).pop()}`),
          h("div", { class: "pf-tools" },
            h("button", { class: "ibtn sm", type: "button", "aria-label": "Subir", onclick: () => move(e.insta, k, -1, drawInsta) }, "↑"),
            h("button", { class: "ibtn sm", type: "button", "aria-label": "Descer", onclick: () => move(e.insta, k, 1, drawInsta) }, "↓"),
            h("button", { class: "ibtn sm", type: "button", "aria-label": "Remover publicação", onclick: () => { e.insta.splice(k, 1); touch(); drawInsta(); } }, icon("trash")))),
        f("Legenda curta (opcional)", inp(it, "caption", { placeholder: "Ex.: Reel de lançamento · 48 mil views" })))),
      e.insta.length < 12 ? h("div", { class: "r2", style: "grid-template-columns:1fr auto;align-items:end" }, f("Link do post ou reel", igIn), h("button", { class: "btn", type: "button", onclick: igAdd }, icon("plus"), "Adicionar")) : null);
  };
  drawMetrics(); drawFeedback(); drawInsta();

  const thumb = mediaSlot({ kind: "thumb", label: "Thumb", cropRatio: "16:10", accept: "image/gif,video/mp4,video/webm,image/webp,image/jpeg,image/png", ratio: "16/10", maxW: 1280, get: () => e.thumb, set: (m) => (e.thumb = m) });
  const pageUrl = `/projetos/${id}`;
  const title = e.title || b.title || "Projeto";
  shell({ title, eyebrow: e.custom ? "Projeto criado no painel" : "Portfólio", back: "#/portfolio", compact: true, nav: false },
    h("div", { class: "stack pf-edit" },
      h("section", { class: "form-card glass" },
        h("label", { class: "switch" }, "Mostrar no site", h("input", { type: "checkbox", role: "switch", checked: !e.hidden, onchange: (ev) => { e.hidden = !ev.target.checked; touch(); } })),
        h("div", { class: "btns" }, h("a", { class: "btn small primary", href: `#/editor/${id}` }, icon("pen"), "Editor visual"), h("a", { class: "btn small", href: `#/portfolio/${id}/pagina` }, "Editar por campos"), h("a", { class: "btn ghost small", href: pageUrl, target: "_blank", rel: "noopener" }, icon("eye"), "Ver página"))),
      placeSec,
      cardSec,
      h("section", { class: "form-card glass" }, h("h2", {}, "Thumb animada"), h("p", { class: "hint" }, "Capa do card na página inicial. GIF até 4,5 MB, ou MP4 (recomendado: até 10× mais leve). 1280×800."), thumb.el),
      bannerSec,
      h("section", { class: "form-card glass" }, h("h2", {}, "Galeria"), h("p", { class: "hint" }, "Imagens do projeto em mosaico, na página do projeto. Escolha moldura e tamanho. O moodboard da página inicial tem espaço próprio em Portfólio › Moodboard."), galBox, galInput),
      h("section", { class: "form-card glass" }, h("h2", {}, "Números por seção"), h("p", { class: "hint" }, "Cada seção vira um bloco de dados na página. Use números reais e diga o que medem."), metricsBox),
      h("section", { class: "form-card glass" }, h("h2", {}, "Publicações do Instagram"), h("p", { class: "hint" }, "Cole o link de posts ou reels públicos. Na página aparecem como no Instagram: o vídeo toca com som ao tocar, sem você subir arquivo. Abra a publicação no app › ··· › Copiar link."), igBox),
      h("section", { class: "form-card glass" }, h("h2", {}, "Depoimentos"), h("p", { class: "hint" }, "A mensagem aparece como o cliente escreveu, no formato do canal."), fbBox),
      h("button", { class: "btn danger block", type: "button", onclick: () => confirmSheet(e.custom ? "Excluir projeto?" : "Limpar dados deste projeto?", e.custom ? "O projeto e os arquivos enviados saem do site." : "Thumb, banner, galeria, números e depoimentos enviados aqui são apagados. O case original continua.", e.custom ? "Excluir" : "Limpar", async () => { try { await api(`/api/portfolio/${id}`, { method: "DELETE" }); dirty = false; toast(e.custom ? "Projeto excluído" : "Dados apagados"); location.hash = "#/portfolio"; } catch (x) { toast(x.message); } }) }, icon("trash"), e.custom ? "Excluir projeto" : "Limpar dados enviados"),
      h("datalist", { id: "pf-sec-list" }, ...PF_SECTIONS.map((s) => h("option", { value: s }))),
      h("div", { class: "pf-bar glass" }, status, saveBtn)),
    h("div", { class: "gap24" }));
}


/* Sobre e Trajetória da página inicial */
const SITE_DEFAULT = {
  hero: { title: "Ei, sou o Gustavo Elian.", sub: "Vem conhecer um pouco do meu trabalho ;)", hand: "junto a um mix de pesquisa e historiografia",
    lead: "Crio sites, sistemas e o reposicionamento da sua marca. Direção criativa com um repertório que pode fazer total sentido pra você!",
    cards: [{ k: "Mestrado", title: "História Social", sub: "PPGH · Unimontes", href: "" }, { k: "Processo seletivo do Doutorado", title: "Comunicação", sub: "PPGCom, FCS · UERJ", href: "https://lattes.cnpq.br/6725725752399564" }, { k: "Já fui professor", title: "Design Gráfico", sub: "SENAI e FADENORTE", href: "" }] },
  services: [
    { title: "Sites e landing pages", text: "Páginas que explicam rápido o que você oferece e levam o visitante até o contato." },
    { title: "Sistemas e produtos digitais", text: "Interfaces pensadas como sistema, com componentes, estados e fluxos consistentes." },
    { title: "Identidade visual", text: "Naming, logo, manual de marca e aplicações reais, do cartão à fachada." },
    { title: "Campanhas e comunicação", text: "Linhas criativas, eventos, ativações e narrativa visual com base em análise semiótica." },
  ],
  about: { title: "Por que um designer estuda o século XIX?", years: "1888–1890", yearsLabel: "Recorte da pesquisa", caption: "ALCAR Sudeste 2026 · visualidade da imprensa brasileira",
    text: ["Sou publicitário, designer e mestrando em História Social pelo PPGH/Unimontes. Na dissertação, investigo a Gazeta de Notícias e como a imprensa brasileira do fim do século XIX usava imagem e texto para convencer.",
      "É o mesmo desafio de qualquer marca hoje: ser lida, entendida e lembrada. Por isso cada decisão de cor, fonte e layout nos meus projetos tem um porquê que você pode defender."] },
  trail: [
    { k: "Marca", title: "Live go de marca e naming", text: "Implantação da marca Afya no Centro Universitário FIPMoc." },
    { k: "Docência", title: "Professor de Design Gráfico", text: "Professor visitante no SENAI CFP Luiz de Paula, 2025–2026." },
    { k: "Pesquisa", title: "Mestrado em História Social", text: "PPGH/Unimontes. Dissertação sobre a Gazeta de Notícias (1888–1890)." },
    { k: "Livro", title: "Organizador de coletânea", text: "Estudos em História Política: Poder e Relações Sociais." },
    { k: "Eventos", title: "Comissão científica", text: "Presidente da comissão científica do II ENEHISP, com sistema e comunicação do evento." },
    { k: "Congressos", title: "ALCAR Sudeste 2026", text: "Apresentação de pesquisa sobre a visualidade da imprensa brasileira." },
  ],
};
async function renderSiteContent() {
  loading("Sobre e trajetória");
  const got = await fetch("/api/site-content", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const c = JSON.parse(JSON.stringify(got && got.about ? got : SITE_DEFAULT));
  if (!c.hero?.title) c.hero = JSON.parse(JSON.stringify(SITE_DEFAULT.hero));
  while (c.hero.cards.length < 3) c.hero.cards.push({ ...SITE_DEFAULT.hero.cards[c.hero.cards.length] });
  if (!c.services?.length) c.services = JSON.parse(JSON.stringify(SITE_DEFAULT.services));
  let dirty = false;
  const status = h("span", { class: "pf-state", role: "status" }, "Tudo salvo");
  const touch = () => { dirty = true; status.textContent = "Alterações não salvas"; status.className = "pf-state warn"; };
  window.onbeforeunload = () => (dirty ? true : null);
  const inp = (obj, key, attrs = {}, tag = "input") => { const el = h(tag, { class: "in", ...attrs }); el.value = obj[key] ?? ""; el.addEventListener("input", () => { obj[key] = el.value; touch(); }); return el; };
  const f = (l, el) => h("label", { class: "f" }, h("span", {}, l), el);
  const textBox = h("textarea", { class: "in", rows: 8, "aria-label": "Texto do Sobre" }); textBox.value = c.about.text.join("\n\n");
  textBox.addEventListener("input", () => { c.about.text = textBox.value.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean); touch(); });
  const trailBox = h("div", { class: "stack" });
  const drawTrail = () => trailBox.replaceChildren(...c.trail.map((t, i) => h("div", { class: "pf-sec" },
    h("div", { class: "pf-sec-h" }, h("strong", {}, t.title || `Item ${i + 1}`), h("div", { class: "pf-tools" },
      h("button", { class: "ibtn sm", type: "button", "aria-label": "Subir", disabled: i === 0, onclick: () => { [c.trail[i - 1], c.trail[i]] = [c.trail[i], c.trail[i - 1]]; touch(); drawTrail(); } }, "↑"),
      h("button", { class: "ibtn sm", type: "button", "aria-label": "Descer", disabled: i === c.trail.length - 1, onclick: () => { [c.trail[i + 1], c.trail[i]] = [c.trail[i], c.trail[i + 1]]; touch(); drawTrail(); } }, "↓"),
      h("button", { class: "ibtn sm", type: "button", "aria-label": "Excluir item", onclick: () => { c.trail.splice(i, 1); touch(); drawTrail(); } }, icon("trash")))),
    h("div", { class: "r2" }, f("Categoria", inp(t, "k", { placeholder: "Ex.: Docência" })), f("Título", inp(t, "title", { placeholder: "Ex.: Professor de Design" }))),
    f("Descrição", inp(t, "text", { rows: 2, placeholder: "Uma linha sobre o que foi" }, "textarea")))),
    c.trail.length < 12 ? h("button", { class: "btn block", type: "button", onclick: () => { c.trail.push({ k: "", title: "", text: "" }); touch(); drawTrail(); } }, icon("plus"), "Novo item da trajetória") : null);
  drawTrail();
  // fotos do Sobre em rolagem automática (apresentações e palestras)
  c.about.photos = c.about.photos || [];
  const photosBox = h("div", { class: "stack" });
  const drawPhotos = () => photosBox.replaceChildren(h("p", { class: "hint" }, c.about.photos.length ? "As fotos trocam sozinhas a cada 4 segundos, nesta ordem. Cada uma leva a sua legenda." : "Sem fotos aqui, o site mostra a foto padrão do ALCAR. Adicione as fotos das apresentações para ativar a rolagem automática."),
    ...c.about.photos.map((p, i) => h("div", { class: "pf-sec" },
      h("div", { class: "pf-sec-h" }, h("img", { src: `/api/media/${p.media.key}`, alt: "", style: "width:64px;height:64px;object-fit:cover;border-radius:10px" }), h("div", { class: "pf-tools" },
        h("button", { class: "ibtn sm", type: "button", "aria-label": "Subir", disabled: i === 0, onclick: () => { [c.about.photos[i - 1], c.about.photos[i]] = [c.about.photos[i], c.about.photos[i - 1]]; touch(); drawPhotos(); } }, "↑"),
        h("button", { class: "ibtn sm", type: "button", "aria-label": "Descer", disabled: i === c.about.photos.length - 1, onclick: () => { [c.about.photos[i + 1], c.about.photos[i]] = [c.about.photos[i], c.about.photos[i + 1]]; touch(); drawPhotos(); } }, "↓"),
        h("button", { class: "ibtn sm", type: "button", "aria-label": "Tirar foto", onclick: () => { c.about.photos.splice(i, 1); touch(); drawPhotos(); } }, icon("trash")))),
      f("Legenda", inp(p, "caption", { placeholder: "Ex.: Talks Afya · atendimento e planejamento" })))));
  const photoInput = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/avif", multiple: "", style: "display:none", onchange: async (e) => {
    for (const file of [...e.target.files]) { try { status.textContent = `Enviando ${file.name}…`; c.about.photos.push({ media: await pfUpload("site", "page", file, 1400), caption: "" }); touch(); drawPhotos(); } catch (x) { toast(x.message); } }
    e.target.value = ""; status.textContent = "Alterações não salvas";
  } });
  drawPhotos();
  // foto da abertura: troca e enquadramento (moldura 4:5, a mesma do site)
  const heroBox = h("div", { class: "hero-photo-ed" });
  const heroIn = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/avif", style: "display:none" });
  const heroSend = async (file, isReframe) => {
    const c2 = await pfCropThen(file, "4:5", "Enquadrar a foto da abertura"); if (!c2) return;
    status.textContent = "Enviando foto…";
    try {
      if (!isReframe) c.hero.photoOrig = await pfUpload("site", "page", file, 2400);
      c.hero.photo = await pfUpload("site", "page", c2.file, 1400, c2.focus);
      touch(); drawHero(); toast("Foto pronta. Salve para publicar.");
    } catch (x) { toast(x.message); status.textContent = "Alterações não salvas"; }
  };
  heroIn.onchange = () => { const f0 = heroIn.files[0]; heroIn.value = ""; if (f0) heroSend(f0, false); };
  const drawHero = () => heroBox.replaceChildren(
    h("div", { class: "hero-photo-frame" }, h("img", { src: c.hero.photo?.key ? `/api/media/${c.hero.photo.key}` : "/img/hero-foto.jpg", alt: "Foto atual da abertura" })),
    h("div", { class: "stack", style: "gap:8px" },
      h("span", { class: "pf-lbl" }, "Foto da abertura"),
      h("p", { class: "hint", style: "margin:0" }, c.hero.photo?.key ? "Foto enviada por você." : "Foto padrão do site."),
      h("button", { class: "btn small", type: "button", onclick: () => heroIn.click() }, icon("image"), "Trocar foto"),
      c.hero.photo?.key ? h("button", { class: "btn small", type: "button", onclick: async () => {
        try { const ref = c.hero.photoOrig?.key ? c.hero.photoOrig : c.hero.photo; const blob = await fetch(`/api/media/${ref.key}`).then((r) => r.blob()); await heroSend(new File([blob], "foto." + ((blob.type.split("/")[1]) || "jpg"), { type: blob.type || "image/jpeg" }), true); } catch { toast("Não foi possível abrir a foto"); }
      } }, icon("pen"), "Reenquadrar") : null,
      c.hero.photo?.key ? h("button", { class: "btn ghost small", type: "button", onclick: () => { delete c.hero.photo; delete c.hero.photoOrig; touch(); drawHero(); } }, "Voltar à foto padrão") : null,
      h("label", { class: "f" }, h("span", {}, "Descrição da foto (acessibilidade)"), inp(c.hero, "photoAlt", { placeholder: "Ex.: Gustavo à noite numa rua de festa" }))));
  drawHero();
  const saveBtn = h("button", { class: "btn primary", type: "button", onclick: async () => {
    saveBtn.disabled = true; status.textContent = "Salvando…";
    try { await api("/api/site-content", { method: "PUT", body: c }); dirty = false; status.textContent = "Salvo · no site em até 1 min"; status.className = "pf-state ok"; haptic(); toast("Sobre e trajetória atualizados"); }
    catch (x) { status.textContent = x.message; status.className = "pf-state warn"; toast(x.message); } finally { saveBtn.disabled = false; }
  } }, icon("check"), "Salvar");
  shell({ title: "Textos da página inicial", eyebrow: "Abertura, serviços, sobre e trajetória", back: "#/portfolio", compact: true, nav: false },
    h("div", { class: "stack pf-edit" },
      h("section", { class: "form-card glass" }, h("h2", {}, "Abertura"),
        heroBox, heroIn,
        f("Título", inp(c.hero, "title")), f("Linha abaixo do título", inp(c.hero, "sub")), f("Frase manuscrita", inp(c.hero, "hand")),
        f("Texto de apoio", inp(c.hero, "lead", { rows: 3 }, "textarea")),
        ...c.hero.cards.map((cd, i) => h("div", { class: "pf-item" }, h("strong", { style: "font-weight:500" }, `Cartão sobre a foto ${i + 1}${i === 1 ? " (com selo \"aprovado\")" : ""}`),
          h("div", { class: "r3" }, f("Sobretítulo", inp(cd, "k")), f("Destaque", inp(cd, "title")), f("Linha final", inp(cd, "sub"))),
          null))),
      h("section", { class: "form-card glass" }, h("h2", {}, "Serviços"),
        ...c.services.map((x) => h("div", { class: "pf-item" }, f("Título", inp(x, "title")), f("Texto", inp(x, "text", { rows: 2 }, "textarea"))))),
      h("section", { class: "form-card glass" }, h("h2", {}, "Sobre"),
        f("Título", inp(c.about, "title")),
        f("Texto (deixe uma linha em branco entre parágrafos)", textBox),
        h("div", { class: "r2" }, f("Número em destaque", inp(c.about, "years", { placeholder: "1888–1890" })), f("Legenda do número", inp(c.about, "yearsLabel", { placeholder: "Recorte da pesquisa" }))),
        f("Legenda da foto", inp(c.about, "caption")), photosBox, photoInput,
        h("button", { class: "btn block", type: "button", onclick: () => photoInput.click() }, icon("plus"), "Adicionar fotos à rolagem")),
      h("section", { class: "form-card glass" }, h("h2", {}, "Trajetória"), h("p", { class: "hint" }, "Os cartões abaixo do Sobre. Use as setas para ordenar."), trailBox),
      h("div", { class: "pf-bar glass" }, status, saveBtn)),
    h("div", { class: "gap24" }));
}

/* ================= página do projeto (seções) =================
   Edita textos, imagens e cores de cada seção publicada; reordena e oculta seções.
   O que não é texto, imagem ou cor fica preservado como está. */
const PG_TEXT = new Set(["title", "eyebrow", "text", "body", "caption", "label", "kicker", "lead", "sub", "tail", "t", "d", "kind", "sign", "note", "alt", "tag", "name", "role", "use", "sample", "glyph", "legend"]);
const PG_LONG = new Set(["text", "body", "lead", "note"]);
const PG_IMG = new Set(["img", "image", "cover", "phone", "photo", "poster", "logo", "block"]);
const PG_LINK = new Set(["href", "url"]);
const PG_COLOR = new Set(["bg", "fg", "color", "hex"]);
const PG_NAMES = { hero: "Abertura", split: "Texto e imagem", cards: "Cards", steps: "Etapas", strip: "Faixa de imagens", board: "Painel de blocos", deck: "Apresentação de marca", credits: "Créditos" };
const PG_LBL = { title: "Título", eyebrow: "Sobretítulo", text: "Texto", body: "Texto", caption: "Legenda", label: "Rótulo", kicker: "Chamada", lead: "Texto de abertura", sub: "Subtítulo", tail: "Final do título", t: "Título", d: "Descrição", kind: "Tipo", sign: "Assinatura", note: "Nota", alt: "Descrição da imagem", tag: "Etiqueta", name: "Nome", role: "Função", use: "Uso", sample: "Amostra", glyph: "Símbolo", legend: "Legenda", img: "Imagem", image: "Imagem", cover: "Capa", block: "Bloco da abertura (4:5 · 1200 × 1500 px)", phone: "Tela do celular", photo: "Foto", poster: "Pôster", logo: "Logo", href: "Link", url: "Link", bg: "Fundo", fg: "Texto", color: "Cor", hex: "Cor", images: "Imagens", chips: "Etiquetas", blocks: "Bloco", slides: "Prancha", items: "Item", cells: "Versão", groups: "Grupo", fonts: "Fonte", colors: "Cor", parts: "Parte", a: "Lado A", b: "Lado B" };
const pgSrc = (v) => (/^(https?:)?\//.test(v) ? v : "/" + v);
const pgHex = (v) => { if (/^#[0-9a-f]{6}$/i.test(v)) return v; if (/^#[0-9a-f]{3}$/i.test(v)) return "#" + [...v.slice(1)].map((c) => c + c).join(""); return null; };

async function renderPageEdit(id) {
  loading("Página do projeto");
  const base = catalog.projects.find((x) => x.id === id) || {};
  const got = await api(`/api/portfolio/${id}/page`).catch(() => null);
  const baseNewer = base.updatedAt && got?.updatedAt && base.updatedAt > got.updatedAt;
  let secs = JSON.parse(JSON.stringify(got?.sections?.length && !baseNewer ? got.sections : base.sections || []));
  const fromBase = !got?.sections?.length || !!baseNewer;
  let dirty = false;
  const status = h("span", { class: "pf-state", role: "status" }, fromBase ? "Mostrando a versão publicada" : "Tudo salvo");
  const touch = () => { dirty = true; status.textContent = "Alterações não salvas"; status.className = "pf-state warn"; };
  window.onbeforeunload = () => (dirty ? true : null);

  const imgField = (obj, key, label) => {
    const wrap = h("div", { class: "pg-img" });
    const input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif,video/mp4", hidden: true });
    const draw = () => wrap.replaceChildren(
      h("span", { class: "pf-lbl" }, label),
      obj[key] ? (/\.mp4$/i.test(obj[key]) ? h("video", { src: pgSrc(obj[key]), muted: true, playsinline: true }) : h("img", { src: pgSrc(obj[key]), alt: "", loading: "lazy" })) : h("span", { class: "hint" }, "Sem imagem"),
      h("div", { class: "btns" }, h("button", { class: "btn small", type: "button", onclick: () => input.click() }, obj[key] ? "Trocar" : "Enviar"),
        obj[key] && !/\.mp4$/i.test(obj[key]) ? h("button", { class: "btn small", type: "button", onclick: async () => {
          try { const blob = await fetch(pgSrc(obj[key])).then((r) => r.blob()); await send(new File([blob], "imagem." + ((blob.type.split("/")[1]) || "jpg"), { type: blob.type || "image/jpeg" })); } catch { toast("Não foi possível abrir a imagem"); }
        } }, "Recortar") : null), input);
    const send = async (file) => {
      const isBlock = key === "block";
      const c = await pfCropThen(file, isBlock ? "4:5" : "orig", `Recorte · ${label}`); if (!c) return;
      toast("Enviando…");
      try {
        const m = await pfUpload(id, "page", c.file, 2400); obj[key] = `/api/media/${m.key}`;
        if (isBlock) { obj.blockType = m.type; if (c.focus) { obj.blockPos = `${c.focus.x}% ${c.focus.y}%`; if (c.focus.z > 1) obj.blockZoom = `${c.focus.z} ${c.focus.ox}% ${c.focus.oy}%`; else delete obj.blockZoom; } else { delete obj.blockPos; delete obj.blockZoom; } }
        touch(); draw(); toast("Imagem trocada");
      } catch (x) { toast(x.message); }
    };
    input.onchange = () => { const f = input.files[0]; input.value = ""; if (f) send(f); };
    draw(); return wrap;
  };
  const colorField = (obj, key, label) => {
    const hx = pgHex(obj[key]);
    if (!hx) return null; // cores que não são hexadecimais (variáveis, transparências) ficam como estão
    const inp = h("input", { type: "color", value: hx, "aria-label": label, oninput: (e) => { obj[key] = e.target.value; touch(); } });
    return h("label", { class: "pg-color" }, inp, h("span", {}, label));
  };
  const textField = (obj, key) => {
    const long = PG_LONG.has(key) || String(obj[key]).length > 80;
    const el = h(long ? "textarea" : "input", { class: "in", rows: long ? 4 : null });
    el.value = obj[key]; el.addEventListener("input", () => { obj[key] = el.value; touch(); });
    return h("label", { class: "f" }, h("span", {}, PG_LBL[key] || key), el);
  };
  const listField = (obj, key) => { // lista de textos: uma linha por item
    const el = h("textarea", { class: "in", rows: Math.min(8, obj[key].length + 1) }); el.value = obj[key].join("\n");
    el.addEventListener("input", () => { obj[key] = el.value.split("\n").map((x) => x.trim()).filter(Boolean); touch(); });
    return h("label", { class: "f" }, h("span", {}, `${PG_LBL[key] || key} (um por linha)`), el);
  };
  // desenha os campos editáveis de um objeto, recursivamente
  function fields(obj, depth = 0, skip = null) {
    const out = [], colors = [];
    for (const [k, v] of Object.entries(obj)) {
      if (skip?.has(k)) continue;
      if (k === "type" || k === "hidden" || k === "blockPos" || k === "blockZoom" || k === "blockType" || k === "blockFit") continue;
      if (typeof v === "string") {
        if (PG_TEXT.has(k)) out.push(textField(obj, k));
        else if (PG_IMG.has(k) || (k === "src" && /\.(jpe?g|png|webp|gif|mp4)$/i.test(v))) out.push(imgField(obj, k, PG_LBL[k] || "Imagem"));
        else if (PG_LINK.has(k)) out.push(textField(obj, k));
        else if (PG_COLOR.has(k)) { const c = colorField(obj, k, PG_LBL[k] || k); if (c) colors.push(c); }
      } else if (Array.isArray(v)) {
        if (v.every((x) => typeof x === "string")) {
          if (k === "images") { out.push(h("div", { class: "f" }, h("span", {}, "Imagens"), h("div", { class: "pg-imgs" }, ...v.map((_, i) => imgField(v, i, `Imagem ${i + 1}`))))); }
          else if (PG_TEXT.has(k) || k === "chips" || k === "text" || k === "title") out.push(listField(obj, k));
        } else if (v.some((x) => x && typeof x === "object")) {
          const items = v.map((x, i) => (x && typeof x === "object" ? (() => { const f = fields(x, depth + 1); return f.length ? h("details", { class: "pg-sub" }, h("summary", {}, `${PG_LBL[k] || k} ${i + 1}${x.title || x.label || x.name || x.t ? " · " + String(x.title || x.label || x.name || x.t).slice(0, 40) : ""}`), ...f) : null; })() : null)).filter(Boolean);
          if (items.length) out.push(h("div", { class: "pg-group" }, ...items));
        }
      } else if (v && typeof v === "object") {
        const f = fields(v, depth + 1); if (f.length) out.push(depth > 2 ? h("div", {}, ...f) : h("div", { class: "pg-nest" }, ...f));
      }
    }
    if (colors.length) out.unshift(h("div", { class: "pg-colors" }, ...colors));
    return out;
  }
  // abertura: um bloco único 4:5 (imagem, PNG transparente, GIF ou vídeo), com recorte/foco e encaixe
  const heroFields = (s) => {
    if (typeof s.block !== "string") s.block = s.image || "";
    const seg = h("div", { class: "seg", role: "radiogroup", "aria-label": "Encaixe" });
    const drawSeg = () => seg.replaceChildren(...[["cover", "Preencher o bloco"], ["contain", "Inteira (PNG sem fundo)"]].map(([k, l]) => h("button", { type: "button", role: "radio", "aria-checked": String((s.blockFit || "cover") === k), class: (s.blockFit || "cover") === k ? "on" : "", onclick: () => { s.blockFit = k; touch(); drawSeg(); } }, l)));
    drawSeg();
    return [imgField(s, "block", PG_LBL.block),
      h("p", { class: "hint" }, "Exporte em 1200 × 1500 px (proporção 4:5). Imagens são recortadas em 4:5; em GIF e vídeo você toca no ponto que deve ficar sempre visível."),
      h("div", { class: "f" }, h("span", {}, "Encaixe"), seg),
      ...fields(s, 0, new Set(["block", "image", "phone"]))];
  };
  const list = h("div", { class: "stack" });
  const titleOf = (s) => { const t = s.title || s.text?.title || s.blocks?.find?.((b) => b.text?.title)?.text?.title || s.eyebrow || s.slides?.[0]?.title || ""; return String(Array.isArray(t) ? t.join(" ") : t).slice(0, 60) || (s.slides ? `${s.slides.length} pranchas` : s.blocks ? `${s.blocks.length} blocos` : ""); };
  const draw = () => list.replaceChildren(...secs.map((s, i) => {
    const vis = h("input", { type: "checkbox", role: "switch", checked: !s.hidden, onchange: (e) => { if (e.target.checked) delete s.hidden; else s.hidden = true; touch(); card.classList.toggle("is-off", !!s.hidden); } });
    const body = h("div", { class: "pg-body" });
    const det = h("details", { class: "pg-sec", ontoggle: () => { if (det.open && !body.childElementCount) body.replaceChildren(...(s.type === "hero" ? heroFields(s) : fields(s))); } },
      h("summary", {}, h("span", { class: "pg-n" }, String(i + 1).padStart(2, "0")), h("span", { class: "pg-t" }, h("strong", {}, PG_NAMES[s.type] || s.type), h("small", {}, titleOf(s) || "—"))),
      body);
    const card = h("div", { class: "pf-sec pg-card" + (s.hidden ? " is-off" : "") },
      h("div", { class: "pg-bar" },
        h("label", { class: "switch sm" }, h("span", {}, "Visível"), vis),
        h("div", { class: "pf-tools" },
          h("button", { class: "ibtn sm", type: "button", "aria-label": "Subir seção", disabled: i === 0, onclick: () => { [secs[i - 1], secs[i]] = [secs[i], secs[i - 1]]; touch(); draw(); } }, "↑"),
          h("button", { class: "ibtn sm", type: "button", "aria-label": "Descer seção", disabled: i === secs.length - 1, onclick: () => { [secs[i + 1], secs[i]] = [secs[i], secs[i + 1]]; touch(); draw(); } }, "↓"),
          h("button", { class: "ibtn sm", type: "button", "aria-label": "Duplicar seção", onclick: () => { secs.splice(i + 1, 0, JSON.parse(JSON.stringify(s))); touch(); draw(); } }, icon("copy")))),
      det);
    return card;
  }));
  draw();
  const saveBtn = h("button", { class: "btn primary", type: "button", onclick: async () => {
    saveBtn.disabled = true; status.textContent = "Salvando…";
    try { await api(`/api/portfolio/${id}/page`, { method: "PUT", body: { sections: secs } }); dirty = false; status.textContent = "Salvo · no site em até 1 min"; status.className = "pf-state ok"; haptic(); toast("Página atualizada"); }
    catch (x) { status.textContent = x.message; status.className = "pf-state warn"; toast(x.message); } finally { saveBtn.disabled = false; }
  } }, icon("check"), "Salvar");
  shell({ title: "Página do projeto", eyebrow: base.title || id, back: `#/portfolio/${id}`, compact: true, nav: false },
    h("div", { class: "stack pf-edit" },
      h("div", { class: "glass card pf-intro" },
        h("p", {}, secs.length ? "Toque numa seção para editar textos, imagens e cores. Use as setas para reordenar e o botão Visível para esconder uma seção sem apagá-la." : "Este projeto ainda não tem seções de página. Banner, galeria, números e depoimentos ficam no editor do projeto."),
        h("div", { class: "btns" }, h("a", { class: "btn ghost small", href: `/projetos/${id}`, target: "_blank", rel: "noopener" }, icon("eye"), "Ver página"),
          !fromBase ? h("button", { class: "btn ghost small", type: "button", onclick: () => confirmSheet("Voltar à versão original?", "Suas edições desta página são apagadas e volta a valer a versão do arquivo base.", "Restaurar", async () => { try { await api(`/api/portfolio/${id}/page`, { method: "DELETE" }); dirty = false; toast("Página restaurada"); route(); } catch (x) { toast(x.message); } }) }, "Restaurar original") : null)),
      list,
      h("div", { class: "pf-bar glass" }, status, saveBtn)),
    h("div", { class: "gap24" }));
}

/* ================= roteamento ================= */
/* ================= editor visual (canvas) ================= */
function renderCanvasList() {
  const list = catalog.projects.filter((p) => p.sections?.length && !p.draft);
  shell({ title: "Editor visual", eyebrow: "Site", back: "#/portfolio", actions: headerActions() },
    h("p", { class: "hint", style: "margin:0 0 12px" }, "Abra uma página e edite direto nela: clique no texto para escrever, na imagem para trocar, e use a barra de cada seção para mover, duplicar, ocultar ou excluir."),
    h("div", { class: "list" }, ...list.map((p) => h("a", { class: "row-card glass", href: `#/editor/${p.id}` },
      p.cover ? h("img", { src: "/" + p.cover, alt: "", style: "width:56px;height:40px;object-fit:cover;border-radius:10px" }) : h("span"),
      h("div", { class: "who" }, h("strong", {}, p.title), h("div", { class: "sub" }, `/projetos/${p.id}`)), icon("pen")))));
}
function renderCanvas(id) {
  const p = catalog.projects.find((x) => x.id === id);
  let vp = lsGet("ge_canvas_vp") || "d";
  const frame = h("iframe", { class: "canvas-frame", src: `/projetos/${id}?editar`, title: `Editor visual: ${p?.title || id}` });
  const stage = h("div", { class: `canvas-stage ${vp}` }, frame);
  const seg = h("div", { class: "seg canvas-seg", role: "group", "aria-label": "Formato" },
    ...[["d", "Computador"], ["m", "Celular"]].map(([k, l]) => h("button", { type: "button", "aria-pressed": String(vp === k), onclick: (e) => {
      vp = k; lsSet("ge_canvas_vp", k); stage.className = `canvas-stage ${k}`;
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
    } }, l)));
  shell({ title: p?.title || id, eyebrow: "Editor visual", back: "#/editor", compact: true, nav: false,
    actions: [seg, h("a", { class: "ibtn", href: `/projetos/${id}`, target: "_blank", rel: "noopener", "aria-label": "Abrir página no site" }, icon("eye"))] }, stage);
  document.body.classList.add("canvas-mode");
  const off = () => { document.body.classList.remove("canvas-mode"); removeEventListener("hashchange", off); };
  addEventListener("hashchange", off);
}

async function route() {
  window.onbeforeunload = null;
  try {
    const me = await api("/api/me");
    if (!me.admin) return renderLogin();
    if (!catalog.projects.length) catalog = await fetch("/data/projects.json").then((r) => r.json()).catch(() => ({ fronts: [], projects: [] }));
    const r = (location.hash.replace(/^#/, "") || "/").split("?")[0];
    let m;
    if (r === "/") return await renderHome();
    if (r === "/propostas") return await renderProposals();
    if (r === "/novo") return await renderEditor(null);
    if (r === "/contratos") return await renderContracts();
    if (r === "/financeiro") return await renderFinance();
    if (r === "/servicos") return await renderServices();
    if (r === "/atividade" || r === "/inbox") return await renderInbox();
    if (r === "/ajustes") return await renderSettings();
    if (r === "/portfolio") return await renderPortfolioList();
    if (r === "/portfolio/sobre") return await renderSiteContent();
    if (r === "/portfolio/moodboard") return await renderMoodboard();
    if ((m = r.match(/^\/portfolio\/([a-z0-9-]+)\/pagina$/))) return await renderPageEdit(m[1]);
    if (r === "/editor") return renderCanvasList();
    if ((m = r.match(/^\/editor\/([a-z0-9-]+)$/))) return renderCanvas(m[1]);
    if ((m = r.match(/^\/portfolio\/([a-z0-9-]+)$/))) return await renderPortfolioEdit(m[1]);
    if ((m = r.match(/^\/c\/([a-z0-9-]+)$/))) return await renderContract(m[1]);
    if ((m = r.match(/^\/q\/([a-z0-9-]+)\/(detalhe|atividade)$/))) return await renderProposalDetail(m[1]);
    if ((m = r.match(/^\/q\/([a-z0-9-]+)$/))) return await renderEditor(m[1]);
    location.hash = "#/";
  } catch (x) {
    if (x.message !== "login") shell({ title: "Ops" }, emptyState(x.message, h("a", { class: "btn", href: "#/" }, "Voltar ao início")));
  }
}
window.addEventListener("hashchange", route);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/app/sw.js").catch(() => {});
route();

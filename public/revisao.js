// Modo revisão: abra qualquer página com ?revisao (fica ativo na aba). Toque em um elemento,
// escreva o que mudar e anexe o arquivo substituto. Tudo fica salvo para aplicar depois.
(() => {
  const q = new URLSearchParams(location.search);
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} } };
  if (q.has("revisao")) ss.set("ge_rev", "1");
  if (q.get("revisao") === "sair") ss.set("ge_rev", null);
  if (ss.get("ge_rev") !== "1") return;

  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "/revisao.css"; document.head.append(css);
  const page = location.pathname.replace(/\/+$/, "") || "/";
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else if (k === "html") el.innerHTML = v; else el.setAttribute(k, v === true ? "" : v); }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  };
  const api = async (path, opts = {}) => {
    const isJson = opts.body && !(opts.body instanceof Blob) && typeof opts.body !== "string";
    const r = await fetch(path, { credentials: "same-origin", ...opts, headers: { ...(isJson ? { "content-type": "application/json" } : {}), ...(opts.headers || {}) }, body: isJson ? JSON.stringify(opts.body) : opts.body });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Erro");
    return d;
  };
  const TAGS = ["Trocar imagem", "Trocar texto", "Remover", "Espaçamento", "Ordem", "Tamanho", "Cor", "Link errado"];
  const UI = h("div", { class: "rv-ui", "data-rv": "" });
  const isUI = (el) => !!el.closest?.("[data-rv]");
  let notes = [], picking = false, hoverEl = null;

  /* ---------- seletor estável do elemento ---------- */
  function selOf(el) {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      if (el.id && !/^\d/.test(el.id)) { parts.unshift("#" + CSS.escape(el.id)); break; }
      const tag = el.tagName.toLowerCase(); const p = el.parentElement;
      const sib = p ? [...p.children].filter((c) => c.tagName === el.tagName) : [];
      parts.unshift(sib.length > 1 ? `${tag}:nth-of-type(${sib.indexOf(el) + 1})` : tag);
      el = p;
    }
    return parts.join(" > ");
  }
  const find = (sel) => { try { return sel ? document.querySelector(sel) : null; } catch { return null; } };
  function describe(el) {
    const media = el.matches("img,video,picture,svg") ? el : el.querySelector?.("img,video");
    const src = media ? (media.currentSrc || media.src || media.querySelector?.("source")?.src || "") : (getComputedStyle(el).backgroundImage.match(/url\("?([^")]+)/)?.[1] || "");
    const txt = (el.innerText || el.alt || el.getAttribute?.("aria-label") || "").replace(/\s+/g, " ").trim();
    const kind = el.matches("img,video,picture,figure,svg") || (src && txt.length < 3) ? "imagem" : el.matches("h1,h2,h3,h4,p,span,small,b,strong,em,a,li,button,label") ? "texto" : "bloco";
    const sec = el.closest("section[id],section,header,footer")?.querySelector("h1,h2")?.innerText?.trim() || "";
    return { kind, src: src.replace(location.origin, ""), label: (txt || src.split("/").pop() || el.tagName.toLowerCase()).slice(0, 160), section: sec.slice(0, 80) };
  }

  /* ---------- realce e marcadores ---------- */
  const box = h("div", { class: "rv-box", "data-rv": "", "aria-hidden": "true" });
  document.body.append(box, UI);
  function outline(el) {
    if (!el) { box.style.display = "none"; return; }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  }
  const pins = h("div", { class: "rv-pins", "data-rv": "" });
  document.body.append(pins);
  function drawPins() {
    pins.replaceChildren(...notes.map((n, i) => {
      const el = find(n.sel); if (!el) return null;
      const r = el.getBoundingClientRect();
      return h("button", { class: `rv-pin${n.status === "feita" ? " done" : ""}`, type: "button", style: `left:${Math.max(4, r.left + scrollX + r.width - 14)}px;top:${Math.max(4, r.top + scrollY - 10)}px`, "aria-label": `Nota ${i + 1}: ${n.text || n.tags.join(", ")}`, onclick: () => openNote(n) }, String(i + 1));
    }));
    count.textContent = String(notes.filter((n) => n.status !== "feita").length);
  }
  let t; const redraw = () => { clearTimeout(t); t = setTimeout(drawPins, 120); };
  addEventListener("resize", redraw); new MutationObserver((ms) => { if (ms.some((m) => !isUI(m.target) && !m.target.closest?.(".rv-pins"))) redraw(); }).observe(document.body, { childList: true, subtree: true });

  /* ---------- barra ---------- */
  const count = h("b", {}, "0");
  const pickBtn = h("button", { type: "button", class: "rv-main", "aria-pressed": "false", onclick: () => setPick(!picking) }, "Marcar alteração");
  const bar = h("div", { class: "rv-bar" },
    h("span", { class: "rv-dot", "aria-hidden": "true" }), h("span", { class: "rv-ttl" }, "Revisão"),
    pickBtn,
    h("button", { type: "button", onclick: () => listPanel() }, "Notas ", count),
    h("button", { type: "button", "aria-label": "Sair do modo revisão", onclick: () => { ss.set("ge_rev", null); location.href = location.pathname; } }, "Sair"));
  UI.append(bar);
  function setPick(v) {
    picking = v; pickBtn.setAttribute("aria-pressed", String(v)); pickBtn.textContent = v ? "Toque no que mudar… (Esc cancela)" : "Marcar alteração";
    document.documentElement.classList.toggle("rv-picking", v); if (!v) outline(null);
  }
  document.addEventListener("mousemove", (e) => { if (!picking || isUI(e.target)) return; hoverEl = e.target; outline(hoverEl); }, true);
  document.addEventListener("click", (e) => {
    if (!picking || isUI(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    setPick(false); newNote(e.target);
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { setPick(false); closeSheet(); } });

  /* ---------- folha de edição ---------- */
  let sheetEl = null;
  function closeSheet() { sheetEl?.remove(); sheetEl = null; outline(null); }
  function sheet(...kids) { closeSheet(); sheetEl = h("div", { class: "rv-sheet", role: "dialog", "aria-modal": "false", "aria-label": "Nota de revisão" }, ...kids); UI.append(sheetEl); return sheetEl; }

  async function compress(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5e6) return file;
    const img = await createImageBitmap(file).catch(() => null); if (!img) return file;
    const k = Math.min(1, 2600 / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const b = await new Promise((r) => c.toBlob(r, file.type === "image/png" ? "image/png" : "image/jpeg", 0.88));
    return b && b.size < file.size ? new File([b], file.name.replace(/\.(png|webp)$/i, file.type === "image/png" ? ".png" : ".jpg"), { type: b.type }) : file;
  }

  function form(n, el) {
    let target = el, info = el ? describe(el) : { kind: n.kind, label: n.label, src: n.src, section: n.title };
    const sel = { tags: new Set(n?.tags || []) };
    const what = h("div", { class: "rv-what" });
    const paint = () => what.replaceChildren(
      info.src && info.kind === "imagem" ? h("img", { src: info.src, alt: "" }) : null,
      h("div", {}, h("small", {}, `${info.kind}${info.section ? " · " + info.section : ""}`), h("p", {}, info.label || "—")));
    paint();
    const up = el ? h("button", { type: "button", class: "rv-ghost", onclick: () => { const p = target.parentElement; if (p && p !== document.body) { target = p; info = describe(p); paint(); outline(p); } } }, "Selecionar bloco maior ↑") : null;
    const chips = h("div", { class: "rv-chips" }, ...TAGS.map((t) => h("button", { type: "button", "aria-pressed": String(sel.tags.has(t)), onclick: (e) => { sel.tags.has(t) ? sel.tags.delete(t) : sel.tags.add(t); e.currentTarget.setAttribute("aria-pressed", String(sel.tags.has(t))); } }, t)));
    const ta = h("textarea", { rows: "4", placeholder: "O que mudar? Ex.: trocar por esta foto, diminuir o texto, novo título: …" }); ta.value = n?.text || "";
    const link = h("input", { type: "url", placeholder: "Link do Drive (para arquivos grandes)" }); link.value = n?.link || "";
    const fileIn = h("input", { type: "file", multiple: true, accept: "image/*,video/*,application/pdf,.svg,.gif" });
    const pending = h("div", { class: "rv-files" });
    const existing = h("div", { class: "rv-files" }, ...(n?.files || []).map((f) => h("a", { href: `/api/review/${n.id}/files/${f.id}`, target: "_blank", rel: "noopener" }, `📎 ${f.name}`)));
    fileIn.addEventListener("change", () => pending.replaceChildren(...[...fileIn.files].map((f) => h("span", {}, `${f.name} · ${(f.size / 1e6).toFixed(1)} MB`))));
    const msg = h("p", { class: "rv-msg", role: "status" });
    const save = h("button", { type: "button", class: "rv-main", onclick: async () => {
      if (!ta.value.trim() && !sel.tags.size) { msg.textContent = "Escreva o que mudar ou escolha uma etiqueta."; ta.focus(); return; }
      save.disabled = true; save.textContent = "Salvando…";
      try {
        const body = { page, title: document.title, sel: target ? selOf(target) : n.sel, label: info.label, kind: info.kind, src: info.src, tags: [...sel.tags], text: ta.value.trim(), link: link.value.trim(), vw: innerWidth, y: Math.round(scrollY) };
        let note = n?.id ? await api(`/api/review/${n.id}`, { method: "PATCH", body }) : await api("/api/review", { method: "POST", body });
        for (const raw of [...fileIn.files]) {
          save.textContent = `Enviando ${raw.name}…`;
          const f = await compress(raw);
          note = await api(`/api/review/${note.id}/files`, { method: "POST", body: f, headers: { "content-type": f.type || "application/octet-stream", "x-name": encodeURIComponent(f.name) } });
        }
        notes = [...notes.filter((x) => x.id !== note.id), note]; drawPins(); closeSheet(); toast(n?.id ? "Nota atualizada" : "Nota salva");
      } catch (x) { msg.textContent = x.message; save.disabled = false; save.textContent = "Salvar nota"; }
    } }, n?.id ? "Salvar alterações" : "Salvar nota");
    return [h("div", { class: "rv-sh" }, h("strong", {}, n?.id ? "Editar nota" : "Nova nota"), h("button", { type: "button", class: "rv-x", "aria-label": "Fechar", onclick: closeSheet }, "×")),
      what, up, chips, h("label", { class: "rv-f" }, h("span", {}, "O que mudar"), ta),
      h("label", { class: "rv-f" }, h("span", {}, "Arquivo substituto (foto, vídeo, PDF · até 5,5 MB cada)"), fileIn), pending, existing,
      h("label", { class: "rv-f" }, h("span", {}, "Ou link"), link), msg,
      h("div", { class: "rv-actions" },
        n?.id ? h("button", { type: "button", class: "rv-ghost", onclick: async () => { if (!confirm("Apagar esta nota?")) return; await api(`/api/review/${n.id}`, { method: "DELETE" }); notes = notes.filter((x) => x.id !== n.id); drawPins(); closeSheet(); } }, "Apagar") : null,
        n?.id ? h("button", { type: "button", class: "rv-ghost", onclick: async () => { const x = await api(`/api/review/${n.id}`, { method: "PATCH", body: { status: n.status === "feita" ? "aberta" : "feita" } }); notes = notes.map((y) => (y.id === x.id ? x : y)); drawPins(); closeSheet(); } }, n.status === "feita" ? "Reabrir" : "Marcar feita") : null,
        save)];
  }
  function newNote(el) { outline(el); sheet(...form(null, el)); }
  function openNote(n) { const el = find(n.sel); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => outline(el), 350); } sheet(...form(n, null)); }

  async function listPanel() {
    let all = [];
    try { all = await api("/api/review"); } catch {}
    const byPage = all.reduce((m, n) => ((m[n.page] = m[n.page] || []).push(n), m), {});
    sheet(h("div", { class: "rv-sh" }, h("strong", {}, `Notas · ${all.filter((n) => n.status !== "feita").length} abertas`), h("button", { type: "button", class: "rv-x", "aria-label": "Fechar", onclick: closeSheet }, "×")),
      all.length ? null : h("p", { class: "rv-msg" }, "Nenhuma nota ainda. Toque em “Marcar alteração” e depois no elemento."),
      ...Object.entries(byPage).map(([pg, list]) => h("div", { class: "rv-group" }, h("small", {}, pg === page ? `${pg} (esta página)` : pg),
        ...list.map((n) => h(pg === page ? "button" : "a", { class: `rv-item${n.status === "feita" ? " done" : ""}`, type: pg === page ? "button" : null, href: pg === page ? null : pg, onclick: pg === page ? () => openNote(n) : null },
          h("span", {}, n.tags?.length ? n.tags.join(" · ") : n.kind), h("p", {}, n.text || n.label), n.files?.length ? h("em", {}, `${n.files.length} arquivo(s)`) : null)))));
  }
  const toastEl = h("div", { class: "rv-toast", role: "status" }); UI.append(toastEl);
  function toast(m) { toastEl.textContent = m; toastEl.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("on"), 2200); }

  /* ---------- login ---------- */
  async function start() {
    const me = await api("/api/me").catch(() => ({ admin: false }));
    if (!me.admin) {
      pickBtn.disabled = true;
      const pw = h("input", { type: "password", autocomplete: "current-password", placeholder: "Senha do Studio" });
      const msg = h("p", { class: "rv-msg", role: "status" });
      sheet(h("div", { class: "rv-sh" }, h("strong", {}, "Entrar para revisar")),
        h("p", { class: "rv-msg" }, "Use a mesma senha do Studio. As notas ficam visíveis só para você."),
        h("label", { class: "rv-f" }, h("span", {}, "Senha"), pw), msg,
        h("div", { class: "rv-actions" }, h("button", { type: "button", class: "rv-main", onclick: async () => { try { await api("/api/login", { method: "POST", body: { password: pw.value } }); closeSheet(); start(); } catch (x) { msg.textContent = x.message; } } }, "Entrar")));
      pw.addEventListener("keydown", (e) => { if (e.key === "Enter") sheetEl.querySelector(".rv-main").click(); });
      return;
    }
    pickBtn.disabled = false;
    notes = await api(`/api/review?page=${encodeURIComponent(page)}`).catch(() => []);
    setTimeout(drawPins, 800);
  }
  start();
})();

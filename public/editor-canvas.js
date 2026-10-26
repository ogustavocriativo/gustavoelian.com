// Editor visual (canvas) das páginas de projeto. Abre com /projetos/<id>?editar dentro do Studio.
// Texto: clique e digite direto na página. Mídia: clique para trocar. Seções: mover, duplicar, ocultar, excluir, adicionar.
// Mudanças ficam em rascunho (nesta aba) até "Salvar"; o site só muda depois de salvar.
(async () => {
  const E = window.__GE_EDIT; if (!E) return;
  const me = await fetch("/api/me").then((r) => r.json()).catch(() => ({}));
  if (!me.admin) { location.href = `/app/#/editor/${E.id}`; return; }

  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "/editor-canvas.css?v=1"; document.head.append(css);
  const KEY = `ge_draft_${E.id}`;
  let S = E.sections; // seções em edição (fonte única)
  const hist = [];
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else if (k === "html") el.innerHTML = v; else el.setAttribute(k, v === true ? "" : v); }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const UI = h("div", { class: "edc", "data-edc": "" }); document.body.append(UI);
  const isUI = (el) => !!el?.closest?.("[data-edc]");
  const toastEl = h("div", { class: "edc-toast", role: "status" }); UI.append(toastEl);
  const toast = (m) => { toastEl.textContent = m; toastEl.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("on"), 2400); };

  /* ---------- estado e rascunho ---------- */
  const status = h("span", { class: "edc-st" });
  function setDirty(v) { E.dirty = v; status.textContent = v ? "Alterações não salvas" : E.fromBase ? "Versão original do site" : "Tudo salvo"; status.className = "edc-st" + (v ? " warn" : ""); }
  function commit(mut, { reload = true } = {}) {
    hist.push(clone(S)); if (hist.length > 60) hist.shift();
    mut(S);
    try { sessionStorage.setItem(KEY, JSON.stringify({ sections: S, at: Date.now() })); } catch {}
    setDirty(true);
    if (reload) refresh();
  }
  function refresh() { try { sessionStorage.setItem("ge_edc_y", String(scrollY)); } catch {} location.reload(); }
  try { const y = sessionStorage.getItem("ge_edc_y"); if (y) { sessionStorage.removeItem("ge_edc_y"); setTimeout(() => scrollTo(0, +y), 60); } } catch {}

  /* ---------- barra superior ---------- */
  const btn = (label, on, cls = "") => h("button", { type: "button", class: cls, onclick: on }, label);
  const undoBtn = btn("Desfazer", () => {
    const prev = hist.pop(); if (!prev) { toast("Nada para desfazer"); return; }
    S = prev; try { sessionStorage.setItem(KEY, JSON.stringify({ sections: S })); } catch {} setDirty(true); refresh();
  });
  const saveBtn = btn("Salvar", save, "edc-main");
  const bar = h("div", { class: "edc-bar" },
    h("span", { class: "edc-dot", "aria-hidden": "true" }), h("strong", {}, "Editor visual"), status,
    h("span", { class: "edc-sp" }),
    undoBtn,
    btn("Descartar", () => confirmIn("Descartar as alterações não salvas?", "Descartar", () => { try { sessionStorage.removeItem(KEY); } catch {} refresh(); })),
    btn("Restaurar original", () => confirmIn("Voltar à versão original do arquivo base? As edições salvas desta página são apagadas.", "Restaurar", async () => {
      await fetch(`/api/portfolio/${E.id}/page`, { method: "DELETE" }); try { sessionStorage.removeItem(KEY); } catch {} refresh();
    })),
    btn("Ver página", () => window.open(`/projetos/${E.id}`, "_blank")),
    saveBtn);
  UI.append(bar);
  setDirty(!!E.dirty);
  async function save() {
    saveBtn.disabled = true; saveBtn.textContent = "Salvando…";
    try {
      const r = await fetch(`/api/portfolio/${E.id}/page`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ sections: S }) });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Não foi possível salvar");
      try { sessionStorage.removeItem(KEY); } catch {}
      E.fromBase = false; setDirty(false); toast("Salvo. A página do site já mostra esta versão.");
      parent?.postMessage?.({ ge: "saved", id: E.id }, location.origin);
    } catch (x) { toast(x.message); } finally { saveBtn.disabled = false; saveBtn.textContent = "Salvar"; }
  }
  addEventListener("beforeunload", () => {});
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !document.activeElement?.isContentEditable) { e.preventDefault(); undoBtn.click(); }
    if (e.key === "Escape") closePanel();
  });

  /* ---------- confirmação dentro da página ---------- */
  function confirmIn(text, yes, fn) {
    panel("Confirmar", [h("p", { class: "edc-p" }, text)], [btn("Cancelar", closePanel), btn(yes, async () => { closePanel(); await fn(); }, "edc-danger")]);
  }

  /* ---------- painel lateral ---------- */
  let panelEl = null;
  function closePanel() { panelEl?.remove(); panelEl = null; }
  function panel(title, body, acts) {
    closePanel();
    panelEl = h("aside", { class: "edc-panel", role: "dialog", "aria-label": title },
      h("div", { class: "edc-ph" }, h("strong", {}, title), h("button", { type: "button", class: "edc-x", "aria-label": "Fechar", onclick: closePanel }, "×")),
      h("div", { class: "edc-pb" }, ...body), acts ? h("div", { class: "edc-pa" }, ...acts) : null);
    UI.append(panelEl); return panelEl;
  }

  /* ---------- seções: ferramentas ---------- */
  const secs = [...document.querySelectorAll("[data-si]")];
  const TYPES = { hero: "Abertura", board: "Painel", split: "Texto e imagem", steps: "Passo a passo", strip: "Galeria em faixa", marquee: "Letreiro", reels: "Vídeos", calendar: "Calendário", band: "Faixa de vídeo", logoMotion: "Símbolo animado", insta: "Instagram", credits: "Créditos", cards: "Cards", mosaic: "Mosaico", photos: "Fotos", swap: "Alternar imagens", family: "Família", packs: "Embalagens", illHero: "Abertura ilustrada" };
  const nameOf = (s) => `${TYPES[s.type] || s.type}${s.title ? " · " + String(s.title).slice(0, 40) : ""}`;
  secs.forEach((el) => {
    const i = +el.dataset.si, s = S[i]; if (!s) return;
    el.classList.add("edc-sec");
    const tools = h("div", { class: "edc-tools", "data-edc": "" },
      h("span", { class: "edc-lbl" }, nameOf(s) + (s.hidden ? " · oculta" : "")),
      h("button", { type: "button", title: "Subir", "aria-label": "Subir seção", disabled: i === 0, onclick: () => commit((A) => { [A[i - 1], A[i]] = [A[i], A[i - 1]]; }) }, "↑"),
      h("button", { type: "button", title: "Descer", "aria-label": "Descer seção", disabled: i === S.length - 1, onclick: () => commit((A) => { [A[i + 1], A[i]] = [A[i], A[i + 1]]; }) }, "↓"),
      h("button", { type: "button", title: "Duplicar", "aria-label": "Duplicar seção", onclick: () => commit((A) => { A.splice(i + 1, 0, clone(A[i])); }) }, "⧉"),
      h("button", { type: "button", title: s.hidden ? "Mostrar no site" : "Ocultar do site", "aria-label": s.hidden ? "Mostrar seção" : "Ocultar seção", onclick: () => commit((A) => { if (A[i].hidden) delete A[i].hidden; else A[i].hidden = true; }) }, s.hidden ? "Mostrar" : "Ocultar"),
      h("button", { type: "button", title: "Campos", onclick: () => fieldsPanel(i) }, "Campos"),
      h("button", { type: "button", class: "edc-del", title: "Excluir", "aria-label": "Excluir seção", onclick: () => confirmIn(`Excluir "${nameOf(s)}"?`, "Excluir", () => commit((A) => { A.splice(i, 1); })) }, "Excluir"));
    el.prepend(tools);
    el.after(h("div", { class: "edc-add", "data-edc": "" }, h("button", { type: "button", onclick: () => addPanel(i + 1) }, "+ Adicionar seção aqui")));
  });
  if (!secs.length) document.querySelector("main")?.prepend(h("div", { class: "edc-add", "data-edc": "" }, h("button", { type: "button", onclick: () => addPanel(0) }, "+ Adicionar seção")));

  /* ---------- novos blocos ---------- */
  const TEMPLATES = [
    ["Texto e imagem", "Título, parágrafos e uma imagem ao lado.", { type: "split", eyebrow: "Seção", title: "Título da seção", text: ["Escreva aqui o texto da seção."], image: "img/og-home.jpg" }],
    ["Texto e perfil do Instagram", "Mostra o perfil inteiro (grade de posts) ao lado do texto.", { type: "split", eyebrow: "Instagram", title: "Perfil no Instagram", text: ["Texto sobre o perfil."], profile: "@ogustavocriativo" }],
    ["Publicações do Instagram", "Posts ou reels com o player do Instagram.", { type: "insta", kicker: "Instagram", title: "Publicado nas redes", items: [{ url: "https://www.instagram.com/p/DLpqGPdO8cE/" }] }],
    ["Galeria em faixa", "Imagens lado a lado, com arrastar.", { type: "strip", title: "Galeria", images: ["img/og-home.jpg", "img/og-home.jpg", "img/og-home.jpg"] }],
    ["Faixa de vídeo", "Vídeo em largura total, mudo e em loop.", { type: "band", video: "video/ibifront/v4.mp4", ratio: "21/6", bg: "#222222", label: "" }],
    ["Letreiro", "Palavras correndo em uma faixa de cor.", { type: "marquee", items: ["Palavra", "Outra palavra", "Mais uma"], bg: "#2E4A3E", fg: "#FBF6EA" }],
    ["Passo a passo", "Imagem e uma lista numerada.", { type: "steps", eyebrow: "Processo", title: "Como foi feito", image: "img/og-home.jpg", items: [{ t: "Primeiro passo", d: "Descrição curta." }, { t: "Segundo passo", d: "Descrição curta." }] }],
    ["Créditos", "Equipe e participações.", { type: "credits", items: ["Gustavo Elian · Direção de arte"] }],
  ];
  function addPanel(at) {
    panel("Adicionar seção", [h("div", { class: "edc-tpls" }, ...TEMPLATES.map(([t, d, tpl]) => h("button", { type: "button", class: "edc-tpl", onclick: () => { closePanel(); commit((A) => { A.splice(at, 0, clone(tpl)); }); toast("Seção adicionada. Clique nos textos e imagens para trocar."); } }, h("strong", {}, t), h("span", {}, d))))]);
  }

  /* ---------- campos (todas as propriedades da seção) ---------- */
  const LBL = { eyebrow: "Sobretítulo", kicker: "Sobretítulo", title: "Título", text: "Texto", lead: "Texto de apoio", image: "Imagem", video: "Vídeo", poster: "Capa do vídeo", bg: "Cor de fundo", fg: "Cor do texto", items: "Itens", images: "Imagens", label: "Legenda", url: "Link", caption: "Legenda", credit: "Crédito", profile: "Perfil do Instagram (@perfil)", insta: "Post do Instagram no lugar da imagem", ratio: "Proporção (largura/altura)", reverse: "Inverter lados", panel: "Fundo em painel", chips: "Etiquetas", t: "Título", d: "Descrição", alt: "Descrição da imagem", glyph: "Símbolo", note: "Nota", tag: "Etiqueta", prefix: "Prefixo", name: "Nome" };
  const SKIP = new Set(["type", "cols", "rows", "areas", "mcols", "mrows", "mareas", "fx", "anim", "_ill", "_fotos", "_artigo", "palettes", "legend"]);
  const isMedia = (v) => typeof v === "string" && /\.(jpe?g|png|webp|gif|svg|mp4|webm)(\?|$)|^\/api\/media\//i.test(v);
  function fieldsPanel(i) {
    const work = clone(S[i]);
    const field = (obj, k, depth) => {
      const v = obj[k], lab = LBL[k] || k;
      if (SKIP.has(k)) return null;
      if (typeof v === "boolean") return h("label", { class: "edc-chk" }, h("input", { type: "checkbox", checked: v, onchange: (e) => { obj[k] = e.target.checked; } }), lab);
      if (typeof v === "number") return h("label", { class: "edc-f" }, h("span", {}, lab), h("input", { type: "number", value: v, oninput: (e) => { obj[k] = +e.target.value; } }));
      if (typeof v === "string") {
        if (/^#[0-9a-f]{3,8}$/i.test(v)) return h("label", { class: "edc-f row" }, h("input", { type: "color", value: v.length === 4 ? "#" + [...v.slice(1)].map((c) => c + c).join("") : v.slice(0, 7), oninput: (e) => { obj[k] = e.target.value; } }), h("span", {}, lab));
        if (isMedia(v)) return mediaField(obj, k, lab);
        const long = v.length > 70 || k === "text" || k === "lead";
        const el = h(long ? "textarea" : "input", { rows: long ? 4 : null }); el.value = v; el.oninput = () => { obj[k] = el.value; };
        return h("label", { class: "edc-f" }, h("span", {}, lab), el);
      }
      if (Array.isArray(v) && v.every((x) => typeof x === "string") && !v.some(isMedia)) {
        const el = h("textarea", { rows: Math.min(8, Math.max(3, v.length + 1)) }); el.value = v.join("\n");
        el.oninput = () => { obj[k] = el.value.split("\n").map((x) => x.trim()).filter(Boolean); };
        return h("label", { class: "edc-f" }, h("span", {}, `${lab} (um por linha)`), el);
      }
      if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
        return h("div", { class: "edc-grp" }, h("small", {}, lab), ...v.map((_, j) => mediaField(v, j, `${lab} ${j + 1}`)), h("button", { type: "button", class: "edc-mini", onclick: () => { v.push(v[v.length - 1] || "img/og-home.jpg"); fieldsPanel.redraw(); } }, "+ Adicionar"));
      }
      if (Array.isArray(v) && depth < 3) {
        return h("details", { class: "edc-grp", open: depth === 0 && v.length <= 6 }, h("summary", {}, `${lab} (${v.length})`),
          ...v.map((it, j) => typeof it === "object" && it ? h("div", { class: "edc-item" },
            h("div", { class: "edc-ih" }, h("small", {}, `${lab} ${j + 1}`),
              h("button", { type: "button", class: "edc-mini", "aria-label": "Subir item", disabled: j === 0, onclick: () => { [v[j - 1], v[j]] = [v[j], v[j - 1]]; fieldsPanel.redraw(); } }, "↑"),
              h("button", { type: "button", class: "edc-mini", "aria-label": "Remover item", onclick: () => { v.splice(j, 1); fieldsPanel.redraw(); } }, "Remover")),
            ...Object.keys(it).map((kk) => field(it, kk, depth + 1))) : null),
          v.length && typeof v[0] === "object" ? h("button", { type: "button", class: "edc-mini", onclick: () => { v.push(clone(v[v.length - 1])); fieldsPanel.redraw(); } }, "+ Adicionar item") : null);
      }
      if (v && typeof v === "object" && depth < 3) return h("details", { class: "edc-grp" }, h("summary", {}, lab), ...Object.keys(v).map((kk) => field(v, kk, depth + 1)));
      return null;
    };
    const draw = () => panel(`Campos · ${nameOf(S[i])}`, Object.keys(work).map((k) => field(work, k, 0)).filter(Boolean),
      [btn("Cancelar", closePanel), btn("Aplicar", () => { closePanel(); commit((A) => { A[i] = work; }); }, "edc-main")]);
    fieldsPanel.redraw = () => { const y = panelEl?.querySelector(".edc-pb")?.scrollTop || 0; draw(); panelEl.querySelector(".edc-pb").scrollTop = y; };
    draw();
  }

  /* ---------- envio de mídia ---------- */
  async function upload(file) {
    if (file.size > 4.5 * 1024 * 1024) throw new Error("Arquivo acima de 4,5 MB. Para animações, use MP4.");
    const fd = new FormData(); fd.append("file", file); fd.append("kind", "page");
    const r = await fetch(`/api/portfolio/${E.id}/upload`, { method: "POST", body: fd });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Falha no envio");
    return d.url;
  }
  function pick(accept = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm") {
    return new Promise((res) => { const i = h("input", { type: "file", accept }); i.onchange = () => res(i.files[0] || null); i.click(); });
  }
  function mediaField(obj, k, lab) {
    const v = obj[k]; const url = /^(https?:)?\//.test(v) ? v : "/" + v;
    const prev = /\.(mp4|webm)/i.test(v) ? h("video", { src: url, muted: true, playsinline: true }) : h("img", { src: url, alt: "" });
    return h("div", { class: "edc-media" }, prev, h("div", {}, h("small", {}, lab),
      h("button", { type: "button", class: "edc-mini", onclick: async (e) => {
        const f = await pick(); if (!f) return; e.target.textContent = "Enviando…";
        try { obj[k] = await upload(f); fieldsPanel.redraw?.(); } catch (x) { toast(x.message); e.target.textContent = "Trocar"; }
      } }, "Trocar")));
  }

  /* ---------- edição direta: textos ---------- */
  const norm = (t) => String(t || "").replace(/\s+/g, " ").trim();
  // troca a primeira string igual ao texto antigo dentro da seção (procura em profundidade)
  function replaceText(node, oldT, newT) {
    const o = norm(oldT);
    const walk = (x) => {
      if (Array.isArray(x)) { for (let j = 0; j < x.length; j++) { if (typeof x[j] === "string" && norm(x[j]) === o) { x[j] = newT; return true; } if (x[j] && typeof x[j] === "object" && walk(x[j])) return true; } return false; }
      for (const k of Object.keys(x)) { if (typeof x[k] === "string" && norm(x[k]) === o) { x[k] = newT; return true; } if (x[k] && typeof x[k] === "object" && walk(x[k])) return true; }
      return false;
    };
    return walk(node);
  }
  const TEXT_SEL = "h1,h2,h3,h4,p,li,figcaption,small,strong,b,em,span,a,blockquote,dt,dd,label";
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (isUI(t)) return;
    const sec = t.closest?.("[data-si]");
    const a = t.closest?.("a"); if (a && !isUI(a)) e.preventDefault();
    if (!sec) { if (t.closest?.("main")) toast("Este bloco vem do Studio (Portfólio › projeto) ou é fixo do site."); return; }
    const i = +sec.dataset.si;
    // mídia
    const media = t.closest("img,video,iframe,.bk-art,figure");
    const mel = media?.matches("img,video,iframe") ? media : media?.querySelector?.("img,video,iframe");
    if (mel && !t.closest(TEXT_SEL)) { e.preventDefault(); mediaPop(mel, i); return; }
    // texto
    const el = t.closest(TEXT_SEL);
    if (!el || el.querySelector("img,video,iframe,section,div")) return;
    if (el.isContentEditable) return;
    e.preventDefault();
    const old = el.innerText;
    el.contentEditable = "plaintext-only"; if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
    el.classList.add("edc-editing"); el.focus();
    const done = () => {
      el.removeEventListener("blur", done); el.contentEditable = "false"; el.classList.remove("edc-editing");
      const nv = el.innerText.replace(/ /g, " ").trim();
      if (norm(nv) === norm(old)) return;
      let ok = false;
      commit((A) => { ok = replaceText(A[i], old, nv); }, { reload: false });
      if (!ok) {
        S = hist.pop() || S; try { sessionStorage.setItem(KEY, JSON.stringify({ sections: S })); } catch {}
        el.innerText = old; toast("Esse texto é montado pelo layout. Edite pelo botão Campos da seção.");
      }
      else toast("Texto alterado. Salve para publicar.");
    };
    el.addEventListener("blur", done);
    el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey && !/^(P|LI|BLOCKQUOTE)$/.test(el.tagName)) { ev.preventDefault(); el.blur(); } if (ev.key === "Escape") { el.innerText = old; el.blur(); } });
  }, true);

  /* ---------- edição direta: mídia ---------- */
  const pathOf = (u) => { try { const x = new URL(u, location.href); return x.pathname + (x.pathname.startsWith("/api/") ? "" : ""); } catch { return u; } };
  function findMedia(node, path) {
    const eq = (v) => typeof v === "string" && (("/" + v.replace(/^\//, "")) === path || v === path);
    const walk = (x) => { for (const k of Object.keys(x)) { if (eq(x[k])) return [x, k]; if (x[k] && typeof x[k] === "object") { const r = walk(x[k]); if (r) return r; } } return null; };
    return walk(node);
  }
  function mediaPop(el, i) {
    if (el.tagName === "IFRAME" || el.closest(".pf-ig,.ig-prof")) { fieldsPanel(i); toast("Troque o link do Instagram nos campos da seção."); return; }
    const path = pathOf(el.currentSrc || el.src || el.querySelector?.("source")?.src || "");
    const hit = findMedia(S[i], path);
    const prev = el.tagName === "VIDEO" ? h("video", { src: path, muted: true, autoplay: true, loop: true, playsinline: true }) : h("img", { src: path, alt: "" });
    panel("Imagem ou vídeo", [h("div", { class: "edc-big" }, prev),
      hit ? null : h("p", { class: "edc-p" }, "Essa mídia é montada pelo layout. Use o botão Campos da seção para trocar."),
      h("p", { class: "edc-p" }, "JPG, PNG, WebP, GIF ou MP4 até 4,5 MB. Para animações, prefira MP4: carrega bem mais rápido.")],
      [hit ? btn("Trocar arquivo", async (e) => {
        const f = await pick(); if (!f) return; const b = e.target; b.disabled = true; b.textContent = "Enviando…";
        try {
          const url = await upload(f);
          commit((A) => { const r = findMedia(A[i], path); if (r) { r[0][r[1]] = url; if (/video/.test(f.type) && r[0].poster) delete r[0].poster; } });
        } catch (x) { toast(x.message); b.disabled = false; b.textContent = "Trocar arquivo"; }
      }, "edc-main") : null, btn("Campos da seção", () => fieldsPanel(i))].filter(Boolean));
  }

  // aviso de saída com rascunho
  window.addEventListener("message", (e) => { if (e.origin === location.origin && e.data?.ge === "save") save(); });
  toast(E.dirty ? "Rascunho restaurado. Salve para publicar." : "Clique em um texto para editar. Clique numa imagem para trocar.");
})();

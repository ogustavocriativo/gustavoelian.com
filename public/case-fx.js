/* Seções ilustradas e animadas dos cases (usado pelo site e pela versão editável).
   CaseFX.extend(R, h, src, opts) adiciona os tipos de seção; CaseFX.run(root) liga as animações. */
window.CaseFX = (() => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const STRIPE = ["#8A402D", "#D59C37", "#2C1E14", "#1F7A45", "#E6C66E", "#22385A"];

  function extend(R, h, src, opts = {}) {
    const back = opts.back || "/#projetos";
    const arr = (t) => (t == null ? [] : Array.isArray(t) ? t : [t]);
    // Cabeçalho padrão: eyebrow + título + parágrafos (proximidade: um bloco de leitura só)
    const head = (s) => h("div", { class: "fx-head" },
      s.eyebrow ? h("span", { class: "eyebrow" }, s.eyebrow) : null,
      s.title ? h("h2", {}, s.title) : null,
      ...arr(s.text).map((t) => h("p", { class: "soft" }, t)));
    const tileImg = (t) => (typeof t === "string" ? { img: t, alt: "" } : t);

    // Faixa de blocos de cor em movimento contínuo (assinatura visual do topo)
    const stripes = (colors = STRIPE) => {
      const set = () => colors.concat(colors).map((c) => h("span", { style: `background:${c}` }));
      return h("div", { class: "stripes", "aria-hidden": "true" }, h("div", { class: "run" }, ...set(), ...set()));
    };

    /* Painel: composição em grade de blocos de cor chapada (estilo prancha ilustrada).
       Cada bloco: area, bg, fg, img (+ fit "contain" | "bleed", w, x, y, anim), text, photo, pattern, stripes, tag */
    const quote = (rows) => arr(rows).map((r) => `"${r}"`).join(" ");
    const keyToggle = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.classList.toggle("on"); } };
    const block = (b, i) => {
      const st = [`grid-area:${b.area}`, `--bg:${b.bg || "transparent"}`, `--fg:${b.fg || "#fff"}`, `--i:${i}`];
      if (b.pattern) st.push(`--pat:url("${src(b.pattern)}")`, `--pat-size:${b.patSize || "160px"}`);
      const art = b.img ? h("div", {
        class: `bk-art ${b.fit || "contain"}${b.anim ? " a-" + b.anim : ""}${b.round ? " round" : ""}`,
        style: b.fit === "bleed" ? `left:${b.x ?? 0}%;top:${b.y ?? 0}%;width:${b.w ?? 100}%` : `--w:${b.w ?? 72}%`,
        ...(b.par ? { "data-par": String(b.par) } : {}),
      }, /\.(mp4|webm)$/i.test(b.img)
        ? h("video", { src: src(b.img), poster: b.poster ? src(b.poster) : null, muted: "", loop: "", autoplay: "", playsinline: "", preload: "metadata", "aria-label": b.alt || "Vídeo", style: b.pos ? `object-position:${b.pos}` : null })
        : h("img", { src: src(b.img), alt: b.alt || "", loading: b.eager ? null : "lazy", style: b.pos ? `object-position:${b.pos}` : null })) : null;
      const t = b.text;
      const txt = t ? h("div", { class: `bk-text ${t.size || "m"} ${t.align || "end"}` },
        t.back ? h("a", { class: "bk-back", href: back }, "← Todos os projetos") : null,
        t.eyebrow ? h("span", { class: "eyebrow" }, t.eyebrow) : null,
        t.title ? h(t.h1 ? "h1" : "h2", {}, t.title) : null,
        ...arr(t.body).map((p) => h("p", {}, p)),
        t.chips ? h("div", { class: "chips" }, ...t.chips.map((c) => h("span", { class: "chip" }, c))) : null,
        t.seal ? h("img", { class: "bk-seal", src: src(t.seal), alt: t.sealAlt || "" }) : null,
        t.link ? h("a", { class: "btn bk-btn", href: t.link.href, target: "_blank", rel: "noopener" }, t.link.label) : null) : null;
      const photoAttrs = b.photo ? { tabindex: "0", role: "button", "aria-label": `${b.alt || b.tag || "Bloco"}: alternar para a foto do produto`,
        onclick: (e) => e.currentTarget.classList.toggle("on"), onkeydown: keyToggle } : {};
      return h("div", { class: `bk${b.photo ? " has-photo" : ""}${b.pattern ? " pat" : ""}`, style: st.join(";"), "data-fx": "", ...photoAttrs },
        b.stripes ? stripes(b.stripes === true ? undefined : b.stripes) : null,
        art,
        b.photo ? h("img", { class: "bk-photo", src: src(b.photo), alt: "", loading: "lazy" }) : null,
        txt,
        b.tag ? h("span", { class: "bk-tag" }, b.tag) : null);
    };
    R.board = (s) => h("section", { class: "blk board" },
      s.title || s.eyebrow || s.text ? h("div", { class: "wrap bd-head" }, head(s)) : null,
      h("div", { class: "bd", style: [
        `--cols:${s.cols || "repeat(4,1fr)"}`, `--rows:${s.rows || "auto"}`, `--areas:${quote(s.areas)}`,
        `--m-cols:${s.mcols || (s.mareas ? `repeat(${String(s.mareas[0]).trim().split(/\s+/).length},1fr)` : s.cols || "1fr 1fr")}`, `--m-rows:${s.mrows || s.rows || "auto"}`, `--m-areas:${quote(s.mareas || s.areas)}`,
      ].join(";") }, ...s.blocks.map(block)));

    R.illHero = (s) => h("section", { class: "blk ihero" },
      stripes(s.stripe),
      h("div", { class: "wrap ih-grid" },
        h("div", { class: "ih-copy" },
          h("a", { class: "back", href: back }, "← Todos os projetos"),
          s.kicker ? h("span", { class: "eyebrow" }, s.kicker) : null,
          h("h1", {}, s.title),
          s.lead ? h("p", { class: "lead" }, s.lead) : null,
          s.chips ? h("div", { class: "chips" }, ...s.chips.map((c) => h("span", { class: "chip" }, c))) : null,
          s.seal ? h("img", { class: "ih-seal", src: src(s.seal), alt: s.sealAlt || "Selo da marca", fetchpriority: "high" }) : null),
        h("div", { class: "ih-art" },
          h("div", { class: "ih-tiles" }, ...arr(s.tiles).map(tileImg).map((t, i) =>
            h("figure", { class: "tile pop", style: `--i:${i}`, "data-fx": "" }, h("img", { src: src(t.img), alt: t.alt || "" })))),
          s.pack ? h("div", { class: "ih-packwrap", "data-par": "-0.07" }, h("img", { class: "ih-pack", src: src(s.pack), alt: s.packAlt || "Embalagens" })) : null)));

    R.marquee = (s) => {
      const g = s.glyph ? src(s.glyph) : null;
      const seq = (hidden) => h("div", { class: "mq-set", ...(hidden ? { "aria-hidden": "true" } : {}) },
        ...s.items.flatMap((t) => [h("span", { class: "mq-t" }, t), h("i", { class: g ? "mq-g" : "mq-dot", style: g ? `--g:url("${g}")` : null, "aria-hidden": "true" })]));
      return h("section", { class: "blk marquee" }, h("div", { class: "mq-run" }, seq(false), seq(true)));
    };

    R.mosaic = (s) => h("section", { class: "blk mosaic" }, h("div", { class: "wrap" }, head(s),
      h("div", { class: "mz-grid" }, ...s.tiles.map(tileImg).map((t, i) =>
        h("figure", { class: "tile", style: `--i:${i}`, "data-fx": "" }, h("img", { src: src(t.img), alt: t.alt || "", loading: "lazy" }))))));

    R.family = (s) => h("section", { class: "blk family" }, h("div", { class: "wrap" }, head(s),
      h("div", { class: "fm-grid" }, ...s.items.map((c, i) => h("article", { class: "fm", style: `--i:${i}`, "data-fx": "" },
        h("button", { type: "button", class: `fm-fig${c.photo ? " has-photo" : ""}`, "aria-label": c.photo ? `${c.name}: alternar entre marca e foto do produto` : c.name,
          onclick: (e) => e.currentTarget.classList.toggle("on") },
          c.tile ? h("img", { class: "fm-tile", src: src(c.tile), alt: "", loading: "lazy" })
            : h("span", { class: "fm-type", style: `--c:${c.color || "#5B2A1C"}`, "aria-hidden": "true" }, h("em", {}, c.kind), h("b", {}, c.name)),
          c.photo ? h("img", { class: "fm-photo", src: src(c.photo), alt: "", loading: "lazy" }) : null),
        h("small", {}, c.kind), h("h3", {}, c.name), c.text ? h("p", {}, c.text) : null)))));

    R.packs = (s) => h("section", { class: "blk packs" }, h("div", { class: "wrap" }, head(s)),
      h("div", { class: "pk-row" }, ...s.items.map((k, i) => h("figure", { class: "pk", style: `--pk:${k.bg || "#D59C37"};--i:${i}`, "data-fx": "" },
        h("div", { class: "pk-stage" }, h("i", { class: "pk-shadow" }), h("img", { src: src(k.image), alt: k.alt || `Embalagem ${k.name}`, loading: "lazy" })),
        h("figcaption", {}, h("small", {}, k.kind), h("strong", {}, k.name))))));

    R.photos = (s) => {
      const cols = [[], [], []];
      s.images.forEach((im, i) => cols[i % 3].push(im));
      const speed = [0.05, -0.05, 0.09];
      return h("section", { class: "blk photos" }, h("div", { class: "wrap" }, head(s),
        h("div", { class: "ph-cols" }, ...cols.map((c, ci) => h("div", { class: "ph-col", "data-par": String(speed[ci]) },
          ...c.map((im) => h("figure", {}, h("img", { src: src(im), alt: s.alt || "Fotografia de produto", loading: "lazy" }))))))));
    };

    R.swap = (s) => {
      let cur = 0;
      const imgs = s.items.map((it, i) => h("img", { src: src(it.image), alt: it.alt || it.label, class: i ? "" : "on", loading: i ? "lazy" : null }));
      const btns = s.items.map((it, i) => h("button", { type: "button", "aria-pressed": String(!i), onclick: () => {
        if (i === cur) return;
        imgs[cur].classList.remove("on"); btns[cur].setAttribute("aria-pressed", "false");
        cur = i; imgs[i].classList.add("on"); btns[i].setAttribute("aria-pressed", "true");
      } }, it.label));
      return h("section", { class: "blk swap" }, h("div", { class: "wrap sw-grid" },
        h("div", {}, head(s), h("div", { class: "sw-tabs", role: "group", "aria-label": "Alternar imagem" }, ...btns)),
        h("div", { class: "sw-stage" }, ...imgs)));
    };

    // Vinhetas: vídeos mudos em loop, tocam só quando estão na tela
    R.reels = (s) => h("section", { class: "blk reels" }, h("div", { class: "wrap" }, head(s),
      h("div", { class: "rl-grid" }, ...s.items.map((v, i) => h("figure", { class: `rl${v.wide ? " wide" : ""}`, style: `--i:${i};--ar:${v.ratio || "16/9"}`, "data-fx": "" },
        h("div", { class: "rl-box" }, h("video", { src: src(v.src), poster: v.poster ? src(v.poster) : null, muted: "", loop: "", playsinline: "", preload: "metadata", "aria-label": v.label || "Vinheta" })),
        v.label ? h("figcaption", {}, v.label) : null)))));

    // Calendário: linha do tempo de 12 meses com as campanhas posicionadas por mês
    R.calendar = (s) => {
      const M = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const K = Object.fromEntries((s.legend || []).map((l) => [l.k, l]));
      const cols = M.map((m, i) => h("div", { class: "cal-col" },
        h("span", { class: "cal-m" }, m),
        ...s.items.filter((it) => it.m === i + 1).map((it, j) => h("button", { type: "button", class: "cal-it", "data-fx": "", style: `--i:${i + j};--k:${K[it.kind]?.color || "#fff"}`, "aria-label": `Ver campanha ${it.label}`, onclick: () => openCamp(it) },
          h("img", { src: src(it.img), alt: it.alt || it.label, loading: "lazy", class: it.bg ? "fit" : null, style: it.bg ? `background:${it.bg}` : null }),
          h("span", { class: "cal-cap" }, h("b", {}, it.label), h("small", {}, K[it.kind]?.label || ""), h("em", { "aria-hidden": "true" }, "Ver campanha →"))))));
      // conteúdo da campanha em janela: peça principal, texto e galeria (quando houver)
      const openCamp = (it) => {
        const imgs = [it.img, ...(it.gallery || [])];
        const dlg = h("dialog", { class: "cal-dlg", "aria-label": it.label },
          h("form", { method: "dialog", class: "cal-dlg-x" }, h("button", { type: "submit", "aria-label": "Fechar" }, "×")),
          h("div", { class: "cal-dlg-b" },
            h("small", { style: `--k:${K[it.kind]?.color || "#fff"}` }, `${M[it.m - 1]} · ${K[it.kind]?.label || ""}`),
            h("h3", {}, it.label), it.text ? h("p", {}, it.text) : null,
            h("div", { class: `cal-dlg-g n${Math.min(imgs.length, 3)}` }, ...imgs.map((im, k) => /\.(mp4|webm)$/i.test(im)
              ? h("video", { src: src(im), controls: "", playsinline: "", preload: "metadata" })
              : h("img", { src: src(im), alt: k ? `${it.label}, peça ${k + 1}` : it.label, loading: "lazy", style: !k && it.bg ? `background:${it.bg}` : null })))));
        dlg.addEventListener("close", () => dlg.remove());
        dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
        document.body.append(dlg); dlg.showModal();
      };
      return h("section", { class: "blk cal" }, h("div", { class: "wrap" }, head(s),
        s.legend ? h("div", { class: "cal-legend" }, ...s.legend.map((l) => h("span", { style: `--k:${l.color}` }, l.label))) : null,
        s.note ? h("p", { class: "cal-note soft" }, s.note) : null),
        h("div", { class: "cal-scroll", tabindex: "0", "aria-label": "Calendário de campanhas, role para o lado" },
          h("div", { class: "cal-track", "data-fx": "" }, h("i", { class: "cal-line", "aria-hidden": "true" }), ...cols)));
    };

    // Faixa de vídeo em largura total (testeira de palco, motion), muda e em loop
    R.band = (s) => h("section", { class: "blk vband", "aria-label": s.label || "Vídeo" },
      h("div", { class: "vb-box", style: `--ar:${s.ratio || "21/6"}` },
        h("video", { src: src(s.video), poster: s.poster ? src(s.poster) : null, muted: "", loop: "", autoplay: "", playsinline: "", preload: "metadata", "aria-label": s.label || "Vídeo", style: s.pos ? `object-position:${s.pos}` : null })),
      s.label ? h("p", { class: "vb-cap" }, s.label) : null);

    // Símbolo da marca trocando de cor no ritmo das linhas de campanha
    R.logoMotion = (s) => {
      const P = s.palettes || [];
      const word = h("b", {}, P[0]?.name || "");
      const sec = h("section", { class: "blk lmo", style: P[0] ? `--lb:${P[0].bg};--lf:${P[0].fg}` : null, "aria-label": s.label || "Símbolo da marca nas cores das campanhas" },
        h("div", { class: "lmo-in" },
          h("i", { class: "lmo-g", style: `--g:url("${src(s.glyph)}")`, "aria-hidden": "true" }),
          h("p", { class: "lmo-w", "aria-live": "off" }, h("span", {}, s.prefix || "celebre"), word)));
      if (P.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        let i = 0;
        setInterval(() => { if (document.hidden) return; i = (i + 1) % P.length; sec.style.setProperty("--lb", P[i].bg); sec.style.setProperty("--lf", P[i].fg); word.textContent = P[i].name; word.animate?.([{ opacity: 0, transform: "translateY(30%)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" }); }, s.every || 1600);
      }
      return sec;
    };

    // Qualquer seção aceita "bg"/"fg" (bloco de cor) e "fx" (variação de movimento)
    for (const k of Object.keys(R)) {
      const f = R[k];
      if (f.__fx) continue;
      const g = (s, ...a) => {
        const e = f(s, ...a);
        if (e && s.bg) { e.classList.add("tone"); e.style.setProperty("--sbg", s.bg); e.style.setProperty("--sfg", s.fg || "#fff"); }
        if (e && s.fx) e.classList.add("fx-" + s.fx);
        return e;
      };
      g.__fx = true; R[k] = g;
    }

    /* ===== Apresentação de marca (deck) =====
       Padrão para as páginas de logos e marcas: sequência de pranchas 16:9 em tela cheia,
       no ritmo das apresentações de estúdio (capa chapada, foto com assinatura, paleta,
       grade de versões, tipografia, manifesto, sistema por produto, aplicações).
       Cada prancha é dado (k = tipo); a marca define cores e fontes no próprio JSON. */
    const fontsDone = new Set();
    const deckFonts = (fonts = []) => {
      const css = fonts.filter((f) => !fontsDone.has(f.family)).map((f) => { fontsDone.add(f.family); return `@font-face{font-family:"${f.family}";src:url("${src(f.src)}");font-display:swap}`; }).join("");
      if (css) document.head.append(h("style", {}, css));
    };
    const im = (p, cls, alt = "", pos) => h("img", { class: cls || null, src: src(p), alt, loading: "lazy", decoding: "async", style: pos ? `object-position:${pos}` : null });
    const lines = (t) => arr(t).flatMap((x, i) => (i ? [h("br"), x] : [x]));
    // tipografia cinética: cada palavra sobe de dentro de uma máscara (referência: stories de evento)
    const kin = (t) => { let n = 0; return arr(t).flatMap((x, i) => [i ? h("br") : null, ...String(x).split(" ").flatMap((w, j) => [j ? " " : null, h("span", { class: "kw" }, h("span", { style: `--i:${n++}` }, w))])]).filter((x) => x != null); };
    const SL = {
      cover: (d) => [d.pattern ? im(d.pattern.img, "dk-pat", "", null) : null,
        h("div", { class: "dk-center" + (d.pattern ? " left" : "") }, d.logo ? im(d.logo, "dk-logo", d.alt || "") : null, d.title ? h("p", { class: "dk-sub" }, d.title) : null),
        d.caption ? h("p", { class: "dk-cap" }, d.caption) : null],
      photo: (d) => [im(d.img, "dk-bg", d.alt || "", d.pos), h("div", { class: "dk-shade", style: `--shade:${d.shade ?? 0.45}` }),
        h("div", { class: `dk-over ${d.align || "bl"}` },
          d.kicker ? h("p", { class: "dk-kick" }, d.kicker) : null,
          d.title ? h("h3", { class: "dk-h" }, kin(d.title), d.tail ? h("span", { class: "dk-tail" }, d.tail) : null) : null,
          d.sub ? h("p", { class: "dk-sub" }, d.sub) : null),
        d.logo ? im(d.logo, `dk-mark ${d.logoAt || "br"}`, "") : null],
      palette: (d) => [h("div", { class: "dk-pal-img" }, im(d.img, "dk-bg", d.alt || "", d.pos), d.logo ? im(d.logo, "dk-mark bl", "") : null),
        h("div", { class: "dk-pal" }, ...d.colors.map((c) => h("div", { style: `background:${c.hex};color:${c.ink || "#fff"}` },
          h("b", {}, c.name || ""), h("span", {}, c.hex.toUpperCase()), c.role ? h("span", {}, c.role) : null)))],
      logos: (d) => [h("div", { class: "dk-grid g" + (d.cols || 3) }, ...d.cells.map((c) => h("figure", { style: `background:${c.bg};color:${c.fg || "inherit"}` },
        c.photo ? im(c.photo, "dk-bg", "") : null, im(c.img, "dk-cell", c.alt || c.label || "", null), c.label ? h("figcaption", {}, c.label) : null)))],
      symbol: (d) => [h("div", { class: "dk-sym" },
        h("div", { class: "dk-sym-main" }, im(d.img, "", d.alt || "")),
        h("div", { class: "dk-sym-parts" }, d.title ? h("h3", { class: "dk-h s" }, d.title) : null,
          ...arr(d.parts).map((p) => h("div", { class: "dk-part" }, p.img ? im(p.img, "", "") : null, h("div", {}, h("b", {}, p.label), h("p", {}, p.text))))))],
      type: (d) => [h("div", { class: "dk-type" }, ...d.fonts.map((f) => h("div", { class: "dk-font" },
        h("p", { class: "dk-kick" }, f.label), h("p", { class: "dk-aa", style: `font-family:"${f.family}"` }, f.sample || "Aa"),
        h("p", { class: "dk-abc", style: `font-family:"${f.family}"` }, f.alphabet || "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789"),
        h("p", { class: "dk-use" }, f.use || ""))))],
      manifesto: (d) => [d.pattern ? im(d.pattern, "dk-pat r", "") : null, h("div", { class: "dk-man" },
        d.kicker ? h("p", { class: "dk-kick" }, d.kicker) : null, h("p", { class: "dk-big" }, d.text), d.sign ? h("p", { class: "dk-sub" }, d.sign) : null)],
      swatches: (d) => [h("div", { class: "dk-sw" }, d.title ? h("h3", { class: "dk-h s" }, d.title) : null,
        h("div", { class: "dk-sw-g" }, ...d.groups.map((g) => h("div", { class: "dk-sw-i" },
          h("div", { class: "dk-sw-c" }, ...g.colors.map((c) => h("i", { style: `background:${c}`, title: c }))), h("b", {}, g.name), g.sub ? h("span", {}, g.sub) : null))))],
      icons: (d) => [h("div", { class: "dk-icons" }, d.title ? h("h3", { class: "dk-h s" }, d.title) : null,
        h("div", { class: "dk-ic-g" }, ...d.items.map((it) => h("figure", {}, im(it.img, "", it.label || ""), h("figcaption", {}, it.label)))))],
      products: (d) => [h("div", { class: "dk-prod" }, d.title ? h("h3", { class: "dk-h s" }, d.title) : null,
        h("div", { class: "dk-prod-g", style: `--n:${d.items.length}` }, ...d.items.map((it) => h("figure", {}, im(it.img, "", it.label || ""), it.label ? h("figcaption", {}, it.label) : null))))],
      image: (d) => [im(d.img, "dk-bg", d.alt || "", d.pos), d.caption ? h("p", { class: "dk-tagc" }, d.caption) : null],
      // galeria: imagens inteiras, sem recorte (rótulos planificados, thumbs de produto)
      gallery: (d) => [h("div", { class: "dk-gal", style: `--c:${d.cols || 2};--mc:${d.mcols || 1}` }, d.title ? h("h3", { class: "dk-h s" }, d.title) : null,
        h("div", { class: "dk-gal-g" }, ...d.items.map((it) => h("figure", {}, im(it.img || it, "", it.label || ""), it.label ? h("figcaption", {}, it.label) : null))))],
      duo: (d) => [h("div", { class: "dk-duo" }, ...[d.a, d.b].map((p) => h("div", { style: p.bg ? `background:${p.bg};color:${p.fg || "#fff"}` : "" },
        p.img ? im(p.img, p.fit === "contain" ? "dk-ct" : "dk-bg", p.alt || "", p.pos) : null,
        p.logo ? im(p.logo, "dk-logo s", "") : null,
        p.title || p.text ? h("div", { class: "dk-over bl" }, p.kicker ? h("p", { class: "dk-kick" }, p.kicker) : null, p.title ? h("h3", { class: "dk-h s" }, lines(p.title)) : null, p.text ? h("p", { class: "dk-sub" }, p.text) : null) : null,
        p.caption ? h("p", { class: "dk-tagc" }, p.caption) : null)))],
    };
    SL.end = SL.cover;
    R.deck = (s) => {
      deckFonts(s.fonts);
      const vars = Object.entries(s.vars || {}).map(([k, v]) => `--${k}:${v}`).join(";");
      return h("section", { class: "blk deck", style: vars },
        s.title || s.eyebrow || s.text ? h("div", { class: "wrap" }, head(s)) : null,
        h("div", { class: "dk-list" }, ...s.slides.map((d, i) => h("article", {
          class: `sl k-${d.k}${d.tall ? " tall" : ""}`, "data-fx": "", "aria-label": d.label || d.title || d.kicker || `Prancha ${i + 1}`,
          style: [`--bg:${d.bg || "var(--dk-paper,#F2EFE6)"}`, `--fg:${d.fg || "var(--dk-ink,#222)"}`, d.font ? `--dk-font:"${d.font}"` : ""].join(";"),
        }, ...(SL[d.k] || SL.image)(d).filter(Boolean)))));
    };
    return R;
  }

  let cleanup = null;
  function run(root) {
    cleanup?.();
    const all = (q) => [...root.querySelectorAll(q)];
    if (RM.matches || !("IntersectionObserver" in window)) { all("[data-fx]").forEach((e) => e.classList.add("in")); all(".reels video").forEach((v) => { v.controls = true; }); cleanup = null; return; }
    // Entrada escalonada: cada bloco aparece ao entrar na tela
    // blocos com clip-path têm área visível zero: observa-se o painel inteiro e abre os blocos juntos
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      if (e.target.classList.contains("bd")) e.target.querySelectorAll(":scope > [data-fx]").forEach((b) => b.classList.add("in"));
      else e.target.classList.add("in");
      io.unobserve(e.target);
    }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    all("[data-fx]").forEach((e) => { if (!e.classList.contains("bk")) io.observe(e); });
    all(".bd").forEach((e) => io.observe(e));
    // Parallax leve (usa "translate" para não brigar com as animações de transform)
    const par = all("[data-par]");
    let tick = false;
    const onScroll = () => {
      if (tick) return; tick = true;
      requestAnimationFrame(() => {
        tick = false; const vh = innerHeight;
        for (const e of par) {
          const r = (e.parentElement || e).getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) continue;
          e.style.translate = `0 ${((r.top + r.height / 2 - vh / 2) * parseFloat(e.dataset.par)).toFixed(1)}px`;
        }
      });
    };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
    // Mosaico vivo: de tempos em tempos um bloco visível gira
    const tiles = all(".mosaic .tile");
    const iv = tiles.length ? setInterval(() => {
      if (document.hidden) return;
      const vis = tiles.filter((t) => { const r = t.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
      if (!vis.length) return;
      const t = vis[(Math.random() * vis.length) | 0];
      t.classList.remove("flip"); void t.offsetWidth; t.classList.add("flip");
    }, 1400) : 0;
    // todos os vídeos da página (vinhetas, faixas, capas) passam pelo mesmo controle de reprodução do site
    all("video:not([controls])").forEach((v) => window.GE?.watchVideo ? window.GE.watchVideo(v) : (v.muted = true, v.play().catch(() => {})));
    cleanup = () => { io.disconnect(); removeEventListener("scroll", onScroll); clearInterval(iv); };
  }
  return { extend, run };
})();

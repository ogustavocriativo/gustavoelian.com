/* Demonstração interativa do sistema do II ENEHISP (página do case).
   Tudo roda no navegador, com dados fictícios: nada é enviado a servidor.
   Cinco módulos ligados entre si, na ordem real do evento:
   confirmação → cronômetro (registra presença) → mural da coordenação (nota da apresentação)
   → submissão do texto → pareceres às cegas e índice de seleção (70% pareceres + 30% apresentação). */
window.EnehispDemo = (s, h) => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- dados fictícios ---------- */
  const ST = { cod: "ST10", nome: "Imagem e imprensa", sub: "atos políticos, cultura visual e intencionalidade", dia: "quinta-feira, 8 de outubro", hora: "14h às 18h", sala: "Sala virtual 3 · Google Meet" };
  const FALAS = [
    { cod: "ST10-14", autor: "Helena Duarte Siqueira", titulo: "Caricatura e República: o traço como argumento (1889-1894)" },
    { cod: "ST10-17", autor: "Rafael Moura Lins", titulo: "Fotografia de imprensa e a construção do inimigo público" },
    { cod: "ST10-21", autor: "Lívia Prado Antunes", titulo: "Capas de revista e a encenação do poder no Estado Novo" },
    { cod: "ST10-23", autor: "Tomás Ferreira Neto", titulo: "Charges eleitorais e humor político nos anos 1950" },
  ];
  const LIVRES = [
    { cod: "SL2", dia: "quinta-feira, 8/10", hora: "14h às 18h", vagas: 2 },
    { cod: "SL4", dia: "sexta-feira, 9/10", hora: "8h às 12h", vagas: 1 },
    { cod: "SL5", dia: "sexta-feira, 9/10", hora: "14h às 18h", vagas: 0 },
  ];
  const CRIT_MURAL = ["Clareza e organização", "Fundamentação e fontes", "Contribuição ao Simpósio", "Tempo e debate"];
  const ROT = { 1: "insuficiente", 2: "regular", 3: "bom", 4: "muito bom", 5: "excelente" };
  const CRIT_PARECER = ["Originalidade", "Fundamentação teórica", "Uso das fontes", "Metodologia", "Clareza e escrita", "Adequação à modalidade"];
  // outros textos já avaliados (para o ranking da Comissão)
  const OUTROS = [
    { cod: "ST10-14", pareceres: 8.6, apres: 9.0 },
    { cod: "ST03-08", pareceres: 7.9, apres: 8.5 },
    { cod: "ST18-02", pareceres: 9.1, apres: 7.5 },
    { cod: "ST07-11", pareceres: 6.8, apres: 8.0 },
  ];

  /* estado compartilhado entre os módulos (a demonstração conta uma história só) */
  const S = { fala: FALAS[1], confirmado: null, sessao: null, presenca: false, tempoUsado: 0, notaApres: null, enviado: null, parecer: null };
  const listeners = new Set();
  const changed = () => listeners.forEach((f) => f());

  /* ---------- utilitários ---------- */
  const el = (t, a, ...k) => h(t, a || {}, ...k);
  const btn = (label, on, cls = "") => el("button", { type: "button", class: `ehd-btn ${cls}`, onclick: on }, label);
  const field = (label, input, hint) => el("label", { class: "ehd-f" }, el("span", { class: "ehd-lbl" }, label), input, hint ? el("small", {}, hint) : null);
  const mmss = (ms) => { const neg = ms < 0, t = Math.abs(Math.round(ms / 1000)); return `${neg ? "+" : ""}${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
  const fmt = (n) => n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const note = (t) => el("p", { class: "ehd-note" }, t);
  const toast = (box, msg, kind = "ok") => { const n = el("div", { class: `ehd-toast ${kind}`, role: "status" }, msg); box.append(n); setTimeout(() => n.remove(), 2600); };
  let ctx; const beep = (f = 880, d = 0.18) => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = 0.06; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + d); } catch (e) {} };

  /* ---------- 1 · confirmação de apresentação ---------- */
  function confirmacao() {
    const wrap = el("div", { class: "ehd-pane" });
    const cod = el("input", { value: "ST10-17", "aria-label": "Código da proposta", autocomplete: "off", spellcheck: "false" });
    const out = el("div", { "aria-live": "polite" });
    function show() {
      const f = FALAS.find((x) => x.cod.toLowerCase() === cod.value.trim().toLowerCase());
      out.replaceChildren();
      if (!f) { out.append(el("div", { class: "ehd-card warn" }, "Código não encontrado. Use um dos códigos de demonstração: ", FALAS.map((x) => x.cod).join(", "), ".")); return; }
      S.fala = f;
      const st = S.confirmado;
      const status = st === "sim" ? el("span", { class: "ehd-pill ok" }, "Confirmada") : st === "nao" ? el("span", { class: "ehd-pill no" }, "Recusada") : st === "troca" ? el("span", { class: "ehd-pill ok" }, `Remanejada · ${S.sessao}`) : el("span", { class: "ehd-pill wait" }, "Aguardando confirmação");
      const livres = el("div", { class: "ehd-livres", hidden: "" }, el("p", { class: "ehd-lbl" }, "Sessões livres com vaga"),
        ...LIVRES.map((l) => el("button", { type: "button", class: "ehd-slot", disabled: l.vagas ? null : "", onclick: () => { S.confirmado = "troca"; S.sessao = l.cod; changed(); show(); toast(wrap, `Comunicação remanejada para a ${l.cod}.`); } },
          el("b", {}, l.cod), el("span", {}, `${l.dia} · ${l.hora}`), el("small", {}, l.vagas ? `${l.vagas} vaga${l.vagas > 1 ? "s" : ""}` : "sem vagas"))));
      out.append(el("div", { class: "ehd-card" },
        el("div", { class: "ehd-row" }, el("span", { class: "ehd-code" }, f.cod), status),
        el("h4", {}, f.titulo), el("p", { class: "ehd-soft" }, f.autor),
        el("dl", { class: "ehd-dl" }, el("dt", {}, "Simpósio"), el("dd", {}, `${ST.cod} · ${ST.nome}`), el("dt", {}, "Sessão"), el("dd", {}, `${ST.dia} · ${ST.hora}`), el("dt", {}, "Local"), el("dd", {}, ST.sala)),
        el("div", { class: "ehd-actions" },
          btn("Confirmo minha apresentação", () => { S.confirmado = "sim"; S.sessao = null; changed(); show(); toast(wrap, "Presença confirmada. A coordenação já vê no painel."); }, "pri"),
          btn("Preciso trocar de sessão", () => { livres.hidden = !livres.hidden; }, "ghost"),
          btn("Não vou apresentar", () => { S.confirmado = "nao"; changed(); show(); toast(wrap, "Recusa registrada. A vaga volta para as sessões livres.", "no"); }, "ghost")),
        livres));
    }
    wrap.append(
      el("div", { class: "ehd-intro" }, el("h3", {}, "Confirme sua apresentação"), el("p", {}, "Quem apresenta digita o código que veio na carta de aceite, vê sessão e horário e confirma, recusa ou pede troca para uma sessão livre.")),
      el("form", { class: "ehd-inline", onsubmit: (e) => { e.preventDefault(); show(); } }, field("Código da proposta", cod, "Demonstração: ST10-14, ST10-17, ST10-21 ou ST10-23"), btn("Buscar minha proposta", null, "pri")),
      out);
    show();
    return wrap;
  }

  /* ---------- 2 · cronômetro das comunicações ---------- */
  function cronometro() {
    const wrap = el("div", { class: "ehd-pane" });
    const DUR = 15 * 60 * 1000;
    const T = { idx: 0, status: "parado", acumulado: 0, inicio: 0, extra: 0, speed: 30, aus: new Set(), avisos: new Set() };
    const clock = el("div", { class: "ehd-clock", "aria-live": "off" });
    const bar = el("i");
    const who = el("div", { class: "ehd-who" });
    const phone = el("div", { class: "ehd-phone" }, el("small", { class: "ehd-lbl" }, "Tela de quem apresenta"), who, clock, el("div", { class: "ehd-bar" }, bar), el("p", { class: "ehd-soft" }, "Avisos sonoros aos 5 minutos, a 1 minuto e no fim."));
    const list = el("ol", { class: "ehd-queue" });
    const speedSel = el("select", { "aria-label": "Velocidade da demonstração", onchange: () => { sync(); T.speed = Number(speedSel.value); } },
      el("option", { value: "1" }, "tempo real"), el("option", { value: "30", selected: "" }, "30× mais rápido"), el("option", { value: "90" }, "90× mais rápido"));
    const used = () => T.acumulado + (T.status === "rodando" ? (performance.now() - T.inicio) * T.speed : 0);
    function sync() { if (T.status === "rodando") { T.acumulado = used(); T.inicio = performance.now(); } }
    const ctrl = el("div", { class: "ehd-ctrl" });
    function act(a) {
      if (a === "iniciar") { Object.assign(T, { status: "rodando", inicio: performance.now(), acumulado: 0, extra: 0 }); T.avisos.clear(); }
      if (a === "pausar") { sync(); T.status = "pausado"; }
      if (a === "retomar") { T.status = "rodando"; T.inicio = performance.now(); }
      if (a === "mais") { T.extra += 60 * 1000; }
      if (a === "concluir") { sync(); T.status = "concluido"; registrar(T.idx); }
      if (a === "ausente") { T.aus.add(T.idx); a = "proxima"; }
      if (a === "proxima") {
        if (T.status === "rodando" || T.status === "pausado") { sync(); registrar(T.idx); }
        let i = T.idx + 1; while (i < FALAS.length && T.aus.has(i)) i++;
        if (i >= FALAS.length) { toast(wrap, "Fim da sessão: abrir o debate.", "ok"); T.status = "concluido"; render(); return; }
        Object.assign(T, { idx: i, status: "parado", acumulado: 0, extra: 0 }); T.avisos.clear();
      }
      render();
    }
    function registrar(i) {
      FALAS[i].presente = true;
      if (FALAS[i] === S.fala) { S.presenca = true; S.tempoUsado = T.acumulado; changed(); }
    }
    function render() {
      const f = FALAS[T.idx];
      who.replaceChildren(el("span", { class: "ehd-code" }, f.cod), el("b", {}, f.autor), el("small", {}, f.titulo));
      list.replaceChildren(...FALAS.map((x, i) => el("li", { class: i === T.idx ? "on" : T.aus.has(i) ? "aus" : x.presente ? "ok" : "" },
        el("span", { class: "ehd-code" }, x.cod), el("span", {}, x.autor), el("small", {}, T.aus.has(i) ? "ausente" : x.presente ? "presença registrada" : i === T.idx ? "em fala" : "aguardando"))));
      const st = T.status;
      ctrl.replaceChildren(...[
        st === "parado" || st === "concluido" ? btn(st === "concluido" ? "Recomeçar fala" : "Iniciar fala", () => act("iniciar"), "pri") : null,
        st === "rodando" ? btn("Pausar", () => act("pausar"), "pri") : null,
        st === "pausado" ? btn("Retomar", () => act("retomar"), "pri") : null,
        st === "rodando" || st === "pausado" ? btn("+1 min", () => act("mais"), "ghost") : null,
        st === "rodando" || st === "pausado" ? btn("Concluir fala", () => act("concluir"), "ghost") : null,
        btn("Próxima", () => act("proxima"), "ghost"),
        st === "parado" ? btn("Marcar ausente", () => act("ausente"), "ghost") : null].filter(Boolean));
    }
    let raf = 0, visible = false;
    function tick() {
      const rest = DUR + T.extra - used();
      clock.textContent = mmss(rest);
      const ratio = Math.max(0, Math.min(1, used() / (DUR + T.extra)));
      bar.style.width = `${ratio * 100}%`;
      phone.dataset.fase = rest <= 0 ? "fim" : rest <= 60000 ? "1min" : rest <= 300000 ? "5min" : "";
      if (T.status === "rodando") for (const [k, lim, f] of [["5", 300000, 660], ["1", 60000, 880], ["0", 0, 1040]]) if (rest <= lim && !T.avisos.has(k)) { T.avisos.add(k); if (soundOn.checked) beep(f, k === "0" ? 0.5 : 0.18); }
      if (visible) raf = requestAnimationFrame(tick);
    }
    const soundOn = el("input", { type: "checkbox" });
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; cancelAnimationFrame(raf); if (visible) tick(); }).observe(wrap); else { visible = true; tick(); }
    wrap.append(
      el("div", { class: "ehd-intro" }, el("h3", {}, "Cronômetro das comunicações"), el("p", {}, "A coordenação controla a sessão; cada comunicador acompanha o próprio tempo no celular, ao lado da chamada. Ao concluir a fala, a presença fica registrada e libera a avaliação e o envio do texto.")),
      el("div", { class: "ehd-two" },
        el("div", { class: "ehd-card" }, el("div", { class: "ehd-row" }, el("small", { class: "ehd-lbl" }, `Coordenação · ${ST.cod} · ${ST.nome}`)), list, ctrl,
          el("div", { class: "ehd-row ehd-opts" }, speedSel, el("label", { class: "ehd-check" }, soundOn, " avisos sonoros"))),
        phone));
    render(); tick();
    return wrap;
  }

  /* ---------- 3 · mural de avaliação da coordenação ---------- */
  function mural() {
    const wrap = el("div", { class: "ehd-pane" });
    const box = el("div");
    const notas = {}; let rec = null;
    function render() {
      const f = S.fala;
      box.replaceChildren();
      if (!S.presenca) {
        box.append(el("div", { class: "ehd-card warn" }, el("b", {}, `${f.cod} ainda não tem presença registrada.`), el("p", {}, "O mural só libera a avaliação depois que a fala passa pelo cronômetro."),
          btn("Registrar presença (atalho da demonstração)", () => { S.presenca = true; S.tempoUsado = 14 * 60000 + 12000; FALAS[FALAS.indexOf(f)].presente = true; changed(); }, "ghost")));
        return;
      }
      const media = () => { const v = Object.values(notas); return v.length === CRIT_MURAL.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      const res = el("div", { class: "ehd-score" });
      const upd = () => { const m = media(); res.replaceChildren(el("small", { class: "ehd-lbl" }, "Média da apresentação"), el("b", {}, m == null ? "—" : fmt(m)), el("small", {}, m == null ? "de 1 a 5" : `entra como ${fmt(m * 2)} de 10 no índice`)); };
      box.append(el("div", { class: "ehd-card" },
        el("div", { class: "ehd-row" }, el("span", { class: "ehd-code" }, f.cod), el("span", { class: "ehd-pill ok" }, `presença · ${mmss(S.tempoUsado)} de fala`)),
        el("h4", {}, f.titulo), el("p", { class: "ehd-soft" }, f.autor),
        ...CRIT_MURAL.map((c, ci) => el("div", { class: "ehd-crit" }, el("span", {}, c),
          el("div", { class: "ehd-scale", role: "radiogroup", "aria-label": c }, ...[1, 2, 3, 4, 5].map((n) => {
            const b = el("button", { type: "button", role: "radio", "aria-checked": String(notas[ci] === n), title: ROT[n], onclick: () => { notas[ci] = n; render(); } }, String(n));
            return b;
          })))),
        el("div", { class: "ehd-crit" }, el("span", {}, "Recomendação para publicação"),
          el("div", { class: "ehd-seg" }, ...["Recomendo", "Com ajustes", "Não recomendo"].map((r) => el("button", { type: "button", "aria-pressed": String(rec === r), onclick: () => { rec = r; render(); } }, r)))),
        el("div", { class: "ehd-row" }, res, btn("Salvar avaliação", () => {
          const m = media(); if (m == null || !rec) { toast(wrap, "Dê uma nota em cada critério e escolha a recomendação.", "no"); return; }
          S.notaApres = m * 2; changed(); toast(wrap, "Avaliação salva. A nota segue para o índice de seleção.");
        }, "pri"))));
      upd();
    }
    listeners.add(render);
    wrap.append(el("div", { class: "ehd-intro" }, el("h3", {}, "Mural de avaliação"), el("p", {}, "A coordenação de cada Simpósio avalia as apresentações em quatro critérios. A média vira 30% do índice que decide a publicação no livro e nos Anais.")), box);
    render();
    return wrap;
  }

  /* ---------- 4 · submissão do texto ---------- */
  function submissao() {
    const wrap = el("div", { class: "ehd-pane" });
    const box = el("div");
    const D = { passo: 0, modal: null, titulo: "Fotografia de imprensa e a construção do inimigo público", resumo: "", pal: "imprensa; fotografia; anticomunismo", arq: [], cond: [false, false, false] };
    const PASSOS = ["Acesso", "Modalidade", "Condições", "Dados", "Arquivos", "Envio"];
    const MOD = { cap: { nome: "Capítulo de livro", d: "15 a 25 laudas · notas de rodapé", arqs: ["texto-sem-identificacao.pdf", "texto-editavel.docx"] }, anais: { nome: "Trabalho completo nos Anais", d: "10 a 15 laudas · ABNT", arqs: ["trabalho-sem-identificacao.pdf"] } };
    const steps = () => el("ol", { class: "ehd-steps" }, ...PASSOS.map((p, i) => el("li", { class: i < D.passo ? "ok" : i === D.passo ? "on" : "" }, p)));
    const nav = (ok, label = "Continuar") => el("div", { class: "ehd-actions" }, D.passo ? btn("Voltar", () => { D.passo--; render(); }, "ghost") : null, btn(label, () => { const r = ok(); if (r === true) { D.passo++; render(); } else toast(wrap, r, "no"); }, "pri"));
    function render() {
      box.replaceChildren(steps());
      const c = el("div", { class: "ehd-card" }); box.append(c);
      if (D.passo === 0) {
        const cod = el("input", { value: S.fala.cod, "aria-label": "Código" }), mail = el("input", { value: "rafael.lins@exemplo.org", type: "email", "aria-label": "E-mail" });
        c.append(el("h4", {}, "Entrar na área de submissão"), field("Código da comunicação", cod), field("E-mail cadastrado na proposta", mail),
          note(S.presenca ? "Presença registrada no evento: o texto vai direto para a avaliação." : "Sem presença registrada o envio é aceito, mas o texto só é avaliado depois da conferência."),
          nav(() => (cod.value.trim() && /@/.test(mail.value) ? true : "Preencha o código e o e-mail."), "Entrar"));
      } else if (D.passo === 1) {
        c.append(el("h4", {}, "Escolha a modalidade"), el("div", { class: "ehd-opts2" }, ...Object.entries(MOD).map(([k, m]) => el("button", { type: "button", class: "ehd-opt", "aria-pressed": String(D.modal === k), onclick: () => { D.modal = k; D.arq = []; render(); } }, el("b", {}, m.nome), el("small", {}, m.d)))),
          nav(() => (D.modal ? true : "Escolha uma modalidade.")));
      } else if (D.passo === 2) {
        const C = ["O texto é inédito e não está em avaliação em outro veículo.", "O PDF não identifica a autoria, nem nas propriedades do arquivo.", "Declaro o uso de IA, se houver, conforme o edital."];
        c.append(el("h4", {}, "Condições para submissão"), ...C.map((t, i) => el("label", { class: "ehd-check" }, el("input", { type: "checkbox", checked: D.cond[i] ? "" : null, onchange: (e) => { D.cond[i] = e.target.checked; } }), " ", t)),
          nav(() => (D.cond.every(Boolean) ? true : "Marque as três condições.")));
      } else if (D.passo === 3) {
        const t = el("input", { value: D.titulo, maxlength: "150", oninput: (e) => { D.titulo = e.target.value; ct.textContent = `${D.titulo.length}/150`; } });
        const r = el("textarea", { rows: "4", maxlength: "1000", placeholder: "Resumo de até 1.000 caracteres", oninput: (e) => { D.resumo = e.target.value; cr.textContent = `${D.resumo.length}/1.000`; } }, D.resumo);
        const p = el("input", { value: D.pal, oninput: (e) => { D.pal = e.target.value; } });
        const ct = el("small", {}, `${D.titulo.length}/150`), cr = el("small", {}, `${D.resumo.length}/1.000`);
        c.append(el("h4", {}, "Título, resumo e palavras-chave"), field("Título", t, ct), field("Resumo", r, cr), field("Palavras-chave (3 a 5, separadas por ponto e vírgula)", p),
          btn("Preencher resumo de exemplo", () => { D.resumo = "Analisa a circulação de fotografias de imprensa em jornais de grande tiragem e o modo como enquadramentos, legendas e paginação produziram a figura do inimigo público em contextos de crise política."; render(); }, "link"),
          nav(() => { const n = D.pal.split(";").map((x) => x.trim()).filter(Boolean).length; if (!D.titulo.trim()) return "Informe o título."; if (D.resumo.trim().length < 80) return "Escreva o resumo (ou use o exemplo)."; if (n < 3 || n > 5) return "Use de 3 a 5 palavras-chave."; return true; }));
      } else if (D.passo === 4) {
        const m = MOD[D.modal];
        c.append(el("h4", {}, "Arquivos"), ...m.arqs.map((a) => el("div", { class: "ehd-file" }, el("span", {}, a), D.arq.includes(a) ? el("span", { class: "ehd-pill ok" }, "anexado") : btn("Escolher arquivo", () => { D.arq.push(a); render(); }, "ghost"))),
          note("Na demonstração os arquivos são simulados."), nav(() => (D.arq.length === m.arqs.length ? true : "Anexe todos os arquivos da modalidade."), "Enviar texto"));
      } else {
        S.enviado = { modal: MOD[D.modal].nome, titulo: D.titulo, quando: "30/10, 22h41" }; changed();
        c.append(el("div", { class: "ehd-done" }, el("span", { class: "ehd-tick", "aria-hidden": "true" }, "✓"), el("h4", {}, "Texto enviado"),
          el("p", {}, `${MOD[D.modal].nome} · ${S.fala.cod}`), el("span", { class: "ehd-pill " + (S.presenca ? "ok" : "wait") }, S.presenca ? "Em avaliação" : "Aguardando comprovação de apresentação"),
          el("p", { class: "ehd-soft" }, "Em “Minhas submissões” a pessoa acompanha cada etapa: avaliação, resultado e correções.")),
          el("div", { class: "ehd-actions" }, btn("Fazer outra submissão", () => { Object.assign(D, { passo: 0, modal: null, arq: [], cond: [false, false, false] }); render(); }, "ghost")));
      }
    }
    wrap.append(el("div", { class: "ehd-intro" }, el("h3", {}, "Submissão de textos"), el("p", {}, "Depois do evento, quem apresentou envia o capítulo de livro ou o trabalho completo para os Anais, com o mesmo código da comunicação.")), box);
    render();
    return wrap;
  }

  /* ---------- 5 · pareceres às cegas e índice de seleção ---------- */
  function pareceres() {
    const wrap = el("div", { class: "ehd-pane" });
    const box = el("div");
    const N = CRIT_PARECER.map(() => 8);
    let decisao = "Aprovado", com = "";
    function render() {
      box.replaceChildren();
      const media = N.reduce((a, b) => a + b, 0) / N.length;
      const apres = S.notaApres ?? 8.0;
      const indice = media * 0.7 + apres * 0.3;
      const out = el("div", { class: "ehd-score" }, el("small", { class: "ehd-lbl" }, "Média do parecer"), el("b", {}, fmt(media)), el("small", {}, "de 0 a 10"));
      const parecer = el("div", { class: "ehd-card" },
        el("div", { class: "ehd-row" }, el("span", { class: "ehd-code" }, "Texto nº 0417"), el("span", { class: "ehd-pill wait" }, "Autoria oculta")),
        el("h4", {}, S.enviado?.titulo || "Fotografia de imprensa e a construção do inimigo público"),
        el("p", { class: "ehd-soft" }, `${S.enviado?.modal || "Capítulo de livro"} · ${ST.cod} · parecerista B`),
        ...CRIT_PARECER.map((c, i) => {
          const v = el("output", {}, String(N[i]));
          return el("label", { class: "ehd-range" }, el("span", {}, c), el("input", { type: "range", min: "0", max: "10", step: "0.5", value: String(N[i]), oninput: (e) => { N[i] = Number(e.target.value); v.textContent = String(N[i]); out.querySelector("b").textContent = fmt(N.reduce((a, b) => a + b, 0) / N.length); } }), v);
        }),
        el("div", { class: "ehd-crit" }, el("span", {}, "Parecer"), el("div", { class: "ehd-seg" }, ...["Aprovado", "Aprovado com ressalvas", "Reprovado"].map((r) => el("button", { type: "button", "aria-pressed": String(decisao === r), onclick: () => { decisao = r; render(); } }, r)))),
        field("Comentários à autoria", el("textarea", { rows: "2", placeholder: "Visível para a autoria, sem identificar quem avaliou.", oninput: (e) => { com = e.target.value; } }, com)),
        el("div", { class: "ehd-row" }, out, btn("Enviar parecer", () => { S.parecer = { media, decisao }; render(); toast(wrap, "Parecer enviado à Comissão."); }, "pri")));
      // painel da Comissão
      const meu = { cod: S.fala.cod, pareceres: S.parecer ? S.parecer.media : null, apres, eu: true };
      const linhas = [...OUTROS, meu].map((x) => ({ ...x, ind: x.pareceres == null ? null : x.pareceres * 0.7 + x.apres * 0.3 })).sort((a, b) => (b.ind ?? -1) - (a.ind ?? -1));
      const comissao = el("div", { class: "ehd-card ehd-deep" },
        el("small", { class: "ehd-lbl" }, "Painel da Comissão · índice de seleção"),
        el("div", { class: "ehd-formula" }, el("span", {}, "70% pareceres"), el("i", {}, "+"), el("span", {}, "30% apresentação"), el("i", {}, "="), el("b", {}, S.parecer ? fmt(indice) : "aguardando parecer")),
        el("table", { class: "ehd-table" }, el("thead", {}, el("tr", {}, el("th", {}, "Texto"), el("th", {}, "Pareceres"), el("th", {}, "Apresentação"), el("th", {}, "Índice"))),
          el("tbody", {}, ...linhas.map((x) => el("tr", { class: x.eu ? "me" : "" }, el("td", {}, x.cod), el("td", {}, fmt(x.pareceres)), el("td", {}, fmt(x.apres)), el("td", {}, el("b", {}, fmt(x.ind))))))),
        note(S.notaApres == null ? "A nota da apresentação usa 8,0 como exemplo. Avalie no Mural para usar a sua." : "Nota da apresentação vinda do Mural de avaliação."));
      box.append(el("div", { class: "ehd-two" }, parecer, comissao));
    }
    listeners.add(render);
    wrap.append(el("div", { class: "ehd-intro" }, el("h3", {}, "Pareceres às cegas"), el("p", {}, "Cada texto recebe pareceres sem identificação de autoria, em seis critérios de 0 a 10. A Comissão vê o índice de seleção somando a média dos pareceres à nota da apresentação.")), box);
    render();
    return wrap;
  }

  /* ---------- montagem ---------- */
  const MODS = [
    ["Confirmação", confirmacao], ["Cronômetro", cronometro], ["Mural da coordenação", mural], ["Submissão", submissao], ["Pareceres", pareceres],
  ];
  const panes = MODS.map(([, f]) => f());
  const tabs = MODS.map(([n], i) => el("button", { type: "button", role: "tab", id: `ehd-t${i}`, "aria-controls": `ehd-p${i}`, "aria-selected": String(!i), tabindex: i ? "-1" : "0", onclick: () => go(i) },
    el("span", { class: "ehd-n" }, String(i + 1).padStart(2, "0")), n));
  panes.forEach((p, i) => { p.id = `ehd-p${i}`; p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", `ehd-t${i}`); if (i) p.hidden = true; });
  function go(i) {
    tabs.forEach((t, j) => { t.setAttribute("aria-selected", String(i === j)); t.tabIndex = i === j ? 0 : -1; });
    panes.forEach((p, j) => { p.hidden = i !== j; });
    tabs[i].focus({ preventScroll: true });
    tabs[i].scrollIntoView({ block: "nearest", inline: "center", behavior: RM ? "auto" : "smooth" });
  }
  const tablist = el("div", { class: "ehd-tabs", role: "tablist", "aria-label": "Módulos do sistema",
    onkeydown: (e) => { const i = tabs.indexOf(document.activeElement); if (i < 0) return; if (e.key === "ArrowRight") { e.preventDefault(); go((i + 1) % tabs.length); } if (e.key === "ArrowLeft") { e.preventDefault(); go((i - 1 + tabs.length) % tabs.length); } } }, ...tabs);
  const head = el("div", { class: "fx-head" }, s.eyebrow ? el("span", { class: "eyebrow" }, s.eyebrow) : null, s.title ? el("h2", {}, s.title) : null, ...(Array.isArray(s.text) ? s.text : s.text ? [s.text] : []).map((t) => el("p", { class: "soft" }, t)));
  return el("section", { class: "blk ehd" }, el("div", { class: "wrap" }, head,
    el("div", { class: "ehd-win" },
      el("div", { class: "ehd-top" }, el("span", { class: "ehd-dots", "aria-hidden": "true" }, el("i"), el("i"), el("i")), el("span", { class: "ehd-url" }, "enehisp · demonstração"), el("span", { class: "ehd-tag" }, "dados fictícios")),
      tablist, ...panes)));
};

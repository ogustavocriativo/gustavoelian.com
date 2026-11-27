// Saldo em aberto e parcelas (o mesmo plano que o Studio mostra em Recebimentos), para o cliente pagar pelo checkout.
export const round2 = (v: number) => Math.round(v * 100) / 100;

export function planOf(st: any, entryPctDefault = 60) {
  if (!st?.approvedAt) return [];
  const tot = Number(st.total || 0), paid = Number(st.paidTotal || 0), t = st.terms;
  let rows: { label: string; amount: number; due: string }[];
  if (t?.parcels?.length) rows = t.parcels.map((p: any) => ({ label: String(p.label || "Parcela"), amount: Number(p.amount || 0), due: p.due || "" }));
  else {
    const method = t ? (t.method === "cartao" ? "cartao" : "avista") : st.selection?.method;
    const ep = t?.entryPct ?? entryPctDefault;
    if (method === "cartao" || ep >= 100) rows = [{ label: method === "cartao" ? "Cartão de crédito" : "Pagamento único", amount: tot, due: st.approvedAt.slice(0, 10) }];
    else { const entry = round2((tot * ep) / 100); rows = [{ label: `Entrada (${ep}%)`, amount: entry, due: st.approvedAt.slice(0, 10) }, { label: `Saldo na entrega (${100 - ep}%)`, amount: round2(tot - entry), due: st.work?.dueDate || "" }]; }
  }
  // quanto falta em cada parcela, abatendo o que já foi pago na ordem
  let left = paid;
  return rows.map((r) => { const covered = Math.min(r.amount, Math.max(0, left)); left -= r.amount; return { ...r, open: round2(r.amount - covered), done: r.amount - covered < 0.01 }; });
}

/** Opções de pagamento do saldo: tudo à vista e, se houver mais de uma parcela em aberto, só a próxima. */
export function balanceOptions(st: any, entryPctDefault = 60) {
  const rest = round2(Math.max(0, Number(st.total || 0) - Number(st.paidTotal || 0)));
  if (rest < 1) return { rest, options: [] as any[] };
  const pending = planOf(st, entryPctDefault).filter((p) => !p.done);
  const options: any[] = [{ id: "total", label: pending.length > 1 ? `Pagar tudo à vista (${pending.length} parcelas)` : "Pagar o saldo", amount: rest }];
  if (pending.length > 1) options.push({ id: "proxima", label: `Pagar a próxima parcela · ${pending[0].label}`, amount: pending[0].open, due: pending[0].due });
  return { rest, options, pending: pending.map((p) => ({ label: p.label, amount: p.open, due: p.due })) };
}

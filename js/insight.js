/* Analizy liczone kodem. Żadna liczba tutaj nie pochodzi z AI. */
import { dnum, dstr, monthKey, addMonths, monthTotals, fullMonthsBefore, median, CAT } from './engine.js';
const sum = a => a.reduce((x, y) => x + y, 0), r0 = n => Math.round(n);
const dim = mk => new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate();
const addMonthsDate = (d, k) => { const mk = addMonths(d.slice(0, 7), k), day = Math.min(+d.slice(8, 10), dim(mk)); return `${mk}-${String(day).padStart(2, '0')}`; };

/* ---------- saldo na dzień (odtwarzane od salda-kotwicy) ---------- */
export function balanceAt(txs, account, anchor, date) {
  if (!anchor) return null;
  let b = anchor.v;
  for (const t of txs) if (t.account === account && !t.pending && (t.booked || t.date) > date && (t.booked || t.date) <= anchor.date) b -= t.amount;
  return b;
}
export function totalAnchor(accounts, txs) {
  const list = accounts.filter(a => a.anchor && !a.noBalance);
  if (!list.length) return null;
  return { date: list.map(a => a.anchor.date).sort().pop(), accounts: list };
}

/* ---------- prognoza salda ---------- */
export function forecast(txs, rec, today, anchor, days = 35) {
  if (!anchor) return null;
  const start = anchor.date, mk = monthKey(today), prev = fullMonthsBefore(txs, mk, 3);
  if (prev.length < 2) return { notEnough: true };
  const incByDom = {}, base = txs.filter(t => !t.internal && !t.pending && prev.includes(monthKey(t.date)));
  for (const t of base) if (t.amountPLN > 0 && !t.irr && !t.offset) { const d = +t.date.slice(8, 10); incByDom[d] = (incByDom[d] || 0) + t.amountPLN / prev.length; }
  const varTotal = sum(base.filter(t => t.amountPLN < 0 && !t.recKey).map(t => -t.amountPLN)) + sum(base.filter(t => t.offset).map(t => -t.amountPLN));
  const daysInPrev = sum(prev.map(dim)), daily = varTotal / daysInPrev;
  const events = []; // znane z góry: stałe opłaty
  const horizonEnd = dstr(dnum(start) + days);
  for (const r of rec.filter(r => r.active)) {
    let d = r.next, guard = 0;
    while (d <= start && guard++ < 60) d = stepDate(d, r.period);
    while (d <= horizonEnd && guard++ < 120) { events.push({ date: d, name: r.name, amount: -r.latest, kind: 'stała' }); d = stepDate(d, r.period); }
  }
  const series = []; let bal = anchor.v, low = { date: start, bal };
  const evBy = {}; for (const e of events) (evBy[e.date] = evBy[e.date] || []).push(e);
  for (let i = 1; i <= days; i++) {
    const d = dstr(dnum(start) + i), dom = +d.slice(8, 10);
    const inc = incByDom[dom] || 0, fx = sum((evBy[d] || []).map(e => e.amount));
    bal += inc + fx - daily;
    series.push({ date: d, bal: Math.round(bal), inc: Math.round(inc) });
    if (bal < low.bal) low = { date: d, bal: Math.round(bal) };
  }
  const incomeEvents = Object.entries(incByDom).map(([dom, v]) => ({ dom: +dom, v })).filter(x => x.v > 200);
  return { start, startBal: anchor.v, limit: anchor.limit ?? null, series, low, end: series[series.length - 1], daily, incomeEvents, events: events.sort((a, b) => (a.date < b.date ? -1 : 1)), basedOn: prev };
}
function stepDate(d, period) {
  if (period === 'weekly') return dstr(dnum(d) + 7);
  if (period === 'biweekly') return dstr(dnum(d) + 14);
  if (period === 'quarterly') return addMonthsDate(d, 3);
  if (period === 'yearly') return addMonthsDate(d, 12);
  return addMonthsDate(d, 1);
}

/* ---------- dług na koncie ---------- */
export function debtView(txs, accounts, today) {
  const acc = accounts.filter(a => a.anchor);
  if (!acc.length) return null;
  const first = txs.reduce((m, t) => (t.date < m ? t.date : m), '9999'), last = acc.map(a => a.anchor.date).sort().pop();
  const months = []; for (let m = monthKey(first); m <= monthKey(last); m = addMonths(m, 1)) months.push(m);
  const series = months.map(mk => {
    const end = mk === monthKey(last) ? last : `${mk}-${dim(mk)}`;
    return { mk, bal: r0(sum(acc.map(a => { const exact = (a.bals || []).find(b => monthKey(b.date) === mk && b.date <= a.anchor.date); return exact ? exact.v : balanceAt(txs, a.id, a.anchor, end > a.anchor.date ? a.anchor.date : end); }))) };
  });
  // pierwszy miesiąc bywa niepełny: saldo liczone od początku danych, więc pomijamy go w trendzie
  const costs = months.map(mk => ({ mk, v: r0(sum(txs.filter(t => t.tag === 'Dług' && t.amountPLN < 0 && monthKey(t.date) === mk).map(t => -t.amountPLN))) }));
  const fullCosts = costs.filter(c => c.mk > monthKey(first) && c.mk < monthKey(last));
  const neg = series.filter(s => s.bal < 0);
  const totalCost = sum(costs.map(c => c.v)), avgDebt = neg.length ? -sum(neg.map(s => s.bal)) / neg.length : 0;
  const d3 = series.slice(-4); const delta = d3.length > 1 ? (d3[d3.length - 1].bal - d3[0].bal) / (d3.length - 1) : 0;
  const nowBal = series[series.length - 1].bal;
  return { series, costs, nowBal, totalCost, avgMonthlyCost: fullCosts.length ? sum(fullCosts.map(c => c.v)) / fullCosts.length : 0, avgDebt, delta, active: nowBal < 0 };
}
export function debtProject(nowBal, delta, extra, months = 12) {
  const out = []; let b = nowBal; for (let i = 1; i <= months; i++) { b += delta + extra; out.push(r0(b)); } return out;
}

/* ---------- dlaczego ten miesiąc wyszedł tak ---------- */
export function whyMonth(txs, mk) {
  const prev = fullMonthsBefore(txs, mk, 3);
  if (!prev.length) return null;
  const cur = monthTotals(txs, mk), pt = prev.map(m => monthTotals(txs, m));
  const avg = k => sum(pt.map(p => k(p))) / pt.length;
  const cats = Object.keys({ ...cur.byCat, ...Object.assign({}, ...pt.map(p => p.byCat)) }).map(id => {
    const a = cur.byCat[id] || 0, b = avg(p => p.byCat[id] || 0);
    return { id, name: (CAT[id] || {}).name || id, cur: a, avg: b, diff: a - b };
  }).filter(c => Math.abs(c.diff) >= 50).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  const inMonth = txs.filter(t => !t.internal && !t.pending && monthKey(t.date) === mk && t.amountPLN < 0);
  const seenBefore = new Set(txs.filter(t => prev.includes(monthKey(t.date))).map(t => t.mkey));
  const top = [...inMonth].sort((a, b) => a.amountPLN - b.amountPLN).slice(0, 5).map(t => ({ id: t.id, name: t.name, date: t.date, v: -t.amountPLN, cat: t.cat }));
  const nm = {}; for (const t of inMonth) if (!seenBefore.has(t.mkey)) { const n = nm[t.mkey] || (nm[t.mkey] = { name: t.name, v: 0 }); n.v += -t.amountPLN; }
  const fresh = Object.values(nm).filter(x => x.v >= 100).sort((a, b) => b.v - a.v).slice(0, 4);
  return { mk, prev, spent: cur.spent, avgSpent: avg(p => p.spent), income: cur.income, avgIncome: avg(p => p.income), cats, top, fresh };
}

/* ---------- anomalie ---------- */
export function anomalies(txs, rec, today) {
  const out = [], mk = monthKey(today), recent = dstr(dnum(today) - 45);
  const spend = txs.filter(t => !t.internal && !t.pending && t.amountPLN < 0);
  const nk = t => String(t.rawName || t.merchant || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]+/g, ' ').split(/\s+/).filter(w => w.length > 1).slice(0, 2).join(' ');
  const byKey = new Map(); for (const t of spend) { if (t.cat === 'gotowka' || t.rule?.person) continue; const k = nk(t); if (!k) continue; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(t); }
  for (const [k, arr] of byKey) {
    if (arr.length < 5) continue;
    const last = arr.filter(t => t.date >= recent && t.date <= today); if (!last.length) continue;
    const hist = arr.filter(t => t.date < recent).map(t => -t.amountPLN); if (hist.length < 4) continue;
    const m = median(hist), p95 = [...hist].sort((a, b) => a - b)[Math.floor(hist.length * 0.95)];
    for (const t of last) if (-t.amountPLN > 2.5 * m && -t.amountPLN > 1.25 * p95 && -t.amountPLN - m > 80 && !t.rule?.person) out.push({ type: 'big', rank: 1, id: t.id, title: `${t.name}: ${r0(-t.amountPLN)} zł, zwykle ${r0(m)} zł`, body: `${t.date}. To ${(-t.amountPLN / m).toFixed(1).replace('.', ',')} razy więcej niż mediana z ${hist.length} wcześniejszych płatności.` });
  }
  for (const r of rec) {
    if (r.active && r.count <= 3 && r.last >= recent && r.kind !== 'przelew cykliczny') out.push({ type: 'new', rank: 2, key: r.key, title: `Nowa płatność cykliczna: ${r.name}`, body: `${r.count} płatności, ${r0(r.latest)} zł ${r.periodLabel}. Wychodzi ${r0(r.yearly)} zł rocznie.` });
    if (!r.active && r.kind !== 'przelew cykliczny' && r.last >= dstr(dnum(today) - 100) && r.monthly >= 20) out.push({ type: 'gone', rank: 3, key: r.key, title: `Zniknęła: ${r.name}`, body: `Ostatnia płatność ${r.last}. Jeśli to Twoja decyzja, oszczędzasz ${r0(r.monthly)} zł miesięcznie.` });
  }
  const w = whyMonth(txs, mk);
  if (w) for (const c of w.cats.filter(c => c.diff > 150 && c.avg > 0 && c.cur > 1.4 * c.avg).slice(0, 3)) out.push({ type: 'cat', rank: 2, cat: c.id, title: `${c.name}: ${r0(c.cur)} zł w tym miesiącu`, body: `Średnio z ostatnich ${w.prev.length} mies. wychodziło ${r0(c.avg)} zł, czyli o ${r0(c.diff)} zł mniej.` });
  // podwójne obciążenie: ta sama kwota, ten sam sprzedawca, ten sam dzień
  const seen = new Map();
  for (const t of spend) { if (t.recKey || t.cat === 'gotowka' || -t.amountPLN < 100) continue; const k = `${t.mkey}|${t.date}|${t.amountPLN}`; const p = seen.get(k); if (p && t.date >= recent) out.push({ type: 'dup', rank: 1, id: t.id, title: `Podwójne obciążenie? ${t.name} ${r0(-t.amountPLN)} zł`, body: `Dwie takie same płatności ${t.date}.` }); seen.set(k, t); }
  const uniq = new Set(); return out.filter(o => !uniq.has(o.title) && uniq.add(o.title)).sort((a, b) => a.rank - b.rank).slice(0, 12);
}

/* ---------- do sprawdzenia ---------- */
export function inbox(txs) {
  const g = new Map();
  for (const t of txs) {
    if (t.internal || t.pending || t.amountPLN >= 0 || t.cat !== 'inne' || t.tag || t.rule || t.pid) continue;
    const x = g.get(t.mkey) || { key: t.mkey, name: t.name, v: 0, n: 0, big: t }; x.v += -t.amountPLN; x.n++; if (t.amountPLN < x.big.amountPLN) x.big = t; g.set(t.mkey, x);
  }
  return [...g.values()].sort((a, b) => b.v - a.v);
}

/* ---------- podsumowanie roku ---------- */
export function yearSummary(txs, year) {
  const ts = txs.filter(t => !t.internal && !t.pending && t.date.startsWith(String(year)));
  if (!ts.length) return null;
  const months = [...new Set(ts.map(t => monthKey(t.date)))].sort();
  const per = months.map(mk => ({ mk, ...monthTotals(txs, mk) }));
  const full = per.filter(m => m.mk > monthKey(ts.reduce((a, t) => (t.date < a ? t.date : a), '9999')) );
  const income = sum(per.map(m => m.income)), irregular = sum(per.map(m => m.irregular)), spent = sum(per.map(m => m.spent));
  const byCat = {}; for (const m of per) for (const [k, v] of Object.entries(m.byCat)) byCat[k] = (byCat[k] || 0) + v;
  const cats = Object.entries(byCat).filter(([, v]) => v > 0).map(([id, v]) => ({ id, name: (CAT[id] || {}).name || id, v })).sort((a, b) => b.v - a.v);
  const merch = {}; for (const t of ts) if (t.amountPLN < 0) { const m = merch[t.mkey] || (merch[t.mkey] = { name: t.name, v: 0, n: 0 }); m.v += -t.amountPLN; m.n++; }
  const top = Object.values(merch).sort((a, b) => b.v - a.v).slice(0, 8);
  const tax = sum(ts.filter(t => t.amountPLN < 0 && t.name === 'Podatki i urzędy').map(t => -t.amountPLN));
  const debtCost = sum(ts.filter(t => t.tag === 'Dług' && t.amountPLN < 0).map(t => -t.amountPLN));
  const spendMonths = per.filter(m => full.includes(m));
  const best = spendMonths.length ? spendMonths.reduce((a, m) => (m.spent < a.spent ? m : a)) : null, worst = spendMonths.length ? spendMonths.reduce((a, m) => (m.spent > a.spent ? m : a)) : null;
  return { year, months: months.length, per, income, irregular, spent, net: income + irregular - spent, rate: income > 0 ? (income + irregular - spent) / (income + irregular) : 0, cats, top, tax, debtCost, best, worst, count: ts.length };
}

/* ---------- ceny produktów z paragonów ---------- */
const prodKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[0-9]+([,.][0-9]+)?\s?(G|KG|ML|L|SZT|X)?\b/g, ' ').replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim();
export function productPrices(log) {
  const g = new Map();
  for (const rc of log || []) for (const it of rc.items || []) {
    if (!(it.amount > 0)) continue; const k = prodKey(it.name); if (k.length < 3) continue;
    const a = g.get(k) || { key: k, name: it.name, obs: [] }; a.obs.push({ date: rc.date, store: rc.merchant, price: it.amount }); g.set(k, a);
  }
  return [...g.values()].filter(p => p.obs.length >= 2).map(p => {
    p.obs.sort((a, b) => (a.date < b.date ? -1 : 1)); const first = p.obs[0], last = p.obs[p.obs.length - 1], min = p.obs.reduce((m, o) => (o.price < m.price ? o : m));
    return { key: p.key, name: p.name, n: p.obs.length, first, last, min, change: last.price - first.price, pct: first.price ? (last.price - first.price) / first.price : 0 };
  }).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

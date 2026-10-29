import { setRecIgnore, recBase } from './engine.js';
import { forecast, debtView, debtProject, whyMonth, anomalies, inbox, yearSummary, productPrices } from './insight.js';
import { narrate } from './narrate.js';
import { fmtInt, setUserRules, normText, CATS, CAT, analyze, budgetState, insights, suggestPlan, monthTotals, monthKey, addMonths, dnum, plDate, money } from './engine.js';
import { demoData, DEMO_ACCOUNTS } from './demo.js';
import { applyPeople, personCandidates, personStats, ROLES, normName } from './people.js';
import { scanReceipt, splitByCategory } from './receipt.js';
import { decodeBuffer, importFiles, findDuplicates, FIELDS } from './parsers.js';

/* ---------- pomocnicze ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => fmtInt(n);
const sum = a => a.reduce((x, y) => x + y, 0);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const MSHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const mName = mk => `${MONTHS[+mk.slice(5, 7) - 1]} ${mk.slice(0, 4)}`;
const PN = { ja: 'Ja', partnerka: 'Partnerka' };
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const TODAY = new URLSearchParams(location.search).get('today') || localToday();
const I = {
  dzis: '<circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M8.5 20.2A8 8 0 0 1 4 13"/>',
  wydatki: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  stale: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  warn: '<path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  good: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>',
  pen: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3"/>',
  analiza: '<path d="M3 17l5-5 4 4 8-9M15 7h5v5"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  gotowka: '<path d="M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16 14.5h.01"/>',
};
const svg = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

/* ---------- stan ---------- */
const KEY = 'budzet.v1';
const fresh = () => ({ v: 1, mode: 'demo', accounts: [], raw: [], overrides: {}, plan: {}, savings: 1500, cancel: {}, cashLog: [], cash: {}, receipts: {}, people: [], rules: [], receiptLog: [], debtExtra: 0, recIgnore: [] });
let S = (() => { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && j.v === 1) { j.cashLog = j.cashLog || []; j.cash = j.cash || {}; j.receipts = j.receipts || {}; j.people = j.people || []; j.rules = j.rules || []; j.receiptLog = j.receiptLog || []; j.recIgnore = j.recIgnore || []; return j; } } catch { } return fresh(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } };
const accounts = () => (S.mode === 'demo' ? DEMO_ACCOUNTS : S.accounts);
const accName = id => (accounts().find(a => a.id === id) || { name: id }).name;

let TX = [], REC = [], BS, INS;
function rebuild() {
  TX = (S.mode === 'demo' ? demoData(TODAY) : S.raw).map(t => ({ ...t, rawName: t.merchant }));
  if (S.mode !== 'demo') applyPeople(TX, S.people);
  setUserRules(S.mode === 'demo' ? [] : S.rules);
  setRecIgnore(S.mode === 'demo' ? [] : S.recIgnore);
  REC = analyze(TX, S.overrides, TODAY, accounts().map(a => a.owner).filter(Boolean));
  BS = budgetState(TX, REC, TODAY, S.savings);
  INS = insights(TX, REC, TODAY, BS);
}
const monthsWithData = () => [...new Set(TX.map(t => monthKey(t.date)))].sort();

const U = { mk: TODAY.slice(0, 7), who: 'all', cat: null, limit: 50 };
let VIEW = (location.hash || '#dzis').slice(1);

/* ---------- animacje ---------- */
function count(el, to) {
  const t0 = performance.now(), dur = 1000;
  const f = now => { const p = Math.min(1, (now - t0) / dur), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); el.textContent = nf(to * e); if (p < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function mount(first) {
  const root = $('#view'), fin = [];
  root.querySelectorAll('[data-count]').forEach(el => { const to = +el.dataset.count; if (!first || REDUCED) el.textContent = nf(to); else count(el, to); });
  root.querySelectorAll('[data-dash]').forEach(el => fin.push(() => (el.style.strokeDasharray = el.dataset.dash)));
  root.querySelectorAll('[data-w]').forEach(el => fin.push(() => (el.style.width = el.dataset.w)));
  root.querySelectorAll('[data-h]').forEach(el => fin.push(() => (el.style.height = el.dataset.h)));
  root.querySelectorAll('[data-fg]').forEach(el => fin.push(() => (el.style.flexGrow = el.dataset.fg)));
  if (first && !REDUCED) requestAnimationFrame(() => requestAnimationFrame(() => fin.forEach(f => f())));
  else { root.classList.add('notrans'); fin.forEach(f => f()); void root.offsetHeight; requestAnimationFrame(() => root.classList.remove('notrans')); }
}

/* ---------- widoki ---------- */
const letter = n => esc((n || '?').trim().charAt(0).toUpperCase());
const dots = list => (list || []).map(p => `<i class="dot ${esc(p)}" title="${esc(PN[p] || p)}"></i>`).join('');

function empty(title, text, btn) {
  return `<div class="card empty"><b>${esc(title)}</b>${esc(text)}${btn ? `<button class="btn" style="margin-top:18px" data-act="add">${esc(btn)}</button>` : ''}</div>`;
}
function head(title, sub) {
  return `<div class="top"><div><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
  <div style="display:flex;gap:8px;align-items:center">${S.mode === 'demo' ? '<span class="pill demo">Demo</span>' : ''}<button class="iconbtn" data-act="nav" data-to="analiza" aria-label="Analiza">${svg(I.analiza)}</button><button class="iconbtn" data-act="settings" aria-label="Ustawienia">${svg(I.gear)}</button></div></div>`;
}
function insCard(i) {
  return `<button class="ins ${i.tone}" data-act="nav" data-to="${i.go}"><span class="g">${svg(I[i.tone])}</span><span style="flex:1"><b>${esc(i.title)}</b><span>${esc(i.body)}</span></span></button>`;
}

function vDzis() {
  const date = new Date(TODAY + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!TX.length) return head('Dziś', date) + empty('Zacznij od wyciągu', 'Zaimportuj plik CSV z banku, a Budżet policzy stałe opłaty, subskrypcje i bezpieczną kwotę na każdy dzień.', 'Importuj wyciąg');
  const b = BS, L = 465, over = b.leftToday < 0;
  const frac = b.budget > 0 ? Math.max(0, Math.min(1, (b.budget - b.spent) / b.budget)) : 0;
  const up = REC.filter(r => r.active && dnum(r.next) >= dnum(TODAY) && dnum(r.next) - dnum(TODAY) <= 10).sort((a, c) => (a.next < c.next ? -1 : 1));
  const who = { ja: 0, partnerka: 0 };
  for (const t of TX) if (!t.internal && !t.recKey && t.amountPLN < 0 && monthKey(t.date) === b.mk) who[t.person] = (who[t.person] || 0) + -t.amountPLN;
  const wt = who.ja + who.partnerka;
  return head('Dziś', date) + `
  <div class="card hero">
    <div class="ring ${over ? 'bad' : ''}">
      <svg viewBox="0 0 236 236"><defs><linearGradient id="gArc" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${over ? '#ff6b5e' : '#0fa37a'}"/><stop offset=".55" stop-color="${over ? '#ff8f6e' : '#2ee6a6'}"/><stop offset="1" stop-color="${over ? '#ffd0c0' : '#b8ffe4'}"/></linearGradient></defs>
        <circle class="track" cx="118" cy="118" r="100" fill="none" stroke-width="14" stroke-linecap="round" stroke-dasharray="${L} 628"/>
        <circle class="arc" cx="118" cy="118" r="100" fill="none" stroke="url(#gArc)" stroke-width="14" stroke-linecap="round" style="stroke-dasharray:0 628" data-dash="${(L * frac).toFixed(1)} 628"/></svg>
      <div class="mid"><div class="lbl">${over ? 'Ponad limit dziś' : 'Do wydania dziś'}</div>
        <div class="big num">${over ? '−' : ''}<span data-count="${Math.abs(b.leftToday)}">0</span><small>zł</small></div>
        <div class="cap">${b.spentToday > 0 ? `z dziennego limitu ${money(b.dailyLimit)}` : 'dzienny limit do końca miesiąca'}</div></div>
    </div>
    <div class="stats">
      <div class="stat"><div class="v num">${money(b.spent)}</div><div class="l">wydano w miesiącu</div></div>
      <div class="stat"><div class="v num">${money(b.budget)}</div><div class="l">plan na życie</div></div>
      <div class="stat"><div class="v num">${b.daysLeft}</div><div class="l">${b.daysLeft === 1 ? 'dzień do końca' : 'dni do końca'}</div></div>
    </div>
    <div class="small muted" style="margin-top:12px">Plan = wpływy ${money(b.income)} − stałe ${money(b.fixed)} − oszczędności ${money(b.savings)}</div>
  </div>
  ${S.mode !== 'demo' && b.prevCount < 2 ? `<button class="ins" data-act="add"><span class="g">${svg(I.info)}</span><span style="flex:1"><b>Za mało historii na dokładny limit</b><span>Zaimportuj wyciągi z 3 miesięcy, a wykryję stałe opłaty i policzę limit dokładnie.</span></span></button>` : ''}
  ${S.mode === 'demo' ? `<button class="ins" data-act="add"><span class="g">${svg(I.file)}</span><span style="flex:1"><b>To dane demo</b><span>Zaimportuj wyciąg z banku, żeby zobaczyć swoje liczby.</span></span></button>` : ''}
  ${INS.length ? `<div class="h2">Warto sprawdzić</div>${INS.slice(0, 3).map(insCard).join('')}` : ''}
  ${up.length ? `<div class="h2">Najbliższe opłaty<b class="num">${money(sum(up.map(r => r.latest)))}</b></div>
  <div class="card flat">${up.slice(0, 5).map(r => `<div class="row"><div class="ico" style="background:${CAT[r.cat].color}">${letter(r.name)}</div><div class="mid"><div class="t">${esc(r.name)}</div><div class="s">${dnum(r.next) === dnum(TODAY) ? 'dziś' : plDate(r.next)} ${dots(r.persons)}</div></div><div class="amt num">${money(r.latest)}</div></div>`).join('')}</div>` : ''}
  ${wt > 0 ? `<div class="h2">Codzienne wydatki, kto ile</div><div class="card flat"><div class="split"><i class="ja" data-fg="${who.ja.toFixed(0)}"></i><i class="partnerka" data-fg="${who.partnerka.toFixed(0)}"></i></div>
  <div style="display:flex;justify-content:space-between"><span><i class="dot ja"></i> Ja <b class="num">${money(who.ja)}</b></span><span><b class="num">${money(who.partnerka)}</b> Partnerka <i class="dot partnerka"></i></span></div></div>` : ''}`;
}

function sumSpent(mk, who) { return sum(TX.filter(t => !t.internal && t.amountPLN < 0 && monthKey(t.date) === mk && (who === 'all' || t.person === who)).map(t => -t.amountPLN)); }

function vWydatki() {
  if (!TX.length) return head('Wydatki') + empty('Brak transakcji', 'Zaimportuj wyciąg, a zobaczysz podział na kategorie.', 'Importuj wyciąg');
  const months = monthsWithData().slice(-6);
  if (!months.includes(U.mk)) U.mk = months[months.length - 1];
  const totals = months.map(m => ({ m, v: sumSpent(m, U.who) })), max = Math.max(...totals.map(t => t.v), 1);
  const all = TX.filter(t => monthKey(t.date) === U.mk && (U.who === 'all' || t.person === U.who));
  const rows = all.filter(t => !t.internal), spend = rows.filter(t => t.amountPLN < 0), inc = sum(rows.filter(t => t.amountPLN > 0 && !t.irr && !t.offset).map(t => t.amountPLN));
  const transfers = all.filter(t => t.internal && t.amountPLN < 0);
  const byCat = {}; for (const t of spend) byCat[t.cat] = (byCat[t.cat] || 0) + -t.amountPLN;
  for (const t of rows) if (t.offset) byCat[t.cat] = (byCat[t.cat] || 0) - t.amountPLN;
  const cats = CATS.filter(c => byCat[c.id] > 0).sort((a, c) => byCat[c.id] - byCat[a.id]);
  const total = sum(cats.map(c => byCat[c.id]));
  const R = 74, C = 2 * Math.PI * R; let acc = 0;
  const segs = cats.map(c => {
    const share = byCat[c.id] / total, len = Math.max(0.5, C * share - 3), st = acc; acc += C * share;
    const dim = U.cat && U.cat !== c.id;
    return `<circle cx="95" cy="95" r="${R}" fill="none" stroke="${c.color}" stroke-width="${U.cat === c.id ? 26 : 22}" style="stroke-dasharray:0 ${C.toFixed(1)};stroke-dashoffset:${(-st).toFixed(1)};opacity:${dim ? .22 : 1}" data-dash="${len.toFixed(1)} ${C.toFixed(1)}"/>`;
  }).join('');
  const sel = U.cat && CAT[U.cat];
  const unk = {};
  for (const t of spend) if (t.cat === 'inne' && !t.tag && !t.pending) { const u = unk[t.mkey] || (unk[t.mkey] = { name: t.name, v: 0, n: 0, big: t }); u.v += -t.amountPLN; u.n++; if (t.amountPLN < u.big.amountPLN) u.big = t; }
  const unkList = Object.values(unk).sort((a, b) => b.v - a.v).slice(0, 4);
  const unkTotal = sum(Object.values(unk).map(u => u.v));
  const list = rows.filter(t => !U.cat || t.cat === U.cat).sort((a, c) => (a.date < c.date ? 1 : a.date > c.date ? -1 : 0));
  const shown = list.slice(0, U.limit);
  const groups = []; for (const t of shown) { const g = groups[groups.length - 1]; if (g && g.d === t.date) g.items.push(t); else groups.push({ d: t.date, items: [t] }); }
  const dayLbl = d => { const n = dnum(TODAY) - dnum(d); return n === 0 ? 'Dziś' : n === 1 ? 'Wczoraj' : plDate(d); };
  return head('Wydatki') + `
  <div class="card">
    <div class="months">${totals.map(t => `<button class="${t.m === U.mk ? 'on' : ''}" data-act="month" data-m="${t.m}"><span class="val num">${t.m === U.mk ? nf(t.v) : ''}</span><span class="b" style="height:0" data-h="${Math.max(4, (t.v / max) * 78).toFixed(0)}px"></span><em>${MSHORT[+t.m.slice(5, 7) - 1]}</em></button>`).join('')}</div>
  </div>
  <div class="chips"><button class="chip ${U.who === 'all' ? 'on' : ''}" data-act="who" data-w="all">Razem</button><button class="chip ${U.who === 'ja' ? 'on' : ''}" data-act="who" data-w="ja"><i class="dot ja"></i>Ja</button><button class="chip ${U.who === 'partnerka' ? 'on' : ''}" data-act="who" data-w="partnerka"><i class="dot partnerka"></i>Partnerka</button></div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font:800 18px var(--f-num)">${mName(U.mk)}</b><span class="small muted">wpływy <b class="num pos">${money(inc)}</b></span></div>
    ${total ? `<div class="donut"><svg viewBox="0 0 190 190"><circle cx="95" cy="95" r="${R}" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="22"/>${segs}</svg>
      <div class="mid"><div class="v">${money(sel ? byCat[sel.id] || 0 : total)}</div><div class="l">${sel ? esc(sel.name) : 'wydano'}</div></div></div>
    ${cats.map(c => `<button class="cat ${U.cat === c.id ? 'sel' : U.cat ? 'dim' : ''}" data-act="cat" data-c="${c.id}"><span class="sw" style="background:${c.color}"></span><span class="nm"><div><span>${esc(c.name)}</span><span class="num">${money(byCat[c.id])}</span></div><div class="bar"><i style="background:${c.color}" data-w="${(byCat[c.id] / byCat[cats[0].id] * 100).toFixed(1)}%"></i></div></span></button>`).join('')}` : '<div class="empty">Brak wydatków w tym miesiącu.</div>'}
    ${transfers.length ? `<div class="small muted" style="margin-top:10px">Pominięto ${transfers.length} ${transfers.length === 1 ? 'przelew' : 'przelewy'} między Waszymi kontami (${money(sum(transfers.map(t => -t.amountPLN)))}), bo to nie są wydatki.</div>` : ''}
  </div>
  ${!U.cat && unkList.length && unkTotal > 0.1 * total ? `<div class="h2">Przypisz kategorie<b class="num">${money(unkTotal)} bez kategorii</b></div><div class="card flat">${unkList.map(u => `<button class="row" data-act="tx" data-id="${esc(u.big.id)}"><div class="ico" style="background:var(--s3);color:var(--tx2)">?</div><div class="mid"><div class="t">${esc(u.name)}</div><div class="s">${u.n} ${u.n === 1 ? 'płatność' : 'płatności'} w tym miesiącu</div></div><div class="amt num">${money(u.v)}</div></button>`).join('')}</div>` : ''}
  ${list.length ? `<div class="h2">${sel ? esc(sel.name) : 'Transakcje'}<b>${list.length}</b></div><div>${groups.map(g => `<div class="day"><span>${dayLbl(g.d)}</span></div><div class="card flat" style="margin-bottom:0;padding-top:4px;padding-bottom:4px">${g.items.map(t => `<button class="row" data-act="tx" data-id="${esc(t.id)}"><div class="ico" style="background:${CAT[t.cat].color}">${letter(t.name)}</div><div class="mid"><div class="t">${esc(t.name)}</div><div class="s">${esc(accName(t.account))} ${dots([t.person])}${t.pending ? ' · <span class="badge">w toku</span>' : ''}${t.irr ? ' · <span class="badge">nieregularny</span>' : ''}${t.offset ? ' · <span class="badge">wypłata</span>' : ''}${t.currency !== 'PLN' ? ` · ${esc(t.currency)}` : ''}</div></div><div class="amt num ${t.amountPLN > 0 ? 'in' : ''}">${t.amountPLN > 0 ? '+' : '−'}${money(t.amountPLN, 2)}</div></button>`).join('')}</div>`).join('')}</div>
  ${list.length > shown.length ? `<button class="btn ghost" style="margin-top:14px" data-act="more">Pokaż więcej (${list.length - shown.length})</button>` : ''}` : ''}`;
}

function vStale() {
  if (!TX.length) return head('Stałe') + empty('Brak danych', 'Importuj wyciąg z co najmniej 3 miesięcy, żeby wykryć subskrypcje i stałe opłaty.', 'Importuj wyciąg');
  const act = REC.filter(r => r.active), ended = REC.filter(r => !r.active);
  const subs = act.filter(r => r.kind === 'subskrypcja'), bills = act.filter(r => r.kind === 'stała opłata'), misc = act.filter(r => r.kind === 'płatność cykliczna' || r.kind === 'przelew cykliczny');
  const mSubs = sum(subs.map(r => r.monthly)), mBills = sum(bills.map(r => r.monthly)), mMisc = sum(misc.map(r => r.monthly)), tot = mSubs + mBills + mMisc;
  const marked = act.filter(r => S.cancel[r.key]), saveY = sum(marked.map(r => r.yearly));
  const row = r => `<button class="row" data-act="rec" data-k="${esc(r.key)}"><div class="ico" style="background:${CAT[r.cat].color}">${letter(r.name)}</div><div class="mid"><div class="t">${esc(r.name)} ${r.priceChange ? `<span class="badge warn">▲ ${money(r.priceChange.to - r.priceChange.from)}</span>` : ''}${S.cancel[r.key] ? '<span class="badge acc">do rezygnacji</span>' : ''}</div><div class="s">${esc(r.periodLabel)} · ${r.late ? `<span class="badge warn">nie pobrano jeszcze (było ${plDate(r.next)})</span>` : r.active ? 'następna ' + plDate(r.next) : 'ostatnio ' + plDate(r.last)} ${dots(r.persons)}</div></div><div class="amt num">${money(r.monthly)}${r.variable ? '<small>średnio</small>' : r.period !== 'monthly' ? `<small>${money(r.latest)} ${esc(r.periodLabel)}</small>` : ''}</div></button>`;
  return head('Stałe', 'Subskrypcje i opłaty cykliczne') + `
  <div class="card hero" style="padding-bottom:16px">
    <div class="muted small">Stałe koszty miesięcznie</div>
    <div class="num" style="font-size:44px;font-weight:800;margin:4px 0 2px;letter-spacing:-.04em"><span data-count="${tot}">0</span><small style="font-size:20px;color:var(--tx2);margin-left:4px">zł</small></div>
    <div class="muted small">${money(tot * 12)} rocznie · ${BS.income ? Math.round(tot / BS.income * 100) + '% wpływów' : ''}</div>
    <div class="split" style="margin-top:16px"><i style="background:var(--acc);flex-grow:0" data-fg="${mSubs.toFixed(0)}"></i><i style="background:var(--s3);flex-grow:0" data-fg="${(mBills + mMisc).toFixed(0)}"></i></div>
    <div style="display:flex;justify-content:space-between;font-size:13px"><span><i class="dot" style="background:var(--acc)"></i> Subskrypcje <b class="num">${money(mSubs)}</b></span><span>Rachunki i inne <b class="num">${money(mBills + mMisc)}</b> <i class="dot" style="background:var(--s3)"></i></span></div>
    ${saveY > 0 ? `<div class="badge acc" style="margin-top:14px;display:inline-block;padding:6px 12px">Rezygnacja z zaznaczonych: −${money(saveY)} rocznie</div>` : ''}
  </div>
  ${INS.filter(i => i.go === 'stale').map(insCard).join('')}
  ${subs.length ? `<div class="h2">Subskrypcje<b class="num">${subs.length}</b></div><div class="card flat">${subs.map(row).join('')}</div>` : ''}
  ${bills.length ? `<div class="h2">Rachunki i stałe opłaty<b class="num">${bills.length}</b></div><div class="card flat">${bills.map(row).join('')}</div>` : ''}
  ${misc.length ? `<div class="h2">Cykliczne, do sprawdzenia<b class="num">${misc.length}</b></div><div class="card flat">${misc.map(row).join('')}</div><div class="small muted" style="margin:-4px 4px 12px">Te płatności wracają regularnie, ale nie wiem, za co. Dotknij, żeby zobaczyć historię.</div>` : ''}
  ${ended.length ? `<div class="h2">Zakończone (brak płatności w całym miesiącu)</div><div class="card flat" style="opacity:.7">${ended.map(row).join('')}</div>` : ''}
  <div class="small muted" style="margin:6px 4px 0">Wykrywam płatności tego samego sprzedawcy, które wracają regularnie. Dotknij pozycji, żeby zobaczyć historię.</div>`;
}

/* ---------- plan ---------- */
const planMonth = () => addMonths(TODAY.slice(0, 7), 1);
function planData() {
  const mk = planMonth(), sug = suggestPlan(TX, mk, REC, S.savings), saved = S.plan[mk];
  return { mk, sug, limits: saved ? saved.limits : sug.limits, savings: saved ? saved.savings : S.savings, income: sug.income || BS.curIncome, saved: !!saved };
}
function vPlan() {
  if (!TX.length) return head('Plan') + empty('Brak historii', 'Plan powstaje ze średnich z ostatnich miesięcy. Importuj wyciąg.', 'Importuj wyciąg');
  const P = planData(), fixed = P.sug.fixed, pool = P.income - fixed - P.savings;
  const vc = CATS.filter(c => c.variable), alloc = sum(vc.map(c => P.limits[c.id] || 0)), left = pool - alloc;
  const prev = P.sug.prevMonths;
  const hist = {};
  for (const c of vc) hist[c.id] = prev.length ? sum(prev.map(m => sum(TX.filter(t => !t.internal && !t.recKey && t.amountPLN < 0 && t.cat === c.id && monthKey(t.date) === m).map(t => -t.amountPLN)))) / prev.length : 0;
  const denom = Math.max(pool, alloc, 1);
  return head('Plan', mName(P.mk)) + `
  <div class="card">
    <div class="muted small">Do rozdysponowania na życie</div>
    <div class="num" style="font-size:40px;font-weight:800;letter-spacing:-.04em;margin:2px 0 12px">${money(Math.max(pool, 0))}</div>
    <div class="split" style="height:12px">${vc.filter(c => P.limits[c.id] > 0).map(c => `<i style="background:${c.color}" data-fg="${P.limits[c.id]}"></i>`).join('')}<i style="background:${left < 0 ? 'var(--warn)' : 'rgba(255,255,255,.07)'}" data-fg="${Math.abs(left).toFixed(0)}"></i></div>
    <div style="display:flex;justify-content:space-between;font-size:13px"><span class="muted">Rozdysponowano <b class="num" style="color:var(--tx)">${money(alloc)}</b></span><span class="num ${left < 0 ? 'neg' : 'pos'}"><b>${left < 0 ? 'Brakuje ' : 'Wolne '}${money(Math.abs(left))}</b></span></div>
    <div class="flow" style="margin-top:14px">
      <div class="r"><span class="muted">Wpływy (średnia z ${prev.length || 1} mies.)</span><b class="num">${money(P.income)}</b></div>
      <div class="r"><span class="muted">Stałe opłaty i subskrypcje</span><b class="num neg">−${money(fixed)}</b></div>
      <div class="r"><span class="muted">Oszczędności</span><span class="step"><button data-act="psave" data-d="-100" aria-label="Mniej">−</button><span class="n">${money(P.savings)}</span><button data-act="psave" data-d="100" aria-label="Więcej">+</button></span></div>
      <div class="r tot"><span>Na życie</span><span class="num">${money(pool)}</span></div>
    </div>
  </div>
  <div class="h2">Limity na kategorie</div>
  <div class="card flat">${vc.map(c => `<div class="row"><span class="dot" style="background:${c.color};width:10px;height:10px;border-radius:3px"></span><div class="mid"><div class="t">${esc(c.name)}</div><div class="s">${prev.length ? `średnio ${money(hist[c.id])} / mies.` : 'brak historii'}</div></div><span class="step"><button data-act="plimit" data-c="${c.id}" data-d="-50" aria-label="Mniej">−</button><span class="n">${nf(P.limits[c.id] || 0)}</span><button data-act="plimit" data-c="${c.id}" data-d="50" aria-label="Więcej">+</button></span></div>`).join('')}</div>
  <div class="small muted" style="margin:0 4px 14px">Propozycja to średnia z ostatnich ${prev.length || 'dostępnych'} miesięcy, zaokrąglona w górę do 10 zł. Zmień ją, jak chcecie.</div>
  <div style="display:grid;gap:10px">
    <button class="btn" data-act="pconfirm">${P.saved ? 'Plan zapisany ✓' : 'Zatwierdź plan'}</button>
    <button class="btn ghost" data-act="preset">Przywróć propozycję</button>
  </div>`;
}

const VIEWS = { analiza: vAnaliza, dzis: vDzis, wydatki: vWydatki, gotowka: vGotowka, stale: vStale, plan: vPlan };
const TABS = [['dzis', 'Dziś'], ['wydatki', 'Wydatki'], ['gotowka', 'Gotówka'], ['add', ''], ['stale', 'Stałe'], ['plan', 'Plan']];

function renderTabs() {
  $('#tabs').innerHTML = '<div class="in">' + TABS.map(([id, l]) => id === 'add'
    ? `<button class="plus" data-act="add" aria-label="Dodaj">${svg(I.plus, 2.4)}</button>`
    : `<button class="${VIEW === id ? 'on' : ''}" data-act="nav" data-to="${id}" ${VIEW === id ? 'aria-current="page"' : ''}>${svg(I[id])}<span>${l}</span></button>`).join('') + '</div>';
}
function render(first = false) {
  if (!VIEWS[VIEW]) VIEW = 'dzis';
  const v = $('#view'), st = scrollY;
  v.className = first ? 'enter' : '';
  v.innerHTML = VIEWS[VIEW]();
  scrollTo(0, first ? 0 : st);
  mount(first);
  renderTabs();
}

/* ---------- gotówka (portfel) ----------
   Wypłata z bankomatu jest wydatkiem w budżecie (tak jak w banku). Wpisy „z portfela” rozbijają tę gotówkę
   na kategorie, ale nie wchodzą drugi raz do sum budżetu. */
function cashState() {
  if (!S.cash) S.cash = {};
  if (!S.cash.since) { S.cash.since = TODAY; S.cash.adj = 0; save(); }
  const since = S.cash.since, adj = S.cash.adj || 0;
  const wd = TX.filter(t => t.cat === 'gotowka' && t.amountPLN < 0 && !t.internal);
  const log = S.cashLog || [];
  const wIn = sum(wd.filter(t => t.date >= since).map(t => -t.amountPLN)), lIn = sum(log.filter(l => l.date >= since).map(l => l.amount));
  return { since, wd, log, balance: adj + wIn - lIn };
}
function vGotowka() {
  const C = cashState(), mk = U.mk;
  const wdM = C.wd.filter(t => monthKey(t.date) === mk).sort((a, b) => (a.date < b.date ? 1 : -1)), logM = C.log.filter(l => monthKey(l.date) === mk).sort((a, b) => (a.date < b.date ? 1 : -1));
  const wSum = sum(wdM.map(t => -t.amountPLN)), lSum = sum(logM.map(l => l.amount)), gap = wSum - lSum;
  const byCat = {}; for (const l of logM) byCat[l.cat] = (byCat[l.cat] || 0) + l.amount;
  const cats = CATS.filter(c => byCat[c.id] > 0).sort((a, c) => byCat[c.id] - byCat[a.id]);
  const none = !C.wd.length && !C.log.length;
  const ms = monthsWithData().slice(-6);
  return head('Gotówka', mName(mk)) + `
  <div class="card hero" style="padding-bottom:16px">
    <div class="muted small">W portfelu (szacunek)</div>
    <div class="num" style="font-size:44px;font-weight:800;margin:4px 0 2px;letter-spacing:-.04em"><span data-count="${Math.round(C.balance)}">0</span><small style="font-size:20px;color:var(--tx2);margin-left:4px">zł</small></div>
    <div class="muted small">Liczone od ${plDate(C.since)} ${C.since.slice(0, 4)}: wypłaty minus wpisy z portfela</div>
    ${S.cash.adj ? '' : '<div class="small" style="margin-top:8px;color:var(--pa)">Dotknij „Policzyłem”, żeby ustawić, ile gotówki masz teraz.</div>'}
    <div style="display:flex;gap:10px;margin-top:14px"><button class="btn" style="flex:1" data-act="cashadd">Wydałem z portfela</button><button class="btn ghost" style="flex:1" data-act="cashcal">Policzyłem</button></div>
  </div>
  ${ms.length > 1 ? `<div class="chips">${ms.map(m => `<button class="chip ${m === mk ? 'on' : ''}" data-act="month" data-m="${m}">${MSHORT[+m.slice(5, 7) - 1]}</button>`).join('')}</div>` : ''}
  ${none ? empty('Brak wypłat', 'Wypłaty z bankomatu pojawią się tu same po zaimportowaniu wyciągu. Wydatki gotówką dopisujesz przyciskiem powyżej.') : `
  <div class="card">
    <div class="kv"><span class="muted">Wypłacono w miesiącu</span><b class="num">${money(wSum)}</b></div>
    <div class="kv"><span class="muted">Opisane wydatki</span><b class="num">${money(lSum)}</b></div>
    <div class="kv"><span class="muted">Bez opisu</span><b class="num ${gap > 0.5 * wSum && wSum ? 'neg' : ''}">${money(Math.max(0, gap))}</b></div>
    ${wSum ? `<div class="split" style="margin-top:12px"><i style="background:var(--acc);flex-grow:0" data-fg="${Math.min(lSum, wSum).toFixed(0)}"></i><i style="background:var(--s3);flex-grow:0" data-fg="${Math.max(0, gap).toFixed(0)}"></i></div>` : ''}
    <div class="small muted" style="margin-top:8px">Wypłata liczy się do budżetu w dniu pobrania z bankomatu. Wpisy z portfela tylko pokazują, na co poszła gotówka.</div>
  </div>
  ${cats.length ? `<div class="h2">Na co poszła gotówka</div><div class="card flat">${cats.map(c => `<div class="row"><div class="ico" style="background:${c.color}">${letter(c.name)}</div><div class="mid"><div class="t">${esc(c.name)}</div></div><div class="amt">${money(byCat[c.id])}</div></div>`).join('')}</div>` : ''}
  ${logM.length ? `<div class="h2">Wydatki z portfela<b class="num">${logM.length}</b></div><div class="card flat">${logM.map(l => `<button class="row" data-act="cashrow" data-id="${esc(l.id)}"><div class="ico" style="background:${CAT[l.cat] ? CAT[l.cat].color : 'var(--s3)'}">${letter(l.name)}</div><div class="mid"><div class="t">${esc(l.name)}</div><div class="s">${plDate(l.date)} · ${esc(CAT[l.cat] ? CAT[l.cat].name : '')}</div></div><div class="amt">−${money(l.amount)}</div></button>`).join('')}</div>` : ''}
  ${wdM.length ? `<div class="h2">Wypłaty z bankomatu<b class="num">${wdM.length}</b></div><div class="card flat">${wdM.map(t => `<div class="row"><div class="ico" style="background:${CAT.gotowka.color}">${svg(I.gotowka)}</div><div class="mid"><div class="t">${esc(t.merchant || 'Bankomat')}</div><div class="s">${plDate(t.date)}</div></div><div class="amt">${money(-t.amountPLN)}</div></div>`).join('')}</div>` : ''}`}`;
}
function sCashAdd() {
  openSheet(`<h3>Wydałem z portfela</h3><div class="muted small">Gotówka z wcześniejszej wypłaty. Nie dolicza się drugi raz do budżetu.</div>
  <label class="field"><span>Kwota (zł)</span><input id="cAmt" inputmode="decimal" placeholder="0,00" autocomplete="off"></label>
  <label class="field"><span>Na co</span><input id="cName" placeholder="np. Targ, parking" autocomplete="off"></label>
  <label class="field"><span>Kategoria</span><select id="cCat">${CATS.filter(c => c.variable && c.id !== 'gotowka').map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
  <label class="field"><span>Data</span><input id="cDate" type="date" value="${TODAY}"></label>
  <button class="btn" style="margin-top:18px" data-act="cashsave">Zapisz</button>`);
}
function sCashCal() {
  const C = cashState();
  openSheet(`<h3>Ile masz w portfelu?</h3><div class="muted small">Wpisz, ile gotówki naprawdę masz. Od teraz liczę od tej kwoty.</div>
  <label class="field"><span>Stan (zł)</span><input id="cBal" inputmode="decimal" value="${Math.max(0, Math.round(C.balance))}" autocomplete="off"></label>
  <button class="btn" style="margin-top:18px" data-act="cashcalsave">Zapisz</button>`);
}

/* ---------- paragon ---------- */
const GKEY = 'budzet.gkey';
const gkey = () => { try { return localStorage.getItem(GKEY) || ''; } catch { return ''; } };
let RC = null;
function sReceipt() {
  if (!gkey()) {
    openSheet(`<h3>Klucz Gemini</h3><div class="muted small">Do odczytu paragonów potrzebny jest darmowy klucz. Wejdź na aistudio.google.com/apikey, utwórz klucz dla tego projektu i wklej go tutaj. Zostaje tylko w tym telefonie, nie trafia do kopii danych.</div>
    <label class="field"><span>Klucz</span><input id="gk" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="AIza…"></label>
    <button class="btn" style="margin-top:18px" data-act="gksave">Zapisz i dalej</button>`); return;
  }
  openSheet(`<h3>Paragon</h3><div class="muted small">Zdjęcie idzie do Google tylko po to, żeby odczytać tekst. Sumy sprawdzam sam i nic nie zapisuję bez Twojego zatwierdzenia.</div>
  <label class="btn" style="margin-top:18px;cursor:pointer">Zrób zdjęcie lub wybierz<input type="file" accept="image/*" data-change="rcfile" style="display:none"></label>`);
}
function renderReceipt() {
  const r = RC; if (!r) return;
  const cats = CATS.filter(c => c.variable && c.id !== 'gotowka');
  const top = splitByCategory(r.items, r.total)[0].cat;
  openSheet(`<h3>Sprawdź paragon</h3>
  <div class="card flat" style="margin-top:10px">${r.items.map(i => `<div class="kv"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.name)}</span><b class="num">${money(i.amount, 2)}</b></div>`).join('') || '<div class="small muted">Nie odczytałem pozycji, zapiszę samą sumę.</div>'}</div>
  <div class="small ${r.matches || !r.items.length ? 'muted' : ''}" style="margin-top:8px;${r.matches || !r.items.length ? '' : 'color:var(--pa)'}">${r.items.length ? (r.matches ? 'Suma pozycji zgadza się z kwotą na paragonie ✓' : `Suma pozycji ${money(r.itemsSum, 2)} nie zgadza się z kwotą ${money(r.total, 2)}. Popraw kwotę, jeśli jest zła.`) : ''}</div>
  <label class="field"><span>Sklep</span><input id="rMer" value="${esc(r.merchant)}" autocomplete="off"></label>
  <label class="field"><span>Kwota do zapłaty (zł)</span><input id="rTot" inputmode="decimal" value="${String(r.total).replace('.', ',')}" autocomplete="off"></label>
  <label class="field"><span>Data</span><input id="rDate" type="date" value="${r.date || TODAY}"></label>
  <label class="field"><span>Kategoria</span><select id="rCat">${cats.map(c => `<option value="${c.id}" ${c.id === top ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
  <label class="field"><span>Zapłacone</span><select id="rSrc"><option value="konto">Kartą lub BLIK-iem (konto)</option><option value="portfel">Gotówką z portfela</option></select></label>
  ${new Set(r.items.map(i => i.category)).size > 1 ? `<label class="field"><span>Podział</span><select id="rSplit"><option value="0">Jedna kategoria</option><option value="1">Wg pozycji</option></select></label>` : ''}
  <div class="small muted" style="margin-top:8px">Jeśli płatność już jest na wyciągu, dopasuję paragon do niej i nie policzę wydatku drugi raz.</div>
  <button class="btn" style="margin-top:18px" data-act="rcsave">Zapisz</button>`);
}
function saveReceipt() {
  const total = parseFloat(String($('#rTot').value).replace(',', '.')), name = $('#rMer').value.trim() || 'Paragon', date = $('#rDate').value || TODAY, cat = $('#rCat').value, src = $('#rSrc').value;
  if (!(total > 0)) { toast('Podaj kwotę'); return; }
  S.receiptLog.push({ id: 'r' + Date.now().toString(36), merchant: name, date, total, items: RC.items });
  const parts = $('#rSplit') && $('#rSplit').value === '1' ? splitByCategory(RC.items, total) : [{ cat, amount: total }];
  if (src === 'portfel') {
    for (const p of parts) S.cashLog.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), date, amount: p.amount, name, cat: p.cat });
    save(); closeSheet(); VIEW = 'gotowka'; location.hash = '#gotowka'; render(true); toast('Zapisano w portfelu'); return;
  }
  const m = S.mode !== 'demo' && TX.find(t => !t.pending && t.amountPLN < 0 && Math.abs(-t.amountPLN - total) < 0.02 && Math.abs(dnum(t.date) - dnum(date)) <= 4 && !S.receipts[t.id]);
  if (m) {
    S.receipts[m.id] = { merchant: name, date, items: RC.items };
    if (parts.length === 1 && m.cat !== parts[0].cat) S.overrides[m.mkey] = parts[0].cat;
    save(); rebuild(); closeSheet(); render(); toast('Dopasowano do płatności z konta'); return;
  }
  if (S.mode === 'demo') { S.mode = 'real'; S.raw = []; S.accounts = []; S.overrides = {}; S.plan = {}; S.cancel = {}; }
  if (!S.accounts.some(a => a.id === 'reczne')) S.accounts.push({ id: 'reczne', name: 'Gotówka i ręczne', person: 'ja' });
  for (const p of parts) {
    S.raw.push({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), date, amount: -p.amount, currency: 'PLN', merchant: name, title: parts.length > 1 ? CAT[p.cat].name : '', account: 'reczne', person: 'ja', balance: null });
    if (parts.length > 1) S.overrides[(name + ' ' + CAT[p.cat].name).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ')] = p.cat;
  }
  save(); rebuild(); closeSheet(); render(); toast('Zapisano wydatek');
}

/* ---------- kopia i eksport ---------- */
function exportCSV() {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Data', 'Konto', 'Osoba', 'Kwota', 'Waluta', 'Sprzedawca', 'Tytuł', 'Kategoria', 'Przelew własny']].concat(TX.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map(t => [t.date, accName(t.account), PN[t.person] || t.person, String(t.amount).replace('.', ','), t.currency, t.merchant, t.title, (CAT[t.cat] || {}).name || '', t.internal ? 'tak' : '']));
  const b = new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = `budzet-transakcje-${TODAY}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
let restoreArm = null;
async function restoreBackup(file) {
  try {
    const j = JSON.parse(await file.text());
    if (!j || j.v !== 1 || !Array.isArray(j.raw) || !Array.isArray(j.accounts)) throw 0;
    restoreArm = j; $('#rbmsg').textContent = `Kopia: ${j.raw.length} transakcji, ${j.accounts.length} kont. Dotknij „Przywróć”, żeby zastąpić obecne dane.`; $('#rbgo').hidden = false;
  } catch { toast('To nie jest kopia z Budżetu'); }
}

/* ---------- analiza ---------- */
const spark = (vals, w = 320, h = 86) => {
  if (vals.length < 2) return '';
  const mn = Math.min(...vals), mx = Math.max(...vals), sp = mx - mn || 1, x = i => (i / (vals.length - 1)) * w, y = v => 6 + (1 - (v - mn) / sp) * (h - 12);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`), lo = vals.indexOf(mn);
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;display:block"><path d="M0,${h} L${pts.join(' L')} L${w},${h}Z" fill="rgba(46,230,166,.10)"/><polyline points="${pts.join(' ')}" fill="none" stroke="var(--acc)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(lo).toFixed(1)}" cy="${y(mn).toFixed(1)}" r="4" fill="var(--warn)"/></svg>`;
};
const sm = n => (n < 0 ? '\u2212' : '') + money(Math.abs(n));
const anchorInfo = () => {
  const acc = S.mode === 'demo' ? [] : S.accounts.filter(a => a.anchor && !(a.anchor.avail && a.anchor.limit == null));
  if (!acc.length) return null;
  return { anchor: { date: acc.map(a => a.anchor.date).sort().pop(), v: sum(acc.map(a => a.anchor.v)), limit: acc.every(a => a.limit != null) ? sum(acc.map(a => a.limit)) : null }, acc };
};
function vAnaliza() {
  if (!TX.length) return head('Analiza') + empty('Brak danych', 'Zaimportuj wyciągi z kilku miesięcy, a policzę prognozę, koszty długu i anomalie.', 'Importuj wyciąg');
  const ai = anchorInfo(), mk = U.am && monthsWithData().includes(U.am) ? U.am : monthsWithData().slice(-1)[0];
  const fc = ai ? forecast(TX, REC, TODAY, ai.anchor, 35) : null, dv = ai ? debtView(TX, ai.acc, TODAY) : null;
  const wm = whyMonth(TX, mk), an = anomalies(TX, REC, TODAY), ib = inbox(TX), cands = personCandidates(TX, S.people), pr = productPrices(S.receiptLog || []);
  const yr = yearSummary(TX, +TODAY.slice(0, 4)), ms = monthsWithData().slice(-5);
  let h = head('Analiza', 'Liczone z Twoich wyciągów');
  // 1. prognoza
  if (fc && !fc.notEnough) {
    const lim = fc.limit, avail = lim != null ? fc.startBal + lim : null, lowAvail = lim != null ? fc.low.bal + lim : null;
    h += `<div class="h2">Prognoza salda na 5 tygodni</div><div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted small">Dziś (${plDate(fc.start)})</span><b class="num" style="font-size:20px">${sm(fc.startBal)}</b></div>
      ${spark([fc.startBal, ...fc.series.map(s => s.bal)])}
      <div class="kv"><span class="muted">Najniżej ${plDate(fc.low.date)}</span><b class="num ${fc.low.bal < 0 ? 'neg' : ''}">${sm(fc.low.bal)}</b></div>
      <div class="kv"><span class="muted">Za 35 dni (${plDate(fc.end.date)})</span><b class="num ${fc.end.bal < 0 ? 'neg' : ''}">${sm(fc.end.bal)}</b></div>
      ${lim != null ? `<div class="kv"><span class="muted">Limit debetu</span><b class="num">${money(lim)}</b></div><div class="kv"><span class="muted">Dostępne środki dziś</span><b class="num ${avail < 0 ? 'neg' : ''}">${sm(avail)}</b></div>${lowAvail < 0 ? `<div class="small" style="margin-top:8px;color:var(--warn)">${avail < 0 ? 'Jesteś już ponad limitem debetu. ' : ''}W najniższym punkcie zabraknie ${money(-lowAvail)} do limitu.</div>` : ''}` : ''}
      <div class="small muted" style="margin-top:10px">Założenia: wpływy z dni miesiąca, w które wpadały w ostatnich ${fc.basedOn.length} mies., znane stałe opłaty i średnie dzienne wydatki ${money(fc.daily)}. To szacunek, nie obietnica.</div></div>`;
  } else if (!ai) h += `<div class="card flat"><b>Prognoza salda</b><div class="small muted" style="margin-top:4px">Potrzebuję salda konta. Zaimportuj wyciąg MT940 albo CSV z kolumną salda.</div></div>`;
  // 2. dług
  if (dv && dv.active) {
    const extra = S.debtExtra || 0, proj = debtProject(dv.nowBal, dv.delta, extra, 12), lim = ai.anchor.limit;
    h += `<div class="h2">Dług na koncie</div><div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted small">Saldo dziś</span><b class="num neg" style="font-size:22px">${sm(dv.nowBal)}</b></div>
      ${spark(dv.series.map(s => s.bal))}
      <div class="small muted" style="display:flex;justify-content:space-between"><span>${mName(dv.series[0].mk)}</span><span>${mName(dv.series[dv.series.length - 1].mk)}</span></div>
      <div class="kv"><span class="muted">Koszt odsetek i opłat za limit</span><b class="num">${money(dv.avgMonthlyCost)} / mies.</b></div>
      <div class="kv"><span class="muted">Łącznie w tym okresie</span><b class="num">${money(dv.totalCost)}</b></div>
      <div class="kv"><span class="muted">Średni dług</span><b class="num">${money(dv.avgDebt)}</b></div>
      <div class="kv"><span class="muted">Zmiana salda, ostatnie 3 mies.</span><b class="num ${dv.delta < 0 ? 'neg' : 'pos'}">${dv.delta < 0 ? '−' : '+'}${money(Math.abs(dv.delta))} / mies.</b></div>
      <div class="h2" style="margin:16px 0 6px">Co jeśli odkładasz na spłatę<span class="step"><button data-act="debtx" data-d="-250" aria-label="Mniej">−</button><span class="n">${money(extra)}</span><button data-act="debtx" data-d="250" aria-label="Więcej">+</button></span></div>
      <div class="kv"><span class="muted">Saldo za 12 mies. przy takim tempie</span><b class="num ${proj[11] < 0 ? 'neg' : 'pos'}">${sm(proj[11])}</b></div>
      ${proj[11] >= 0 && dv.nowBal < 0 ? `<div class="kv"><span class="muted">Dług spłacony po</span><b class="num">${proj.findIndex(v => v >= 0) + 1} mies.</b></div>` : ''}
      ${lim != null && dv.nowBal + lim < 0 ? `<div class="small" style="margin-top:8px;color:var(--warn)">Saldo jest ${money(-(dv.nowBal + lim))} poniżej limitu debetu ${money(lim)}.</div>` : ''}
      <div class="small muted" style="margin-top:8px">Projekcja trzyma ostatnie tempo zmiany salda bez nowych odsetek, więc rzeczywisty wynik będzie nieco gorszy.</div></div>`;
  }
  // 3. dlaczego ten miesiąc
  if (wm) {
    const cl = c => `<div class="row"><div class="ico" style="background:${(CAT[c.id] || {}).color || 'var(--s3)'}">${letter(c.name)}</div><div class="mid"><div class="t">${esc(c.name)}</div><div class="s">teraz ${money(c.cur)} · średnio ${money(c.avg)}</div></div><div class="amt ${c.diff > 0 ? 'neg' : 'pos'}">${c.diff > 0 ? '+' : '−'}${money(Math.abs(c.diff))}</div></div>`;
    h += `<div class="h2">Dlaczego ${esc(mName(mk))} wyszedł tak${mk === TODAY.slice(0, 7) ? ` <b>do ${plDate(TODAY)}</b>` : ''}</div><div class="chips">${ms.map(m => `<button class="chip ${m === mk ? 'on' : ''}" data-act="amonth" data-m="${m}">${MSHORT[+m.slice(5, 7) - 1]}</button>`).join('')}</div>
    <div class="card"><div class="kv"><span class="muted">Wydano</span><b class="num">${money(wm.spent)}</b></div><div class="kv"><span class="muted">Średnio z ${wm.prev.length} mies. wcześniej</span><b class="num">${money(wm.avgSpent)}</b></div><div class="kv"><span class="muted">Wpływy (regularne)</span><b class="num">${money(wm.income)} <small class="muted">śr. ${money(wm.avgIncome)}</small></b></div>
      ${wm.cats.length ? `<div class="h2" style="margin:14px 0 4px">Gdzie jest różnica</div>${wm.cats.slice(0, 5).map(cl).join('')}` : '<div class="small muted" style="margin-top:10px">Żadna kategoria nie odbiega od średniej o więcej niż 50 zł.</div>'}
      ${wm.top.length ? `<div class="h2" style="margin:14px 0 4px">Największe wydatki</div>${wm.top.map(t => `<button class="row" data-act="tx" data-id="${esc(t.id)}"><div class="mid"><div class="t">${esc(t.name)}</div><div class="s">${plDate(t.date)}</div></div><div class="amt">${money(t.v)}</div></button>`).join('')}` : ''}
      ${wm.fresh.length ? `<div class="small muted" style="margin-top:8px">Nowi sprzedawcy: ${wm.fresh.map(f => `${esc(f.name)} ${money(f.v)}`).join(', ')}</div>` : ''}
      <button class="btn ghost" style="margin-top:14px" data-act="narr" data-t="why" ${gkey() ? '' : 'disabled'}>Opisz słowami (Gemini)</button></div>`;
  }
  // 4. anomalie
  h += `<div class="h2">Anomalie<b class="num">${an.length}</b></div>` + (an.length ? `<div class="card flat">${an.map(a => `<button class="row" ${a.id ? `data-act="tx" data-id="${esc(a.id)}"` : a.key ? `data-act="rec" data-k="${esc(a.key)}"` : ''}><div class="mid"><div class="t" style="white-space:normal">${esc(a.title)}</div><div class="s" style="white-space:normal">${esc(a.body)}</div></div></button>`).join('')}</div>` : '<div class="card flat small muted">Nic nietypowego w ostatnich tygodniach.</div>');
  // 5. do sprawdzenia, osoby, reguły
  const nPeople = S.people.length;
  h += `<div class="h2">Porządkowanie</div><div class="card flat">
    <button class="row" data-act="inbox"><div class="mid"><div class="t">Do sprawdzenia</div><div class="s">${ib.length} sprzedawców bez kategorii, razem ${money(sum(ib.map(x => x.v)))}</div></div>${svg(I.chev)}</button>
    <button class="row" data-act="people"><div class="mid"><div class="t">Osoby</div><div class="s">${nPeople} w rejestrze · ${cands.length} do przypisania</div></div>${svg(I.chev)}</button>
    <button class="row" data-act="rules"><div class="mid"><div class="t">Własne reguły</div><div class="s">${(S.rules || []).length} reguł · ${Object.keys(S.overrides).length} zapamiętanych kategorii</div></div>${svg(I.chev)}</button></div>`;
  // 6. produkty
  h += `<div class="h2">Ceny z paragonów</div>` + (pr.length ? `<div class="card flat">${pr.slice(0, 8).map(p => `<div class="row"><div class="mid"><div class="t">${esc(p.name)}</div><div class="s">${plDate(p.first.date)} ${money(p.first.price, 2)} → ${plDate(p.last.date)} ${money(p.last.price, 2)} · najtaniej ${money(p.min.price, 2)} (${esc(p.min.store)})</div></div><div class="amt ${p.change > 0 ? 'neg' : 'pos'}">${p.change > 0 ? '+' : '−'}${Math.round(Math.abs(p.pct) * 100)}%</div></div>`).join('')}</div>` : `<div class="card flat small muted">Gdy zapiszesz kilka paragonów z tymi samymi produktami, pokażę, jak zmieniają się ceny i gdzie jest taniej. Zapisanych paragonów: ${(S.receiptLog || []).length}.</div>`);
  // 7. rok
  if (yr) h += `<div class="h2">Rok ${yr.year} (${yr.months} mies. danych)</div><div class="card">
    <div class="kv"><span class="muted">Regularne wpływy</span><b class="num pos">${money(yr.income)}</b></div><div class="kv"><span class="muted">Wpływy jednorazowe</span><b class="num">${money(yr.irregular)}</b></div><div class="kv"><span class="muted">Wydatki</span><b class="num">${money(yr.spent)}</b></div>
    <div class="kv"><span class="muted">Bilans</span><b class="num ${yr.net < 0 ? 'neg' : 'pos'}">${yr.net < 0 ? '−' : '+'}${money(Math.abs(yr.net))}</b></div><div class="kv"><span class="muted">Stopa oszczędzania</span><b class="num">${(yr.rate * 100).toFixed(1).replace('.', ',')}%</b></div>
    ${yr.tax ? `<div class="kv"><span class="muted">Podatki i urzędy</span><b class="num">${money(yr.tax)}</b></div>` : ''}${yr.debtCost ? `<div class="kv"><span class="muted">Koszt długu na koncie</span><b class="num">${money(yr.debtCost)}</b></div>` : ''}
    ${yr.best ? `<div class="kv"><span class="muted">Najtańszy miesiąc</span><b>${esc(mName(yr.best.mk))} · ${money(yr.best.spent)}</b></div><div class="kv"><span class="muted">Najdroższy miesiąc</span><b>${esc(mName(yr.worst.mk))} · ${money(yr.worst.spent)}</b></div>` : ''}
    <div class="h2" style="margin:14px 0 4px">Na co poszły pieniądze</div>${yr.cats.slice(0, 6).map(c => `<div class="row"><div class="ico" style="background:${(CAT[c.id] || {}).color || 'var(--s3)'}">${letter(c.name)}</div><div class="mid"><div class="t">${esc(c.name)}</div></div><div class="amt">${money(c.v)}</div></div>`).join('')}
    <button class="btn ghost" style="margin-top:14px" data-act="narr" data-t="year" ${gkey() ? '' : 'disabled'}>Opisz słowami (Gemini)</button></div>`;
  return h;
}
function narrFacts(kind) {
  const f = []; const add = (text, ...nums) => f.push({ id: 'f' + (f.length + 1), text, nums });
  if (kind === 'why') {
    const mk = U.am && monthsWithData().includes(U.am) ? U.am : monthsWithData().slice(-1)[0], w = whyMonth(TX, mk); if (!w) return [];
    add(`${mName(mk)}: wydano ${nf(w.spent)} zł`, Math.round(w.spent)); add(`Średnio z ${w.prev.length} wcześniejszych miesięcy wydawano ${nf(w.avgSpent)} zł`, Math.round(w.avgSpent), w.prev.length);
    for (const c of w.cats.slice(0, 4)) add(`Kategoria ${c.name}: ${nf(c.cur)} zł w tym miesiącu wobec średnio ${nf(c.avg)} zł`, Math.round(c.cur), Math.round(c.avg));
    for (const t of w.top.slice(0, 3)) add(`Duży wydatek: ${t.name} ${nf(t.v)} zł, ${plDate(t.date)}`, Math.round(t.v));
  } else {
    const y = yearSummary(TX, +TODAY.slice(0, 4)); if (!y) return [];
    add(`Regularne wpływy w ${y.year}: ${nf(y.income)} zł`, Math.round(y.income)); add(`Wydatki w ${y.year}: ${nf(y.spent)} zł`, Math.round(y.spent)); add(`Bilans roku: ${nf(Math.abs(y.net))} zł ${y.net < 0 ? 'na minusie' : 'na plusie'}`, Math.round(Math.abs(y.net)));
    for (const c of y.cats.slice(0, 3)) add(`Kategoria ${c.name}: ${nf(c.v)} zł`, Math.round(c.v));
    if (y.debtCost) add(`Koszt długu na koncie: ${nf(y.debtCost)} zł`, Math.round(y.debtCost)); if (y.tax) add(`Podatki i urzędy: ${nf(y.tax)} zł`, Math.round(y.tax));
  }
  return f;
}
async function runNarr(kind) {
  const facts = narrFacts(kind); if (!facts.length) { toast('Za mało danych'); return; }
  openSheet('<h3>Opis słowami</h3><div class="muted small">Gemini dostaje tylko policzone przeze mnie fakty. Zdanie pokażę dopiero po sprawdzeniu każdej liczby.</div><div class="card flat" style="margin-top:16px;height:90px;opacity:.5;animation:pulse 1.2s infinite alternate"></div>');
  try {
    const r = await narrate(facts, gkey(), kind === 'why' ? 'dlaczego ten miesiąc wyszedł tak, a nie inaczej' : 'podsumowanie roku');
    openSheet(`<h3>Opis słowami</h3><div class="muted small">Każda liczba poniżej została sprawdzona z faktami policzonymi przez aplikację.</div>
    <div class="card flat" style="margin-top:14px">${r.sentences.length ? r.sentences.map(s => `<div style="padding:8px 0;border-top:1px solid var(--line)">${esc(s.text)}</div>`).join('') : '<div class="small muted">Żadne zdanie nie przeszło kontroli, więc niczego nie pokazuję.</div>'}</div>
    ${r.dropped ? `<div class="small muted" style="margin-top:8px">Odrzucone przez kontrolę: ${r.dropped}</div>` : ''}
    <div class="h2" style="margin-top:16px">Fakty źródłowe</div><div class="card flat small muted">${facts.map(f => `<div>${esc(f.text)}</div>`).join('')}</div>`);
  } catch (e) { openSheet(`<h3>Nie wyszło</h3><div class="muted small">${esc(e.message)}</div>`); }
}

/* ---------- porządkowanie: skrzynka, osoby, reguły ---------- */
const catChips = (act, extra, cur) => CATS.filter(c => !['dochod', 'nieregularny'].includes(c.id)).map(c => `<button class="chip ${cur === c.id ? 'on' : ''}" data-act="${act}" ${extra} data-c="${c.id}">${esc(c.name)}</button>`).join('');
function sInbox() {
  const ib = inbox(TX).slice(0, 12);
  openSheet(`<h3>Do sprawdzenia</h3><div class="muted small">Sprzedawcy bez kategorii. Wybierz kategorię, a zapamiętam ją dla tego sprzedawcy.</div>
  ${ib.length ? ib.map(x => `<div class="card flat" style="margin-top:12px"><div style="display:flex;justify-content:space-between"><b>${esc(x.name)}</b><span class="num">${money(x.v)}</span></div><div class="small muted">${x.n} ${x.n === 1 ? 'płatność' : 'płatności'} · ${esc(x.big.merchant)}</div><div class="chips" style="flex-wrap:wrap;margin-top:8px">${catChips('inboxcat', `data-k="${esc(x.key)}"`, '')}</div></div>`).join('') : '<div class="card flat small muted" style="margin-top:14px">Wszystko ma kategorię.</div>'}`);
}
function sPeople() {
  const cands = personCandidates(TX, S.people).slice(0, 15);
  openSheet(`<h3>Osoby</h3><div class="muted small">Jedna osoba pod kilkoma nazwami w banku. Raz łączysz, a ja stosuję to do całej historii i nowych wyciągów.</div>
  ${S.people.length ? `<div class="card flat" style="margin-top:12px">${S.people.map(p => { const st = personStats(TX, p); return `<button class="row" data-act="person" data-id="${esc(p.id)}"><div class="ico" style="background:var(--s3);color:var(--tx)">${letter(p.name)}</div><div class="mid"><div class="t">${esc(p.name)}</div><div class="s">${esc(ROLES[p.role] || '')} · wysłane ${money(st.out)} · otrzymane ${money(st.inn)}</div></div>${svg(I.chev)}</button>`; }).join('')}</div>` : ''}
  ${cands.length ? `<div class="h2">Możliwe osoby w Twoich przelewach</div><div class="card flat">${cands.map((c, i) => `<div class="row"><div class="mid"><div class="t">${esc(c.name)}</div><div class="s">${c.n} × · wysłane ${money(c.out)} · otrzymane ${money(c.inn)}</div></div><button class="chip" data-act="padd" data-i="${i}">Dodaj</button></div>`).join('')}</div>` : ''}`);
  PC = cands;
}
let PC = [];
function sPerson(id) {
  const p = S.people.find(x => x.id === id); if (!p) return;
  const others = personCandidates(TX, S.people).filter(c => normName(c.name) !== normName(p.name)).slice(0, 25);
  openSheet(`<h3>${esc(p.name)}</h3>
  <label class="field"><span>Nazwa</span><input id="pName" value="${esc(p.name)}" data-change="pname" data-id="${esc(p.id)}"></label>
  <div class="h2" style="margin-top:14px">Rola</div><div class="chips" style="flex-wrap:wrap">${Object.entries(ROLES).map(([k, v]) => `<button class="chip ${p.role === k ? 'on' : ''}" data-act="prole" data-id="${esc(p.id)}" data-r="${k}">${v}</button>`).join('')}</div>
  <div class="small muted" style="margin-top:8px">${p.role === 'partnerka' ? 'Przelewy z partnerką to przepływ w gospodarstwie. Z tytułem „Mieszkanie”, „czynsz” lub „najem” liczą się jako stały koszt mieszkania.' : 'Przelewy do tej osoby liczę w kategorii „Przelewy do osób”, wpływy od niej jako jednorazowe.'}</div>
  <div class="h2">Inne nazwy tej osoby w banku</div>
  ${(p.aliases || []).length ? `<div class="chips" style="flex-wrap:wrap">${p.aliases.map((a, i) => `<button class="chip on" data-act="pdelalias" data-id="${esc(p.id)}" data-i="${i}">${esc(a)} ✕</button>`).join('')}</div>` : '<div class="small muted">Brak.</div>'}
  ${others.length ? `<div class="h2">Dołącz nazwę z Twoich przelewów</div><div class="chips" style="flex-wrap:wrap">${others.map((c, i) => `<button class="chip" data-act="paddalias" data-id="${esc(p.id)}" data-n="${esc(c.name)}">${esc(c.name)}</button>`).join('')}</div>` : ''}
  <button class="btn ghost" style="margin-top:18px;color:var(--warn)" data-act="pdel" data-id="${esc(p.id)}">Usuń osobę</button>`);
}
const savePeople = () => { save(); rebuild(); render(); };
function sRules() {
  const ru = S.rules || [], ov = Object.entries(S.overrides);
  openSheet(`<h3>Własne reguły</h3><div class="muted small">Jeśli opis transakcji zawiera podany tekst, nadaję tę kategorię. Własne reguły mają pierwszeństwo przed wbudowanymi.</div>
  <label class="field"><span>Tekst w opisie</span><input id="ruText" placeholder="np. endorfina" autocomplete="off" data-change="rupreview"></label>
  <label class="field"><span>Kategoria</span><select id="ruCat" data-change="rupreview">${CATS.filter(c => !['dochod', 'nieregularny', 'przelew'].includes(c.id)).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
  <div class="small muted" id="ruPrev" style="margin-top:6px"></div>
  <button class="btn" style="margin-top:12px" data-act="rusave">Dodaj regułę</button>
  ${ru.length ? `<div class="h2">Twoje reguły</div><div class="card flat">${ru.map((u, i) => `<div class="row"><div class="mid"><div class="t">„${esc(u.text)}”</div><div class="s">${esc((CAT[u.cat] || {}).name || u.cat)}</div></div><button class="chip" data-act="rudel" data-i="${i}">Usuń</button></div>`).join('')}</div>` : ''}
  ${(S.recIgnore || []).length ? `<div class="h2">Wyłączone z cyklicznych</div><div class="card flat">${S.recIgnore.map(k => `<div class="row"><div class="mid"><div class="t">${esc(k.split('|')[0])}</div></div><button class="chip" data-act="recrestore" data-k="${esc(k)}">Przywróć</button></div>`).join('')}</div>` : ''}
  ${ov.length ? `<div class="h2">Zapamiętane kategorie<b class="num">${ov.length}</b></div><div class="card flat">${ov.slice(0, 40).map(([k, c]) => `<div class="row"><div class="mid"><div class="t">${esc(k)}</div><div class="s">${esc((CAT[c] || {}).name || c)}</div></div><button class="chip" data-act="ovdel" data-k="${esc(k)}">Usuń</button></div>`).join('')}</div>` : ''}`);
}
function rulePreview() {
  const t = ($('#ruText') || {}).value || '', n = normText(t).trim(); if (!n) { $('#ruPrev').textContent = ''; return; }
  const m = TX.filter(x => normText(`${x.rawName || x.merchant} ${x.title}`).includes(n));
  $('#ruPrev').textContent = m.length ? `Pasuje do ${m.length} transakcji, razem ${money(sum(m.map(x => Math.abs(x.amountPLN))))}.` : 'Nic jeszcze nie pasuje.';
}

/* ---------- arkusze ---------- */
const sheet = $('#sheet'), pane = sheet.querySelector('.pane');
function openSheet(html) { pane.innerHTML = `<div class="grab"></div>${html}`; sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); pane.scrollTop = 0; document.documentElement.classList.add('lock'); }
function closeSheet() { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); document.documentElement.classList.remove('lock'); }
sheet.querySelector('.back').addEventListener('click', closeSheet);
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

function sAdd() {
  openSheet(`<h3>Dodaj</h3><div class="muted small">Dane zostają w tym telefonie.</div>
  <button class="opt" data-act="import"><span class="g">${svg(I.file)}</span><span><b>Wyciąg z banku (CSV lub MT940)</b><span>Wiele plików naraz, np. cały rok</span></span></button>
  <button class="opt" data-act="receipt"><span class="g">${svg(I.cam)}</span><span><b>Paragon ze zdjęcia</b><span>Odczyt przez Gemini, Ty zatwierdzasz</span></span></button>
  <button class="opt" data-act="manual"><span class="g">${svg(I.pen)}</span><span><b>Wydatek ręcznie</b><span>Gotówka z portfela albo drobne zakupy</span></span></button>`);
}

/* import */
let IM = null;
function sImport() {
  const accs = accounts();
  IM = { accountId: accs.length && S.mode !== 'demo' ? accs[0].id : 'new', newId: 'k' + Date.now().toString(36), newName: '', newPerson: 'ja', files: [], res: null, picked: false };
  renderImport();
}
function renderImport() {
  const accs = S.mode === 'demo' ? [] : S.accounts, r = IM.res;
  let body = `<h3>Import wyciągu</h3><div class="muted small">Plik jest przetwarzany tylko w tym telefonie.</div>
  <label class="field"><span>Konto</span><select data-change="imacc">${accs.map(a => `<option value="${esc(a.id)}" ${IM.accountId === a.id ? 'selected' : ''}>${esc(a.name)} (${esc(PN[a.person])})</option>`).join('')}<option value="new" ${IM.accountId === 'new' ? 'selected' : ''}>＋ Nowe konto…</option></select></label>`;
  if (IM.accountId === 'new') body += `<label class="field"><span>Nazwa konta</span><input id="newName" placeholder="np. ING osobiste" value="${esc(IM.newName)}" data-change="imname"></label>
  <label class="field"><span>Właściciel</span><select data-change="imperson"><option value="ja" ${IM.newPerson === 'ja' ? 'selected' : ''}>Ja</option><option value="partnerka" ${IM.newPerson === 'partnerka' ? 'selected' : ''}>Partnerka</option></select></label>`;
  if (!r) body += `<label class="btn" style="margin-top:18px;cursor:pointer">Wybierz pliki wyciągu<input type="file" multiple data-change="imfile" style="display:none"></label><div class="small muted" style="margin-top:8px">CSV albo MT940 (.sta). Możesz zaznaczyć wiele plików, np. wszystkie miesiące.</div>`;
  else if (r.needsMapping) {
    body += `<div class="card flat" style="margin-top:14px"><b>Nie rozpoznałem układu kolumn.</b><div class="small muted">Wskaż, która kolumna co zawiera.</div></div><div class="mapgrid">${FIELDS.map(f => `<label class="field" style="margin-top:6px"><span>${f.label}</span><select data-change="immap" data-f="${f.id}"><option value="">— brak —</option>${r.columns.map((c, i) => `<option value="${i}" ${r.mapping[f.id] === i ? 'selected' : ''}>${esc(c || 'kolumna ' + (i + 1))}</option>`).join('')}</select></label>`).join('')}</div>
    <button class="btn" style="margin-top:16px" data-act="imapply">Zastosuj</button>`;
  } else {
    const dup = S.mode === 'demo' ? new Set() : findDuplicates(S.raw, r.txs), fresh = r.txs.filter(t => !dup.has(t.id));
    const selAcc = S.accounts.find(a => a.id === IM.accountId), warn = [];
    if (selAcc && selAcc.iban && r.iban && selAcc.iban !== r.iban) warn.push('Ten wyciąg dotyczy innego rachunku niż wybrane konto.');
    if (r.ibans && r.ibans.length > 1) warn.push('Pliki dotyczą kilku różnych rachunków. Importuj każdy rachunek osobno.');
    if (r.unreadable && r.unreadable.length) warn.push('Nie odczytałem: ' + r.unreadable.map(esc).join(', '));
    if (r.balance && r.balance.missing.length) warn.push('Brakuje wyciągów za: ' + r.balance.missing.join(', '));
    if (r.balance && (r.balance.bad.length || r.balance.gaps.length)) warn.push('Salda się nie zgadzają' + (r.balance.bad.length ? ' w wyciągach: ' + r.balance.bad.join(', ') : '') + (r.balance.gaps.length ? '; ciągłość przerwana przy: ' + r.balance.gaps.join(', ') : '') + '.');
    const ds = r.txs.map(t => t.date).sort();
    body += `<div class="card flat" style="margin-top:14px">
      <div class="kv"><span class="muted">Bank</span><b>${esc(r.bank)}</b></div>
      ${r.files && r.files.length > 1 ? `<div class="kv"><span class="muted">Pliki</span><b class="num">${r.files.length - (r.unreadable || []).length}</b></div>` : ''}
      ${r.balance ? `<div class="kv"><span class="muted">Salda i ciągłość wyciągów</span><b class="${r.balance.ok ? 'pos' : 'neg'}">${r.balance.ok ? 'zgodne ✓' : 'rozbieżność'}</b></div>` : ''}
      ${r.check ? `<div class="kv"><span class="muted">Kontrola z podsumowaniem banku</span><b class="${r.check.ok ? 'pos' : 'neg'}">${r.check.ok ? 'zgodna ✓' : 'rozbieżność'}</b></div>` : ''}
      <div class="kv"><span class="muted">Wiersze w pliku</span><b class="num">${r.txs.length}</b></div>
      ${r.txs.some(t => t.pending) ? `<div class="kv"><span class="muted">W tym karta w toku</span><b class="num">${r.txs.filter(t => t.pending).length}</b></div>` : ''}
      <div class="kv"><span class="muted">Nowe</span><b class="num pos">${fresh.length}</b></div>
      <div class="kv"><span class="muted">Już były (pominę)</span><b class="num">${r.txs.length - fresh.length}</b></div>
      ${r.skipped.length ? `<div class="kv"><span class="muted">Nieważne (oczekujące, wymiany)</span><b class="num">${r.skipped.length}</b></div>` : ''}
      ${ds.length ? `<div class="kv"><span class="muted">Okres</span><b>${plDate(ds[0])} – ${plDate(ds[ds.length - 1])} ${ds[ds.length - 1].slice(0, 4)}</b></div>` : ''}</div>
    ${warn.map(w => `<div class="small" style="margin-top:8px;color:var(--pa)">${w}</div>`).join('')}
    ${r.txs.some(t => t.currency !== 'PLN') ? '<div class="small muted" style="margin-top:8px">Waluty obce przeliczam przybliżonym kursem. Docelowo: kurs NBP z dnia transakcji.</div>' : ''}
    ${S.mode === 'demo' ? '<div class="small" style="margin-top:8px;color:var(--pa)">Dane demo zostaną zastąpione Twoimi.</div>' : ''}
    <button class="btn" style="margin-top:16px" data-act="imgo" ${fresh.length ? '' : 'disabled'}>Zaimportuj ${fresh.length} ${fresh.length === 1 ? 'transakcję' : 'transakcji'}</button>
    <button class="btn ghost" style="margin-top:10px" data-act="imreset">Wybierz inny plik</button>`;
  }
  openSheet(body);
}
function runImport(mapping) {
  if (!IM.picked && IM.files.length) { // bez wyboru ręcznego dobieram konto po numerze rachunku
    const probe = importFiles(IM.files, { account: 'x' });
    const m = probe.iban && S.accounts.find(a => a.iban === probe.iban);
    if (m) IM.accountId = m.id;
  }
  const person = IM.accountId === 'new' ? IM.newPerson : (S.accounts.find(a => a.id === IM.accountId) || {}).person || 'ja';
  const acc = IM.accountId === 'new' ? IM.newId : IM.accountId;
  IM.res = importFiles(IM.files, { account: acc, person, mapping: mapping || null, headerIndex: mapping ? (IM.res ? IM.res.headerIndex : 0) : null });
  if (IM.accountId === 'new' && !IM.newName && IM.res.bank && IM.res.bank !== 'Nieznany bank') IM.newName = IM.res.bank;
  renderImport();
}
function commitImport() {
  const r = IM.res; if (!r || r.needsMapping) return;
  if (S.mode === 'demo') { S.mode = 'real'; S.raw = []; S.accounts = []; S.overrides = {}; S.plan = {}; S.cancel = {}; }
  let accId = IM.accountId;
  if (accId === 'new') { S.accounts.push({ id: IM.newId, name: (IM.newName || r.bank || 'Konto').trim(), person: IM.newPerson, ...(r.iban ? { iban: r.iban } : {}) }); accId = IM.newId; }
  const dup = findDuplicates(S.raw, r.txs), add = r.txs.filter(t => !dup.has(t.id)).map(({ id, date, amount, currency, merchant, title, account, person, balance, pending, booked, code, cp }) => ({ id, date, amount, currency, merchant, title, account, person, balance, ...(code ? { code } : {}), ...(cp ? { cp } : {}), ...(booked ? { booked } : {}), ...(pending ? { pending: true } : {}) }));
  S.raw.push(...add); S.raw = reconcilePending(S.raw);
  const ac = S.accounts.find(a => a.id === accId); if (ac && r.iban && !ac.iban) ac.iban = r.iban;
  if (ac && r.anchor && (!ac.anchor || r.anchor.date >= ac.anchor.date)) {
    ac.anchor = { ...r.anchor };
    if (ac.anchor.limit != null) ac.limit = ac.anchor.limit;
    else if (ac.anchor.avail && ac.limit != null) { ac.anchor.v = +(ac.anchor.v - ac.limit).toFixed(2); ac.anchor.limit = ac.limit; }
  }
  if (ac && r.bals && r.bals.length) { const m = new Map((ac.bals || []).map(b => [b.date, b.v])); for (const b of r.bals) m.set(b.date, b.v); ac.bals = [...m].map(([date, v]) => ({ date, v })).sort((a, b) => a.date.localeCompare(b.date)); }
  if (ac && r.owner && !ac.owner) ac.owner = r.owner; // do rozpoznawania przelewów własnych
  save(); rebuild(); closeSheet();
  const ms = monthsWithData(); U.mk = ms[ms.length - 1]; VIEW = 'dzis'; location.hash = '#dzis'; render(true);
  toast(`Dodano ${add.length} transakcji`);
}

// karta w toku znika, gdy pojawi się rozliczona płatność (albo po 10 dniach bez rozliczenia)
function reconcilePending(raw) {
  const key = x => String(x || '').toUpperCase().replace(/[^A-ZĄĆĘŁŃÓŚŹŻ]/g, '').slice(0, 10);
  const maxD = raw.reduce((m, t) => (t.date > m ? t.date : m), '');
  return raw.filter(t => {
    if (!t.pending) return true;
    if (raw.some(b => !b.pending && b.account === t.account && b.amount === t.amount && Math.abs(dnum(b.date) - dnum(t.date)) <= 6 && key(b.merchant) === key(t.merchant))) return false;
    return dnum(maxD) - dnum(t.date) < 10;
  });
}

/* ręczny wydatek */
function sManual() {
  openSheet(`<h3>Wydatek ręcznie</h3>
  <label class="field"><span>Kwota (zł)</span><input id="mAmt" inputmode="decimal" placeholder="0,00" autocomplete="off"></label>
  <label class="field"><span>Na co</span><input id="mName" placeholder="np. Targ, parking" autocomplete="off"></label>
  <label class="field"><span>Kategoria</span><select id="mCat">${CATS.filter(c => c.variable).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
  <label class="field"><span>Kto</span><select id="mWho"><option value="ja">Ja</option><option value="partnerka">Partnerka</option></select></label>
  <label class="field"><span>Data</span><input id="mDate" type="date" value="${TODAY}"></label>
  <label class="field"><span>Skąd</span><select id="mSrc"><option value="konto">Z konta (karta, BLIK)</option><option value="portfel">Z portfela (gotówka z bankomatu)</option></select></label>
  ${S.mode === 'demo' ? '<div class="small" style="margin-top:10px;color:var(--pa)">Dane demo zostaną zastąpione Twoimi.</div>' : ''}
  <button class="btn" style="margin-top:18px" data-act="msave">Zapisz</button>`);
}
function saveManual() {
  const amt = parseFloat(String($('#mAmt').value).replace(',', '.')), name = $('#mName').value.trim();
  if (!(amt > 0) || !name) { toast('Podaj kwotę i nazwę'); return; }
  if ($('#mSrc').value === 'portfel') { S.cashLog.push({ id: 'c' + Date.now().toString(36), date: $('#mDate').value || TODAY, amount: amt, name, cat: $('#mCat').value }); save(); closeSheet(); VIEW = 'gotowka'; location.hash = '#gotowka'; render(true); toast('Zapisano w portfelu'); return; }
  if (S.mode === 'demo') { S.mode = 'real'; S.raw = []; S.accounts = []; S.overrides = {}; S.plan = {}; S.cancel = {}; }
  if (!S.accounts.some(a => a.id === 'reczne')) S.accounts.push({ id: 'reczne', name: 'Gotówka i ręczne', person: 'ja' });
  const cat = $('#mCat').value, id = 'm' + Date.now().toString(36);
  S.raw.push({ id, date: $('#mDate').value || TODAY, amount: -amt, currency: 'PLN', merchant: name, title: '', account: 'reczne', person: $('#mWho').value, balance: null });
  S.overrides = S.overrides; // kategoria dla ręcznego wpisu: zapamiętana po nazwie
  S.overrides[name.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').split(' ').slice(0, 3).join(' ')] = cat;
  save(); rebuild(); closeSheet(); render(); toast('Zapisano');
}

/* transakcja i stała opłata */
function sTx(id) {
  const t = TX.find(x => x.id === id); if (!t) return;
  openSheet(`<h3>${esc(t.name)}</h3><div class="muted small">${plDate(t.date)} · ${esc(accName(t.account))} · ${esc(PN[t.person] || t.person)}</div>
  <div class="num" style="font:800 34px var(--f-num);margin:10px 0 2px;letter-spacing:-.03em">${t.amountPLN > 0 ? '+' : '−'}${money(t.amountPLN, 2)}</div>
  ${t.currency !== 'PLN' ? `<div class="small muted">${t.amount.toFixed(2)} ${esc(t.currency)}, kurs przybliżony</div>` : ''}
  <div class="small muted" style="margin-top:8px">${esc(t.merchant)}${t.title ? ' · ' + esc(t.title) : ''}</div>
  ${S.receipts && S.receipts[t.id] ? `<div class="h2" style="margin-top:16px">Paragon</div><div class="card flat">${S.receipts[t.id].items.map(i => `<div class="kv"><span>${esc(i.name)}</span><b class="num">${money(i.amount, 2)}</b></div>`).join('')}</div>` : ''}
  ${t.internal ? '<div class="small" style="margin-top:8px;color:var(--pa)">Przelew własny: nie liczę go jako wydatku ani wpływu.</div>' : ''}
  <div class="h2" style="margin-top:20px">Kategoria <b>zapamiętam dla „${esc(t.name)}”</b></div><div class="chips" style="flex-wrap:wrap">${CATS.filter(c => t.amountPLN < 0 ? !['dochod', 'nieregularny'].includes(c.id) : ['dochod', 'nieregularny', 'przelew'].includes(c.id)).map(c => `<button class="chip ${t.cat === c.id ? 'on' : ''}" data-act="setcat" data-id="${esc(t.id)}" data-c="${c.id}"><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</button>`).join('')}</div>`);
}
function sRec(key) {
  const r = REC.find(x => x.key === key); if (!r) return;
  const hist = TX.filter(t => t.recKey === key).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  openSheet(`<h3>${esc(r.name)}</h3><div class="muted small">${esc(r.kind)} · ${esc(r.periodLabel)} ${dots(r.persons)}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0"><div class="stat"><div class="v num">${money(r.monthly)}</div><div class="l">miesięcznie</div></div><div class="stat"><div class="v num">${money(r.yearly)}</div><div class="l">rocznie</div></div></div>
  ${r.priceChange ? `<div class="ins warn" style="margin-bottom:12px"><span class="g">${svg(I.warn)}</span><span><b>Podwyżka ${money(r.priceChange.to - r.priceChange.from)}</b><span>Było ${money(r.priceChange.from, 2)}, jest ${money(r.priceChange.to, 2)}.</span></span></div>` : ''}
  <div class="kv"><span class="muted">Następna płatność</span><b>${r.active ? plDate(r.next) : 'brak, wygląda na zakończoną'}</b></div>
  <div class="kv"><span class="muted">Płatności w historii</span><b class="num">${r.count}</b></div>
  <div class="h2" style="margin-top:18px">Ostatnie płatności</div>${hist.map(t => `<div class="kv"><span>${plDate(t.date)} ${t.date.slice(0, 4)}</span><b class="num">${money(t.amountPLN, 2)}</b></div>`).join('')}
  <button class="btn ${S.cancel[key] ? 'ghost' : ''}" style="margin-top:18px" data-act="cancelmark" data-k="${esc(key)}">${S.cancel[key] ? 'Zostawiam, odznacz' : 'Rozważam rezygnację'}</button>
  <button class="btn ghost" style="margin-top:10px" data-act="recignore" data-k="${esc(key)}">To nie jest płatność cykliczna</button>`);
}

function sSettings() {
  const n = TX.length;
  openSheet(`<h3>Ustawienia</h3>
  <div class="card flat" style="margin-top:12px"><div class="kv"><span class="muted">Dane</span><b>${S.mode === 'demo' ? 'Demo (zmyślone)' : 'Własne'}</b></div><div class="kv"><span class="muted">Transakcje</span><b class="num">${n}</b></div>
  ${accounts().map(a => `<div class="kv"><span>${esc(a.name)}</span><span>${dots([a.person])} ${esc(PN[a.person])}</span></div>`).join('')}</div>
  <div class="row" style="margin-top:8px"><div class="mid"><div class="t">Miesięczne oszczędności</div><div class="s">odejmuję od planu na życie</div></div><span class="step"><button data-act="sav" data-d="-100" aria-label="Mniej">−</button><span class="n">${money(S.savings)}</span><button data-act="sav" data-d="100" aria-label="Więcej">+</button></span></div>
  <button class="btn ghost" style="margin-top:14px" data-act="export" ${S.mode === 'demo' ? 'disabled' : ''}>Pobierz kopię danych (JSON)</button>
  <button class="btn ghost" style="margin-top:10px" data-act="exportcsv" ${S.mode === 'demo' ? 'disabled' : ''}>Pobierz transakcje (CSV do Excela)</button>
  <label class="btn ghost" style="margin-top:10px;cursor:pointer;display:block;text-align:center">Wczytaj kopię danych<input type="file" accept=".json,application/json" data-change="rbfile" style="display:none"></label>
  <div class="small muted" id="rbmsg" style="margin-top:8px"></div><button class="btn" id="rbgo" data-act="rbgo" style="margin-top:8px" hidden>Przywróć</button>
  <label class="btn ghost" style="margin-top:10px;cursor:pointer;display:block;text-align:center">Wczytaj osoby (plik)<input type="file" accept=".json,application/json" data-change="pfile" style="display:none"></label>
  <label class="field" style="margin-top:14px"><span>Klucz Gemini (paragony)</span><input id="gk2" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${gkey() ? 'zapisany: ••••' + esc(gkey().slice(-4)) : 'AIza…'}" data-change="gkey"></label>
  ${S.mode === 'demo' ? '' : '<button class="btn ghost" style="margin-top:10px" data-act="loaddemo">Wróć do danych demo</button>'}
  <button class="btn ghost" style="margin-top:10px;color:var(--warn)" data-act="wipe" ${S.mode === 'demo' ? 'disabled' : ''}>Usuń wszystkie moje dane</button>
  <div class="small muted" style="margin-top:16px">Budżet v0.1 (prototyp). Dane są tylko w tym urządzeniu. Synchronizacja z partnerką pojawi się w następnym etapie.</div>`);
}

/* ---------- zdarzenia ---------- */
let wipeArm = false;
const ACT = {
  nav: d => { VIEW = d.to; location.hash = '#' + d.to; closeSheet(); },
  cashadd: () => sCashAdd(), cashcal: () => sCashCal(),
  cashsave: () => { const amt = parseFloat(String($('#cAmt').value).replace(',', '.')), name = $('#cName').value.trim(); if (!(amt > 0) || !name) { toast('Podaj kwotę i nazwę'); return; } S.cashLog.push({ id: 'c' + Date.now().toString(36), date: $('#cDate').value || TODAY, amount: amt, name, cat: $('#cCat').value }); save(); closeSheet(); render(); toast('Zapisano'); },
  cashcalsave: () => { const v = parseFloat(String($('#cBal').value).replace(',', '.')); if (!(v >= 0)) { toast('Podaj kwotę'); return; } S.cash = { since: TODAY, adj: v }; save(); closeSheet(); render(); toast('Stan portfela zapisany'); },
  cashrow: d => { const l = S.cashLog.find(x => x.id === d.id); if (!l) return; openSheet(`<h3>${esc(l.name)}</h3><div class="muted small">${plDate(l.date)} · ${money(l.amount)}</div><button class="btn ghost" style="margin-top:18px" data-act="cashdel" data-id="${esc(l.id)}">Usuń wpis</button>`); },
  cashdel: d => { S.cashLog = S.cashLog.filter(x => x.id !== d.id); save(); closeSheet(); render(); toast('Usunięto'); },
  add: () => sAdd(), import: () => sImport(), manual: () => sManual(), msave: () => saveManual(), settings: () => sSettings(),
  month: d => { U.mk = d.m; U.cat = null; U.limit = 50; render(); },
  who: d => { U.who = d.w; U.cat = null; U.limit = 50; render(); },
  cat: d => { U.cat = U.cat === d.c ? null : d.c; U.limit = 50; render(); },
  more: () => { U.limit += 50; render(); },
  tx: d => sTx(d.id), rec: d => sRec(d.k),
  setcat: d => { const t = TX.find(x => x.id === d.id); S.overrides[t.mkey] = d.c; save(); rebuild(); closeSheet(); render(); toast(`${t.name}: ${CAT[d.c].name}`); },
  cancelmark: d => { S.cancel[d.k] = !S.cancel[d.k]; if (!S.cancel[d.k]) delete S.cancel[d.k]; save(); closeSheet(); render(); },
  imapply: () => { const m = {}; pane.querySelectorAll('[data-f]').forEach(s => { if (s.value !== '') m[s.dataset.f] = +s.value; }); runImport(m); },
  imgo: () => commitImport(), imreset: () => { IM.res = null; IM.files = []; renderImport(); },
  psave: d => { const P = planData(); S.plan[P.mk] = { limits: { ...P.limits }, savings: Math.max(0, P.savings + +d.d) }; save(); render(); },
  plimit: d => { const P = planData(); const l = { ...P.limits }; l[d.c] = Math.max(0, (l[d.c] || 0) + +d.d); S.plan[P.mk] = { limits: l, savings: P.savings }; save(); render(); },
  pconfirm: () => { const P = planData(); S.plan[P.mk] = { limits: { ...P.limits }, savings: P.savings }; save(); render(); toast('Plan zapisany'); },
  preset: () => { delete S.plan[planMonth()]; save(); render(); toast('Przywrócono propozycję'); },
  sav: d => { S.savings = Math.max(0, S.savings + +d.d); save(); rebuild(); sSettings(); render(); },
  recignore: d => { const b = recBase(d.k); if (!S.recIgnore.includes(b)) S.recIgnore.push(b); save(); rebuild(); closeSheet(); render(); toast('Przestałem traktować to jako cykliczne'); },
  recrestore: d => { S.recIgnore = S.recIgnore.filter(x => x !== d.k); save(); rebuild(); sRules(); render(); },
  amonth: d => { U.am = d.m; render(); },
  debtx: d => { S.debtExtra = Math.max(0, Math.min(20000, (S.debtExtra || 0) + +d.d)); save(); render(); },
  narr: d => runNarr(d.t),
  inbox: () => sInbox(), people: () => sPeople(), rules: () => sRules(), person: d => sPerson(d.id),
  inboxcat: d => { S.overrides[d.k] = d.c; save(); rebuild(); sInbox(); render(); },
  padd: d => { const c = PC[+d.i]; if (!c) return; S.people.push({ id: 'p' + Date.now().toString(36), name: c.name, role: 'znajomy', aliases: [] }); savePeople(); sPeople(); },
  prole: d => { const p = S.people.find(x => x.id === d.id); if (p) { p.role = d.r; savePeople(); sPerson(p.id); } },
  paddalias: d => { const p = S.people.find(x => x.id === d.id); if (p && !(p.aliases || []).includes(d.n)) { p.aliases = [...(p.aliases || []), d.n]; savePeople(); sPerson(p.id); } },
  pdelalias: d => { const p = S.people.find(x => x.id === d.id); if (p) { p.aliases.splice(+d.i, 1); savePeople(); sPerson(p.id); } },
  pdel: d => { S.people = S.people.filter(x => x.id !== d.id); savePeople(); sPeople(); },
  rusave: () => { const text = ($('#ruText').value || '').trim(), cat = $('#ruCat').value; if (text.length < 3) { toast('Wpisz co najmniej 3 znaki'); return; } S.rules.push({ text, cat }); save(); rebuild(); sRules(); render(); toast('Reguła dodana'); },
  rudel: d => { S.rules.splice(+d.i, 1); save(); rebuild(); sRules(); render(); },
  ovdel: d => { delete S.overrides[d.k]; save(); rebuild(); sRules(); render(); },
  receipt: () => sReceipt(),
  gksave: () => { const v = $('#gk').value.trim(); if (v.length < 20) { toast('To nie wygląda na klucz'); return; } try { localStorage.setItem(GKEY, v); } catch { toast('Nie mogę zapisać klucza'); return; } sReceipt(); },
  rcsave: () => saveReceipt(),
  exportcsv: () => exportCSV(),
  rbgo: () => { if (!restoreArm) return; S = restoreArm; S.cashLog = S.cashLog || []; S.cash = S.cash || {}; S.receipts = S.receipts || {}; restoreArm = null; save(); rebuild(); closeSheet(); render(true); toast('Kopia przywrócona'); },
  export: () => { const b = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `budzet-kopia-${TODAY}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); },
  loaddemo: () => { S = fresh(); save(); rebuild(); closeSheet(); render(true); },
  wipe: (d, el) => { if (!wipeArm) { wipeArm = true; el.textContent = 'Na pewno? Dotknij ponownie'; setTimeout(() => { wipeArm = false; }, 4000); return; } wipeArm = false; S = fresh(); S.mode = 'real'; save(); rebuild(); closeSheet(); render(true); toast('Dane usunięte'); },
};
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && ACT[el.dataset.act]) { if (el.tagName === 'BUTTON' && el.disabled) return; ACT[el.dataset.act](el.dataset, el, e); } });
document.addEventListener('change', async e => {
  const el = e.target.closest('[data-change]'); if (!el) return;
  const k = el.dataset.change;
  if (k === 'imacc') { IM.accountId = el.value; IM.picked = true; if (IM.files.length) runImport(); else renderImport(); }
  else if (k === 'rbfile' && el.files[0]) restoreBackup(el.files[0]);
  else if (k === 'pfile' && el.files[0]) {
    try {
      const j = JSON.parse(await el.files[0].text()); if (!j || !Array.isArray(j.people)) throw 0;
      for (const np of j.people) { if (!np.name) continue; const ex = S.people.find(x => normName(x.name) === normName(np.name)); if (ex) { ex.role = np.role || ex.role; ex.aliases = [...new Set([...(ex.aliases || []), ...(np.aliases || [])])]; } else S.people.push({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), name: np.name, role: np.role || 'znajomy', aliases: np.aliases || [] }); }
      savePeople(); toast('Osoby wczytane');
    } catch { toast('To nie jest plik z osobami'); }
  }
  else if (k === 'pname') { const p = S.people.find(x => x.id === el.dataset.id); if (p && el.value.trim()) { p.name = el.value.trim(); savePeople(); } }
  else if (k === 'rupreview') rulePreview();
  else if (k === 'gkey') { const v = el.value.trim(); try { if (v) localStorage.setItem(GKEY, v); else localStorage.removeItem(GKEY); } catch { } toast(v ? 'Klucz zapisany' : 'Klucz usunięty'); }
  else if (k === 'rcfile' && el.files[0]) {
    openSheet('<h3>Czytam paragon…</h3><div class="muted small">To trwa kilka sekund.</div><div class="card flat" style="margin-top:16px;height:90px;opacity:.5;animation:pulse 1.2s infinite alternate"></div>');
    try { RC = await scanReceipt(el.files[0], gkey()); renderReceipt(); } catch (e) { openSheet(`<h3>Nie wyszło</h3><div class="muted small">${esc(e.message)}</div><button class="btn" style="margin-top:18px" data-act="receipt">Spróbuj ponownie</button>`); }
  }
  else if (k === 'imname') IM.newName = el.value;
  else if (k === 'imperson') { IM.newPerson = el.value; if (IM.files.length) runImport(); }
  else if (k === 'imfile' && el.files.length) {
    try { IM.files = await Promise.all([...el.files].map(async f => ({ name: f.name, text: decodeBuffer(await f.arrayBuffer()) }))); runImport(); } catch { toast('Nie mogę odczytać pliku'); }
  }
});
document.addEventListener('input', e => { if (e.target.id === 'ruText') rulePreview(); });
addEventListener('hashchange', () => { const v = (location.hash || '#dzis').slice(1); if (VIEWS[v] && v !== VIEW) { VIEW = v; render(true); } else if (VIEWS[v]) render(true); });

/* ---------- start ---------- */
rebuild();
render(true);
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });

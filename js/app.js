import { fmtInt, CATS, CAT, analyze, budgetState, insights, suggestPlan, monthTotals, monthKey, addMonths, dnum, plDate, money } from './engine.js';
import { demoData, DEMO_ACCOUNTS } from './demo.js';
import { decodeBuffer, importCSV, FIELDS } from './parsers.js';

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
  chev: '<path d="M9 6l6 6-6 6"/>',
};
const svg = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

/* ---------- stan ---------- */
const KEY = 'budzet.v1';
const fresh = () => ({ v: 1, mode: 'demo', accounts: [], raw: [], overrides: {}, plan: {}, savings: 1500, cancel: {} });
let S = (() => { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && j.v === 1) return j; } catch { } return fresh(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } };
const accounts = () => (S.mode === 'demo' ? DEMO_ACCOUNTS : S.accounts);
const accName = id => (accounts().find(a => a.id === id) || { name: id }).name;

let TX = [], REC = [], BS, INS;
function rebuild() {
  TX = (S.mode === 'demo' ? demoData(TODAY) : S.raw).map(t => ({ ...t }));
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
  <div style="display:flex;gap:8px;align-items:center">${S.mode === 'demo' ? '<span class="pill demo">Demo</span>' : ''}<button class="iconbtn" data-act="settings" aria-label="Ustawienia">${svg(I.gear)}</button></div></div>`;
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
  const row = r => `<button class="row" data-act="rec" data-k="${esc(r.key)}"><div class="ico" style="background:${CAT[r.cat].color}">${letter(r.name)}</div><div class="mid"><div class="t">${esc(r.name)} ${r.priceChange ? `<span class="badge warn">▲ ${money(r.priceChange.to - r.priceChange.from)}</span>` : ''}${S.cancel[r.key] ? '<span class="badge acc">do rezygnacji</span>' : ''}</div><div class="s">${esc(r.periodLabel)} · ${r.active ? 'następna ' + plDate(r.next) : 'ostatnio ' + plDate(r.last)} ${dots(r.persons)}</div></div><div class="amt num">${money(r.monthly)}${r.variable ? '<small>średnio</small>' : r.period !== 'monthly' ? `<small>${money(r.latest)} ${esc(r.periodLabel)}</small>` : ''}</div></button>`;
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
  ${ended.length ? `<div class="h2">Prawdopodobnie zakończone</div><div class="card flat" style="opacity:.7">${ended.map(row).join('')}</div>` : ''}
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

const VIEWS = { dzis: vDzis, wydatki: vWydatki, stale: vStale, plan: vPlan };
const TABS = [['dzis', 'Dziś'], ['wydatki', 'Wydatki'], ['add', ''], ['stale', 'Stałe'], ['plan', 'Plan']];

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
  <button class="opt" data-act="import"><span class="g">${svg(I.file)}</span><span><b>Wyciąg z banku (CSV)</b><span>ING, Alior, Revolut, mBank i inne banki</span></span></button>
  <button class="opt" disabled><span class="g">${svg(I.cam)}</span><span><b>Paragon ze zdjęcia</b><span>Skanowanie w następnym etapie</span></span></button>
  <button class="opt" data-act="manual"><span class="g">${svg(I.pen)}</span><span><b>Wydatek ręcznie</b><span>Gotówka i drobne zakupy</span></span></button>`);
}

/* import */
let IM = null;
function sImport() {
  const accs = accounts();
  IM = { accountId: accs.length && S.mode !== 'demo' ? accs[0].id : 'new', newId: 'k' + Date.now().toString(36), newName: '', newPerson: 'ja', text: null, res: null, file: '' };
  renderImport();
}
function renderImport() {
  const accs = S.mode === 'demo' ? [] : S.accounts, r = IM.res;
  let body = `<h3>Import wyciągu</h3><div class="muted small">Plik jest przetwarzany tylko w tym telefonie.</div>
  <label class="field"><span>Konto</span><select data-change="imacc">${accs.map(a => `<option value="${esc(a.id)}" ${IM.accountId === a.id ? 'selected' : ''}>${esc(a.name)} (${esc(PN[a.person])})</option>`).join('')}<option value="new" ${IM.accountId === 'new' ? 'selected' : ''}>＋ Nowe konto…</option></select></label>`;
  if (IM.accountId === 'new') body += `<label class="field"><span>Nazwa konta</span><input id="newName" placeholder="np. ING osobiste" value="${esc(IM.newName)}" data-change="imname"></label>
  <label class="field"><span>Właściciel</span><select data-change="imperson"><option value="ja" ${IM.newPerson === 'ja' ? 'selected' : ''}>Ja</option><option value="partnerka" ${IM.newPerson === 'partnerka' ? 'selected' : ''}>Partnerka</option></select></label>`;
  if (!r) body += `<label class="btn" style="margin-top:18px;cursor:pointer">Wybierz plik CSV<input type="file" accept=".csv,.txt,text/csv,text/plain" data-change="imfile" style="display:none"></label>`;
  else if (r.needsMapping) {
    body += `<div class="card flat" style="margin-top:14px"><b>Nie rozpoznałem układu kolumn.</b><div class="small muted">Wskaż, która kolumna co zawiera.</div></div><div class="mapgrid">${FIELDS.map(f => `<label class="field" style="margin-top:6px"><span>${f.label}</span><select data-change="immap" data-f="${f.id}"><option value="">— brak —</option>${r.columns.map((c, i) => `<option value="${i}" ${r.mapping[f.id] === i ? 'selected' : ''}>${esc(c || 'kolumna ' + (i + 1))}</option>`).join('')}</select></label>`).join('')}</div>
    <button class="btn" style="margin-top:16px" data-act="imapply">Zastosuj</button>`;
  } else {
    const have = new Set(S.raw.map(t => t.id)), fresh = r.txs.filter(t => S.mode === 'demo' || !have.has(t.id));
    const ds = r.txs.map(t => t.date).sort();
    body += `<div class="card flat" style="margin-top:14px">
      <div class="kv"><span class="muted">Bank</span><b>${esc(r.bank)}</b></div>
      ${r.check ? `<div class="kv"><span class="muted">Kontrola z podsumowaniem banku</span><b class="${r.check.ok ? 'pos' : 'neg'}">${r.check.ok ? 'zgodna ✓' : 'rozbieżność'}</b></div>` : ''}
      <div class="kv"><span class="muted">Wiersze w pliku</span><b class="num">${r.txs.length}</b></div>
      ${r.txs.some(t => t.pending) ? `<div class="kv"><span class="muted">W tym karta w toku</span><b class="num">${r.txs.filter(t => t.pending).length}</b></div>` : ''}
      <div class="kv"><span class="muted">Nowe</span><b class="num pos">${fresh.length}</b></div>
      <div class="kv"><span class="muted">Już były (pominę)</span><b class="num">${r.txs.length - fresh.length}</b></div>
      ${r.skipped.length ? `<div class="kv"><span class="muted">Nieważne (oczekujące, wymiany)</span><b class="num">${r.skipped.length}</b></div>` : ''}
      ${ds.length ? `<div class="kv"><span class="muted">Okres</span><b>${plDate(ds[0])} – ${plDate(ds[ds.length - 1])} ${ds[ds.length - 1].slice(0, 4)}</b></div>` : ''}</div>
    ${r.txs.some(t => t.currency !== 'PLN') ? '<div class="small muted" style="margin-top:8px">Waluty obce przeliczam przybliżonym kursem. Docelowo: kurs NBP z dnia transakcji.</div>' : ''}
    ${S.mode === 'demo' ? '<div class="small" style="margin-top:8px;color:var(--pa)">Dane demo zostaną zastąpione Twoimi.</div>' : ''}
    <button class="btn" style="margin-top:16px" data-act="imgo" ${fresh.length ? '' : 'disabled'}>Zaimportuj ${fresh.length} ${fresh.length === 1 ? 'transakcję' : 'transakcji'}</button>
    <button class="btn ghost" style="margin-top:10px" data-act="imreset">Wybierz inny plik</button>`;
  }
  openSheet(body);
}
function runImport(mapping) {
  const person = IM.accountId === 'new' ? IM.newPerson : (S.accounts.find(a => a.id === IM.accountId) || {}).person || 'ja';
  const acc = IM.accountId === 'new' ? IM.newId : IM.accountId;
  IM.res = importCSV(IM.text, { account: acc, person, mapping: mapping || null, headerIndex: mapping ? (IM.res ? IM.res.headerIndex : 0) : null });
  if (IM.accountId === 'new' && !IM.newName && IM.res.bank && IM.res.bank !== 'Nieznany bank') IM.newName = IM.res.bank;
  renderImport();
}
function commitImport() {
  const r = IM.res; if (!r || r.needsMapping) return;
  if (S.mode === 'demo') { S.mode = 'real'; S.raw = []; S.accounts = []; S.overrides = {}; S.plan = {}; S.cancel = {}; }
  let accId = IM.accountId;
  if (accId === 'new') { S.accounts.push({ id: IM.newId, name: (IM.newName || r.bank || 'Konto').trim(), person: IM.newPerson }); accId = IM.newId; }
  const have = new Set(S.raw.map(t => t.id)), add = r.txs.filter(t => !have.has(t.id)).map(({ id, date, amount, currency, merchant, title, account, person, balance, pending }) => ({ id, date, amount, currency, merchant, title, account, person, balance, ...(pending ? { pending: true } : {}) }));
  S.raw.push(...add); S.raw = reconcilePending(S.raw);
  const ac = S.accounts.find(a => a.id === accId); if (ac && r.owner && !ac.owner) ac.owner = r.owner; // do rozpoznawania przelewów własnych
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
  ${S.mode === 'demo' ? '<div class="small" style="margin-top:10px;color:var(--pa)">Dane demo zostaną zastąpione Twoimi.</div>' : ''}
  <button class="btn" style="margin-top:18px" data-act="msave">Zapisz</button>`);
}
function saveManual() {
  const amt = parseFloat(String($('#mAmt').value).replace(',', '.')), name = $('#mName').value.trim();
  if (!(amt > 0) || !name) { toast('Podaj kwotę i nazwę'); return; }
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
  <button class="btn ${S.cancel[key] ? 'ghost' : ''}" style="margin-top:18px" data-act="cancelmark" data-k="${esc(key)}">${S.cancel[key] ? 'Zostawiam, odznacz' : 'Rozważam rezygnację'}</button>`);
}

function sSettings() {
  const n = TX.length;
  openSheet(`<h3>Ustawienia</h3>
  <div class="card flat" style="margin-top:12px"><div class="kv"><span class="muted">Dane</span><b>${S.mode === 'demo' ? 'Demo (zmyślone)' : 'Własne'}</b></div><div class="kv"><span class="muted">Transakcje</span><b class="num">${n}</b></div>
  ${accounts().map(a => `<div class="kv"><span>${esc(a.name)}</span><span>${dots([a.person])} ${esc(PN[a.person])}</span></div>`).join('')}</div>
  <div class="row" style="margin-top:8px"><div class="mid"><div class="t">Miesięczne oszczędności</div><div class="s">odejmuję od planu na życie</div></div><span class="step"><button data-act="sav" data-d="-100" aria-label="Mniej">−</button><span class="n">${money(S.savings)}</span><button data-act="sav" data-d="100" aria-label="Więcej">+</button></span></div>
  <button class="btn ghost" style="margin-top:14px" data-act="export" ${S.mode === 'demo' ? 'disabled' : ''}>Pobierz kopię danych (JSON)</button>
  ${S.mode === 'demo' ? '' : '<button class="btn ghost" style="margin-top:10px" data-act="loaddemo">Wróć do danych demo</button>'}
  <button class="btn ghost" style="margin-top:10px;color:var(--warn)" data-act="wipe" ${S.mode === 'demo' ? 'disabled' : ''}>Usuń wszystkie moje dane</button>
  <div class="small muted" style="margin-top:16px">Budżet v0.1 (prototyp). Dane są tylko w tym urządzeniu. Synchronizacja z partnerką pojawi się w następnym etapie.</div>`);
}

/* ---------- zdarzenia ---------- */
let wipeArm = false;
const ACT = {
  nav: d => { VIEW = d.to; location.hash = '#' + d.to; closeSheet(); },
  add: () => sAdd(), import: () => sImport(), manual: () => sManual(), msave: () => saveManual(), settings: () => sSettings(),
  month: d => { U.mk = d.m; U.cat = null; U.limit = 50; render(); },
  who: d => { U.who = d.w; U.cat = null; U.limit = 50; render(); },
  cat: d => { U.cat = U.cat === d.c ? null : d.c; U.limit = 50; render(); },
  more: () => { U.limit += 50; render(); },
  tx: d => sTx(d.id), rec: d => sRec(d.k),
  setcat: d => { const t = TX.find(x => x.id === d.id); S.overrides[t.mkey] = d.c; save(); rebuild(); closeSheet(); render(); toast(`${t.name}: ${CAT[d.c].name}`); },
  cancelmark: d => { S.cancel[d.k] = !S.cancel[d.k]; if (!S.cancel[d.k]) delete S.cancel[d.k]; save(); closeSheet(); render(); },
  imapply: () => { const m = {}; pane.querySelectorAll('[data-f]').forEach(s => { if (s.value !== '') m[s.dataset.f] = +s.value; }); runImport(m); },
  imgo: () => commitImport(), imreset: () => { IM.res = null; IM.text = null; renderImport(); },
  psave: d => { const P = planData(); S.plan[P.mk] = { limits: { ...P.limits }, savings: Math.max(0, P.savings + +d.d) }; save(); render(); },
  plimit: d => { const P = planData(); const l = { ...P.limits }; l[d.c] = Math.max(0, (l[d.c] || 0) + +d.d); S.plan[P.mk] = { limits: l, savings: P.savings }; save(); render(); },
  pconfirm: () => { const P = planData(); S.plan[P.mk] = { limits: { ...P.limits }, savings: P.savings }; save(); render(); toast('Plan zapisany'); },
  preset: () => { delete S.plan[planMonth()]; save(); render(); toast('Przywrócono propozycję'); },
  sav: d => { S.savings = Math.max(0, S.savings + +d.d); save(); rebuild(); sSettings(); render(); },
  export: () => { const b = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `budzet-kopia-${TODAY}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); },
  loaddemo: () => { S = fresh(); save(); rebuild(); closeSheet(); render(true); },
  wipe: (d, el) => { if (!wipeArm) { wipeArm = true; el.textContent = 'Na pewno? Dotknij ponownie'; setTimeout(() => { wipeArm = false; }, 4000); return; } wipeArm = false; S = fresh(); S.mode = 'real'; save(); rebuild(); closeSheet(); render(true); toast('Dane usunięte'); },
};
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && ACT[el.dataset.act]) { if (el.tagName === 'BUTTON' && el.disabled) return; ACT[el.dataset.act](el.dataset, el, e); } });
document.addEventListener('change', async e => {
  const el = e.target.closest('[data-change]'); if (!el) return;
  const k = el.dataset.change;
  if (k === 'imacc') { IM.accountId = el.value; if (IM.text) runImport(); else renderImport(); }
  else if (k === 'imname') IM.newName = el.value;
  else if (k === 'imperson') { IM.newPerson = el.value; if (IM.text) runImport(); }
  else if (k === 'imfile' && el.files[0]) {
    try { IM.file = el.files[0].name; IM.text = decodeBuffer(await el.files[0].arrayBuffer()); runImport(); } catch { toast('Nie mogę odczytać pliku'); }
  }
});
addEventListener('hashchange', () => { const v = (location.hash || '#dzis').slice(1); if (VIEWS[v] && v !== VIEW) { VIEW = v; render(true); } else if (VIEWS[v]) render(true); });

/* ---------- start ---------- */
rebuild();
render(true);
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });

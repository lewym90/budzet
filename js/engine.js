// Silnik analiz. Czysty kod, bez AI: te same reguły dla każdego konta i każdego banku.
// Wszystkie liczby w aplikacji pochodzą stąd.

export const CATS = [
  { id: 'jedzenie',    name: 'Jedzenie',                color: '#3987e5', variable: true },
  { id: 'mieszkanie',  name: 'Mieszkanie i rachunki',   color: '#d95926', variable: false },
  { id: 'subskrypcje', name: 'Subskrypcje',             color: '#199e70', variable: false },
  { id: 'transport',   name: 'Transport',               color: '#c98500', variable: true },
  { id: 'restauracje', name: 'Restauracje i kawiarnie', color: '#d55181', variable: true },
  { id: 'zakupy',      name: 'Zakupy i dom',            color: '#008300', variable: true },
  { id: 'zdrowie',     name: 'Zdrowie i uroda',         color: '#9085e9', variable: true },
  { id: 'rozrywka',    name: 'Rozrywka i podróże',      color: '#e66767', variable: true },
  { id: 'gotowka',     name: 'Gotówka',                 color: '#b8a06a', variable: true },
  { id: 'inne',        name: 'Inne',                    color: '#7d8aa3', variable: true },
  { id: 'dochod',      name: 'Wpływy',                  color: '#2ee6a6', variable: false },
  { id: 'przelew',     name: 'Przelew własny',          color: '#7d8aa3', variable: false },
  { id: 'nieregularny', name: 'Wpływ nieregularny',     color: '#7d8aa3', variable: false },
];
export const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));

// kursy przybliżone; wersja docelowa pobiera kurs NBP z dnia transakcji
export const RATES = { PLN: 1, EUR: 4.27, USD: 3.95, GBP: 4.95, CZK: 0.17, CHF: 4.5 };

// [wzorzec, nazwa, kategoria, grupa, subskrypcja?, stały rachunek?, opcje]
// opcje: own = przelew własny, irr = wpływ nieregularny, offset = wypłata pomniejsza wydatki kategorii, multi = kilka różnych kwot
const RULES = [
  [/WYPLATA GOTOWKI|WYPLATA Z BANKOMATU|CASH WITHDRAWAL|\bATM\b/, 'Wypłata z bankomatu', 'gotowka'],
  [/PROWIZJA ZA WYPLAT|OPLATA ZA WYPLAT|OPL\.? ?ZA WYPLAT/, 'Prowizje bankowe', 'inne', 'Bank'],
  [/PROW\.? ?I OPL|ZWIEKSZENIE LIM/, 'Opłaty za limit w koncie', 'inne', 'Dług'],
  [/URZAD SKARBOWY|PIT-?\d|\bZUS\b/, 'Podatki i urzędy', 'inne'],
  [/GMINA|ODPAD/, 'Odpady i opłaty gminne', 'mieszkanie', null, 0, 1],
  [/KAUCJA/, 'Kaucja', 'inne'],
  [/FOODSI|CUKIERN|KARMELLO|\bALDI\b|TOM MARKET|INTERMARCHE|SPOMLEK|DELIKATESY|PIEKARN|LODZIARN|SKLEP ABC|MAKRO|CARREFOUR/, 'Sklep spożywczy', 'jedzenie'],
  [/KARCZMA|BISTRO|CAFE\b|KAWIARN/, 'Restauracja i bar', 'restauracje'],
  [/\bCLUB\b|\bZOO\b|RAGNAROK|MUNDO|DYSKOTEK|BOWLING/, 'Rozrywka', 'rozrywka'],
  [/PANDORA|\bCHIC\b|CROPP|\bLPP\b|CALZEDONIA|KIK TEXTIL|RITUALS|DEALZ|VINTED|MEDIAPRESS|KWIACIARNIA|GO SHOPPING|ALIEXPRESS/, 'Zakupy i moda', 'zakupy'],
  [/WETERYN|ALAB|DIAGNOSTYK/, 'Zdrowie i weterynarz', 'zdrowie'],
  [/AUTO[- ]?(MIX|PERFEKT)|MYJNIA|WULKANIZ|WARSZTAT/, 'Auto', 'transport'],
  [/KREA\.?AI/, 'Krea', 'subskrypcje', 'AI', 1],
  [/PROWIZJA ZA PRZEWALUTOWANIE/, 'Prowizje za przewalutowanie', 'inne', 'Bank'],
  [/ODS - KRED|OBSL\.? ?LIMITU|LIMITU ZADL/, 'Koszt zadłużenia w koncie', 'inne', 'Dług'],
  [/LIMIT W KONCIE/, 'Limit w koncie', 'inne', null, 0, 0, { own: 1 }],
  [/PRZELEW WLASNY/, 'Przelew własny', 'inne', null, 0, 0, { own: 1 }],
  [/REVOLUT\*\*|REVOLUT BANK/, 'Revolut (doładowanie)', 'inne', null, 0, 0, { own: 1 }],
  [/KASYNA|LOTERIE|BETCLIC|BEM OPERATIONS|FORTUNA|SUPERBET|\bSTS\b|TOTALIZATOR/, 'Zakłady online', 'rozrywka', null, 0, 0, { offset: 1 }],
  [/ADYEN|PAYPRO/, 'Wypłaty z serwisów', 'inne', null, 0, 0, { irr: 1 }],
  [/APTEKA|ZIKO|\bDOZ\b/, 'Apteka', 'zdrowie'],
  [/LUX ?MED|MEDICOVER|ENEL-?MED/, 'Opieka medyczna', 'zdrowie'],
  [/ROSSMANN|HEBE|SEPHORA|DOUGLAS|BARBER|FRYZJER|KOSMETYK/, 'Uroda i drogeria', 'zdrowie'],
  [/NETFLIX/, 'Netflix', 'subskrypcje', 'Streaming', 1],
  [/DODATEK DO PRIME/, 'Prime Video (dodatek)', 'subskrypcje', 'Streaming', 1],
  [/AMAZON ?PRIME|AMZNPRIME|PRIME ?VIDEO/, 'Amazon Prime', 'subskrypcje', 'Streaming', 1],
  [/DISNEY/, 'Disney+', 'subskrypcje', 'Streaming', 1],
  [/HBO|MAX\.COM/, 'Max', 'subskrypcje', 'Streaming', 1],
  [/SPOTIFY/, 'Spotify', 'subskrypcje', 'Muzyka', 1],
  [/YOUTUBE/, 'YouTube Premium', 'subskrypcje', 'Streaming', 1],
  [/APPLE\.COM\/BILL|ICLOUD/, 'Apple', 'subskrypcje', 'Apple', 1, 0, { multi: 1 }],
  [/GOOGLE PLAY/, 'Google Play', 'subskrypcje', 'Aplikacje', 1, 0, { multi: 1 }],
  [/OPENAI|CHATGPT/, 'ChatGPT', 'subskrypcje', 'AI', 1],
  [/ANTHROPIC|CLAUDE/, 'Claude', 'subskrypcje', 'AI', 1],
  [/GEMINI|GOOGLE ?ONE|GOOGLE ?AI/, 'Gemini', 'subskrypcje', 'AI', 1],
  [/X\.AI|GROK/, 'Grok', 'subskrypcje', 'AI', 1],
  [/GAMMA/, 'Gamma', 'subskrypcje', 'AI', 1],
  [/SUNO/, 'Suno', 'subskrypcje', 'AI', 1],
  [/FACELESSREEL/, 'FacelessReel', 'subskrypcje', 'AI', 1],
  [/CANVA/, 'Canva', 'subskrypcje', 'Projektowanie', 1],
  [/DROPBOX/, 'Dropbox', 'subskrypcje', 'Chmura', 1],
  [/ZDROFIT|BENEFIT|FITNESS|CALYPSO|CITYFIT|MYFITNESS|SILOWNIA|MAGIC ?GYM/, 'Siłownia', 'subskrypcje', 'Fitness', 1],
  [/BIEDRONKA/, 'Biedronka', 'jedzenie'],
  [/LIDL/, 'Lidl', 'jedzenie'],
  [/ZABKA/, 'Żabka', 'jedzenie'],
  [/AUCHAN/, 'Auchan', 'jedzenie'],
  [/CARREFOUR/, 'Carrefour', 'jedzenie'],
  [/KAUFLAND/, 'Kaufland', 'jedzenie'],
  [/\bDINO\b|STOKROTKA|NETTO/, 'Sklep spożywczy', 'jedzenie'],
  [/PYSZNE|GLOVO|WOLT|UBER ?EATS/, 'Dostawa jedzenia', 'restauracje'],
  [/MCDONALD/, "McDonald's", 'restauracje'],
  [/STARBUCKS|COSTA COFFEE|COFFEE/, 'Kawiarnia', 'restauracje'],
  [/\bKFC\b|BURGER|PIZZ|RESTAURAC|KEBAB|WHISKEY|\bPUB\b/, 'Restauracja i bar', 'restauracje'],
  [/ORLEN/, 'Orlen', 'transport'],
  [/SHELL/, 'Shell', 'transport'],
  [/CIRCLE ?K|MOYA|\bBP\b|STACJA PALIW|OKTAN|\bAMIC\b|\bMOL\b/, 'Stacja paliw', 'transport'],
  [/UBER|BOLT|FREE ?NOW/, 'Taxi', 'transport'],
  [/JAKDOJADE|\bZTM\b|KOLEJE|\bPKP\b|INTERCITY/, 'Bilety', 'transport'],
  [/ALLEGRO/, 'Allegro', 'zakupy'],
  [/AMAZON|ZALANDO|ZARA|H&M|RESERVED|EMPIK|MEDIAMARKT|RTV ?EURO|SINSAY|TEMU|KRUK|PEPCO|\bACTION\b|DECATHLON/, 'Zakupy i moda', 'zakupy'],
  [/LEROY|IKEA|CASTORAMA|\bOBI\b|JYSK/, 'Dom i ogród', 'zakupy'],
  [/HELIOS|CINEMA ?CITY|MULTIKINO|STEAM|BOOKING|AIRBNB|RYANAIR|WIZZ|\bLOT\b/, 'Rozrywka i podróże', 'rozrywka'],
  [/TAURON|\bPGE\b|ENEA|ENERGA/, 'Prąd', 'mieszkanie', null, 0, 1],
  [/PGNIG|GAZOWNIA/, 'Gaz', 'mieszkanie', null, 0, 1],
  [/ORANGE/, 'Orange', 'mieszkanie', null, 0, 1],
  [/T-MOBILE/, 'T-Mobile', 'mieszkanie', null, 0, 1],
  [/\bPLAY\b|\bP4\b/, 'Play', 'mieszkanie', null, 0, 1],
  [/\bPLUS\b/, 'Plus', 'mieszkanie', null, 0, 1],
  [/VECTRA|NETIA|\bUPC\b/, 'Internet i TV', 'mieszkanie', null, 0, 1],
  [/CZYNSZ|WSPOLNOTA|SPOLDZIELNIA|WYNAJEM/, 'Czynsz', 'mieszkanie', null, 0, 1],
  [/KREDYT|HIPOTEK|RATA KREDYTU/, 'Rata kredytu', 'mieszkanie', null, 0, 1],
  [/UBEZPIECZ|\bPZU\b|WARTA|ALLIANZ|COMPENSA/, 'Ubezpieczenie', 'mieszkanie', null, 0, 1],
];

const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');
const ruleCache = new Map();
export function matchRule(raw) {
  const s = strip(raw).toUpperCase();
  if (ruleCache.has(s)) return ruleCache.get(s);
  let r = null;
  for (const [re, name, cat, tag, sub, fixed, o] of RULES) {
    if (re.test(s)) { r = { name, cat, tag: tag || null, sub: !!sub, fixed: !!fixed, ...(o || {}) }; break; }
  }
  ruleCache.set(s, r);
  return r;
}

const NOISE = /\b(PLATNOSC|KARTA|KARTOWA|TRANSAKCJA|ZAKUP|NR|OPERACJA|PRZELEW|POS|ZAKUPY|PL|WARSZAWA|KRAKOW|WROCLAW|GDANSK|POZNAN|SP|Z O O|SA|S A)\b/g;
export function merchantKey(raw) {
  const r = matchRule(raw);
  if (r) return r.name.toUpperCase();
  const s = strip(raw).toUpperCase().replace(/[0-9*#/\\.,:;()_-]+/g, ' ').replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
  return s.split(' ').slice(0, 3).join(' ') || 'NIEZNANY';
}
const titleCase = s => s.toLowerCase().replace(/(^|[\s.,(-])\S/g, m => m.toUpperCase());
function cleanName(raw) {
  let s = String(raw || '').replace(/\+\d[\d\s]{6,}/g, ' ').replace(/\b\d{2}-\d{3}\b/g, ' ').replace(/\b\d{5}\b/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/\s+(POL|IRL|USA|MLT|NLD|GBR|DEU|LTU|CZE|CYP|EST)$/i, '').trim();
  if (s && s === s.toUpperCase()) s = titleCase(s);
  return s.slice(0, 30) || 'Nieznany';
}
const tokens = s => strip(s).toUpperCase().replace(/[^A-Z ]+/g, ' ').split(/\s+/).filter(w => w.length > 1);
let OWNERS = [];
export function setOwners(list) { OWNERS = (list || []).map(n => new Set(tokens(n))).filter(x => x.size >= 2); }
function isOwnName(t) {
  if (!OWNERS.length || /PLATNOSC KART|BLIK/.test(strip(t.title).toUpperCase())) return false;
  const tk = tokens(t.merchant);
  return OWNERS.some(o => [...o].every(w => tk.includes(w)) && tk.length <= o.size + 8);
}

export const dnum = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
export const dstr = n => new Date(n * 864e5).toISOString().slice(0, 10);
export const monthKey = s => s.slice(0, 7);
export const addMonths = (mk, k) => { const [y, m] = mk.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + k, 1)); return d.toISOString().slice(0, 7); };
export const daysIn = mk => { const [y, m] = mk.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const sum = a => a.reduce((x, y) => x + y, 0);

// uzupełnia transakcję: kwota w PLN, sprzedawca, kategoria
export function prepare(t, overrides = {}) {
  t.amountPLN = +(t.amount * (RATES[t.currency || 'PLN'] || 1)).toFixed(2);
  const raw = `${t.merchant || ''} ${t.title || ''}`;
  const rule = matchRule(raw) || matchRule(t.merchant || '');
  t.mkey = merchantKey(rule ? raw : (t.merchant || t.title || ''));
  t.rule = rule;
  t.name = rule ? rule.name : cleanName(t.merchant || t.title);
  t.cat = overrides[t.mkey] || (t.amountPLN > 0 ? 'dochod' : rule ? rule.cat : 'inne');
  t.tag = rule ? rule.tag : null;
  t.own = !!(rule && rule.own) || isOwnName(t) || t.cat === 'przelew';
  t.irr = t.amountPLN > 0 && (!!(rule && rule.irr) || t.cat === 'nieregularny');
  t.offset = t.amountPLN > 0 && !!(rule && rule.offset);
  if (t.offset) t.cat = rule.cat;
  return t;
}

// przelewy między własnymi kontami: nie są ani wydatkiem, ani wpływem
export function detectTransfers(txs) {
  for (const t of txs) t.internal = !!t.own;
  const out = txs.filter(t => t.amountPLN < 0 && !t.internal), inc = txs.filter(t => t.amountPLN > 0 && !t.internal);
  const used = new Set();
  for (const o of out) {
    let best = null, bd = 9;
    for (const i of inc) {
      if (used.has(i) || i.account === o.account) continue;
      const dd = Math.abs(dnum(i.date) - dnum(o.date));
      if (dd > 3) continue;
      const a = -o.amountPLN, b = i.amountPLN;
      if (Math.abs(a - b) / a > (o.currency !== i.currency ? 0.05 : 0.001)) continue;
      if (dd < bd) { best = i; bd = dd; }
    }
    if (best) { used.add(best); o.internal = best.internal = true; o.cat = best.cat = 'inne'; }
  }
}

const PERIODS = [
  { id: 'weekly',    label: 'co tydzień',   lo: 6,   hi: 8,   tol: 1,  factor: 52 / 12 },
  { id: 'biweekly',  label: 'co 2 tygodnie', lo: 13, hi: 15,  tol: 2,  factor: 26 / 12 },
  { id: 'monthly',   label: 'miesięcznie',  lo: 26,  hi: 35,  tol: 5,  factor: 1 },
  { id: 'quarterly', label: 'co kwartał',   lo: 85,  hi: 97,  tol: 8,  factor: 1 / 3 },
  { id: 'yearly',    label: 'rocznie',      lo: 350, hi: 380, tol: 20, factor: 1 / 12 },
];
const FREE_CATS = new Set(['jedzenie', 'restauracje', 'transport', 'zakupy', 'zdrowie', 'rozrywka']);

// stałe opłaty i subskrypcje: ten sam sprzedawca, regularny odstęp, podobna kwota
function detectGroup(arr, key, name, today) {
  arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last = arr[arr.length - 1], rule = last.rule;
  const isSub = !!(rule && rule.sub), isFixed = !!(rule && rule.fixed);
  if (!isSub && !isFixed && FREE_CATS.has(last.cat)) return null;
  if (arr.length < (isSub ? 2 : 3)) return null;
  const days = arr.map(t => dnum(t.date));
  const gaps = days.slice(1).map((d, i) => d - days[i]).filter(g => g > 0);
  if (!gaps.length) return null;
  const g = median(gaps);
  const P = PERIODS.find(p => g >= p.lo && g <= p.hi);
  if (!P) return null;
  if (gaps.filter(x => Math.abs(x - g) <= P.tol + 1).length / gaps.length < 0.7) return null;
  const amts = arr.map(t => -t.amountPLN), n = amts.length;
  let priceChange = null;
  if (n >= 4) {
    const early = amts.slice(0, n - 2), em = median(early);
    const es = Math.max(...early.map(a => Math.abs(a - em) / em));
    const late = amts.slice(n - 2);
    if (es <= 0.05 && Math.abs(late[0] - late[1]) / late[1] <= 0.03 && Math.abs(late[1] - em) / em > 0.06 && Math.abs(late[1] - em) >= 1)
      priceChange = { from: em, to: late[1] };
  }
  const med = median(amts);
  const spread = Math.max(...amts.map(a => Math.abs(a - med) / med));
  if (spread > 0.5 && !priceChange) return null;
  const variable = !priceChange && spread > 0.08;
  const latest = priceChange ? priceChange.to : variable ? sum(amts.slice(-3)) / Math.min(3, n) : amts[n - 1];
  const next = dstr(days[days.length - 1] + Math.round(g));
  const overdue = dnum(today) - dnum(next);
  const card = /PLATNOSC KART|BLIK/.test(strip(last.title).toUpperCase());
  return {
    arr, item: {
      key, name, cat: isSub ? 'subskrypcje' : last.cat, tag: last.tag,
      kind: isSub ? 'subskrypcja' : isFixed ? 'stała opłata' : card ? 'płatność cykliczna' : 'przelew cykliczny',
      period: P.id, periodLabel: P.label,
      latest, monthly: latest * P.factor, yearly: latest * P.factor * 12,
      count: n, first: arr[0].date, last: last.date, next, active: overdue <= Math.max(10, 0.35 * g), variable, priceChange,
      persons: [...new Set(arr.map(t => t.person))], accounts: [...new Set(arr.map(t => t.account))],
    },
  };
}

// kwoty bliskie sobie (do 3%) trafiają do jednej grupy: np. kilka subskrypcji Apple pod jednym sprzedawcą
function clusterByAmount(arr) {
  const s = [...arr].sort((a, b) => a.amountPLN - b.amountPLN), out = [];
  for (const t of s) {
    const c = out[out.length - 1];
    if (c && Math.abs(t.amountPLN - c[c.length - 1].amountPLN) / Math.abs(c[c.length - 1].amountPLN) <= 0.03) c.push(t); else out.push([t]);
  }
  return out;
}

export function detectRecurring(txs, today) {
  const groups = new Map();
  for (const t of txs) {
    if (t.internal || t.amountPLN >= 0) continue;
    const gk = `${t.mkey}|${t.account}`; // ten sam sprzedawca na różnych kontach to osobne opłaty
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk).push(t);
  }
  const out = [];
  for (const [gk, arr] of groups) {
    const rule = arr[0].rule, base = arr[arr.length - 1].name;
    let found = (rule && rule.multi) ? null : detectGroup(arr, gk, base, today);
    if (found) { for (const t of found.arr) t.recKey = gk; out.push(found.item); continue; }
    if (new Set(arr.map(t => Math.round(t.amountPLN))).size < 2 && !(rule && rule.multi)) continue;
    for (const c of clusterByAmount(arr)) {
      if (c.length < 2) continue;
      const m = median(c.map(t => -t.amountPLN)), k = `${gk}|${Math.round(m)}`;
      const f = detectGroup(c, k, `${base} ${money(m, 2)}`, today);
      if (f) { for (const t of f.arr) t.recKey = k; out.push(f.item); }
    }
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}

export function monthTotals(txs, mk) {
  let income = 0, irregular = 0, spent = 0, variable = 0; const byCat = {};
  for (const t of txs) {
    if (t.internal || monthKey(t.date) !== mk) continue;
    if (t.amountPLN > 0) {
      if (t.offset) { spent -= t.amountPLN; byCat[t.cat] = (byCat[t.cat] || 0) - t.amountPLN; if (!t.recKey) variable -= t.amountPLN; }
      else if (t.irr) irregular += t.amountPLN;
      else income += t.amountPLN;
      continue;
    }
    const v = -t.amountPLN; spent += v;
    byCat[t.cat] = (byCat[t.cat] || 0) + v;
    if (!t.recKey) variable += v;
  }
  return { income, irregular, spent, variable, byCat };
}

export function fullMonthsBefore(txs, mk, k = 3) {
  const have = new Set(txs.map(t => monthKey(t.date)));
  const first = txs.reduce((m, t) => (t.date < m ? t.date : m), '9999-99-99');
  const res = [];
  for (let i = 1; i <= k + 2 && res.length < k; i++) {
    const m = addMonths(mk, -i);
    if (!have.has(m)) continue;
    if (dnum(m + '-01') < dnum(first) - 3) continue; // miesiąc zaczęty przed początkiem danych = niepełny
    res.push(m);
  }
  return res;
}

export function variableByCat(txs, mk) {
  const o = {};
  for (const t of txs) {
    if (t.internal || t.recKey || monthKey(t.date) !== mk) continue;
    if (t.amountPLN >= 0 && !t.offset) continue;
    o[t.cat] = (o[t.cat] || 0) + -t.amountPLN;
  }
  return o;
}

// bieżący stan budżetu: ile można jeszcze wydać dziś, bez ruszania stałych opłat
export function budgetState(txs, rec, today, savings = 0) {
  const mk = monthKey(today), day = +today.slice(8, 10), dim = daysIn(mk), daysLeft = dim - day + 1;
  const prev = fullMonthsBefore(txs, mk, 3);
  const cur = monthTotals(txs, mk);
  const avgIncome = prev.length ? sum(prev.map(m => monthTotals(txs, m).income)) / prev.length : 0;
  const income = Math.max(avgIncome, cur.income);
  const fixed = sum(rec.filter(r => r.active).map(r => r.monthly));
  const budget = Math.max(0, income - fixed - savings);
  const spentToday = sum(txs.filter(t => !t.internal && !t.recKey && t.amountPLN < 0 && t.date === today).map(t => -t.amountPLN));
  const spentBefore = cur.variable - spentToday;
  const dailyLimit = Math.max(0, budget - spentBefore) / daysLeft;
  const pace = day > 0 ? (cur.variable / day) * dim : 0;
  return { mk, day, dim, daysLeft, prevCount: prev.length, income, fixed, savings, budget, spent: cur.variable, spentToday,
    remaining: budget - cur.variable, dailyLimit, leftToday: dailyLimit - spentToday, pace, curIncome: cur.income };
}

export function suggestPlan(txs, mkTarget, rec, savings = 0) {
  const prev = fullMonthsBefore(txs, mkTarget, 3);
  const limits = {};
  for (const c of CATS.filter(c => c.variable)) {
    const vals = prev.map(m => variableByCat(txs, m)[c.id] || 0);
    const avg = vals.length ? sum(vals) / vals.length : 0;
    limits[c.id] = Math.ceil(avg / 10) * 10;
  }
  const avgIncome = prev.length ? sum(prev.map(m => monthTotals(txs, m).income)) / prev.length : 0;
  return { limits, income: avgIncome, fixed: sum(rec.filter(r => r.active).map(r => r.monthly)), savings, prevMonths: prev };
}

export function insights(txs, rec, today, bs) {
  const out = [];
  const act = rec.filter(r => r.active);
  for (const r of act.filter(r => r.priceChange)) {
    const d = r.priceChange.to - r.priceChange.from;
    out.push({ id: 'price-' + r.key, tone: 'warn', rank: 1, title: `${r.name} podrożał o ${money(d)}`,
      body: `Było ${money(r.priceChange.from)}, jest ${money(r.priceChange.to)}. To ${money(d * 12)} więcej rocznie.`, go: 'stale' });
  }
  const tags = {};
  for (const r of act) if (r.tag) (tags[r.tag] = tags[r.tag] || []).push(r);
  for (const [tag, list] of Object.entries(tags)) {
    if (tag !== 'AI' && tag !== 'Streaming') continue; // tylko grupy, w których usługi się pokrywają
    const need = tag === 'AI' ? 3 : 2;
    if (list.length >= need) {
      const m = sum(list.map(r => r.monthly));
      out.push({ id: 'tag-' + tag, tone: 'info', rank: 2,
        title: tag === 'AI' ? `${list.length} usług AI kosztuje ${money(m)} miesięcznie` : `${list.length} serwisy streamingowe: ${money(m)} miesięcznie`,
        body: `${list.map(r => r.name).join(', ')}. To ${money(m * 12)} rocznie. Sprawdź, z których naprawdę korzystacie.`, go: 'stale' });
    }
  }
  // możliwe podwójne obciążenie: ta sama kwota u tego samego sprzedawcy w ciągu doby (bez zakupów, które z natury się powtarzają)
  const recent = txs.filter(t => !t.internal && !t.pending && t.amountPLN <= -25 && dnum(today) - dnum(t.date) <= 45 && !t.recKey
    && !['jedzenie', 'restauracje', 'transport', 'rozrywka'].includes(t.cat));
  const seen = new Set();
  for (const a of recent) for (const b of recent) {
    if (a === b || a.id >= b.id || a.mkey !== b.mkey || a.account !== b.account || a.amountPLN !== b.amountPLN) continue;
    if (Math.abs(dnum(a.date) - dnum(b.date)) > 1) continue;
    const k = a.mkey + a.amountPLN + a.date; if (seen.has(k)) continue; seen.add(k);
    out.push({ id: 'dup-' + k, tone: 'warn', rank: 0, title: `Podwójne obciążenie? ${a.name} ${money(-a.amountPLN)}`,
      body: `${a.date === b.date ? `Dwie takie same płatności tego samego dnia (${plDate(a.date)})` : `Dwie takie same płatności: ${plDate(a.date)} i ${plDate(b.date)}`}. Jeśli to pomyłka, zgłoś reklamację w banku.`, go: 'wydatki' });
  }
  const since = dnum(today) - 92;
  const debt = txs.filter(t => t.tag === 'Dług' && t.amountPLN < 0 && dnum(t.date) >= since);
  if (debt.length) {
    const d = sum(debt.map(t => -t.amountPLN));
    out.push({ id: 'debt', tone: 'warn', rank: 0, title: `Koszt zadłużenia w koncie: ${money(d)} w 3 miesiące`,
      body: `Odsetki od debetu i prowizja za limit, średnio ${money(d / 3)} miesięcznie. Spłata debetu to najpewniejsza oszczędność w tym budżecie.`, go: 'wydatki' });
  }
  const fx = txs.filter(t => t.tag === 'Bank' && t.amountPLN < 0 && dnum(t.date) >= since);
  if (fx.length >= 3) {
    const d = sum(fx.map(t => -t.amountPLN));
    out.push({ id: 'fx', tone: 'info', rank: 2, title: `Prowizje za płatności w obcych walutach: ${money(d, 2)}`,
      body: `${fx.length} opłat w ciągu 3 miesięcy. Płatności w USD i EUR kartą tego konta mają dodatkowy koszt przewalutowania.`, go: 'wydatki' });
  }
  if (bs && bs.budget > 0 && bs.day >= 5 && bs.prevCount >= 2) {
    const diff = bs.pace - bs.budget;
    if (diff > 0.05 * bs.budget) out.push({ id: 'pace', tone: 'warn', rank: 1, title: `Tempo wydatków przekracza plan o ${money(diff)}`,
      body: `Przy obecnym tempie codzienne wydatki wyniosą ${money(bs.pace)} przy planie ${money(bs.budget)}.`, go: 'plan' });
    else if (diff < -0.05 * bs.budget) out.push({ id: 'pace', tone: 'good', rank: 3, title: `Jesteś ${money(-diff)} do przodu`,
      body: `Przy obecnym tempie zostanie Ci ok. ${money(-diff)} z miesięcznego planu.`, go: 'plan' });
  }
  if (bs) {
    const prev = fullMonthsBefore(txs, bs.mk, 3);
    if (prev.length >= 2 && bs.day >= 10) {
      const cur = variableByCat(txs, bs.mk);
      for (const c of CATS.filter(c => c.variable && c.id !== 'inne')) {
        const avg = sum(prev.map(m => variableByCat(txs, m)[c.id] || 0)) / prev.length;
        const proj = (cur[c.id] || 0) / bs.day * bs.dim;
        if (avg > 150 && proj > avg * 1.25 && proj - avg > 120)
          out.push({ id: 'cat-' + c.id, tone: 'warn', rank: 2, title: `${c.name}: o ${Math.round((proj / avg - 1) * 100)}% więcej niż zwykle`,
            body: `Zwykle ${money(avg)} miesięcznie, w tym miesiącu zanosi się na ${money(proj)}.`, go: 'wydatki' });
      }
    }
  }
  return out.sort((a, b) => a.rank - b.rank);
}

const group = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
export const fmtInt = n => (n < 0 ? '\u2212' : '') + group(Math.abs(Math.round(n)).toString());
export function money(n, dec = 0) {
  const [i, f] = Math.abs(n).toFixed(dec).split('.');
  return `${group(i)}${f ? ',' + f : ''}\u00a0zł`;
}
export function plDate(s) {
  const m = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  return `${+s.slice(8, 10)} ${m[+s.slice(5, 7) - 1]}`;
}

export function dedupeKey(t) {
  return [t.account, t.date, t.amount.toFixed(2), strip(t.merchant || '').toUpperCase().slice(0, 30), strip(t.title || '').toUpperCase().slice(0, 40), t.balance ?? ''].join('|');
}

// przetwarza całość: kategorie, przelewy własne, stałe opłaty
export function analyze(txs, overrides, today, owners) {
  if (owners) setOwners(owners);
  for (const t of txs) { delete t.recKey; prepare(t, overrides); }
  detectTransfers(txs);
  const rec = detectRecurring(txs, today);
  return rec;
}

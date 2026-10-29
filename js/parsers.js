// Import wyciągów CSV. Każdy bank trafia do jednego wspólnego formatu:
// { id, date, amount, currency, merchant, title, account, person, balance }
// UWAGA: układy kolumn banków opisano z pamięci i sprawdzono tylko na plikach testowych.
// Przed użyciem na prawdziwych danych trzeba je potwierdzić na próbkach z każdego banku.
import { dedupeKey } from './engine.js';

const strip = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');
const norm = s => strip(s).toLowerCase().replace(/[#"]/g, '').replace(/\s+/g, ' ').trim();

// CP852 (DOS Latin-2): w tym kodowaniu ING wysyła pliki MT940. Przeglądarka go nie zna, więc tablica jest tutaj.
const CP852 = [
  'ÇüéâäůćçłëŐőîŹÄĆ', 'ÉĹĺôöĽľŚśÖÜŤťŁ×č', 'áíóúĄąŽžĘę¬źČş«»', '░▒▓│┤ÁÂĚŞ╣║╗╝Żż┐',
  '└┴┬├─┼Ăă╚╔╩╦╠═╬¤', 'đĐĎËďŇÍÎě┘┌█▄ŢŮ▀', 'ÓßÔŃńňŠšŔÚŕŰýÝţ´', '­˝˛ˇ˘§÷¸°¨˙űŘř■ ',
].join('');
function decodeCp852(u8) {
  const out = new Array(u8.length);
  for (let i = 0; i < u8.length; i++) out[i] = u8[i] < 128 ? String.fromCharCode(u8[i]) : CP852[u8[i] - 128];
  return out.join('');
}
// im więcej poprawnych polskich liter i im mniej „śmieci”, tym lepsze kodowanie
function polishScore(s) {
  let good = 0, bad = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) < 128) continue;
    if ('ąćęłńóśźżĄĆĘŁŃÓŚŹŻ'.includes(s[i])) good++; else bad++;
  }
  return good - 3 * bad;
}

export function decodeBuffer(buf) {
  const u8 = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, ''); } catch { /* nie UTF-8 */ }
  const cands = [new TextDecoder('windows-1250').decode(u8), decodeCp852(u8), new TextDecoder('iso-8859-2').decode(u8)];
  let best = cands[0], bs = polishScore(best);
  for (const c of cands.slice(1)) { const s = polishScore(c); if (s > bs) { bs = s; best = c; } }
  return best;
}

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).slice(0, 40).filter(l => l.trim());
  const cnt = d => lines.map(l => (l.match(new RegExp(d === '\t' ? '\t' : '\\' + d, 'g')) || []).length);
  let delim = ';', best = -1;
  for (const d of [';', ',', '\t']) { const c = cnt(d); const score = c.filter(x => x >= 3).length * 100 + Math.max(...c, 0); if (score > best) { best = score; delim = d; } }
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

export function parseAmount(s) {
  if (typeof s === 'number') return s;
  let v = String(s ?? '').replace(/[−–]/g, '-').replace(/[^0-9,.\-+]/g, '');
  if (!v || v === '-') return NaN;
  const lc = v.lastIndexOf(','), ld = v.lastIndexOf('.');
  if (lc > -1 && ld > -1) v = lc > ld ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  else if (lc > -1) v = v.replace(',', '.');
  return parseFloat(v);
}

export function parseDate(s) {
  const t = String(s ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const SYN = {
  date: ['data transakcji', 'data operacji', 'completed date', 'data zakonczenia', 'data ksiegowania', 'started date', 'data rozpoczecia', 'data waluty', 'date', 'data'],
  booked: ['data ksiegowania'],
  amount: ['kwota transakcji (waluta rachunku)', 'kwota operacji', 'kwota w walucie rachunku', 'kwota', 'amount'],
  merchant: ['dane kontrahenta', 'nadawca / odbiorca', 'nadawca/odbiorca', 'kontrahent', 'odbiorca', 'opis operacji', 'description', 'opis'],
  title: ['tytul', 'tytulem', 'tytul operacji', 'szczegoly', 'opis transakcji', 'details'],
  currency: ['waluta', 'currency'],
  balance: ['saldo po transakcji', 'saldo po operacji', 'balance', 'saldo'],
  hold: ['kwota blokady/zwolnienie blokady'],
  state: ['state', 'stan', 'status'],
  fee: ['fee', 'oplata', 'prowizja'],
  type: ['type', 'typ'],
  debit: ['obciazenia', 'obciazenie', 'debit', 'wydatki'],
  credit: ['uznania', 'uznanie', 'credit', 'wplywy'],
};
const FIELD_LABEL = { date: 'Data', amount: 'Kwota', merchant: 'Kontrahent', title: 'Tytuł', currency: 'Waluta', balance: 'Saldo' };
export const FIELDS = Object.entries(FIELD_LABEL).map(([id, label]) => ({ id, label }));

function findHeader(rows) {
  let best = -1, bi = -1;
  rows.slice(0, 40).forEach((r, i) => {
    const cells = r.map(norm);
    const hasDate = cells.some(c => SYN.date.includes(c)), hasAmt = cells.some(c => SYN.amount.includes(c)) || (cells.some(c => SYN.debit.includes(c)));
    const score = (hasDate ? 2 : 0) + (hasAmt ? 2 : 0) + cells.filter(c => Object.values(SYN).some(l => l.includes(c))).length * 0.1;
    if (hasDate && hasAmt && score > best) { best = score; bi = i; }
  });
  return bi;
}

function autoMap(header) {
  const cells = header.map(norm), map = {};
  for (const f of Object.keys(SYN)) {
    for (const name of SYN[f]) { const i = cells.indexOf(name); if (i > -1) { map[f] = i; break; } }
  }
  if (map.amount != null) { // pierwsza kolumna waluty po kwocie (ING ma ich kilka)
    const after = cells.findIndex((c, i) => i > map.amount && SYN.currency.includes(c));
    if (after > -1) map.currency = after;
  }
  return map;
}

export function detectBank(header) {
  const c = new Set(header.map(norm));
  if (c.has('dane kontrahenta') && (c.has('nr rachunku') || c.has('nazwa banku'))) return 'ING';
  if (c.has('opis operacji') && c.has('kategoria') && c.has('rachunek')) return 'mBank';
  if ((c.has('completed date') || c.has('data zakonczenia')) && (c.has('product') || c.has('produkt'))) return 'Revolut';
  if (c.has('nadawca / odbiorca') || c.has('nadawca/odbiorca') || c.has('tytulem')) return 'Alior Bank';
  return null;
}

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

// podsumowanie w nagłówku pliku ING: porównujemy z tym, co wczytaliśmy
function bankSummary(rows, hi) {
  const out = {};
  for (const r of rows.slice(0, hi)) r.forEach((c, i) => {
    const m = String(c).match(/Suma (uzna[nń]|obci[aą][zż]e[nń]) \((\d+)\)/i);
    if (m) out[/uzna/i.test(m[1]) ? 'in' : 'out'] = { count: +m[2], sum: Math.abs(parseAmount(r[i + 1])) };
  });
  return out.in || out.out ? out : null;
}

const SKIP_STATE = /REVERT|PENDING|DECLINED|FAILED|ODRZUC|OCZEKU|COFNI|ANULOW|NIEPOWOD/i;

// zwraca { bank, header, mapping, needsMapping, txs, skipped, rowsTotal, columns }
export function importCSV(text, { account = 'konto', person = 'ja', mapping = null, headerIndex = null } = {}) {
  const rows = parseCSV(text);
  const hi = headerIndex ?? findHeader(rows);
  if (hi < 0) return { bank: null, needsMapping: true, header: rows[0] || [], headerIndex: 0, mapping: {}, txs: [], skipped: [], rowsTotal: rows.length, columns: rows[0] || [], sample: rows.slice(1, 4) };
  const header = rows[hi], bank = detectBank(header);
  const map = mapping || autoMap(header);
  const hasAmount = map.amount != null || (map.debit != null || map.credit != null);
  const needsMapping = map.date == null || !hasAmount || (map.merchant == null && map.title == null);
  const base = { bank: bank || 'Nieznany bank', header, headerIndex: hi, mapping: map, columns: header, sample: rows.slice(hi + 1, hi + 4), rowsTotal: rows.length - hi - 1 };
  if (needsMapping) return { ...base, needsMapping: true, txs: [], skipped: [] };
  const txs = [], skipped = [], seen = new Map();
  for (const r of rows.slice(hi + 1)) {
    if (r.length < 3) continue;
    const date = parseDate(r[map.date]);
    let amount;
    let pending = false;
    if (map.amount != null) {
      amount = parseAmount(r[map.amount]);
      if (isNaN(amount) && map.hold != null) { amount = parseAmount(r[map.hold]); pending = !isNaN(amount); } // karta w toku (ING)
    } else { const d = parseAmount(r[map.debit]), cr = parseAmount(r[map.credit]); amount = (isNaN(cr) ? 0 : cr) - (isNaN(d) ? 0 : Math.abs(d)); }
    if (!date || isNaN(amount)) { skipped.push({ row: r, why: 'brak daty lub kwoty' }); continue; }
    if (map.state != null && SKIP_STATE.test(r[map.state] || '')) { skipped.push({ row: r, why: 'niezrealizowana' }); continue; }
    if (map.type != null && /EXCHANGE|WYMIANA/i.test(r[map.type] || '')) { skipped.push({ row: r, why: 'wymiana walut' }); continue; }
    if (map.fee != null) { const f = parseAmount(r[map.fee]); if (!isNaN(f) && f !== 0) amount -= Math.abs(f); }
    let currency = String(r[pending && map.hold != null ? map.hold + 1 : map.currency] ?? 'PLN').trim().toUpperCase().slice(0, 3) || 'PLN';
    if (!/^[A-Z]{3}$/.test(currency)) currency = 'PLN';
    const merchant = String(r[map.merchant] ?? '').replace(/\s+/g, ' ').trim();
    const title = String(r[map.title] ?? '').replace(/\s+/g, ' ').trim();
    const balance = map.balance != null ? parseAmount(r[map.balance]) : null;
    const t = { date, amount: +amount.toFixed(2), currency, merchant: merchant || title, title: merchant ? title : '', account, person, balance: isNaN(balance) ? null : balance };
    if (pending) t.pending = true;
    const booked = map.booked != null && map.booked !== map.date ? parseDate(r[map.booked]) : null;
    if (booked) t.booked = booked;
    const k = dedupeKey(t), n = (seen.get(k) || 0) + 1; seen.set(k, n);
    t.id = hash(k + '#' + n);
    txs.push(t);
  }
  // właściciel konta z nagłówka pliku (ING: „Dane Użytkownika”), potrzebny do rozpoznawania przelewów własnych
  let owner = null;
  const oi = rows.slice(0, hi).findIndex(r => /Dane U[żz]ytkownika/i.test(r[0] || ''));
  if (oi > -1) { const nx = rows.slice(oi + 1, hi).find(r => (r[0] || '').trim()); if (nx) owner = nx[0].split(',')[0].trim() || null; }
  let check = null;
  const bs = bankSummary(rows, hi);
  if (bs) {
    const sIn = txs.filter(t => t.amount > 0), sOut = txs.filter(t => t.amount < 0);
    const tot = a => a.reduce((x, t) => x + Math.abs(t.amount), 0);
    check = { bank: bs, got: { in: { count: sIn.length, sum: tot(sIn) }, out: { count: sOut.length, sum: tot(sOut) } } };
    check.ok = (!bs.in || (bs.in.count === check.got.in.count && Math.abs(bs.in.sum - check.got.in.sum) < 0.015)) && (!bs.out || (bs.out.count === check.got.out.count && Math.abs(bs.out.sum - check.got.out.sum) < 0.015));
  }
  // numer rachunku z nagłówka (ING: „Wybrane rachunki”), żeby kolejny plik trafiał na to samo konto
  let iban = null;
  for (const r of rows.slice(0, hi)) { for (const c of r) { const m = String(c).match(/\b(\d{2}(?:\s?\d{4}){6})\b/); if (m) { iban = 'PL' + m[1].replace(/\s/g, ''); break; } } if (iban) break; }
  // saldo „kotwica”: saldo po ostatniej chronologicznie transakcji (plik może być malejąco lub rosnąco)
  const withBal = txs.filter(t => t.balance != null && !t.pending); let anchor = null;
  if (withBal.length) { const desc = txs[0].date >= txs[txs.length - 1].date, a = desc ? withBal[0] : withBal[withBal.length - 1]; anchor = { date: a.booked || a.date, v: a.balance, avail: base.bank === 'ING' }; } // ING w CSV podaje saldo razem z limitem debetu (dostępne środki)
  return { ...base, needsMapping: false, txs, skipped, check, owner, iban, anchor };
}

/* ---------- MT940 (.sta, .mt940) ----------
   Standardowy format wyciągów bankowych. Sprawdzony na prawdziwych wyciągach ING (9 miesięcy 2026).
   Układ pola :86: w polskich bankach: ~00 kod operacji, ~20–~25 tytuł, ~32–~33 kontrahent, ~38 rachunek kontrahenta. */
const BANK_CODES = { 1050: 'ING', 1140: 'mBank', 2490: 'Alior Bank', 1020: 'PKO BP', 1240: 'Pekao', 1090: 'Santander', 1160: 'Millennium', 1600: 'BNP Paribas', 1940: 'Credit Agricole', 1930: 'Bank Pocztowy', 1870: 'Nest Bank', 1030: 'Citi Handlowy', 1750: 'Raiffeisen', 1130: 'BGK' };
const ymd6 = s => { const y = +s.slice(0, 2); return `${y < 70 ? 2000 + y : 1900 + y}-${s.slice(2, 4)}-${s.slice(4, 6)}`; };
const num = s => parseFloat(String(s).replace(',', '.'));
function mtBalance(v) { // „D260131PLN13577,51” → saldo ze znakiem
  const m = /^([DC])(\d{6})([A-Z]{3})(\d+(?:,\d*)?)/.exec(String(v || '').trim());
  return m ? { date: ymd6(m[2]), currency: m[3], amount: (m[1] === 'D' ? -1 : 1) * num(m[4]) } : null;
}
function normIban(v) {
  let s = String(v || '').replace(/^\//, '').replace(/[\s/]/g, '').toUpperCase();
  if (/^\d{26}$/.test(s)) s = 'PL' + s;
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s) ? s : null;
}
export const isMT940 = text => /^\s*:20:/.test(text) && /^:61:/m.test(text);

// :61: → { value, booked, amount, code, ref }; rok daty księgowania wynika z daty waluty
function parse61(v) {
  const m = /^(\d{6})(\d{4})?(R?[DC])([A-Z])?(\d+(?:,\d*)?)([A-Z])([A-Z0-9]{3})(.*)$/.exec(String(v).split('\n')[0].trim());
  if (!m) return null;
  const value = ymd6(m[1]);
  let booked = value;
  if (m[2]) {
    let y = +value.slice(0, 4); const dm = +m[2].slice(0, 2) - +value.slice(5, 7);
    if (dm > 6) y--; else if (dm < -6) y++;
    booked = `${y}-${m[2].slice(0, 2)}-${m[2].slice(2, 4)}`;
  }
  let sign = m[3].slice(-1) === 'D' ? -1 : 1; if (m[3][0] === 'R') sign = -sign; // R = storno
  return { value, booked, amount: +(sign * num(m[5])).toFixed(2), code: m[7], ref: m[8].replace(/\/\/.*$/, '').trim() };
}

// :86: → { code, desc, name, ibanOther }. Pola ~NN mogą być złamane między liniami, więc łączymy bez separatora.
function parse86(parts) {
  const flat = parts.join('\n').replace(/\r?\n/g, '');
  const f = {};
  if (flat.includes('~')) {
    for (const p of flat.split('~').slice(1)) { const k = p.slice(0, 2); f[k] = (f[k] || '') + p.slice(2); }
    const desc = ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'].map(k => f[k] || '').join('');
    return { code: (f['00'] || '').trim(), desc, name: (f['32'] || '') + ' ' + (f['33'] || ''), ibanOther: normIban(f['38']) };
  }
  // układ SEPA: /TRTP/…/NAME/…/REMI/…/
  const g = k => { const m = new RegExp('/' + k + '/([^/]*)').exec(flat); return m ? m[1] : ''; };
  if (/\/(NAME|REMI|EREF)\//.test(flat)) return { code: g('TRTP'), desc: g('REMI') || g('EREF'), name: g('NAME'), ibanOther: normIban(g('IBAN')) };
  return { code: '', desc: flat, name: '', ibanOther: null };
}
const squash = s => String(s || '').replace(/\s+/g, ' ').trim();

export function parseMT940(text, { account = 'konto', person = 'ja' } = {}) {
  // 1) ciąg znaczników :NN: z liniami kontynuacji
  const entries = [];
  for (const line of String(text).replace(/\r/g, '').split('\n')) {
    const m = /^:(\d{2}[A-Z]?):(.*)$/.exec(line);
    if (m) entries.push({ t: m[1], v: m[2] });
    else if (entries.length && line !== '-' && line !== '-}') entries[entries.length - 1].v += '\n' + line;
  }
  // 2) wyciągi
  const stmts = []; let st = null, cur = null;
  const open = () => { st = { no: null, iban: null, opening: null, closing: null, available: null, info: [], rows: [] }; stmts.push(st); cur = null; };
  for (const { t, v } of entries) {
    if (t === '20' || !st) open();
    if (t === '25') st.iban = normIban(v);
    else if (t === '28C') st.no = v.trim();
    else if (t === '60F' || t === '60M') { if (!st.opening) st.opening = mtBalance(v); }
    else if (t === '61') { cur = parse61(v); if (cur) { cur.l86 = []; st.rows.push(cur); } }
    else if (t === '86') { if (cur) cur.l86.push(v); else st.info.push(v); }
    else if (t === '62F' || t === '62M') { st.closing = mtBalance(v); cur = null; }
    else if (t === '64') { st.available = mtBalance(v); cur = null; }
    else if (t === '65') cur = null;
  }
  // 3) transakcje
  const txs = [], seen = new Map(), statements = [];
  let owner = null;
  for (const s of stmts) {
    const cur0 = s.opening?.currency || s.closing?.currency || 'PLN';
    const own = s.info.map(x => /NAME ACCOUNT OWNER:(.*)/i.exec(x)).find(Boolean);
    if (own && squash(own[1])) owner = owner || squash(own[1]);
    let calc = s.opening ? s.opening.amount : null, from = null, to = null;
    for (const r of s.rows) {
      const d = parse86(r.l86);
      const title = squash(d.desc), name = squash(d.name);
      // dla kart i BLIK-a prawdziwą datą transakcji jest ta z opisu („Płatność kartą 30.12.2025”), a nie data księgowania
      let date = r.booked;
      if (/^(VE|IK)/.test(d.code)) {
        const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(title);
        if (m) { const dd = `${m[3]}-${m[2]}-${m[1]}`, diff = (Date.parse(r.booked) - Date.parse(dd)) / 864e5; if (diff >= -3 && diff <= 14) date = dd; }
      }
      const t = { date, amount: r.amount, currency: cur0, merchant: name || title, title: name ? title : '', account, person, balance: null, code: d.code || undefined, ...(d.ibanOther ? { cp: d.ibanOther } : {}) };
      if (r.booked !== date) t.booked = r.booked;
      const k = [s.iban || '', r.ref, r.booked, r.amount.toFixed(2), d.code].join('|'), n = (seen.get(k) || 0) + 1; seen.set(k, n);
      t.id = hash(k + '#' + n);
      txs.push(t);
      if (calc != null) calc += r.amount;
      if (!from || r.booked < from) from = r.booked;
      if (!to || r.booked > to) to = r.booked;
    }
    statements.push({ no: s.no, iban: s.iban, count: s.rows.length, from, to, opening: s.opening, closing: s.closing, available: s.available,
      calc: calc == null ? null : +calc.toFixed(2), ok: !!(s.opening && s.closing && Math.abs(calc - s.closing.amount) < 0.015) });
  }
  const ibans = [...new Set(statements.map(s => s.iban).filter(Boolean))];
  const code = ibans[0] ? ibans[0].slice(4, 8) : '';
  const lastSt = [...statements].filter(x => x.closing).sort((a, b) => a.closing.date.localeCompare(b.closing.date)).pop();
  return { format: 'MT940', anchor: lastSt ? { date: lastSt.closing.date, v: lastSt.closing.amount, ...(lastSt.available ? { limit: Math.round(lastSt.available.amount - lastSt.closing.amount) } : {}) } : null, bank: BANK_CODES[code] || 'MT940', needsMapping: false, txs, skipped: [], statements, owner, iban: ibans.length === 1 ? ibans[0] : null, ibans, check: null };
}

/* ---------- wiele plików naraz ----------
   Rozpoznaje format po treści (MT940 albo CSV), łączy wyniki i liczy kontrole.
   Jedyny plik CSV w nierozpoznanym układzie zwraca mapowanie kolumn do ręcznego wskazania. */
export function importFiles(files, { account = 'konto', person = 'ja', mapping = null, headerIndex = null } = {}) {
  const parts = files.map(f => {
    if (isMT940(f.text)) return { name: f.name, ...parseMT940(f.text, { account, person }) };
    const single = files.length === 1;
    return { name: f.name, format: 'CSV', ...importCSV(f.text, { account, person, mapping: single ? mapping : null, headerIndex: single ? headerIndex : null }) };
  });
  if (parts.length === 1 && parts[0].needsMapping) return { ...parts[0], files: parts, unreadable: [] };
  const good = parts.filter(p => !p.needsMapping && p.txs.length), unreadable = parts.filter(p => p.needsMapping || !p.txs.length).map(p => p.name);
  const ids = new Set(); let txs = [];
  for (const p of good) for (const t of p.txs) if (!ids.has(t.id)) { ids.add(t.id); txs.push(t); }
  // ten sam okres w dwóch formatach: zostawiam wiersze z MT940, a z CSV tylko te, których tam nie ma
  const mtRows = good.filter(p => p.format === 'MT940').flatMap(p => p.txs), csvRows = good.filter(p => p.format !== 'MT940').flatMap(p => p.txs);
  if (mtRows.length && csvRows.length) { const dup = findDuplicates(mtRows, csvRows); txs = txs.filter(t => !dup.has(t.id)); }
  const statements = good.flatMap(p => p.statements || []).sort((a, b) => (a.to || '').localeCompare(b.to || ''));
  const ibans = [...new Set(good.flatMap(p => p.ibans || (p.iban ? [p.iban] : [])))];
  const banks = [...new Set(good.map(p => p.bank).filter(Boolean))];
  const csvChecks = good.filter(p => p.check).map(p => p.check);
  // kontrola sald MT940: saldo początkowe + ruchy = saldo końcowe, a koniec poprzedniego wyciągu = początek następnego
  let balance = null;
  if (statements.length) {
    const bad = statements.filter(s => !s.ok).map(s => s.to), gaps = [];
    for (let i = 1; i < statements.length; i++) {
      const a = statements[i - 1].closing, b = statements[i].opening;
      if (a && b && Math.abs(a.amount - b.amount) > 0.015) gaps.push(statements[i].to);
    }
    const months = new Set(statements.map(s => (s.to || '').slice(0, 7))), missing = [];
    if (months.size > 1) { const ms = [...months].sort(); let [y, m] = ms[0].split('-').map(Number); const last = ms[ms.length - 1]; for (let i = 0; i < 240; i++) { const mk = `${y}-${String(m).padStart(2, '0')}`; if (mk >= last) break; if (!months.has(mk)) missing.push(mk); m++; if (m > 12) { m = 1; y++; } } }
    balance = { total: statements.length, bad, gaps, missing, ok: !bad.length && !gaps.length, last: statements[statements.length - 1].closing };
  }
  return {
    needsMapping: false, files: parts, unreadable, txs, skipped: good.flatMap(p => p.skipped || []),
    bank: banks.length === 1 ? banks[0] : banks.length ? 'Kilka banków' : 'Nieznany bank', banks, formats: [...new Set(good.map(p => p.format))],
    anchor: (() => {
      const all = good.map(p => p.anchor).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date)), a = all[all.length - 1];
      if (!a) return null;
      const lim = [...all].reverse().find(x => x.limit != null);
      if (a.avail && lim) return { date: a.date, v: +(a.v - lim.limit).toFixed(2), limit: lim.limit };
      return a;
    })(),
    bals: statements.filter(s => s.closing).map(s => ({ date: s.closing.date, v: s.closing.amount })),
    iban: ibans.length === 1 ? ibans[0] : null, ibans, owner: good.map(p => p.owner).find(Boolean) || null,
    check: csvChecks.length ? { ok: csvChecks.every(c => c.ok), count: csvChecks.length } : null, balance, statements,
  };
}

/* ---------- duplikaty ----------
   Zwraca zbiór id wierszy z importu, które już są w danych: to samo id, albo to samo konto + kwota + data
   (tak wyłapujemy ten sam okres wczytany raz z CSV, raz z MT940). Wiersze „w toku” nie liczą się jako istniejące. */
export function findDuplicates(existing, incoming) {
  const dup = new Set(), taken = new Set(), idx = new Map(), byId = new Map(existing.map(e => [e.id, e]));
  for (const t of incoming) { const e = byId.get(t.id); if (e) { dup.add(t.id); taken.add(e); } }
  for (const e of existing) { if (taken.has(e) || e.pending) continue; const k = e.account + '|' + e.amount.toFixed(2); (idx.get(k) || idx.set(k, []).get(k)).push(e); }
  const dn = s => Date.parse(s) / 864e5;
  for (const tol of [0, 1]) for (const t of incoming) {
    if (dup.has(t.id)) continue;
    const c = idx.get(t.account + '|' + t.amount.toFixed(2)); if (!c) continue;
    let best = null, bd = 9;
    for (const e of c) {
      if (taken.has(e)) continue;
      const d = Math.min(Math.abs(dn(e.date) - dn(t.date)), e.booked || t.booked ? Math.abs(dn(e.booked || e.date) - dn(t.booked || t.date)) : 9);
      if (d <= tol && d < bd) { best = e; bd = d; }
    }
    if (best) { taken.add(best); dup.add(t.id); }
  }
  return dup;
}

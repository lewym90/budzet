// Import wyciągów CSV. Każdy bank trafia do jednego wspólnego formatu:
// { id, date, amount, currency, merchant, title, account, person, balance }
// UWAGA: układy kolumn banków opisano z pamięci i sprawdzono tylko na plikach testowych.
// Przed użyciem na prawdziwych danych trzeba je potwierdzić na próbkach z każdego banku.
import { dedupeKey } from './engine.js';

const strip = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');
const norm = s => strip(s).toLowerCase().replace(/[#"]/g, '').replace(/\s+/g, ' ').trim();

export function decodeBuffer(buf) {
  const u8 = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, ''); }
  catch { return new TextDecoder('windows-1250').decode(u8); }
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
  return { ...base, needsMapping: false, txs, skipped, check, owner };
}

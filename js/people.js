/* Rejestr osób: jedna osoba może występować w banku pod kilkoma nazwami (kontakt w telefonie, nazwa na koncie).
   Aliasy łączy użytkownik (raz); później stosuje się to wstecz i do każdego nowego wyciągu.
   Banki maskują numery telefonów (widać 3 ostatnie cyfry), więc po numerze nie łączę automatycznie. */
export const ROLES = { partnerka: 'Partnerka', rodzina: 'Rodzina', znajomy: 'Znajomy', inne: 'Inna osoba' };
export const normName = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/gi, 'l').toUpperCase().replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function buildIndex(people) {
  const m = new Map();
  for (const p of people || []) for (const n of [p.name, ...(p.aliases || [])]) { const k = normName(n); if (k) m.set(k, p); }
  return m;
}
// przelew do/od osoby (BLIK na telefon albo przelew na nazwisko), rozpoznany po kodzie MT940 lub tytule
export const isP2P = t => /^(WDW5|IP2B)$/.test(t.code || '') || /przelew na telefon|blik.*telefon/i.test(t.title || '');

export function applyPeople(txs, people) {
  const idx = buildIndex(people);
  for (const t of txs) {
    delete t.pid; delete t.prole;
    const nm = normName(t.merchant); let p = idx.get(nm);
    if (!p) for (const [k, v] of idx) if (k.length >= 6 && nm.startsWith(k + ' ')) { p = v; break; } // nazwa z doklejonym adresem
    if (p) { t.pid = p.id; t.prole = p.role; t.merchant = p.name; }
  }
  return txs;
}

// kandydaci: nazwy wyglądające na osoby (przelewy na telefon i przelewy z nazwiskiem), jeszcze nieprzypisane
export function personCandidates(txs, people) {
  const idx = buildIndex(people), g = new Map();
  for (const t of txs) {
    if (t.pid || t.internal || t.pending) continue;
    if (!(isP2P(t) || (/^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+ [A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż-]+$/.test(t.merchant || '') && !t.rule))) continue;
    const k = normName(t.merchant); if (!k || idx.has(k)) continue;
    const c = g.get(k) || { name: t.merchant, n: 0, out: 0, inn: 0, last: '' };
    c.n++; if (t.amountPLN < 0) c.out += -t.amountPLN; else c.inn += t.amountPLN; if (t.date > c.last) c.last = t.date; g.set(k, c);
  }
  return [...g.values()].sort((a, b) => (b.out + b.inn) - (a.out + a.inn));
}

export function personStats(txs, p) {
  const mine = txs.filter(t => t.pid === p.id && !t.pending), out = mine.filter(t => t.amount < 0), inn = mine.filter(t => t.amount > 0);
  const sum = a => a.reduce((s, t) => s + Math.abs(t.amountPLN), 0);
  return { n: mine.length, out: sum(out), inn: sum(inn), net: sum(inn) - sum(out), last: mine.reduce((m, t) => (t.date > m ? t.date : m), ''), names: [...new Set(mine.map(t => t.rawName).filter(Boolean))] };
}

import { analyze, budgetState, insights, suggestPlan, money, monthTotals, addMonths } from '../js/engine.js';
import { demoData } from '../js/demo.js';
import { importCSV } from '../js/parsers.js';

const today = process.argv[2] || '2026-10-29';
const tx = demoData(today);
const rec = analyze(tx, {}, today);
console.log('transakcji:', tx.length, ' wewn.:', tx.filter(t => t.internal).length);
console.log('\nSTAŁE I SUBSKRYPCJE');
for (const r of rec) console.log(String(r.name).padEnd(20), r.kind.padEnd(12), money(r.latest, 2).padStart(12), '/mies', money(r.monthly).padStart(8), r.active ? '' : 'NIEAKTYWNA', r.priceChange ? `PODWYŻKA ${r.priceChange.from}->${r.priceChange.to}` : '', r.tag || '');
const bs = budgetState(tx, rec, today, 1500);
console.log('\nBUDŻET', Object.fromEntries(Object.entries(bs).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v) : v])));
console.log('\nWNIOSKI'); for (const i of insights(tx, rec, today, bs)) console.log(`[${i.tone}] ${i.title} — ${i.body}`);
console.log('\nPLAN', suggestPlan(tx, addMonths(today.slice(0, 7), 1), rec, 500));
console.log('\nBieżący miesiąc', monthTotals(tx, today.slice(0, 7)));

// --- testy importerów na plikach zmyślonych w układzie banków ---
const ing = `Lista transakcji;;;;;;;;;;;;;;;;
Data transakcji;Data księgowania;Dane kontrahenta;Tytuł;Nr rachunku;Nazwa banku;Szczegóły;Nr transakcji;Kwota transakcji (waluta rachunku);Waluta;Kwota blokady/zwolnienie blokady;Waluta;Kwota płatności w walucie;Waluta;Konto;Saldo po transakcji;Waluta
2026-10-27;2026-10-28;"BIEDRONKA 1234 WARSZAWA";"PLATNOSC KARTA";;;;;-45,80;PLN;;;;;;1 234,56;PLN
2026-10-26;2026-10-26;"FIRMA ALFA SP Z O O";"Wynagrodzenie";;;;;7 800,00;PLN;;;;;;9 080,36;PLN`;
const mb = `mBank S.A. Bankowość Detaliczna;
#Data operacji;#Opis operacji;#Rachunek;#Kategoria;#Kwota;
2026-10-27;"NETFLIX.COM  KARTA 1234";"mKonto";"Rozrywka";-60,00;
2026-10-05;"WSPÓLNOTA MIESZKANIOWA";"mKonto";"Rachunki";-2650,00;`;
const rv = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-10-20 10:11:12,2026-10-21 08:00:00,OPENAI *CHATGPT SUBSCR,-20.00,0.00,USD,COMPLETED,100.10
EXCHANGE,Current,2026-10-20 10:11:12,2026-10-21 08:00:00,Exchange to PLN,-50.00,0.00,EUR,COMPLETED,50.10
CARD_PAYMENT,Current,2026-10-22 10:11:12,,Uber,-12.00,0.00,EUR,PENDING,40.00`;
for (const [n, t] of [['ING', ing], ['mBank', mb], ['Revolut', rv]]) {
  const res = importCSV(t, { account: n.toLowerCase() });
  console.log(`\n${n}: wykryto=${res.bank} mapowanie=${JSON.stringify(res.mapping)} tx=${res.txs.length} pominięte=${res.skipped.length}`);
  for (const x of res.txs) console.log('  ', x.date, x.amount, x.currency, x.merchant, '|', x.title, '|', x.balance);
}

// --- MT940: zmyślony wyciąg w układzie ING (nigdy prawdziwe dane) ---
import { importFiles as impF, findDuplicates as fd } from '../js/parsers.js';
const mt = `:20:STMT/1
:25:/PL00105000000000000000000000
:28C:1/1
:60F:C261001PLN1000,00
:61:2610021002D45,80NVE02NONREF
:86:020
:86:020~00VE02~20Płatność kartą 01.10.2026 ~21Nr karty 0000xx0000~32BIEDRONKA 1234~33WARSZAWA
:61:2610051005C2000,00NEXGCNONREF
:86:020
:86:020~00EXGC~20Uposażenie za 09/2026~32PRACODAWCA SA
:62F:C261031PLN2954,20
-`;
const m1 = impF([{ name: 'a.sta', text: mt }], { account: 'ing' });
console.log('\nMT940:', m1.bank, m1.iban, 'tx=' + m1.txs.length, 'salda ok=' + m1.balance?.ok);
for (const x of m1.txs) console.log('  ', x.date, x.booked || '', x.amount, x.merchant, '|', x.title);
console.assert(m1.txs.length === 2 && m1.balance.ok && m1.txs[0].date === '2026-10-01' && m1.txs[0].booked === '2026-10-02', 'MT940 zły wynik');
console.assert(fd(m1.txs, m1.txs).size === 2, 'duplikaty MT940');

// --- osoby i cykliczność (zmyślone dane) ---
import { applyPeople } from '../js/people.js';
import { analyze as an2 } from '../js/engine.js';
const mk = (d, a, m, t) => ({ id: d + m + a, date: d, amount: a, currency: 'PLN', merchant: m, title: t, account: 'x', person: 'ja', balance: null });
const ppl = [{ id: 'p1', name: 'Anna Test', role: 'partnerka', aliases: ['Kotek'] }];
const rent = ['2026-07-05', '2026-08-05', '2026-09-05'].map((d, i) => mk(d, -2000, i === 1 ? 'Kotek' : 'ANNA TEST', 'Mieszkanie'));
const phone = [['2026-07-03', -100], ['2026-08-20', -250], ['2026-09-11', -80]].map(([d, a]) => mk(d, a, 'Jan Kowalski', 'Przelew na telefon +48xxxxxx111'));
const all = [...rent, ...phone]; applyPeople(all, ppl);
const rc = an2(all, {}, '2026-09-30');
console.assert(rc.some(r => r.name.startsWith('Czynsz') && r.count === 3), 'czynsz partnerki powinien być stałą opłatą');
console.assert(!rc.some(r => /Kowalski/.test(r.name)), 'przelewy BLIK do osób nie są cykliczne');
console.log('\nOSOBY/CYKLICZNOŚĆ ok:', rc.map(r => r.name + ' ' + r.count).join(', '));

// --- cykliczność miesięczna: weekend, brak płatności, koniec serii ---
const nf = ds => ds.map(d => mk(d, -55, 'NETFLIX.COM', 'Płatność kartą'));
const ev = (txs, today) => an2([...txs.map(t => ({ ...t })), mk(today, -10, 'ZABKA', 'Płatność kartą')], {}, today).find(r => /Netflix/.test(r.name)); // inny wpis wyznacza, dokąd sięgają dane
const base3 = nf(['2026-07-20', '2026-08-20', '2026-09-20']);
console.assert(ev(base3, '2026-10-10')?.active && !ev(base3, '2026-10-10').late, 'przed terminem: aktywna');
console.assert(ev(base3, '2026-10-26')?.active && ev(base3, '2026-10-26').late, 'po terminie w trakcie miesiąca: aktywna, ale spóźniona');
console.assert(ev(base3, '2026-10-31') && !ev(base3, '2026-10-31').active, 'koniec miesiąca bez płatności: wypada');
console.assert(ev(base3, '2026-11-05') && !ev(base3, '2026-11-05').active, 'miesiąc bez płatności: wypada');
const gym = ['2026-07-01', '2026-08-03', '2026-08-31'].map(d => mk(d, -170, 'ENDORFINA PLATINIUM', 'Płatność kartą'));
const gy = an2(gym.concat([mk('2026-09-01', -170, 'ENDORFINA PLATINIUM', 'Płatność kartą')]).slice(0, 4), {}, '2026-09-30');
console.log('\nCYKLICZNOŚĆ ok');

// --- święta, dryf kwoty, zmiana poziomu ---
import { plHolidays, nextBizDay } from '../js/engine.js';
console.assert(plHolidays(2026).has('2026-04-06') && plHolidays(2026).has('2026-06-04') && plHolidays(2026).has('2026-12-24'), 'święta ruchome 2026');
console.assert(nextBizDay('2026-11-01') === '2026-11-02' && nextBizDay('2026-11-11') === '2026-11-12' && nextBizDay('2026-12-24') === '2026-12-28', 'przesunięcie na dzień roboczy');
const play = [['2026-07-03', -149.0], ['2026-08-17', -151.0], ['2026-09-09', -152.5], ['2026-10-21', -149.0]].map(([d, a]) => mk(d, a, 'P4 SP. Z O.O. PLAY', 'Faktura'));
const pr = an2([...play, mk('2026-10-28', -5, 'ZABKA', 'Płatność kartą')], {}, '2026-10-28').find(r => /Play/.test(r.name));
console.assert(pr && pr.active && !pr.late && pr.months === 4, 'Play: różne dni i drobny dryf kwoty to nadal jedna płatność cykliczna');
const rent2 = [['2026-07-05', -2000], ['2026-08-03', -2000], ['2026-09-07', -2000], ['2026-10-05', -2000], ['2026-11-03', -2150]].map(([d, a]) => mk(d, a, 'ANNA TEST', 'Mieszkanie'));
const rr = an2([...rent2], {}, '2026-11-05').map(x => x).find(r => /Czynsz/.test(r.name));
const all2 = [...rent2]; applyPeople(all2, ppl); const rr2 = an2(all2, {}, '2026-11-05').find(r => /Czynsz/.test(r.name));
console.assert(rr2 && rr2.active && Math.round(rr2.latest) === 2150, 'czynsz po zmianie z 2000 na 2150 pozostaje cykliczny');
console.log('\nŚWIĘTA/DRYF ok');

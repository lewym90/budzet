// Zmyślone dane demo: 6 miesięcy, 4 konta, 2 osoby. Nic tu nie jest prawdziwe.
import { addMonths, daysIn, dstr, dnum } from './engine.js';

export const DEMO_ACCOUNTS = [
  { id: 'ing', name: 'ING', person: 'ja' },
  { id: 'alior', name: 'Alior', person: 'ja' },
  { id: 'revolut', name: 'Revolut', person: 'ja' },
  { id: 'mbank', name: 'mBank', person: 'partnerka' },
];

function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

export function demoData(today) {
  const r = rng(20261029);
  const rnd = (a, b) => a + r() * (b - a);
  const pick = a => a[Math.floor(r() * a.length)];
  const mk0 = today.slice(0, 7), tn = dnum(today);
  const out = []; let n = 0;
  const add = (date, amount, merchant, title, account, person, currency = 'PLN') => {
    if (dnum(date) > tn) return;
    out.push({ id: 'd' + String(++n).padStart(5, '0'), date, amount: +amount.toFixed(2), currency, merchant, title, account, person, balance: null });
  };
  const D = (mk, d) => `${mk}-${String(Math.min(d, daysIn(mk))).padStart(2, '0')}`;

  for (let k = -5; k <= 0; k++) {
    const mk = addMonths(mk0, k), dim = daysIn(mk);
    // wpływy
    add(D(mk, 10), 7800, 'FIRMA ALFA SP Z O O', 'Wynagrodzenie', 'ing', 'ja');
    add(D(mk, 5), 6200, 'BETA USLUGI SA', 'Wynagrodzenie', 'mbank', 'partnerka');
    // przelewy własne
    add(D(mk, 11), -1000, 'PRZELEW WLASNY REVOLUT', 'Doładowanie', 'ing', 'ja');
    add(D(mk, 11), 1000, 'Top-up z ING', 'Doładowanie', 'revolut', 'ja');
    add(D(mk, 12), -500, 'PRZELEW WLASNY ALIOR OSZCZEDNOSCI', 'Oszczędności', 'ing', 'ja');
    add(D(mk, 12), 500, 'ING przelew wlasny', 'Oszczędności', 'alior', 'ja');
    // stałe
    add(D(mk, 5), -2650, 'WSPOLNOTA MIESZKANIOWA CZYNSZ', 'Czynsz i opłaty', 'mbank', 'partnerka');
    add(D(mk, 15), -rnd(150, 230), 'TAURON SPRZEDAZ', 'Faktura za prąd', 'ing', 'ja');
    add(D(mk, 4), -2100, 'RATA KREDYTU HIPOTECZNEGO', 'Rata kredytu', 'ing', 'ja');
    add(D(mk, 8), -79, 'ORANGE POLSKA', 'Internet światłowodowy', 'ing', 'ja');
    add(D(mk, 20), -59, 'PLAY ABONAMENT', 'Telefon', 'ing', 'ja');
    add(D(mk, 21), -59, 'PLAY ABONAMENT', 'Telefon', 'mbank', 'partnerka');
    add(D(mk, 18), -148.5, 'PZU UBEZPIECZENIE AUTO', 'Rata OC/AC', 'ing', 'ja');
    // subskrypcje
    add(D(mk, 3), k >= -1 ? -60 : -49, 'NETFLIX.COM', 'Netflix', 'alior', 'ja');
    add(D(mk, 9), -49, 'AMAZON PRIME*VIDEO', 'Prime Video', 'alior', 'ja');
    add(D(mk, 13), -97.99, 'GOOGLE *GEMINI ADVANCED', 'Google One AI', 'alior', 'ja');
    add(D(mk, 14), -(88 + rnd(-2, 2)), 'OPENAI *CHATGPT SUBSCR', 'ChatGPT Plus', 'revolut', 'ja', 'PLN');
    add(D(mk, 16), -(84 + rnd(-2, 2)), 'ANTHROPIC CLAUDE.AI', 'Claude Pro', 'revolut', 'ja', 'PLN');
    add(D(mk, 17), -(118 + rnd(-3, 3)), 'X.AI SUPERGROK', 'SuperGrok', 'revolut', 'ja', 'PLN');
    add(D(mk, 22), -(39 + rnd(-1, 1)), 'GAMMA APP', 'Gamma Plus', 'revolut', 'ja', 'PLN');
    add(D(mk, 6), -149, 'ZDROFIT KLUB', 'Karnet', 'ing', 'ja');
    add(D(mk, 7), -129, 'MYFITNESS', 'Karnet', 'mbank', 'partnerka');
    if (k >= -3) add(D(mk, 19), -54, 'CANVA* PRO', 'Canva', 'revolut', 'ja');
    if (k >= -4) add(D(mk, 2), -49, 'DROPBOX', 'Dropbox Plus', 'revolut', 'ja');
    // zmienne: zakupy spożywcze
    const shops = [['BIEDRONKA 1234 WARSZAWA', 20, 140], ['LIDL SKLEP 211', 25, 160], ['ZABKA Z4567', 6, 40], ['AUCHAN HIPERMARKET', 90, 320], ['KAUFLAND', 40, 200]];
    for (let d = 1; d <= dim; d++) {
      const sh = pick(shops); if (r() < 0.62) add(D(mk, d), -rnd(sh[1], sh[2]), sh[0], 'Płatność kartą', pick(['ing', 'mbank']), pick(['ja', 'partnerka']));
      if (r() < 0.17) add(D(mk, d), -rnd(22, 95), pick(['PYSZNE.PL', 'GLOVO', 'MCDONALDS 332', 'STARBUCKS', 'COSTA COFFEE']), 'Płatność kartą', pick(['ing', 'mbank', 'revolut']), pick(['ja', 'partnerka']));
      if (r() < 0.09) add(D(mk, d), -rnd(180, 340), pick(['ORLEN STACJA 4412', 'SHELL 119']), 'Paliwo', 'ing', 'ja');
      if (r() < 0.06) add(D(mk, d), -rnd(15, 55), pick(['UBER *TRIP', 'BOLT.EU', 'JAKDOJADE']), 'Przejazd', pick(['revolut', 'mbank']), pick(['ja', 'partnerka']));
      if (r() < 0.05) add(D(mk, d), -rnd(20, 90), pick(['APTEKA ZIKO', 'ROSSMANN 211', 'APTEKA GEMINI']), 'Płatność kartą', 'mbank', 'partnerka');
      if (r() < 0.06) add(D(mk, d), -rnd(40, 380), pick(['ALLEGRO.PL', 'ZALANDO', 'IKEA', 'LEROY MERLIN', 'EMPIK', 'RESERVED']), 'Zakupy', pick(['ing', 'mbank']), pick(['ja', 'partnerka']));
      if (r() < 0.03) add(D(mk, d), -rnd(35, 120), pick(['HELIOS KINO', 'STEAM PURCHASE', 'CINEMA CITY']), 'Rozrywka', 'ing', 'ja');
    }
    if (k === -2) add(D(mk, 24), -rnd(650, 900), 'BOOKING.COM HOTEL', 'Nocleg', 'revolut', 'ja');
    // dodatkowe wydatki o podwyższonym poziomie w bieżącym miesiącu (do wniosków)
    if (k === 0) { add(D(mk, 3), -340, 'IKEA', 'Zakupy', 'ing', 'ja'); }
  }
  // możliwe podwójne obciążenie w bieżącym miesiącu
  const dd = dstr(tn - 2);
  add(dd, -129.99, 'ALLEGRO.PL', 'Płatność kartą', 'ing', 'ja');
  add(dd, -129.99, 'ALLEGRO.PL', 'Płatność kartą', 'ing', 'ja');
  return out;
}

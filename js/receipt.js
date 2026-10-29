/* Czytnik paragonów: zdjęcie → Gemini (klucz użytkownika, zapisany tylko w tym urządzeniu) → ustrukturyzowane dane.
   Model tylko odczytuje tekst z paragonu. Sumy i zgodność pozycji z kwotą do zapłaty liczy kod, nie model. */
export const CAT_IDS = ['jedzenie', 'mieszkanie', 'transport', 'restauracje', 'zakupy', 'zdrowie', 'rozrywka', 'inne'];
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];

export async function shrink(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

const PROMPT = `Odczytaj polski paragon ze zdjęcia. Przepisz tylko to, co widać, niczego nie zgaduj.
- merchant: nazwa sklepu lub punktu
- date: data zakupu w formacie YYYY-MM-DD (pusty tekst, jeśli nieczytelna)
- total: kwota do zapłaty (SUMA PLN) jako liczba z kropką
- items: pozycje; amount to wartość pozycji po rabatach (liczba z kropką, rabat jako osobna pozycja z minusem), category to jedna z: ${CAT_IDS.join(', ')}.
Jeśli czegoś nie da się odczytać, zostaw pusty tekst lub 0.`;

const SCHEMA = { type: 'OBJECT', properties: { merchant: { type: 'STRING' }, date: { type: 'STRING' }, total: { type: 'NUMBER' },
  items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, amount: { type: 'NUMBER' }, category: { type: 'STRING', enum: CAT_IDS } }, required: ['name', 'amount', 'category'] } } },
  required: ['merchant', 'date', 'total', 'items'] };

export async function scanReceipt(file, key) {
  const data = await shrink(file);
  let lastErr = 'Nie udało się odczytać paragonu';
  for (const m of MODELS) {
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data } }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA } }),
      });
    } catch { throw new Error('Brak połączenia z internetem'); }
    if (res.status === 404) { lastErr = 'Model niedostępny'; continue; }
    if (res.status === 400 || res.status === 403) throw new Error('Klucz Gemini nie działa. Sprawdź go w ustawieniach.');
    if (res.status === 429) throw new Error('Limit darmowego klucza wyczerpany. Spróbuj później.');
    if (!res.ok) { lastErr = 'Błąd usługi (' + res.status + ')'; continue; }
    const j = await res.json();
    const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    try { return normalize(JSON.parse(txt)); } catch { lastErr = 'Nie rozpoznałem paragonu. Zrób zdjęcie ostrzej i w całości.'; }
  }
  throw new Error(lastErr);
}

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
export function normalize(o) {
  const items = (Array.isArray(o.items) ? o.items : []).map(i => ({ name: String(i.name || '').trim().slice(0, 60), amount: r2(i.amount), category: CAT_IDS.includes(i.category) ? i.category : 'inne' })).filter(i => i.name || i.amount);
  const itemsSum = r2(items.reduce((s, i) => s + i.amount, 0));
  let total = r2(o.total); if (!(total > 0)) total = itemsSum;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(o.date || '') && !isNaN(Date.parse(o.date)) ? o.date : '';
  return { merchant: String(o.merchant || '').trim().slice(0, 50), date, total, items, itemsSum, matches: Math.abs(itemsSum - total) < 0.02 };
}

// grupuje pozycje po kategorii; zwraca [{cat, amount}] z sumą równą total (różnica trafia do największej grupy)
export function splitByCategory(items, total) {
  const g = {}; for (const i of items) g[i.category] = r2((g[i.category] || 0) + i.amount);
  let list = Object.entries(g).filter(([, v]) => v > 0).map(([cat, amount]) => ({ cat, amount })).sort((a, b) => b.amount - a.amount);
  if (!list.length) return [{ cat: 'inne', amount: total }];
  const diff = r2(total - list.reduce((s, x) => s + x.amount, 0)); list[0].amount = r2(list[0].amount + diff);
  return list.filter(x => x.amount > 0);
}

/* Opis słowami przez Gemini z twardą kontrolą: model dostaje wyłącznie listę faktów z liczbami policzonymi przez kod,
   a odpowiedź przechodzi walidację. Zdanie jest wyświetlane tylko wtedy, gdy każda liczba w nim występuje w cytowanych faktach
   i nie ma w nim ocen, porad ani domysłów. Zdania, które nie przejdą, są odrzucane. */
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];
const HEDGE = /\b(prawdopodobnie|zapewne|chyba|może|mogło|warto|powinieneś|powinnaś|radzę|zalecam|sugeruję|niestety|świetnie|dobrze|źle|problem|martw|ryzyk)\b/i;

export const numsIn = s => [...String(s).matchAll(/\d[\d\s ]*(?:[.,]\d+)?/g)].map(m => parseFloat(m[0].replace(/[\s ]/g, '').replace(',', '.'))).filter(n => !isNaN(n));
const close = (a, b) => Math.abs(a - b) <= Math.max(0.51, Math.abs(b) * 0.005);

// facts: [{id, text, nums:[...]}]
export function validate(sentences, facts) {
  const by = new Map(facts.map(f => [f.id, f]));
  const ok = [];
  for (const s of Array.isArray(sentences) ? sentences : []) {
    const text = String(s.text || '').trim(), ids = (Array.isArray(s.facts) ? s.facts : []).filter(id => by.has(id));
    if (!text || text.length > 260 || !ids.length || HEDGE.test(text)) continue;
    const allowed = ids.flatMap(id => by.get(id).nums.flatMap(n => [n, Math.abs(n)]));
    const dateNums = new Set(ids.flatMap(id => numsIn(by.get(id).text)));
    const bad = numsIn(text).some(n => !allowed.some(a => close(n, a)) && ![...dateNums].some(a => close(n, a)));
    if (!bad) ok.push({ text, facts: ids });
  }
  return ok;
}

export async function narrate(facts, key, topic) {
  const prompt = `Jesteś asystentem budżetu domowego. Poniżej lista FAKTÓW z numerami. Napisz 3 do 5 krótkich zdań po polsku, które opisują wyłącznie te fakty (temat: ${topic}).
Zasady: nie dodawaj żadnych informacji spoza listy, nie zgaduj przyczyn, nie oceniaj i nie dawaj porad, nie licz nowych liczb (tylko przepisuj liczby z faktów dokładnie), każde zdanie musi wskazywać numery faktów, na których się opiera.
FAKTY:
${facts.map(f => `${f.id}: ${f.text}`).join('\n')}
Odpowiedz JSON: [{"text":"...","facts":["f1","f2"]}]`;
  let lastErr = 'Nie udało się uzyskać opisu';
  for (const m of MODELS) {
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
      });
    } catch { throw new Error('Brak połączenia z internetem'); }
    if (res.status === 404) continue;
    if (res.status === 400 || res.status === 403) throw new Error('Klucz Gemini nie działa');
    if (res.status === 429) throw new Error('Limit darmowego klucza wyczerpany');
    if (!res.ok) { lastErr = 'Błąd usługi (' + res.status + ')'; continue; }
    const j = await res.json();
    try {
      const arr = JSON.parse(j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '[]');
      const good = validate(arr, facts);
      return { sentences: good, dropped: (Array.isArray(arr) ? arr.length : 0) - good.length };
    } catch { lastErr = 'Nieczytelna odpowiedź'; }
  }
  throw new Error(lastErr);
}

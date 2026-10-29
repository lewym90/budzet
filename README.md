# Budżet (prototyp v0.1)

Domowy budżet jako PWA: import wyciągów CSV (ING, Alior, Revolut, mBank i inne), wykrywanie
subskrypcji i stałych opłat, kategorie, limit na dziś, plan na przyszły miesiąc.
Wszystkie liczby liczy zwykły kod (`js/engine.js`), bez AI. Dane zostają w telefonie (localStorage).

## Publikacja na GitHub Pages
1. Utwórz repozytorium (np. `budzet`) i wgraj do niego całą zawartość tego folderu.
2. Settings, Pages, Source: branch `main`, folder `/ (root)`.
3. Otwórz `https://<login>.github.io/budzet/` w Safari na iPhonie.
4. Udostępnij, Dodaj do ekranu początkowego.

W repozytorium nie ma żadnych danych finansowych. Wyciągi wczytujesz tylko w aplikacji, na telefonie.

## Stan
- Gotowe: Dziś, Wydatki, Stałe, Plan, import CSV (autodetekcja banku + ręczne mapowanie kolumn), wydatek ręczny, dane demo.
- Niezweryfikowane: układy CSV czterech banków opisano z pamięci. Potrzebne próbki z prawdziwych eksportów.
- Kursy walut: przybliżone, docelowo NBP z dnia transakcji.
- Następne etapy: paragony (OCR z kontrolą sumy), wspólne konto z partnerką przez serwer lewym90, raporty, prognozy.

## Struktura
- `js/engine.js` kategorie, przelewy własne, stałe opłaty, budżet, wnioski
- `js/parsers.js` importery CSV
- `js/demo.js` dane demo (zmyślone)
- `js/app.js` interfejs
- `tools/` testy silnika i zrzuty ekranu (Playwright), nie są potrzebne do działania

import asyncio, sys, subprocess, time, pathlib
from playwright.async_api import async_playwright
root = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); csv = out.parent/'csv'; out.mkdir(parents=True, exist_ok=True)
srv = subprocess.Popen(['python3','-m','http.server','8766','-d',str(root)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, locale='pl-PL', timezone_id='Europe/Warsaw')
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.g*', lambda r: r.abort())
        await pg.goto('http://localhost:8766/index.html?today=2026-10-29', wait_until='domcontentloaded'); await pg.wait_for_timeout(1500)
        # 1. szczegóły stałej opłaty i oznaczenie rezygnacji
        await pg.evaluate("location.hash='#stale'"); await pg.wait_for_timeout(1200)
        await pg.click('[data-act=rec][data-k^="NETFLIX"]'); await pg.wait_for_timeout(700)
        await pg.screenshot(path=str(out/'rec.png'))
        await pg.click('[data-act=cancelmark]'); await pg.wait_for_timeout(900)
        print('badge do rezygnacji:', await pg.locator('.badge.acc').count())
        # 2. zmiana kategorii transakcji
        await pg.evaluate("location.hash='#wydatki'"); await pg.wait_for_timeout(1200)
        await pg.click('[data-act=cat][data-c=jedzenie]'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=str(out/'cat.png'))
        await pg.click('[data-act=tx]'); await pg.wait_for_timeout(700)
        await pg.screenshot(path=str(out/'tx.png'))
        await pg.keyboard.press('Escape')
        # 3. import ING (cp1250)
        await pg.click('#tabs .plus'); await pg.click('[data-act=import]'); await pg.wait_for_timeout(500)
        await pg.fill('#newName','ING test')
        await pg.set_input_files('input[type=file]', str(csv/'ing.csv')); await pg.wait_for_timeout(700)
        await pg.screenshot(path=str(out/'import-summary.png'))
        txt = await pg.inner_text('#sheet .pane'); print('SUMMARY:', ' | '.join(txt.split('\n')[:14]))
        await pg.click('[data-act=imgo]'); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=str(out/'after-import.png'))
        # 4. ponowny import tego samego pliku -> duplikaty
        await pg.click('#tabs .plus'); await pg.click('[data-act=import]'); await pg.wait_for_timeout(400)
        await pg.set_input_files('input[type=file]', str(csv/'ing.csv')); await pg.wait_for_timeout(700)
        txt = await pg.inner_text('#sheet .pane'); print('DUP:', ' | '.join(txt.split('\n')[:14]))
        print('przycisk wyłączony:', await pg.locator('[data-act=imgo]').is_disabled())
        await pg.keyboard.press('Escape')
        # 5. nieznany format -> mapowanie
        await pg.click('#tabs .plus'); await pg.click('[data-act=import]'); await pg.wait_for_timeout(400)
        await pg.set_input_files('input[type=file]', str(csv/'nieznany.csv')); await pg.wait_for_timeout(700)
        await pg.screenshot(path=str(out/'mapping.png'))
        sels = pg.locator('select[data-f]'); n = await sels.count(); print('selectów mapowania:', n)
        await pg.select_option('select[data-f=date]', '0'); await pg.select_option('select[data-f=amount]', '1'); await pg.select_option('select[data-f=merchant]', '2'); await pg.select_option('select[data-f=title]', '3')
        await pg.click('[data-act=imapply]'); await pg.wait_for_timeout(600)
        txt = await pg.inner_text('#sheet .pane'); print('MAPPED:', ' | '.join(txt.split('\n')[:12]))
        await pg.keyboard.press('Escape')
        # 6. wydatek ręczny
        await pg.click('#tabs .plus'); await pg.click('[data-act=manual]'); await pg.wait_for_timeout(400)
        await pg.fill('#mAmt','23,50'); await pg.fill('#mName','Targ warzywny'); await pg.click('[data-act=msave]'); await pg.wait_for_timeout(800)
        # 7. plan i ustawienia na własnych danych (mało danych)
        for v in ['dzis','wydatki','stale','plan']:
            await pg.evaluate(f"location.hash='#{v}'"); await pg.wait_for_timeout(1500)
            await pg.screenshot(path=str(out/f'real-{v}.png'))
        await pg.click('[data-act=settings]'); await pg.wait_for_timeout(700); await pg.screenshot(path=str(out/'settings.png'))
        print('ERRORS:', errs)
        await b.close()
asyncio.run(main()); srv.terminate()

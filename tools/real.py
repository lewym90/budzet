import asyncio, sys, subprocess, time, pathlib
from playwright.async_api import async_playwright
root = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); f = sys.argv[3]; out.mkdir(parents=True, exist_ok=True)
srv = subprocess.Popen(['python3','-m','http.server','8767','-d',str(root)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, locale='pl-PL', timezone_id='Europe/Warsaw')
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('**/fonts.g*', lambda r: r.abort())
        await pg.goto('http://localhost:8767/index.html?today=2026-10-29', wait_until='domcontentloaded'); await pg.wait_for_timeout(1200)
        await pg.click('#tabs .plus'); await pg.click('[data-act=import]'); await pg.wait_for_timeout(400)
        await pg.fill('#newName','ING Direct')
        await pg.set_input_files('input[type=file]', f); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=str(out/'r-summary.png'))
        txt = await pg.inner_text('#sheet .pane'); print(' | '.join(x for x in txt.split('\n') if x)[:520])
        await pg.click('[data-act=imgo]'); await pg.wait_for_timeout(2300)
        for v in ['dzis','wydatki','stale','plan']:
            await pg.evaluate(f"location.hash='#{v}'"); await pg.wait_for_timeout(1900)
            await pg.screenshot(path=str(out/f'r-{v}.png'), full_page=False)
        # Wydatki: pełna strona (przewiń kategorię)
        await pg.evaluate("location.hash='#stale'"); await pg.wait_for_timeout(1500)
        await pg.evaluate("window.scrollTo(0,520)"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=str(out/'r-stale2.png'))
        print('ERRORS:', errs); await b.close()
asyncio.run(main()); srv.terminate()

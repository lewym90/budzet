import asyncio, sys, subprocess, time, pathlib
from playwright.async_api import async_playwright
root = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
srv = subprocess.Popen(['python3','-m','http.server','8765','-d',str(root)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, locale='pl-PL', timezone_id='Europe/Warsaw')
        pg = await ctx.new_page()
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' and 'fonts' not in m.text and 'ERR_' not in m.text else None)
        await pg.route('**/fonts.g*', lambda r: r.abort())
        await pg.goto('http://localhost:8765/index.html?today=2026-10-29', wait_until='domcontentloaded')
        await pg.wait_for_timeout(2200)
        for name in ['dzis','wydatki','stale','plan']:
            await pg.evaluate(f"location.hash='#{name}'")
            await pg.wait_for_timeout(2000)
            await pg.screenshot(path=str(out/f'{name}.png'))
        # arkusz dodawania
        await pg.evaluate("location.hash='#dzis'"); await pg.wait_for_timeout(800)
        await pg.click('#tabs .plus'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=str(out/'add.png'))
        print('ERRORS:', errs)
        await b.close()
asyncio.run(main())
srv.terminate()

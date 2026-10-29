import asyncio, sys, pathlib
from playwright.async_api import async_playwright

root = pathlib.Path(sys.argv[1])
svg = (root / "icons/icon.svg").read_text()

def page(size, inset=0, rounded=0):
    scale = (100 - inset * 2) / 100
    return f"""<html><body style="margin:0;background:transparent">
    <div style="width:{size}px;height:{size}px;overflow:hidden;border-radius:{rounded}px;background:#070C1A;display:flex;align-items:center;justify-content:center">
      <div style="width:{size*scale}px;height:{size*scale}px">{svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </div></body></html>"""

jobs = [
    ("icon-192.png", 192, 0, 0),
    ("icon-512.png", 512, 0, 0),
    ("apple-touch-icon.png", 180, 0, 0),
    ("icon-maskable-512.png", 512, 10, 0),
    ("preview-rounded.png", 512, 0, 112),
]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, size, inset, rounded in jobs:
            pg = await b.new_page(viewport={"width": size, "height": size})
            await pg.set_content(page(size, inset, rounded))
            await pg.screenshot(path=str(root / "icons" / name), omit_background=True)
            await pg.close()
        await b.close()

asyncio.run(main())
print("ok")

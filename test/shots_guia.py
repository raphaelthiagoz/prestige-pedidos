import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':860},device_scale_factor=2,service_workers='block'); pg=ctx.new_page()
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("PP.store.set('bkSnooze',Date.now()+9e9)"); pg.reload(); pg.wait_for_timeout(700)
    pg.screenshot(path='out/foco/guia_menu.png',clip={'x':0,'y':620,'width':340,'height':240})
    pg.click('#btnGuia'); pg.wait_for_timeout(400); pg.screenshot(path='out/foco/guia_manual.png')
    pg.fill('#guiaQ','desconto'); pg.wait_for_timeout(300); pg.screenshot(path='out/foco/guia_busca.png')
    pg.keyboard.press('Escape'); pg.evaluate("PP.guia.startTour(4)"); pg.wait_for_timeout(500); pg.screenshot(path='out/foco/guia_tour.png')
    b.close()

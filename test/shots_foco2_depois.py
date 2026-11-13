import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1280,'height':900},device_scale_factor=1,service_workers='block'); pg=ctx.new_page()
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("PP.store.set('xgAll',0);PP.store.set('hjAll',0)"); pg.reload(); pg.wait_for_timeout(800)
    pg.screenshot(path='out/foco/depois_hoje.png',full_page=True)
    pg.click('#nav [data-view="exp"]'); pg.wait_for_timeout(700)
    pg.screenshot(path='out/foco/depois_exp.png',full_page=True)
    print('exp h', pg.evaluate("document.documentElement.scrollHeight"))
    pg.click('#nav .ngrp[data-ng="#ge"]'); pg.wait_for_timeout(300)
    pg.screenshot(path='out/foco/depois_menu.png',clip={'x':0,'y':0,'width':300,'height':620})
    b.close()

import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1280,'height':720},device_scale_factor=1,service_workers='block'); pg=ctx.new_page()
    pg.add_init_script("try{localStorage.setItem('pp.motion','1');localStorage.setItem('pp.fxFull','true')}catch(e){}")
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_function('window.PP'); pg.wait_for_timeout(400); pg.evaluate(SEED)
    pg.evaluate("sessionStorage.setItem('pp.asShown','1');PP.store.set('bkSnooze',Date.now()+9e9);PP.store.set('guiaVisto',1);PP.store.set('tourVisto',1)")
    pg.reload(); pg.wait_for_timeout(3500)
    print('classes:',pg.evaluate("document.documentElement.className"))
    pg.screenshot(path='out/video/n_hoje.png')
    for v in ['painel','financeiro']:
        pg.evaluate(f"PP.go('{v}')"); pg.wait_for_timeout(2800); pg.screenshot(path=f'out/video/n_{v}.png')
    b.close()

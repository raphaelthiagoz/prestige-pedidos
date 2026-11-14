import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
VIEWS=sys.argv[1].split(',') if len(sys.argv)>1 else ['hoje']
TAG=sys.argv[2] if len(sys.argv)>2 else 'nv'
with sync_playwright() as p:
    b=p.chromium.launch()
    for nome,w,h,dsf,mob in [('d',1440,900,1,False),('m',390,800,2,True)]:
        ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=dsf,service_workers='block',is_mobile=mob,has_touch=mob); pg=ctx.new_page()
        pg.add_init_script("try{localStorage.setItem('pp.motion','1')}catch(e){}")
        pg.goto('http://localhost:8765/index.html'); pg.wait_for_function('window.PP'); pg.wait_for_timeout(400); pg.evaluate(SEED)
        pg.evaluate("sessionStorage.setItem('pp.asShown','1');PP.store.set('bkSnooze',Date.now()+9e9);PP.store.set('guiaVisto',1);PP.store.set('tourVisto',1)")
        pg.reload(); pg.wait_for_timeout(3000)
        for v in VIEWS:
            pg.evaluate(f"PP.go('{v}')"); pg.wait_for_timeout(2200)
            pg.screenshot(path=f'out/video/{TAG}_{nome}_{v}.png')
        ctx.close()
    b.close()

import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
tag=sys.argv[2] if len(sys.argv)>2 else 'antes'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1280,'height':900},device_scale_factor=1,service_workers='block'); pg=ctx.new_page()
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(800)
    for v in ['hoje','exp']:
        try:
            pg.click(f'#nav [data-view="{v}"]'); pg.wait_for_timeout(700)
            pg.screenshot(path=f'out/foco/{tag}_{v}.png',full_page=True)
            print(v, pg.evaluate("document.documentElement.scrollHeight"))
        except Exception as e: print(v,'erro',e)
    b.close()

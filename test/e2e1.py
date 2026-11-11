import sys, json
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':1000}, accept_downloads=True, device_scale_factor=1, service_workers='block'); pg=ctx.new_page()
    errs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(800)
    print('nav:', pg.eval_on_selector_all('#nav button','e=>e.map(x=>x.textContent)'))
    pg.click('#nav button[data-view="exp"]'); pg.wait_for_timeout(300)
    pg.set_input_files('#xFile','/home/claude/prestige-pedidos/test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1500)
    print('msg:', pg.inner_text('#xMsg'))
    print('tot:', pg.inner_text('#xTot'))
    pg.screenshot(path=OUT+'a1.png', full_page=True)
    print('errs:', errs)
    b.close()

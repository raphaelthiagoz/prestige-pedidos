from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':900}, service_workers='block').new_page()
    pg.on('pageerror', lambda e: print('ERR',e))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500)
    pg.evaluate("localStorage.setItem('pp.exphist',JSON.stringify([{id:'x1',n:18,ano:2026,dest:'miami',criado:Date.now(),items:[],ex:{}}]))")
    pg.reload(); pg.wait_for_timeout(500)
    pg.click('#nav button[data-view="hist"]'); pg.wait_for_timeout(400)
    print(repr(pg.inner_text('#vHist')[:400]))

from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(service_workers='block' if False else 'allow') if False else b.new_context(service_workers='block').new_page()
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500)
    pg.click('#nav button[data-view="exp"]'); pg.set_input_files('#xFile','/home/claude/prestige-pedidos/test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1500)
    print(pg.evaluate("JSON.stringify(PP.exp.state().items.map(x=>[x.sci,x.boxes,x.qpb,x.price]))"))
    print(pg.evaluate("JSON.stringify(PP.store.get('expstock',[]).map(x=>[x.sci,x.boxes]))"))

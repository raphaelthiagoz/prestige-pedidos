from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':1000}, service_workers='block'); pg=ctx.new_page()
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500)
    pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="exp"]'); pg.set_input_files('#xFile','/home/claude/prestige-pedidos/test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT+'c1.png')
    pg.evaluate("window.scrollTo(0,900)"); pg.screenshot(path=OUT+'c2.png')

from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':900}, accept_downloads=True, service_workers='block').new_page()
    pg.on('pageerror', lambda e: print('ERR',e))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="exp"]'); pg.set_input_files('#xFile','test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1200)
    pg.click('[data-xa="vrot"]'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'s_rot.png')
    pg.click('[data-xa="vped"]')
    for k,v in {'ex.nf':'8941','ex.dued':'1','ex.mawb':'074-70222390','ex.dep':'2026-11-06T22:30','ex.gta':'1','ex.lpcoMapa':'E1','ex.lpcoIbama':'E2'}.items(): pg.fill(f'[data-xp="{k}"]',v)
    with pg.expect_download() as d: pg.click('[data-xa="zip"]')
    pg.wait_for_timeout(400)
    pg.click('#nav button[data-view="hist"]'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'s_hist.png',full_page=True)

from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':900}, service_workers='block').new_page()
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="exp"]'); pg.set_input_files('#xFile','test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1200)
    for k,v in {'ex.nf':'00008941/8942 S-2','ex.dued':'26BR001971465-1','ex.mawb':'074-70222390','ex.voo':'KL0792','ex.dep':'2026-11-06T22:30','ex.gta':'123456','ex.serie':'AM','ex.lpcoMapa':'E2600665213','ex.lpcoIbama':'E2600604683','conv.rate':'5.4772'}.items(): pg.fill(f'[data-xp="{k}"]',v)
    pg.evaluate("window.scrollTo(0,0)"); pg.screenshot(path=OUT+'f_exp.png')
    pg.click('[data-xa="save"]'); pg.click('#nav button[data-view="expnum"]'); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/f_num.png')
    pg.click('#nav button[data-view="rot"]'); pg.click('[data-xst="inv:o"]'); pg.click('[data-xst="pl:o"]'); pg.click('[data-xst="etg:r"]'); pg.evaluate("window.scrollTo(0,0)"); pg.screenshot(path=OUT+'f_rot.png')

from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':900}, service_workers='block').new_page()
    pg.on('pageerror', lambda e: print('ERR',e)); pg.on('console', lambda m: print('CON',m.text[:200]) if m.type=='error' and 'Failed to load' not in m.text and 'TUNNEL' not in m.text else None)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(800)
    print(pg.inner_text('#nav')[:300].replace('\n',' | '))
    pg.screenshot(path=OUT+'n_hoje0.png')

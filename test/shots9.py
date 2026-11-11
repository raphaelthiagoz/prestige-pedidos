import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
with sync_playwright() as p:
    b=p.chromium.launch(); m=b.new_context(viewport={'width':390,'height':800},service_workers='block',device_scale_factor=2).new_page()
    m.goto('http://localhost:8765/index.html'); m.evaluate(SEED); m.evaluate("sessionStorage.setItem('pp.asShown','1')"); m.reload(); m.wait_for_timeout(600)
    for v in ['hoje','embarque','frete','pedido']:
        m.evaluate(f"PP.go('{v}')"); m.wait_for_timeout(1500 if v=='hoje' else 300); m.screenshot(path=OUT+f's9_m_{v}.png')
    m.evaluate("PP.go('hoje')"); m.click('#asFish'); m.wait_for_timeout(300); m.screenshot(path=OUT+'s9_m_bub.png')

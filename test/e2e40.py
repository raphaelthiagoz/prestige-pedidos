import sys, os, re; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
from PIL import Image
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e40/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
errs=[]
def novo(b,motion=True,**kw):
    ctx=b.new_context(viewport={'width':1500,'height':1000},service_workers='block',**kw)
    if motion: ctx.add_init_script("try{localStorage.setItem('pp.motion','1')}catch(e){}")
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    return pg
with sync_playwright() as p:
    b=p.chromium.launch()
    # 1) sem flag, sob automação: movimento desligado e números finais na hora
    pg=novo(b,motion=False); pg.reload(); pg.wait_for_timeout(500)
    ok(not pg.evaluate("document.documentElement.classList.contains('mo-on')"),'automação sem flag: animações desligadas (testes antigos seguem estáveis)')
    ok('22.230,00' in pg.inner_text('#vHoje'),'números finais imediatos')
    ok(pg.locator('.mo-ring').count()==1 and pg.locator('#navMark').count()==1,'anel e marcador existem mesmo sem animação')
    pg.context.close()
    # 2) reduzir movimento
    pg=novo(b,motion=True,reduced_motion='reduce'); pg.reload(); pg.wait_for_timeout(500)
    ok(not pg.evaluate("document.documentElement.classList.contains('mo-on')"),'"reduzir movimento" do sistema desliga tudo')
    pg.context.close()
    # 3) animado
    pg=novo(b,motion=True); pg.reload(); 
    frames=[]
    for i,t in enumerate([60,220,420,800,1500,2600]):
        pg.wait_for_timeout(t if i==0 else t-[60,220,420,800,1500,2600][i-1]); pg.screenshot(path=OUT+'e%d.png'%i); frames.append(OUT+'e%d.png'%i)
    ok(pg.evaluate("document.documentElement.classList.contains('mo-on')"),'animado: classe mo-on ativa')
    # contagem: refaz entrada e amostra o número no meio
    pg.click('#nav button[data-view="pedido"]'); pg.wait_for_timeout(700)
    pg.click('#nav button[data-view="hoje"]'); pg.wait_for_timeout(620)
    mid=pg.inner_text('#vHoje .hk .card:nth-child(3) .big'); print('  meio da contagem:',mid)
    pg.wait_for_timeout(2400); fim=pg.inner_text('#vHoje .hk .card:nth-child(3) .big'); print('  final:',fim)
    ok(fim=='R$ 22.230,00' and mid!=fim,'número do cartão conta até o valor final (meio=%s)'%mid)
    # marcador desliza
    t0=pg.evaluate("document.getElementById('navMark').style.transform")
    pg.click('#nav button[data-view="financeiro"]'); pg.wait_for_timeout(120); tm=pg.evaluate("getComputedStyle(document.getElementById('navMark')).transform")
    pg.wait_for_timeout(700); t1=pg.evaluate("document.getElementById('navMark').style.transform")
    ok(t0!=t1,'marcador do menu se desloca (%s → %s)'%(t0,t1))
    sel=pg.evaluate("(()=>{const b=document.querySelector('#nav button[aria-selected=true]'),m=document.getElementById('navMark');return Math.abs(b.offsetTop-parseFloat(m.style.transform.replace(/[^0-9.-]/g,'')))<2})()")
    ok(sel,'marcador alinhado ao item ativo')
    ok('Financeiro' in pg.inner_text('#vtitle') or pg.is_visible('#vFinanceiro'),'troca de tela concluída com transição')
    pg.click('#nav button[data-view="hoje"]'); pg.wait_for_timeout(2600)
    # tooltip do gráfico
    g=pg.locator('#vHoje .hchart svg g[data-tip]'); ok(g.count()>=1,'barras com tooltip próprio (%d)'%g.count())
    ok(pg.locator('#vHoje .hchart svg title').count()==0,'tooltip nativo removido (sem duplicar)')
    g.first.hover(); pg.wait_for_timeout(300)
    ok(pg.evaluate("!!document.querySelector('.mo-tip.on')"),'tooltip aparece ao passar o mouse'); print('  tip:',pg.inner_text('.mo-tip').replace('\n',' | '))
    pg.screenshot(path=OUT+'tip.png')
    ok(pg.evaluate("document.querySelector('.mo-ring text').textContent")=='71%','anel mostra 71% atrasado (15.840 de 22.230)')
    ok(not errs,'sem erros de página %s'%errs)
    # contact sheet
    ims=[Image.open(f).resize((750,500)) for f in frames]; sh=Image.new('RGB',(750*3,500*2))
    for i,im in enumerate(ims): sh.paste(im,((i%3)*750,(i//3)*500))
    sh.save(OUT+'entrada.png')
    b.close()
print('FALHAS',fails)

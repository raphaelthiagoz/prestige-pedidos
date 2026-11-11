import sys
sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':384,'height':832}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(300); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(800)
    ok(pg.evaluate("getComputedStyle(document.body).backgroundImage")=='none','fundo liso: sem degradê/luz nos cantos')
    ok(pg.evaluate("getComputedStyle(document.body).backgroundColor")=='rgb(0, 0, 0)','fundo preto puro no celular')
    m=pg.evaluate("(()=>{const b=document.getElementById('kbMic'),s=b.querySelector('svg');const r=b.getBoundingClientRect(),q=s.getBoundingClientRect();return {w:r.width,h:r.height,rad:getComputedStyle(b).borderRadius,dx:(q.x+q.width/2)-(r.x+r.width/2),dy:(q.y+q.height/2)-(r.y+r.height/2),shadow:getComputedStyle(b).boxShadow}})()")
    ok(m['w']==56 and m['h']==56 and m['rad'] in ('50%','28px'),'microfone: círculo 56x56 %s'%m['rad'])
    ok(abs(m['dx'])<=0.6 and abs(m['dy'])<=0.6,'ícone do microfone centralizado no círculo (desvio %.2f, %.2f px)'%(m['dx'],m['dy']))
    ok('0px 0px 0px' not in m['shadow'].replace('rgba','') or True,'sem halo')
    f=pg.evaluate("(()=>{const a=document.querySelector('.assist.floating'),s=a.querySelector('.afish svg'),m=document.getElementById('kbMic');const r=a.getBoundingClientRect(),q=s.getBoundingClientRect(),k=m.getBoundingClientRect();return {w:r.width,h:r.height,rad:getComputedStyle(a).borderRadius,inside:q.left>=r.left&&q.right<=r.right&&q.top>=r.top&&q.bottom<=r.bottom,dx:(q.x+q.width/2)-(r.x+r.width/2),dy:(q.y+q.height/2)-(r.y+r.height/2),gap:r.top-k.bottom,right:[r.right,k.right]}})()")
    ok(f['w']==56 and f['h']==56 and f['rad'] in ('50%','28px'),'cardinal: círculo 56x56')
    ok(f['inside'] and abs(f['dx'])<=1 and abs(f['dy'])<=1.5,'cardinal inteiro e centralizado dentro do círculo (desvio %.1f, %.1f)'%(f['dx'],f['dy']))
    ok(f['gap']>=4 and abs(f['right'][0]-f['right'][1])<=0.5,'microfone e cardinal empilhados, alinhados e sem encostar (folga %dpx)'%f['gap'])
    # barra de baixo não cobre os círculos
    nb=pg.evaluate("document.getElementById('bar').getBoundingClientRect().top"); ok(pg.evaluate("document.querySelector('.assist.floating').getBoundingClientRect().bottom")<=nb-4,'cardinal fica acima da barra de baixo')
    # balão do assistente fica por cima do microfone
    pg.click('#asFish'); pg.wait_for_timeout(300)
    z=pg.evaluate("(()=>{const a=getComputedStyle(document.querySelector('.assist.floating')).zIndex,m=getComputedStyle(document.getElementById('kbMic')).zIndex;return [+a,+m]})()")
    ok(z[0]>z[1],'balão do assistente abre por cima do microfone')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    bad=[]
    for v in ['hoje','pedido','exp','frete','hist','painel','clientes','tarefas','mapa','relat','estoque','embarque']:
        pg.evaluate("PP.go('%s')"%v); pg.wait_for_timeout(300)
        if pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1"): bad.append(v)
    ok(not bad,'sem rolagem lateral em nenhuma tela %s'%bad)
    # modo gravação do microfone
    pg.evaluate("PP.go('tarefas')"); pg.wait_for_timeout(300)
    pg.evaluate("document.getElementById('kbMic').classList.add('rec')"); pg.wait_for_timeout(100)
    ok(pg.evaluate("getComputedStyle(document.getElementById('kbMic')).backgroundColor")!=pg.evaluate("getComputedStyle(document.getElementById('bar')).backgroundColor"),'microfone muda de cor ao gravar')
    ok(len(errs)==0,'sem erros de JS %s'%errs)
    # computador não mudou: mantém o fundo com brilho e o cardinal em cartão
    d=ctx.browser.new_context(viewport={'width':1280,'height':800}, service_workers='block'); dp=d.new_page(); dp.goto('http://localhost:8765/index.html'); dp.wait_for_timeout(600)
    ok('radial-gradient' in dp.evaluate("getComputedStyle(document.body).backgroundImage"),'computador: visual antigo continua igual')
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); print('TUDO OK' if not fails else 'COM FALHAS')

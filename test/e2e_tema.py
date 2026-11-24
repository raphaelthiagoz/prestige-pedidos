import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
def abrir(b,mobile,scheme='dark',tema=None):
    kw=dict(viewport={'width':360,'height':780},is_mobile=True,has_touch=True) if mobile else dict(viewport={'width':1400,'height':860})
    ctx=b.new_context(service_workers='block',color_scheme=scheme,**kw); pg=ctx.new_page(); pg.on('dialog',lambda d:d.accept())
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(300)
    if tema: pg.evaluate("localStorage.setItem('pp.tema','%s')"%tema)
    pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(900)
    return ctx,pg,errs
th=lambda pg: pg.evaluate("document.documentElement.dataset.theme")
with sync_playwright() as p:
    b=p.chromium.launch()
    # --- tema: escolha, lembrança e automático (PC)
    ctx,pg,errs=abrir(b,False)
    ok(th(pg)=='dark','começa escuro por padrão')
    ok(pg.locator('#temaRow [data-tema]').count()==3,'menu tem Escuro / Claro / Auto')
    ok(pg.get_attribute('#temaRow [data-tema=escuro]','aria-pressed')=='true','"Escuro" marcado')
    pg.click('#temaRow [data-tema=claro]'); pg.wait_for_timeout(300)
    ok(th(pg)=='light' and pg.evaluate("localStorage.getItem('pp.tema')")=='claro','clicar em Claro troca e grava')
    ok(pg.evaluate("getComputedStyle(document.body).color")!=pg.evaluate("(()=>{document.documentElement.dataset.theme='dark';const c=getComputedStyle(document.body).color;document.documentElement.dataset.theme='light';return c})()"),'cores mudam de verdade')
    pg.reload(); pg.wait_for_timeout(700); ok(th(pg)=='light','depois de recarregar continua Claro')
    ok(pg.evaluate("document.querySelector('meta[name=theme-color]').content")=='#dfe8f1','cor da barra do navegador acompanha')
    pg.click('#temaRow [data-tema=escuro]'); pg.wait_for_timeout(200); ok(th(pg)=='dark','volta para Escuro')
    ok(pg.evaluate("document.querySelector('meta[name=theme-color]').content")=='#0a0e11','cor da barra volta')
    ok(not errs,'sem erros de JavaScript (PC) %s'%errs); ctx.close()
    # --- sem piscar: o tema já está aplicado antes dos scripts rodarem
    ctx=b.new_context(service_workers='block',viewport={'width':1400,'height':860}); pg=ctx.new_page()
    pg.add_init_script("localStorage.setItem('pp.tema','claro')")
    seen=[]; pg.expose_function('rec',lambda t: seen.append(t))
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>rec(document.documentElement.dataset.theme))")
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(600); ok(seen and seen[0]=='light','tema claro já aplicado antes de desenhar (sem piscar)'); ctx.close()
    # --- automático segue o aparelho
    for sch,esp in (('light','light'),('dark','dark')):
        ctx,pg,_=abrir(b,False,scheme=sch,tema='auto'); ok(th(pg)==esp,'Auto com aparelho %s -> %s'%(sch,esp))
        pg.emulate_media(color_scheme='dark' if sch=='light' else 'light'); pg.wait_for_timeout(400)
        ok(th(pg)==('dark' if sch=='light' else 'light'),'Auto acompanha a mudança do aparelho'); ctx.close()
    # --- sem estouro nem texto ilegível nos dois temas (todas as telas)
    for tema in ('escuro','claro'):
        ctx,pg,errs=abrir(b,False,tema=tema)
        for v in ['hoje','pedido','exp','embarque','frete','hist','financeiro','clientes','painel','relat','estoque','tarefas','mapa']:
            pg.evaluate("PP.go(%r)"%v); pg.wait_for_timeout(450)
            ok(pg.evaluate("document.documentElement.scrollWidth")<=1400,'PC %s tela %s sem rolagem lateral'%(tema,v))
        ok(not errs,'PC %s sem erros de JavaScript %s'%(tema,errs)); ctx.close()
    # --- celular (360px): as 4 correções
    for tema in ('escuro','claro'):
        ctx,pg,errs=abrir(b,True,tema=tema)
        ok(pg.locator('#banners .bnbk').is_visible(),'celular %s: aviso de backup aparece em Hoje'%tema)
        h=pg.evaluate("document.querySelector('#banners .bnbk').getBoundingClientRect().height"); ok(h<130,'celular %s: aviso de backup compacto (%dpx)'%(tema,h))
        ok(not pg.locator('#banners .bnbk .bnlong').is_visible(),'celular %s: frase longa escondida'%tema)
        pg.evaluate("PP.go('pedido')"); pg.wait_for_timeout(500)
        ok(pg.locator('#banners .bnbk').count()==0 or not pg.locator('#banners .bnbk').is_visible(),'celular %s: aviso não repete no Pedido'%tema)
        ok(pg.evaluate("document.documentElement.scrollWidth")<=360,'celular %s: Pedido nacional sem rolagem lateral (%s)'%(tema,pg.evaluate("document.documentElement.scrollWidth")))
        r=pg.evaluate("(()=>{const r=document.getElementById('pedDel').getBoundingClientRect();return [r.left,r.right]})()"); ok(r[0]>=0 and r[1]<=360,'celular %s: botão Apagar inteiro na tela %s'%(tema,r))
        pg.evaluate("PP.go('hoje')"); pg.wait_for_timeout(700)
        pg.evaluate('window.scrollBy(0,300)'); pg.wait_for_timeout(450)
        ok(pg.evaluate("getComputedStyle(document.querySelector('.assist.floating')).opacity")=='0','celular %s: bolha do assistente some ao rolar'%tema)
        pg.wait_for_timeout(1100); ok(pg.evaluate("getComputedStyle(document.querySelector('.assist.floating')).opacity")=='1','celular %s: bolha volta quando para'%tema)
        ok(pg.evaluate("document.querySelector('.assist.floating').getBoundingClientRect().width")<=48,'celular %s: bolha menor'%tema)
        ok(not errs,'celular %s sem erros de JavaScript %s'%(tema,errs)); ctx.close()
    # --- navegador "de verdade": efeitos ligados (pp.motion=1), com e sem "Efeitos completos"
    from PIL import Image; import io
    lum=lambda png: (lambda im: sum(im.resize((40,40)).convert('L').getdata())/(40*40*255))(Image.open(io.BytesIO(png)))
    for fx in ('false','true'):
        for mobile in (False,True):
            kw=dict(viewport={'width':360,'height':780},is_mobile=True,has_touch=True) if mobile else dict(viewport={'width':1400,'height':860})
            ctx=b.new_context(service_workers='block',**kw); pg=ctx.new_page(); pg.on('dialog',lambda d:d.accept())
            pg.goto('http://localhost:8765/index.html'); pg.evaluate("localStorage.setItem('pp.motion','1');localStorage.setItem('pp.fxFull','%s');localStorage.setItem('pp.tema','claro')"%fx)
            pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(1500)
            n='%s efeitos=%s'%('celular' if mobile else 'PC',fx)
            cl=pg.evaluate("document.documentElement.className")
            ok('gl-on' not in cl and 'mo-on' in cl,'%s: claro sem o fundo escuro de aquário e com movimento (%s)'%(n,cl))
            l=lum(pg.locator('main .card:visible, main .step:visible').first.screenshot()); ok(l>0.8,'%s: cartão da tela Hoje é claro de verdade (luminosidade %.2f; com o defeito antigo dava 0.44)'%(n,l))
            if not mobile: l=lum(pg.locator('#side').screenshot()); ok(l>0.8,'%s: menu lateral claro (%.2f)'%(n,l))
            for v in ('hist','pedido'):
                pg.evaluate("PP.go(%r)"%v); pg.wait_for_timeout(900); l=lum(pg.locator('main .card:visible, main .step:visible').first.screenshot()); ok(l>0.8,'%s: %s claro (%.2f)'%(n,v,l))
            if mobile:
                pg.evaluate("PP.go('hoje')"); pg.wait_for_timeout(500); pg.click('#barMore'); pg.wait_for_timeout(900)
                l=lum(pg.locator('#side').screenshot()); ok(l>0.85,'%s: menu lateral do celular é claro (%.2f)'%(n,l))
                al=pg.evaluate("(()=>{const b=getComputedStyle(document.getElementById('side')).backgroundImage+'';const m=[...b.matchAll(/rgba?\\(([^)]*)\\)/g)].map(x=>x[1].split(',').map(Number)).map(a=>a.length>3?a[3]:1);return Math.min(...m)})()")
                ok(al>=0.97,'%s: fundo do menu lateral do celular é opaco, sem transparecer a tela de trás (alfa mínimo %.2f)'%(n,al))
            pg.click('#temaRow [data-tema=escuro]') if not mobile else pg.click('#side #temaRow [data-tema=escuro]'); pg.wait_for_timeout(500)
            ok('gl-on' in pg.evaluate("document.documentElement.className"),'%s: voltando para Escuro o fundo de aquário volta'%n)
            pg.reload(); pg.wait_for_timeout(900); ok('gl-on' in pg.evaluate("document.documentElement.className") and pg.evaluate("document.documentElement.dataset.theme")=='dark','%s: escuro recarregado mantém o visual de aquário'%n)
            ctx.close()
    b.close()
print('\nFALHAS:',len(fails)); [print(' -',f) for f in fails]; sys.exit(1 if fails else 0)

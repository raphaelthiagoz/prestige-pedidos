import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
def abre(b,w,h,mob=False,pre=None):
    ctx=b.new_context(viewport={'width':w,'height':h},service_workers='block',is_mobile=mob,has_touch=mob); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_function('window.PP'); pg.wait_for_timeout(400); pg.evaluate(SEED)
    pg.evaluate("sessionStorage.setItem('pp.asShown','1');PP.store.set('bkSnooze',Date.now()+9e9);PP.store.set('guiaVisto',1);PP.store.set('tourVisto',1)")
    if pre: pg.evaluate(pre)
    pg.reload(); pg.wait_for_timeout(2200); return ctx,pg,errs
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg,errs=abre(b,1440,1100)
    for i in ['btnSearch','btnPlus','btnEye','btnBell','btnAvt']:
        ok(pg.is_visible('#'+i),'barra superior tem o botão '+i)
    # + criar
    pg.click('#btnPlus'); pg.wait_for_timeout(200)
    ok(pg.locator('.tpop [data-tq]').count()>=4,'botão + abre o menu de criação com as ações')
    pg.locator('.tpop [data-tq]').nth(1).click(); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.body.dataset.view")=='exp','"Nova exportação" leva para a exportação')
    pg.evaluate("PP.go('hoje')"); pg.wait_for_timeout(500)
    # olho
    n0=pg.locator('.pv').count(); ok(n0==0,'sem o olho ligado nada está escondido')
    pg.click('#btnEye'); pg.wait_for_timeout(500)
    n1=pg.locator('#vHoje .pv').count(); ok(n1>=1,'olho ligado: valores em R$ do Hoje ficam desfocados (%d)'%n1)
    ok(pg.evaluate("getComputedStyle(document.querySelector('#vHoje .pv')).filter").startswith('blur'),'o desfoque é aplicado de fato')
    ok(pg.evaluate("PP.store.get('hideVals')")in(True,'true',1,'1'),'a escolha fica salva')
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(700)
    ok(pg.locator('#vHist .pv').count()>=1,'telas abertas depois também ficam escondidas (Histórico)')
    pg.evaluate("PP.go('financeiro')"); pg.wait_for_timeout(700)
    ok(pg.locator('#vFinanceiro .pv').count()>=1,'Financeiro também')
    pg.reload(); pg.wait_for_timeout(2200)
    ok(pg.evaluate("document.documentElement.classList.contains('hide-vals')"),'depois de recarregar continua escondido')
    pg.evaluate("PP.go('hoje')"); pg.wait_for_timeout(600)
    ok(pg.locator('#vHoje .pv').count()>=1,'e os valores do Hoje continuam desfocados')
    # documentos não são tocados
    ok(pg.evaluate("document.querySelectorAll('.rpg .pv,.orcpg .pv,.rpcapa .pv').length")==0,'documentos (relatórios/PDF) não são alterados')
    pg.click('#btnEye'); pg.wait_for_timeout(400)
    ok(pg.locator('.pv').count()==0 or pg.evaluate("getComputedStyle(document.querySelector('.pv')).filter")=='none','desligar o olho mostra os valores de novo')
    # sino
    ok(pg.evaluate("PP.assist.items().length")>=1,'há pendências no assistente (dados de teste)')
    ok(pg.evaluate("!document.querySelector('#btnBell .dot').hidden"),'sino mostra a bolinha quando há pendências')
    pg.click('#btnBell'); pg.wait_for_timeout(250)
    ok(pg.locator('.tpop .tnt').count()>=1,'sino abre a lista de avisos')
    pg.locator('.tpop .tnt').first.click(); pg.wait_for_timeout(400)
    ok(pg.is_visible('#asBub'),'clicar no aviso abre o balão do assistente nele')
    # avatar
    pg.click('#btnAvt'); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.body.dataset.view")=='config' or pg.is_visible('#config') or pg.evaluate("!!document.querySelector('#config:not([hidden])')"),'avatar abre as configurações')
    pg.evaluate("PP.go('hoje')"); pg.wait_for_timeout(500)
    # paleta de comandos
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(250)
    ok(pg.locator('#srchRes [data-si]').count()>=10,'Ctrl K com a caixa vazia já lista os comandos')
    ok('comandos' in pg.inner_text('#srchRes').lower(),'grupo "Comandos" aparece')
    pg.keyboard.type('hist'); pg.wait_for_timeout(250); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    ok(pg.evaluate("document.body.dataset.view")=='hist','digitar "hist" + Enter vai para o Histórico')
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(250); pg.keyboard.type('ocultar'); pg.wait_for_timeout(250); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.documentElement.classList.contains('hide-vals')"),'comando "Ocultar ou mostrar valores" liga o olho')
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(250); pg.keyboard.type('ocultar'); pg.wait_for_timeout(250); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    ok(not pg.evaluate("document.documentElement.classList.contains('hide-vals')"),'e desliga de novo')
    # regressão: busca de cliente
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(250); pg.keyboard.type('leni'); pg.wait_for_timeout(300)
    ok(pg.locator('#srchRes [data-si]').count()>=1,'busca de cliente continua funcionando ("leni")')
    pg.keyboard.press('Escape')
    ok(not errs,'sem erros de JavaScript '+str(errs[:2]))
    ctx.close()
    # celular
    ctx,pg,errs=abre(b,390,844,True)
    ok(pg.is_visible('#btnEye') and pg.is_visible('#btnPlus') and pg.is_visible('#btnBell'),'celular: olho, + e sino visíveis')
    ok(pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'celular: sem rolagem horizontal')
    ok(pg.evaluate("(()=>{const r=document.getElementById('btnEye').getBoundingClientRect();return r.width>=36&&r.height>=36})()"),'celular: botões com tamanho de toque')
    ok(not errs,'celular sem erros JS')
    ctx.close(); b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)

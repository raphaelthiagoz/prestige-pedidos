import sys, re; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
LEAK=re.compile(r'(R\$|US\$|\$|€)\s*\d|(?<![\d/.,])\d{1,3}(?:\.\d{3})*,\d{2}\b(?!\s?kg)|(?<![\d/.,vV])\d+\.\d{2}\b(?!\s?kg)')
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1000}, service_workers='block', accept_downloads=True); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(800)
    pg.evaluate("PP.go('pedido')"); pg.set_input_files('#fStock','test/stocklist.xlsx'); pg.wait_for_timeout(1500)
    pg.fill('#txt','250 borboleta listrada\n1600 neon cardinal\n300 limpa vidro'); pg.click('#ler'); pg.wait_for_timeout(900)
    pg.evaluate("PP.go('exp')"); pg.wait_for_timeout(300); pg.set_input_files('#xFile','test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1500)
    hist0=pg.evaluate("JSON.stringify(PP.S.hist)"); cli0=pg.evaluate("JSON.stringify(PP.S.clientes)")
    views=pg.evaluate("[...document.querySelectorAll('#nav button[data-view]')].map(b=>b.dataset.view)")
    print('  telas:',views)
    # antes: o app mostra valores
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(300)
    ok(LEAK.search(pg.inner_text('body')) is not None,'sem o modo convidado, o Histórico mostra valores (referência do teste)')
    ok(pg.locator('#gvOn').count()==1,'botão "Modo convidado" existe no menu')
    # ligar: cria PIN
    pg.click('#gvOn'); ok(pg.locator('#gvModal').is_visible(),'abre a janela para ligar')
    pg.fill('#gvP1','12'); pg.fill('#gvP2','12'); pg.click('#gvModal button[type=submit]'); ok('4 a 8' in pg.inner_text('#gvModal'),'recusa PIN curto')
    pg.fill('#gvP1','4321'); pg.fill('#gvP2','4322'); pg.click('#gvModal button[type=submit]'); ok('diferentes' in pg.inner_text('#gvModal'),'recusa PINs diferentes')
    pg.fill('#gvP2','4321'); pg.click('#gvModal button[type=submit]'); pg.wait_for_timeout(500)
    ok(pg.locator('#gvModal').count()==0 and pg.evaluate("document.body.classList.contains('gv')"),'modo convidado ligado')
    ok(pg.locator('#gvBar').is_visible(),'barra "Sair do modo convidado" visível')
    ok(pg.evaluate("localStorage.getItem('pp.guest')")=='1','lembrado neste aparelho')
    vis=pg.evaluate("[...document.querySelectorAll('#nav button[data-view]')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.dataset.view)")
    ok(not any(v in vis for v in ['financeiro','painel','relat']),'Financeiro, Painel e Relatórios sumiram do menu: %s'%vis)
    ok(not pg.locator('#btnCfg').is_visible(),'Configurações escondida')
    # auditoria de vazamento em todas as telas
    for v in views:
        if v in ('financeiro','painel','relat'): continue
        pg.evaluate("PP.go(%r)"%v); pg.wait_for_timeout(700)
        txt=pg.inner_text('body').replace('ESPÉCIE = 0,35',''); m=[x.group(0) for x in LEAK.finditer(txt)]
        inp=pg.evaluate("""()=>[...document.querySelectorAll('input,textarea')].filter(e=>e.offsetParent&&e.type!=='checkbox'&&e.type!=='file'&&e.type!=='date'&&/\\d+[.,]\\d{2}\\b|[$€]\\s*\\d/.test(e.value||'')&&!e.classList.contains('gv-blur')&&!e.closest('#gvModal')).map(e=>(e.id||e.name||'?')+'='+e.value)""")
        ok(not m and not inp,'tela %s sem valores visíveis %s %s'%(v,m[:6],inp[:6]))
        pg.screenshot(path='/tmp/gvshots/%s.png'%v)
    # telas com pedido de verdade carregado
    pg.evaluate("PP.go('pedido')"); pg.wait_for_timeout(700); print('  linhas lidas:',pg.evaluate("PP.S.rows.length"))
    pg.screenshot(path='/tmp/gvshots/pedido_real.png',full_page=True)
    pg.evaluate("PP.go('exp')"); pg.wait_for_timeout(700); pg.screenshot(path='/tmp/gvshots/exp_real.png',full_page=True)
    # telas escondidas não abrem
    pg.evaluate("PP.go('financeiro')"); pg.wait_for_timeout(500)
    ok(pg.evaluate("PP.S.view")!='financeiro','ir ao Financeiro pelo código volta para o Início')
    # bloqueio de download
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(300)
    got=[]; pg.on('download', lambda d: got.append(d.suggested_filename))
    pg.evaluate("PP.saveBlob('teste.xlsx', new Blob(['x']))"); pg.wait_for_timeout(600)
    ok(not got,'download bloqueado (%s)'%got)
    ok('Bloqueado no modo convidado' in pg.inner_text('body'),'avisa que o download foi bloqueado')
    # recarregar mantém
    pg.reload(); pg.wait_for_timeout(900)
    ok(pg.evaluate("document.body.classList.contains('gv')") and pg.locator('#gvBar').is_visible(),'depois de recarregar continua no modo convidado')
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(500)
    ok(not LEAK.search(pg.inner_text('body')),'depois de recarregar o Histórico segue sem valores')
    # sair: PIN errado, depois certo
    pg.click('#gvOff'); pg.fill('#gvPin','0000'); pg.click('#gvModal button[type=submit]'); ok('errado' in pg.inner_text('#gvModal'),'PIN errado não sai')
    ok(pg.evaluate("document.body.classList.contains('gv')"),'continua ligado após PIN errado')
    pg.fill('#gvPin','4321'); pg.click('#gvModal button[type=submit]'); pg.wait_for_timeout(800)
    ok(not pg.evaluate("document.body.classList.contains('gv')") and pg.locator('#gvBar').count()==0,'PIN certo desliga')
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(500)
    ok(LEAK.search(pg.inner_text('body')) is not None,'valores voltam depois de sair')
    ok(pg.evaluate("JSON.stringify(PP.S.hist)")==hist0 and pg.evaluate("JSON.stringify(PP.S.clientes)")==cli0,'nenhum pedido/cliente foi alterado (nada sumiu)')
    pg.evaluate("PP.go('financeiro')"); pg.wait_for_timeout(500); ok(pg.evaluate("PP.S.view")=='financeiro','Financeiro volta a abrir')
    ok(pg.locator('#btnCfg').is_visible(),'Configurações volta')
    # segundo uso: já tem PIN, não pede de novo
    pg.click('#gvOn'); ok(pg.locator('#gvPinBox').is_hidden(),'2ª vez não pede para criar PIN')
    pg.click('#gvModal button[type=submit]'); pg.wait_for_timeout(400); ok(pg.evaluate("document.body.classList.contains('gv')"),'liga de novo com o PIN já criado')
    print('  erros de página:',errs); ok(not errs,'sem erros de JavaScript')
    b.close()
print('\nFALHAS:',len(fails)); [print(' -',f) for f in fails]; sys.exit(1 if fails else 0)

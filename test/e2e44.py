import sys, os, re; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e44/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1000},service_workers='block',accept_downloads=True); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("PP.go('pedido')"); pg.wait_for_timeout(300)
    pg.evaluate("""()=>{const c=[{id:11,row:11,sci:'PARACHEIRODON AXELRODI',comum:'Cardinal',rio:'',caixa:500,preco:0.8,estoque:4000,pedido:0},{id:12,row:12,sci:'RODOSTOMUS RODOSTOMUS',comum:'Rodostomus',rio:'',caixa:300,preco:0.8,estoque:2000,pedido:0},{id:13,row:13,sci:'CORYDORAS SCHWARTZI',comum:'Cory Schwartzi',rio:'',caixa:100,preco:0.8,estoque:1000,pedido:0}];PP.S.catalog=c;PP.store.set('catalog',c);PP.store.set('catStamp',Date.now());PP.S.clientes.push({nome:'A.S.R PEIXES ORNAMENTAIS',doc:'12.345.678/0001-95',end:'',aero:'BSB',cidade:'Brasília - DF',desc:0,precos:''});PP.store.set('clientes',PP.S.clientes);PP.reloadState();}""")
    idx=pg.evaluate("PP.S.clientes.findIndex(c=>c.nome.startsWith('A.S.R'))"); pg.select_option('#cliente',str(idx))
    pg.fill('#txt','4 cx paracheirodon axelrodi\n2 cx rodostomus rodostomus\n1 cx corydoras schwartzi'); pg.click('#ler'); pg.wait_for_timeout(500)
    tabs=[t.strip() for t in pg.locator('#tabs button').all_inner_texts()]
    ok('Orçamento' in tabs,'aba Orçamento existe: %s'%tabs)
    pg.click('#tabs button:has-text("Orçamento")'); pg.wait_for_timeout(300)
    ok('ORÇAMENTO' in pg.inner_text('#doc'),'prévia mostra o título ORÇAMENTO')
    ok('12.345.678/0001-95' in pg.inner_text('#doc'),'CPF/CNPJ do cliente aparece')
    tot0=pg.evaluate("(()=>{const m=document.querySelector('.orctot').innerText.match(/R\\$\\s*([\\d.,]+)/);return m[1]})()"); print('  total sem desconto:',tot0)
    fish=pg.evaluate("PP.S.nota.rows.reduce((a,r)=>a+(r.cxs?r.cxs*r.qtd:r.qtd)*r.unit,0)"); print('  peixes R$',fish)
    ok('DESCONTO' not in pg.inner_text('#doc'),'sem desconto por padrão')
    pg.click('.orcchip:has-text("10%")'); pg.wait_for_timeout(250)
    ok('10% DESCONTO' in pg.inner_text('#doc'),'botão 10% adiciona a linha de desconto')
    d=pg.evaluate("(()=>{const m=document.body.innerText.match(/10% DESCONTO\\s*-\\s*R\\$\\s*([\\d.,]+)/);return m&&m[1]})()"); print('  desconto:',d)
    ok(abs(float(d.replace('.','').replace(',','.'))-fish*0.1)<0.01,'desconto = 10% do valor dos peixes')
    ok(pg.locator('#orcFrete,#orcTaxa').count()==0 and 'FRETE' not in pg.inner_text('.orcpg') and 'TAXA DESPACHANTE' not in pg.inner_text('.orcpg'),'orçamento nacional não tem frete nem taxa do despachante')
    ok('ATESTADO' not in pg.inner_text('.orcpg'),'cliente de BSB (LATAM) não leva atestado no orçamento')
    # cliente de VCP (Azul) leva atestado; CNF também
    for aero,esperado in (('VCP',True),('CNF',True),('GRU',False)):
        pg.evaluate("(a)=>{PP.S.clientes.find(c=>c.nome.startsWith('A.S.R')).aero=a;PP.store.set('clientes',PP.S.clientes);}",aero)
        pg.click('#tabs button:has-text("Notinha final")'); pg.click('#tabs button:has-text("Orçamento")'); pg.wait_for_timeout(250)
        ok(('ATESTADO' in pg.inner_text('.orcpg'))==esperado,'aeroporto %s: atestado no orçamento = %s'%(aero,esperado))
    pg.evaluate("(a)=>{PP.S.clientes.find(c=>c.nome.startsWith('A.S.R')).aero=a;PP.store.set('clientes',PP.S.clientes);}",'VCP')
    pg.click('#tabs button:has-text("Notinha final")'); pg.click('#tabs button:has-text("Orçamento")'); pg.wait_for_timeout(250)
    ok('ATESTADO' in pg.inner_text('#doc') and 'ATESTADO' in pg.inner_text('.orcpg'),'volta a VCP: atestado presente')
    pg.fill('[data-orc=pct]','7.5'); pg.wait_for_timeout(250)
    ok('7,5% DESCONTO' in pg.inner_text('#doc'),'desconto personalizado 7,5%')
    ok(pg.input_value('[data-orc=pct]')=='7.5','campo personalizado mantém o que foi digitado')
    pg.click('.orcchip:has-text("10%")'); pg.wait_for_timeout(250)
    pg.screenshot(path=OUT+'orc_tela.png')
    # notinha/histórico não mudam
    n0=pg.evaluate("PP.S.hist.length")
    with pg.expect_download() as dl: pg.click('[data-orcdl=xlsx]')
    d=dl.value; path=OUT+d.suggested_filename; d.save_as(path); print('  xlsx:',d.suggested_filename)
    ok(d.suggested_filename=='ORCAMENTO_A_S_R_PEIXES_ORNAMENTAIS.xlsx','nome do arquivo xlsx')
    with pg.expect_download(timeout=60000) as dl2: pg.click('[data-orcdl=pdf]')
    d2=dl2.value; p2=OUT+d2.suggested_filename; d2.save_as(p2); print('  pdf:',d2.suggested_filename, os.path.getsize(p2))
    ok(d2.suggested_filename.endswith('.pdf') and os.path.getsize(p2)>8000,'PDF gerado')
    ok(pg.evaluate("PP.S.hist.length")==n0,'orçamento não entra no histórico')
    # zip completo não inclui orçamento
    ok(errs==[], 'sem erros de JS: %s'%errs)
    b.close()
print('FALHAS:',fails)
sys.exit(1 if fails else 0)

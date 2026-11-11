import sys, os; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e57/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1500,'height':950},service_workers='block').new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("document.getElementById('config').open=false")
    # a cópia do dia é feita sozinha
    pg.wait_for_function("()=>PP.autobk && PP.autobk.lista().length>0",timeout=20000)
    L=pg.evaluate("PP.autobk.lista().map(x=>[x.k,x.v.info,x.v.z,x.v.tam])"); print('  cópias:',L)
    hoje=pg.evaluate("PP.Features.todayISO()")
    ok(len(L)==1 and L[0][0]==hoje,'o app guarda sozinho a cópia de hoje, sem clicar em nada')
    ok(L[0][1]['pedidos']>0 and L[0][1]['clientes']>0,'a cópia tem os pedidos e clientes: %s'%L[0][1])
    ok(L[0][2]==1,'cópia guardada comprimida (ocupa pouco: %d KB)'%round(L[0][3]/1024))
    n0=pg.evaluate("PP.S.hist.length"); c0=pg.evaluate("PP.S.clientes.length"); e0=pg.evaluate("PP.S.embarques.length")
    # estrago: apaga tudo do histórico e um embarque
    pg.evaluate("()=>{PP.S.hist=[];PP.saveHist();PP.S.embarques=[];PP.store.set('embarques',[]);PP.S.clientes=[{nome:'SÓ UM'}];PP.saveClientes();PP.renderAll();}"); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.S.hist.length")==0,'estrago feito: histórico zerado')
    # voltar pela tela
    pg.click('#btnCfg'); pg.wait_for_timeout(300); pg.click('#config [data-cgo="dad"]'); pg.wait_for_timeout(400)
    ok(pg.locator('#bkAuto table tbody tr').count()==1,'Configurações > Dados e nuvem lista a cópia')
    txt=pg.inner_text('#bkAuto'); ok('Hoje' in txt and 'como estava quando você abriu o app hoje' in txt,'a linha explica de quando é a cópia')
    pg.locator('#bkAuto').scroll_into_view_if_needed(); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'copias.png')
    pg.click('#bkAuto [data-bka="voltar"]'); pg.wait_for_timeout(1800)
    ok(pg.evaluate("PP.S.hist.length")==n0,'voltar restaura os pedidos (%d)'%pg.evaluate("PP.S.hist.length"))
    ok(pg.evaluate("PP.S.clientes.length")==c0 and pg.evaluate("PP.S.embarques.length")==e0,'restaura clientes e programação também')
    ok(pg.evaluate("JSON.parse(localStorage.getItem('pp.hist')).length")==n0,'e grava no armazenamento (sobrevive ao F5)')
    L=pg.evaluate("PP.autobk.lista().map(x=>x.k)")
    ok(any(k.startswith('antes-') for k in L),'antes de voltar, o app guardou uma cópia de AGORA (dá para voltar atrás): %s'%L)
    ok('voltaram para a cópia' in pg.inner_text('#bkAuto'),'mostra o aviso do que foi feito')
    pg.screenshot(path=OUT+'depois.png')
    # desfazer o "voltar": a cópia "antes" devolve o estrago
    ok(pg.evaluate("PP.autobk.lista().map(x=>x.k)")[0]==hoje,'as cópias dos dias aparecem primeiro; as de "antes de voltar" ficam no fim')
    antes0=[k for k in pg.evaluate("PP.autobk.lista().map(x=>x.k)") if k.startswith('antes-')][0]
    pg.click('#bkAuto [data-bka="voltar"][data-k="%s"]'%antes0); pg.wait_for_timeout(1500)
    ok(pg.evaluate("PP.S.hist.length")==0,'a cópia "antes de voltar no tempo" desfaz a restauração')
    pg.click('#bkAuto [data-bka="voltar"][data-k="%s"]'%hoje); pg.wait_for_timeout(1500)
    ok(pg.evaluate("PP.S.hist.length")==n0,'e dá para voltar de novo para a cópia do dia')
    # só 7 dias ficam guardados
    pg.evaluate("""async()=>{const d=await new Promise(r=>{const q=indexedDB.open('pp-bk',1);q.onsuccess=()=>r(q.result)});
      for(let i=1;i<=12;i++){const k=PP.Features.addDays(PP.Features.todayISO(),-i);await new Promise(r=>{const t=d.transaction('b','readwrite');t.objectStore('b').put({ts:Date.now()-i*864e5,z:0,d:'{}',tam:2,info:{pedidos:i}},k);t.oncomplete=r});}}""")
    pg.evaluate("PP.autobk.criar('dia')"); pg.wait_for_timeout(800); pg.evaluate("PP.autobk.carregar()"); pg.wait_for_timeout(500)
    L=pg.evaluate("PP.autobk.lista().map(x=>x.k)"); dias=[k for k in L if not k.startswith('antes-')]; antes=[k for k in L if k.startswith('antes-')]
    ok(len(dias)==7,'guarda no máximo 7 dias (ficou com %d: %s)'%(len(dias),dias))
    ok(dias[0]==hoje and dias[-1]==pg.evaluate("PP.Features.addDays(PP.Features.todayISO(),-6)"),'mantém os 7 mais recentes')
    ok(len(antes)<=3,'no máximo 3 cópias de "antes de voltar" (%d)'%len(antes))
    # baixar uma cópia
    with pg.expect_download() as dl: pg.click('#bkAuto [data-bka="baixar"] >> nth=0')
    ok(dl.value.suggested_filename.startswith('prestige-pedidos-copia-'),'dá para baixar a cópia como arquivo: '+dl.value.suggested_filename)
    ok(not errs,'sem erros de JS: %s'%errs)
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); sys.exit(1 if fails else 0)

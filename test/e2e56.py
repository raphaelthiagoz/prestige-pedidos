import sys, os; sys.path.insert(0,'test')
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e56/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1500,'height':900},service_workers='block').new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500)
    pg.evaluate("""()=>{sessionStorage.setItem('pp.asShown','1');
      const L=(id,c,cx)=>({id,cliente:c,aero:'GRU',cidade:'',caixas:cx,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''});
      const E=(id,s,l)=>({id,titulo:'EMBARQUES NACIONAIS',saida:s,chegadaPrev:s,linhas:l});
      PP.S.embarques=[E('p','2026-11-09',[]),E('a','2026-11-11',[L('a1','NACIONAL',40),L('a2','RAQUEL',6)]),E('b','2026-11-11',[]),E('c','2026-11-11',[L('c1','MAEDA',6)]),E('d','2026-11-18',[L('d1','UBER',5)]),E('f','2026-11-25',[])];
      PP.store.set('embarques',PP.S.embarques);PP.store.set('fretes',{cfg:{taxa:90},rec:{'c|c1':{frete:372.5,awb:'957-43219691'}}});}""")
    pg.reload(); pg.wait_for_timeout(600); pg.evaluate("document.getElementById('config').open=false;PP.go('embarque')"); pg.wait_for_timeout(400)
    N=lambda: pg.evaluate("PP.S.embarques.length")
    pg.select_option('#emSel','a'); pg.wait_for_timeout(300)
    ok(pg.locator('[data-em="delemb"]').count()==1 and 'Excluir esta programação' in pg.inner_text('[data-em="delemb"]') and pg.locator('[data-em="limpar"]').count()==1,'só 2 botões: "Excluir esta programação" e "Limpar programações repetidas e vazias"')
    pg.hover('.hinti >> nth=1'); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'prog.png',clip={'x':244,'y':0,'width':1256,'height':520})
    pg.click('[data-em="limpar"]'); pg.wait_for_timeout(300)
    ok(N()==2 and pg.evaluate("PP.S.embarques.find(e=>e.id==='a').linhas.map(l=>l.cliente).join()")=='NACIONAL,RAQUEL,MAEDA','um clique: os 3 do dia 11 viram 1 e as vazias somem (sobram %d)'%N())
    ok(pg.evaluate("PP.store.get('fretes').rec['a|c1'].frete")==372.5,'o frete do cliente foi junto')
    ok(pg.locator('[data-em="limpar"]').count()==0,'com tudo limpo o botão some')
    # excluir embarque (passado ou não) e desfazer
    pg.select_option('#emSel','a'); pg.wait_for_timeout(200); pg.click('[data-em="delemb"]'); pg.wait_for_timeout(300)
    ok(N()==1 and not pg.evaluate("PP.S.embarques.some(e=>e.id==='a')"),'Excluir embarque remove o embarque escolhido')
    ok(pg.locator('[data-em="restemb"]').count()==1,'aparece "Desfazer a última exclusão"')
    pg.click('[data-em="restemb"]'); pg.wait_for_timeout(300)
    ok(N()==2 and pg.evaluate("PP.S.embarques.find(e=>e.id==='a').linhas.length")==3,'desfazer devolve o embarque com os clientes')
    # + Novo embarque duas vezes não cria duplicado vazio
    pg.click('[data-em="new"]'); pg.wait_for_timeout(200); pg.click('[data-em="new"]'); pg.wait_for_timeout(200)
    ok(N()==3,'clicar 2x em "+ Nova programação" não cria dois vazios (%d)'%N())
    ok(not errs,'sem erros de JS: %s'%errs)
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); sys.exit(1 if fails else 0)

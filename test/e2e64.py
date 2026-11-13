import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
SETUP="""(()=>{
 const F=PP.Features,base=PP.S.hist[0],hoje=F.todayISO(),clone=(n,inv)=>{const h=JSON.parse(JSON.stringify(base));h.id='t'+inv;h.inv=inv;h.cliente={nome:n,end:''};h.dataISO=F.addDays(hoje,-4);h.mort=null;h.mortOk=0;h.avista=null;h.pay={status:'aguardando',pago:0,dataPago:'',obs:''};h.lines=[{nome:'ARRAIA',sci:'a',comum:'ARRAIA',peixes:100,preco:5}];h.nota={rows:[{nome:'ARRAIA',cxs:null,qtd:100,unit:5}],ex:{temAt:false},dia:''};h.totais={caixas:2,peixes:100,fish:500,gta:20,atestado:0,emb:30,total:550,valor:500,kg:16};return h;};
 const A=clone('Cliente Ana','9001'),B=clone('Cliente Bia','9002'),C=clone('Cliente Caio','9003');
 B.mort={dead:{0:10},credito:50,mortos:10,destino:'guardar',em:hoje};
 PP.S.hist.length=0;[A,B,C].forEach(h=>PP.S.hist.push(h));PP.saveHist();
 PP.S.embarques=[
  {id:'e1',saida:F.addDays(hoje,-3),titulo:'Voo passado',linhas:[{id:'l1',cliente:'Cliente Ana',pedidoId:A.id,caixas:2},{id:'l2',cliente:'Cliente Bia',pedidoId:B.id,caixas:2},{id:'l3',cliente:'Cliente Caio',pedidoId:C.id,caixas:2},{id:'l4',cliente:'Sem Pedido',pedidoId:'',caixas:1}]},
  {id:'e2',saida:F.addDays(hoje,4),titulo:'Voo futuro',linhas:[{id:'l5',cliente:'Cliente Ana',pedidoId:'',caixas:3}]}];
 PP.store.set('embarques',PP.S.embarques);})()"""
def vis(pg,s): return pg.locator(s).first.is_visible()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1000}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("PP.store.set('bkSnooze',Date.now()+9e9)"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate(SETUP); pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(400)
    pg.click('[data-htipo=emb]'); pg.wait_for_timeout(300)
    t=pg.inner_text('#vHist')
    ok('Embarques e clientes' in t,'aparece o chip/painel "Embarques e clientes"')
    ok(pg.locator('#vHist .epl').count()==2,'um bloco (tabela) por embarque: passado e futuro')
    ok(pg.locator('#vHist .epr').count()==5,'uma linha por cliente (5)')
    ok('Sem pedido no histórico' in t,'cliente da programação sem pedido é sinalizado')
    ok('Perguntar ao cliente' in t and 'saiu há 3 dia' in t,'mortalidade a perguntar para quem ainda não respondeu')
    ok('guardado p/ próximo pedido' in t and '10 peixe' in t,'mortalidade guardada aparece com valor e peixes')
    ok('ainda vai vir' not in t,'sem texto inventado')
    kp=pg.inner_text('#vHist .kpis')
    ok(pg.inner_text('#vHist .kpis div:nth-child(2) b').strip()=='2','KPI: 2 mortalidades a perguntar (Ana e Caio)')
    # ação: não teve mortalidade
    pg.click('[data-ep=mortnao][data-id=t9001]'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.S.hist.find(h=>h.id==='t9001').mortOk")>0,'"Não teve" grava que não houve mortalidade')
    ok(pg.locator('#vHist .chip', has_text='Perguntar ao cliente').count()==1 and pg.inner_text('#vHist .kpis div:nth-child(2) b').strip()=='1','depois de "Não teve" sobra só 1 a perguntar (Caio)')
    # ação: 10% à vista (Bia: abatendo o crédito guardado não entra; base = peixes)
    base=pg.evaluate("PP.Features.baseAvista(PP.S.hist.find(h=>h.id==='t9002'))"); v=round(base*0.10,2)
    pg.click('[data-ep=av10][data-id=t9002]'); pg.wait_for_timeout(400)
    av=pg.evaluate("PP.S.hist.find(h=>h.id==='t9002').avista")
    ok(av and av['pct']==10 and abs(av['valor']-v)<0.006,'10%% à vista aplicado: %s (esperado %.2f)'%(av,v))
    ok(pg.locator('[data-ep=av10][data-id=t9002]').count()==0,'depois de aplicado o botão 10% some')
    ok('10% à vista' in pg.inner_text('#vHist'),'a linha mostra o desconto aplicado')
    # ação: recebi
    dev=pg.evaluate("PP.Features.devido(PP.S.hist.find(h=>h.id==='t9002'))")
    pg.click('[data-ep=recebi][data-id=t9002]'); pg.wait_for_timeout(400)
    h=pg.evaluate("PP.S.hist.find(h=>h.id==='t9002')")
    ok(h['pay']['status']=='pago' and abs(h['pay']['pago']-dev)<0.006,'"Recebi" marca como pago o valor devido (%.2f)'%dev)
    ok(pg.locator('[data-ep=recebi][data-id=t9002]').count()==0,'pedido pago não mostra mais Recebi nem cobrança')
    # detalhes abre o pedido
    pg.click('[data-ep=abrir][data-id=t9003]'); pg.wait_for_timeout(500)
    ok(vis(pg,'#hdet') and 'Cliente Caio' in pg.text_content('#hdet'),'Detalhes abre o pedido no Histórico')
    # chip Todos volta ao histórico normal
    ok(pg.locator('#histTb').count()==1,'o histórico normal continua igual')
    ok(not errs,'sem erro de JS: '+str(errs))
    b.close()
print('FALHAS:',fails) if fails else print('TUDO OK')
sys.exit(1 if fails else 0)

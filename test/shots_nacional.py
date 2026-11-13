import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
SETUP="""(()=>{
 const F=PP.Features,base=PP.S.hist[0],hoje=F.todayISO(),clone=(n,inv)=>{const h=JSON.parse(JSON.stringify(base));h.id='t'+inv;h.inv=inv;h.cliente={nome:n,end:''};h.dataISO=F.addDays(hoje,-6);h.mort=null;h.mortOk=0;h.avista=null;h.pay={status:'aguardando',pago:0,dataPago:'',obs:''};h.lines=[{nome:'ARRAIA',sci:'a',comum:'ARRAIA',peixes:100,preco:5}];h.nota={rows:[{nome:'ARRAIA',cxs:null,qtd:100,unit:5}],ex:{temAt:false},dia:''};h.totais={caixas:2,peixes:100,fish:500,gta:20,atestado:0,emb:30,total:550,valor:500,kg:16};return h;};
 const A=clone('Cliente Ana','9001'),B=clone('Cliente Bia','9002'),C=clone('Cliente Caio','9003'),D=clone('Cliente Duda','9004');
 const bs=h=>F.valorAvista(h,10);
 A.avista={pct:10,valor:bs(A),em:F.addDays(hoje,-5),ate:F.addDays(hoje,-1)};   // venceu
 B.avista={pct:10,valor:bs(B),em:F.addDays(hoje,-5),ate:F.addDays(hoje,1)};    // vence amanhã
 C.mort={dead:{0:4},credito:20,mortos:4,destino:'guardar',em:hoje};            // sem comprovação
 D.avista={pct:5,valor:F.valorAvista(D,5),em:F.addDays(hoje,-5),ate:F.addDays(hoje,5)}; // no prazo
 PP.S.hist.length=0;[A,B,C,D].forEach(h=>PP.S.hist.push(h));PP.saveHist();
 PP.S.embarques=[{id:'e1',saida:F.addDays(hoje,-3),titulo:'Voo',linhas:[A,B,C,D].map((h,i)=>({id:'l'+i,cliente:h.cliente.nome,pedidoId:h.id,caixas:2}))}];
 PP.store.set('embarques',PP.S.embarques);})()"""

with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1000},device_scale_factor=2,service_workers='block'); pg=ctx.new_page()
    pg.on('dialog', lambda d: d.accept())
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("PP.store.set('bkSnooze',Date.now()+9e9)"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate(SETUP); pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(400)
    pg.click('[data-htipo=emb]'); pg.wait_for_timeout(500)
    pg.locator('#vHist .epl').first.scroll_into_view_if_needed()
    pg.locator('#vHist .epl').first.screenshot(path='out/foco/nacional_embarque.png')
    pg.click('[data-ep=avoutro][data-id=t9002]'); pg.wait_for_timeout(400)
    pg.locator('#epForm').scroll_into_view_if_needed(); pg.screenshot(path='out/foco/nacional_form_prazo.png')
    pg.click('[data-ep=fechar]'); pg.wait_for_timeout(200)
    pg.evaluate("PP.S.view!=='hoje'&&PP.go('hoje')"); pg.wait_for_timeout(500)
    pg.evaluate("PP.assist&&PP.assist.open&&PP.assist.open()"); pg.wait_for_timeout(500)
    pg.screenshot(path='out/foco/nacional_assistente.png')
    b.close()

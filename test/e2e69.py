import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
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
def H(pg,id): return pg.evaluate("(id)=>PP.S.hist.find(h=>h.id===id)",id)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1000}, service_workers='block', permissions=['clipboard-read','clipboard-write']); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("PP.store.set('bkSnooze',Date.now()+9e9)"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate(SETUP); pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(400)
    pg.click('[data-htipo=emb]'); pg.wait_for_timeout(300)
    row=lambda n: pg.locator('#vHist .epr', has_text=n)
    # --- lógica pura
    s=pg.evaluate("(()=>{const F=PP.Features,h=PP.S.hist,t=F.todayISO();return h.map(x=>F.avistaSit(x,t).key)})()")
    ok(s==['venceu','amanha','sem','ok'],'avistaSit: venceu / vence amanhã / sem desconto / no prazo -> %s'%s)
    ok(pg.evaluate("PP.extra.avistaPend().length")==2,'avistaPend lista só os que vencem hoje/amanhã ou já venceram (2)')
    ok(pg.evaluate("PP.extra.provaPend().length")==1,'provaPend lista a mortalidade sem comprovação (1)')
    # --- tela
    ok('venceu' in row('Cliente Ana').inner_text() and 'vale até' in row('Cliente Ana').inner_text(),'linha da Ana mostra "vale até ... (venceu)"')
    ok('vence amanhã' in row('Cliente Bia').inner_text(),'linha da Bia mostra "vence amanhã"')
    ok('vale até' in row('Cliente Duda').inner_text() and 'venceu' not in row('Cliente Duda').inner_text(),'Duda no prazo mostra só a data')
    ok(pg.locator('[data-ep=avvenceu][data-id=t9001]').count()==1,'só quem venceu tem "Retirar desconto (venceu)"')
    ok(pg.locator('[data-ep=avvenceu][data-id=t9002]').count()==0,'quem ainda está no prazo não tem esse botão')
    ok('sem comprovação' in row('Cliente Caio').inner_text(),'mortalidade sem comprovação aparece sinalizada')
    # --- mensagens prontas
    pg.click('[data-ep=msgav][data-id=t9002]'); pg.wait_for_timeout(300)
    cb=pg.evaluate("navigator.clipboard.readText()")
    ok('desconto' in cb.lower() and '10%' in cb and 'vence' not in cb and 'até' in cb,'mensagem do desconto copiada: '+cb[:90])
    pg.click('[data-ep=msgmort][data-id=t9003]'); pg.wait_for_timeout(300)
    cb=pg.evaluate("navigator.clipboard.readText()")
    ok('4' in cb and 'R$' in cb,'mensagem da mortalidade traz peixes e valor: '+cb[:90])
    # --- comprovação: pelo WhatsApp
    pg.click('[data-ep=provawhats][data-id=t9003]'); pg.wait_for_timeout(400)
    ok((H(pg,'t9003')['mort'].get('prova') or {}).get('tipo')=='whats','"Cliente mandou pelo WhatsApp" grava a comprovação')
    ok('sem comprovação' not in row('Cliente Caio').inner_text() and 'WhatsApp' in row('Cliente Caio').inner_text(),'linha passa a mostrar "recebida pelo WhatsApp"')
    ok(pg.evaluate("PP.extra.provaPend().length")==0,'sai da lista de pendentes')
    # --- comprovação: arquivo
    pg.evaluate("(()=>{const h=PP.S.hist.find(x=>x.id==='t9003');h.mort=Object.assign({},h.mort,{prova:undefined});PP.saveHist();PP.go('hist');})()"); pg.wait_for_timeout(300)
    pg.click('[data-htipo=emb]'); pg.wait_for_timeout(300)
    with pg.expect_file_chooser() as fc:
        pg.click('[data-ep=provanova][data-id=t9003]')
    fc.value.set_files({'name':'mortos.jpg','mimeType':'image/jpeg','buffer':b'\xff\xd8\xff\xe0fakejpg'}); pg.wait_for_timeout(700)
    pr=(H(pg,'t9003')['mort'].get('prova') or {})
    ok(pr.get('tipo')=='arquivo' and pr.get('nome')=='mortos.jpg','arquivo anexado e registrado: %s'%pr)
    ok(pg.locator('[data-ep=provaver][data-id=t9003]').count()==1 and 'mortos.jpg' in row('Cliente Caio').inner_text(),'aparece "Ver comprovação" e o nome do arquivo')
    got=pg.evaluate("PP.nfpdf._x.dbGet('mortprova-t9003').then(r=>r&&r.bytes?r.bytes.length:0)")
    ok(got>0,'o arquivo ficou guardado no aparelho (%s bytes)'%got)
    # corrigir mortalidade mantém a comprovação
    pg.click('[data-ep=mortinfo][data-id=t9003]'); pg.wait_for_timeout(300)
    pg.fill('[data-epd="0"]','4'); pg.click('[data-ep=mortsalvar]'); pg.wait_for_timeout(400)
    ok((H(pg,'t9003')['mort'].get('prova') or {}).get('tipo')=='arquivo','corrigir a mortalidade não apaga a comprovação')
    # --- retirar desconto vencido
    dev0=pg.evaluate("PP.Features.devido(PP.S.hist.find(h=>h.id==='t9001'))"); av=H(pg,'t9001')['avista']['valor']
    pg.click('[data-ep=avvenceu][data-id=t9001]'); pg.wait_for_timeout(400)
    ok(H(pg,'t9001')['avista'] is None and abs(pg.evaluate("PP.Features.devido(PP.S.hist.find(h=>h.id==='t9001'))")-(dev0+av))<0.006,'retirar o desconto vencido devolve o valor cheio (+R$ %.2f)'%av)
    # --- 10% novo já nasce com prazo
    pg.click('[data-ep=av10][data-id=t9001]'); pg.wait_for_timeout(400)
    a=H(pg,'t9001')['avista']; esp=pg.evaluate("PP.Features.addDays(PP.Features.todayISO(),3)")
    ok(a and a.get('ate')==esp,'10%% novo vale por 3 dias por padrão (até %s): %s'%(esp,a))
    # --- outro %: prazo escolhido no formulário
    pg.click('[data-ep=avoutro][data-id=t9004]'); pg.wait_for_timeout(300)
    ok(pg.locator('[data-epa]').count()==1,'formulário tem o campo "vale até"')
    novo=pg.evaluate("PP.Features.addDays(PP.Features.todayISO(),9)")
    pg.fill('[data-epa]',novo); pg.click('[data-ep=avsalvar]'); pg.wait_for_timeout(400)
    ok(H(pg,'t9004')['avista'].get('ate')==novo,'prazo escolhido é gravado: '+novo)
    # --- prorrogar pelo detalhe do pedido
    pg.click('[data-ep=abrir][data-id=t9002]'); pg.wait_for_timeout(500)
    ok(pg.locator('#avAte').count()==1,'o detalhe do pedido também tem "vale até"')
    novo2=pg.evaluate("PP.Features.addDays(PP.Features.todayISO(),7)")
    pg.fill('#avAte',novo2); pg.click('[data-h=avSave][data-id=t9002]'); pg.wait_for_timeout(400)
    ok(H(pg,'t9002')['avista'].get('ate')==novo2,'prorrogar pelo detalhe grava o novo prazo')
    # --- Assistente
    pg.evaluate("(()=>{const h=PP.S.hist.find(x=>x.id==='t9003');h.mort=Object.assign({},h.mort,{prova:undefined});PP.S.hist.find(x=>x.id==='t9001').avista={pct:10,valor:50,em:PP.Features.todayISO(),ate:PP.Features.addDays(PP.Features.todayISO(),-2)};PP.saveHist();})()")
    its=pg.evaluate("PP.assist.items().map(i=>({k:i.key,t:i.title,kind:i.kind,a:i.actions.map(x=>x.id)}))")
    avp=[i for i in its if i['k'].startswith('avp:')]; mps=[i for i in its if i['k'].startswith('mps:')]
    ok(len(avp)>=1 and any('venceu' in i['t'] for i in avp),'Assistente avisa desconto à vista que venceu')
    ok(any('retirar' in i['a'] for i in avp if 'venceu' in i['t']),'aviso de desconto vencido oferece "Retirar desconto"')
    ok(len(mps)==1 and 'whats' in mps[0]['a'],'Assistente avisa mortalidade sem comprovação, com atalho do WhatsApp')
    pg.evaluate("PP.assist.act('mps:t9003','whats')"); pg.wait_for_timeout(300)
    ok((H(pg,'t9003')['mort'].get('prova') or {}).get('tipo')=='whats','ação do Assistente grava a comprovação pelo WhatsApp')
    pg.evaluate("PP.assist.act('avp:t9001','retirar')"); pg.wait_for_timeout(300)
    ok(H(pg,'t9001')['avista'] is None,'ação do Assistente retira o desconto vencido')
    ok(not errs,'sem erro de JS: '+str(errs))
    b.close()
print('FALHAS:',fails) if fails else print('TUDO OK')
sys.exit(1 if fails else 0)

import sys, os, re; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e54/'; os.makedirs(OUT,exist_ok=True)
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
    T='4 cx paracheirodon axelrodi\n2 cx rodostomus rodostomus'
    F=lambda n: pg.evaluate("n=>PP.F? 0 : PP.Features.addDays(PP.Features.todayISO(),n)",n)
    d7=F(7); d9=F(9)
    names=pg.evaluate("PP.S.clientes.map(c=>c.nome)"); A,B=names[0],names[1]; print('  clientes:',A,'|',B)
    h0=pg.evaluate("PP.S.hist.length"); e0=pg.evaluate("PP.S.embarques.length")
    # --- pedido do cliente A com embarque marcado no cabeçalho
    pg.select_option('#cliente',label=A); pg.fill('#txt',T); pg.click('#ler'); pg.wait_for_timeout(400)
    ok(pg.locator('#embData').count()==1 and pg.locator('#pedDel').count()==1 and pg.locator('#cliMort').count()==0,'cabeçalho: campo Embarque (saída) e botão Apagar pedido (sem Mortalidade)')
    pg.fill('#embData',d7); pg.locator('#embData').dispatch_event('change'); pg.wait_for_timeout(200)
    pg.click('#saveHist'); pg.wait_for_timeout(500)
    idA=pg.evaluate("PP.S.curId"); ok(pg.evaluate("PP.S.hist.length")==h0+1,'pedido de A salvo')
    em=pg.evaluate("id=>{const e=PP.extra.embDoPedido(id);return e?{saida:e.saida,n:e.linhas.length,cli:e.linhas.find(l=>l.pedidoId===id).cliente}:null}",idA)
    ok(em and em['saida']==d7 and em['cli']==A,'ao salvar entrou sozinho na programação do dia marcado: %s'%em)
    ok('Na programação' in pg.inner_text('#embDataNt'),'cabeçalho mostra o embarque: '+pg.inner_text('#embDataNt'))
    # --- O CASO DO SUMIÇO: sem clicar em "Novo pedido", troca o cliente e faz outro pedido
    pg.select_option('#cliente',label=B); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.S.curId")is None,'trocar de cliente vira pedido NOVO (desliga do pedido salvo)')
    ok('pedido NOVO' in pg.inner_text('#draftBar'),'avisa na tela: '+pg.inner_text('#draftBar')[:90])
    pg.fill('#txt','1 cx corydoras schwartzi'); pg.click('#ler'); pg.wait_for_timeout(400)
    pg.fill('#embData',d9); pg.locator('#embData').dispatch_event('change'); pg.click('#saveHist'); pg.wait_for_timeout(500)
    idB=pg.evaluate("PP.S.curId")
    hs=pg.evaluate("PP.S.hist.map(e=>[e.id,e.cliente.nome])")
    ok(idB!=idA and any(x[0]==idA and x[1]==A for x in hs) and any(x[0]==idB and x[1]==B for x in hs),'os DOIS pedidos existem no histórico (o de A não foi sobrescrito)')
    emA=pg.evaluate("id=>{const e=PP.extra.embDoPedido(id);return e?[e.saida,e.linhas.find(l=>l.pedidoId===id).cliente]:null}",idA)
    emB=pg.evaluate("id=>{const e=PP.extra.embDoPedido(id);return e?[e.saida,e.linhas.find(l=>l.pedidoId===id).cliente]:null}",idB)
    ok(emA==[d7,A] and emB==[d9,B],'os DOIS continuam na programação, cada um no seu dia: %s %s'%(emA,emB))
    ok(pg.evaluate("PP.S.hist.find(e=>e.id==='%s').inv"%idA)!=pg.evaluate("PP.S.hist.find(e=>e.id==='%s').inv"%idB),'o pedido novo ganhou outro número de invoice')
    # --- mudar a data do embarque pelo cabeçalho move na programação
    pg.fill('#embData',d7); pg.locator('#embData').dispatch_event('change'); pg.wait_for_timeout(300)
    e7=pg.evaluate("d=>PP.S.embarques.filter(e=>e.saida===d).map(e=>e.linhas.map(l=>l.cliente))",d7); e9=pg.evaluate("d=>PP.S.embarques.filter(e=>e.saida===d).length",d9)
    ok(len(e7)==1 and sorted(e7[0])==sorted([A,B]) and e9==0,'mudar a data move o cliente para o embarque do dia (e o embarque vazio some): %s'%e7)
    pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'cabecalho.png',clip={'x':244,'y':0,'width':1256,'height':470})
    # --- apagar pedido pelo botão do Nacional + lixeira
    pg.click('#pedDel'); pg.wait_for_timeout(400)
    ok(not pg.evaluate("PP.S.hist.some(e=>e.id==='%s')"%idB),'Apagar pedido tira do histórico')
    ok(pg.evaluate("PP.extra.embDoPedido('%s')"%idB)is None and pg.evaluate("PP.extra.embDoPedido('%s')"%idA)is not None,'e tira só ele da programação (A continua)')
    lx=pg.evaluate("PP.store.get('histLixo',[]).map(x=>x.e.cliente.nome)"); ok(lx[:1]==[B],'pedido apagado foi para "Pedidos apagados": %s'%lx)
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(400)
    ok(pg.locator('#hLixo').count()==1,'Histórico mostra "Pedidos apagados"')
    pg.evaluate("document.querySelector('#hLixo details').open=true"); pg.locator('#hLixo').scroll_into_view_if_needed(); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'lixeira.png')
    pg.click('#hLixo [data-lixo="0"]'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.S.hist.some(e=>e.id==='%s')"%idB) and pg.evaluate("PP.store.get('histLixo',[]).length")==0,'Restaurar devolve o pedido ao histórico')
    # --- sincronização que remove pedido também guarda na lixeira
    pg.evaluate("""(id)=>{const h=PP.store.get('hist').filter(e=>e.id!==id);localStorage.setItem('pp.hist',JSON.stringify(h));PP.reloadState();}""",idA); pg.wait_for_timeout(300)
    lx=pg.evaluate("PP.store.get('histLixo',[]).map(x=>[x.e.cliente.nome,x.motivo])"); ok(lx and lx[0][0]==A and 'sincroniza' in lx[0][1],'pedido removido pela sincronização fica guardado: %s'%lx)
    # --- mesmo cliente, edição normal continua atualizando o mesmo pedido
    pg.evaluate("PP.loadEntry('%s','edit')"%idB); pg.wait_for_timeout(400); n=pg.evaluate("PP.S.hist.length"); pg.click('#saveHist'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.S.hist.length")==n and pg.evaluate("PP.S.curId")==idB,'editar e salvar o mesmo cliente continua atualizando o mesmo pedido')
    pg.fill('#embData',d9); pg.locator('#embData').dispatch_event('change'); pg.wait_for_timeout(300)
    pg.evaluate("PP.newOrder()"); pg.evaluate("PP.loadEntry('%s','edit')"%idB); pg.wait_for_timeout(400)
    ok(pg.input_value('#embData')==d9,'abrir pedido salvo mostra o embarque dele no cabeçalho')
    ok(not errs,'sem erros de JS: %s'%errs)
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); sys.exit(1 if fails else 0)

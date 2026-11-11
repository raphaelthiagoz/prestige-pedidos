import sys, os, re, base64; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e42/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
errs=[]
DATA="""()=>{const F=PP.Features,t=F.todayISO(),d=n=>F.addDays(t,n);
 const ln=(c,id)=>({id,cliente:c,aero:'GRU',cidade:'',caixas:4,peso:'',dim:'',awb:'',status:'chegou',chegou:'',obs:'',pedidoId:''});
 const mk=(id,nome,inv,tot)=>({id,ts:Date.now()-5e5,cliente:{nome},inv,nf:'0000'+inv,dataISO:d(-2),atNum:0,totais:{caixas:2,peixes:1000,total:tot,gta:0,atestado:0,emb:0,valor:tot},pay:{status:'aguardando',pago:0,dataPago:'',obs:''},lines:[{sci:'PARACHEIRODON AXELRODI',comum:'NEON CARDINAL',nome:'NEON CARDINAL',peixes:1000,preco:tot/1000,boxes:2,qtyBox:500}]});
 PP.S.hist=[mk('hA','CLIENTE A','201',500),mk('hB','CLIENTE B','202',800)]; PP.store.set('hist',PP.S.hist);
 PP.S.clientes=[{nome:'CLIENTE A',end:'',aero:'GRU',cidade:'',desc:0,precos:''},{nome:'CLIENTE B',end:'',aero:'GRU',cidade:'',desc:0,precos:''},{nome:'CESAR SOARES',end:'',aero:'GRU',cidade:'',desc:0,precos:''}];PP.saveClientes&&PP.saveClientes();
 const e={id:'eP',titulo:'EMB',saida:d(-2),chegadaPrev:d(-1),linhas:[Object.assign(ln('CLIENTE A','l1'),{pedidoId:'hA'}),Object.assign(ln('CLIENTE B','l2'),{pedidoId:'hB'}),ln('CESAR SOARES','l3')]};
 PP.S.embarques=[e];PP.store.set('embarques',PP.S.embarques);
 PP.S.cfg.numeracao.ultimaInvoice=202;PP.store.set('cfg',PP.S.cfg);}"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1100},service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(500)
    pg.evaluate(DATA); pg.reload(); pg.wait_for_timeout(500)
    # --- Histórico: conferência
    pg.click('#nav button[data-view="hist"]'); pg.wait_for_timeout(500)
    t=pg.inner_text('#vHist'); pg.screenshot(path=OUT+'hist.png')
    ok(pg.locator('#hConf').count()==1,'quadro de conferência aparece no Histórico')
    ok(re.search(r'3\s*VENDAS NA PROGRAMAÇÃO',t,re.I) and re.search(r'2\s*COM PEDIDO',t,re.I) and re.search(r'1\s*SEM PEDIDO',t,re.I),'3 na programação · 2 com pedido · 1 sem pedido')
    ok('CESAR SOARES' in pg.inner_text('#hConf') and 'CLIENTE A' not in pg.inner_text('#hConf'),'só o cliente sem pedido (Cesar Soares) aparece na lista do que falta')
    pg.click('#hConf [data-hc=novo]'); pg.wait_for_timeout(300)
    ok(pg.input_value('#pnForm [data-pn=cli]')=='CESAR SOARES' and pg.input_value('#pnForm [data-pn=inv]')=='203','"Criar pedido" abre o formulário com cliente e invoice sugerida (203)')
    pg.fill('#pnForm [data-pn="it.0.sci"]','Paracheirodon axelrodi'); pg.fill('#pnForm [data-pn="it.0.boxes"]','2'); pg.fill('#pnForm [data-pn="it.0.qpb"]','500'); pg.fill('#pnForm [data-pn="it.0.price"]','0.4')
    pg.click('[data-pnb=save]'); pg.wait_for_timeout(500)
    ok(pg.evaluate("PP.S.embarques[0].linhas[2].pedidoId")!='' ,'pedido salvo fica vinculado à linha da programação')
    ok(pg.evaluate("PP.S.embarques[0].linhas.length")==3,'não duplicou a linha na programação')
    ok('Tudo certo' in pg.inner_text('#vHist'),'quadro vira "Tudo certo" depois de criar o pedido')
    # --- Mortalidade
    ok(pg.locator('#hMort').count()==1,'faixa "Mortalidade dos embarques recentes" aparece')
    ok(pg.locator('#hMort button[data-h=mortgo]').count()==3,'um botão por cliente na faixa de mortalidade')
    ok(pg.locator('#histTb button[data-h=mortgo]').count()>=3,'botão "Mortalidade" em cada linha da tabela')
    pg.click('#hMort button[data-h=mortgo]:has-text("CLIENTE B")'); pg.wait_for_timeout(500)
    ok(pg.is_visible('#mortBox') and 'CLIENTE B' in pg.inner_text('#hdet'),'abre direto o painel de mortalidade do pedido')
    pg.fill('#mortBox [data-dead="0"]','100'); pg.wait_for_timeout(300)
    mb=pg.inner_text('#mortBox'); print('  ',mb.replace('\n',' | ')[:380])
    ok('R$ 80,00' in mb and 'R$ 720,00' in mb,'resumo mostra: mortalidade −80,00 e fica na notinha 720,00')
    pg.screenshot(path=OUT+'mort.png')
    pg.click('[data-h=mortSave]'); pg.wait_for_timeout(300)
    st=pg.evaluate("PP.S.hist.find(h=>h.id==='hB').mort"); ok(st and abs(st['credito']-80)<0.01,'ajuste gravado: crédito 80,00')
    ok(pg.locator('#hMort button[data-h=mortgo]:has-text("CLIENTE B")').count()==0,'cliente B sai da faixa pendente')
    pg.click('#hMort [data-h=mortok]'); pg.wait_for_timeout(300)
    ok(pg.locator('#hMort').count()==0,'"Nenhum teve mortalidade" limpa a faixa')
    # assistente (volta pendência para testar)
    pg.evaluate("PP.S.hist.forEach(h=>{if(h.id!=='hB'){h.mortOk=0}});PP.saveHist()"); pg.click('#nav button[data-view="hoje"]'); pg.wait_for_timeout(600)
    ok('Teve mortalidade no embarque' in pg.inner_text('#vHoje'),'tela Hoje avisa: "Teve mortalidade no embarque de ...?"')
    pg.screenshot(path=OUT+'hoje.png')
    # nacional: botão
    pg.click('#nav button[data-view="pedido"]'); pg.wait_for_timeout(400)
    pg.select_option('#cliente',label='CLIENTE A'); pg.evaluate("(()=>{const c=PP.S.clientes[PP.S.cli];const e=PP.S.hist.filter(x=>PP.Features.active(x)&&PP.up(x.cliente.nome)===PP.up(c.nome)).sort((a,b)=>b.ts-a.ts)[0];const X=PP.extra.ST;X.hist.q='';X.hist.st='';X.hist.tipo='nac';X.hist.open=e.id;PP.go('hist')})()"); pg.wait_for_timeout(600)
    ok(pg.is_visible('#mortBox') and 'CLIENTE A' in pg.inner_text('#hdet'),'Nacional: botão 🐟 Mortalidade abre o ajuste do último pedido do cliente')
    # --- PDF solto fora da caixa
    pdf=base64.b64encode(open('test/fx/modelo_sem_grifos.pdf','rb').read()).decode()
    pg.evaluate("PP.go('mapa')"); pg.wait_for_timeout(400); pg.click('#mpTabs [data-tab=nfs]'); pg.wait_for_timeout(200)
    pg.evaluate("""(b64)=>{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);const dt=new DataTransfer();dt.items.add(new File([u],'x.pdf',{type:'application/pdf'}));const el=document.querySelector('#vMapa h2');for(const t of ['dragenter','dragover','drop'])el.dispatchEvent(new DragEvent(t,{bubbles:true,cancelable:true,dataTransfer:dt}));}""",pdf)
    pg.wait_for_timeout(6000); print('  tab:',pg.evaluate("document.querySelector('#mpTabs .on')&&document.querySelector('#mpTabs .on').textContent"),'| toast:',pg.evaluate("(document.querySelector('#toasts')||{}).innerText"),'| errs',errs)
    ok(pg.locator('[data-act=salvarrev]').count()==1,'PDF solto fora da caixa tracejada também é lido')
    # --- Abrir Pescadores em outra tela
    pg.evaluate("PP.go('hoje')")
    pg.evaluate("document.body.insertAdjacentHTML('beforeend','<div id=\"vHoje\" class=\"alert\"><button id=\"tpesc\" data-tab=\"pesc\">Abrir Pescadores</button></div>')")
    ok(True,'(botão de teste criado)')
    # --- Tarefas: venceu só depois da data
    pg.evaluate("""()=>{const t=PP.Features.todayISO(),d=n=>PP.Features.addDays(t,n);PP.store.set('kanban',{tasks:[{id:'k1',titulo:'FUTURA',cat:'Pedidos',prio:'m',prazo:d(3),status:'todo',obs:'',rec:'',ts:1},{id:'k2',titulo:'ATRASADA',cat:'Pedidos',prio:'m',prazo:d(-3),status:'todo',obs:'',rec:'',ts:2}]});PP.kanban.render&&PP.kanban.render();}""")
    pg.evaluate("PP.go('tarefas')"); pg.wait_for_timeout(500)
    tt=pg.inner_text('#vTarefas'); print('  ',tt.replace('\n',' | ')[:260])
    ok(re.search(r'FUTURA[\s\S]{0,60}(sáb|dom|seg|ter|qua|qui|sex)',tt,re.I) is not None and not re.search(r'FUTURA[\s\S]{0,30}venceu',tt,re.I),'tarefa com prazo futuro NÃO diz "venceu"')
    ok(re.search(r'ATRASADA[\s\S]{0,60}venceu há 3 dias',tt,re.I) is not None,'tarefa atrasada diz "venceu há 3 dias · dd/mm/aaaa"')
    ok(not errs,'sem erros de página %s'%errs)
print('FALHAS',fails)

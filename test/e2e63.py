import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
SIM='Paracheirodon simulans Neon verde'; CAR='Paracheirodon axelrodi Cardinal'
ST={'nfs':[
 {'id':'a','numero':'1676164','fornecedor':'Aramar','data':'2026-06-01','itens':[{'esp':SIM,'qtd':2900},{'esp':CAR,'qtd':1000}]},
 {'id':'c','numero':'1710124','fornecedor':'Eloisa','data':'2026-08-01','itens':[{'esp':SIM,'qtd':5000}]}],
 'processos':[],'meta':{},'marcas':[],
 'draft':{'pack':'','sei':'','destino':'','historico':False,'linhas':[]}}
def vis(pg,sel): return pg.locator(sel).first.is_visible()
def passo(pg): return pg.text_content('#mpAgora .k')
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept('21010.009999/2026-09'))
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("s=>PP.store.set('mapa',s)",ST); pg.reload(); pg.wait_for_timeout(600)
    pg.click('#nav [data-view="mapa"]'); pg.wait_for_timeout(400)
    ok(pg.locator('#mpTabs button.on').inner_text()=='Passo a passo','a aba inicial é o Passo a passo')
    ok('Passo 2 de 6' in passo(pg),'com NFs cadastradas e pedido vazio, começa no passo 2 (Pedido)')
    ok(vis(pg,'#colar') and vis(pg,'[data-f=pack]'),'passo 2 mostra o pedido e os dados do pack abertos')
    ok(not vis(pg,'#dropnf'),'passo 2 não mostra as NFs (só o que é dele)')
    ok(pg.locator('[data-f=sei]').count()==0,'passo 2 NÃO pede o número do SEI (só se sabe depois de protocolar)')
    pg.evaluate("()=>{var e=PP.mapa.estado();e.draft.sei='21010.003135/2026-25';PP.store.set('mapa',{nfs:e.nfs,processos:e.processos,meta:e.meta,draft:e.draft,marcas:e.marcas||[]});}")
    # avançar sem pedido não deixa
    pg.click('#mpAgora [data-act=etapaprox]'); pg.wait_for_timeout(200)
    ok('Passo 2' in passo(pg),'sem pedido, o Próximo não avança no passo 2')
    # voltar ao 1
    pg.click('#mpAgora [data-act=etapa]'); pg.wait_for_timeout(200)
    ok('Passo 1' in passo(pg) and vis(pg,'#dropnf'),'Voltar leva ao passo 1 (NFs com o PDF)')
    pg.click('#mpAgora [data-act=etapaprox]'); pg.wait_for_timeout(200)
    pg.fill('[data-f=pack]','030/2026'); pg.fill('[data-f=destino]','Cliente X')
    pg.fill('#colar','Paracheirodon simulans Neon verde 4.000\nParacheirodon axelrodi Cardinal 500'); pg.click('[data-act=ler]'); pg.wait_for_timeout(500)
    ok('Passo 3' in passo(pg),'depois de Ler pedido, vai sozinho para o passo 3 (Conferir)')
    ok(pg.evaluate("PP.mapa.estado().draft.linhas.length")==2,'as 2 espécies entraram')
    ok(pg.locator('#linhas .okrow').count()+pg.locator('#linhas [id^=L]').count()>=1,'passo 3 mostra as espécies')
    # estourar: remove NF de uma linha e tenta avançar
    pg.evaluate("()=>{var e=PP.mapa.estado();e.draft.linhas[1].aloc=[];PP.store.set('mapa',{nfs:e.nfs,processos:e.processos,meta:e.meta,draft:e.draft,marcas:e.marcas||[]});}")
    pg.click('#mpTabs [data-tab=nfs]'); pg.click('#mpTabs [data-tab=passo]'); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('#mpWiz [data-act=etapa][data-n=\"3\"]').click()"); pg.wait_for_timeout(300)
    pg.click('#mpAgora [data-act=etapaprox]'); pg.wait_for_timeout(200)
    ok('Passo 3' in passo(pg),'com espécie sem NF, o Próximo não avança do passo 3')
    pg.click('#mpPasso [data-act=sugerirtudo]'); pg.wait_for_timeout(400)
    pg.click('#mpAgora [data-act=etapaprox]'); pg.wait_for_timeout(300)
    ok('Passo 4' in passo(pg),'tudo certo: avança para o passo 4 (PDF)')
    ok(vis(pg,'#mpPasso [data-act=pdfdraft]') and vis(pg,'#mpPasso [data-act=grifosdraft]'),'passo 4 mostra PDF das NFs e Folha de grifos')
    pg.click('#mpAgora [data-act=etapaprox]'); pg.wait_for_timeout(300)
    ok('Passo 5' in passo(pg) and 'Pack 030/2026' in pg.inner_text('#mpPasso'),'passo 5 mostra o resumo do pack')
    ok(pg.locator('#mpAgora [data-act=etapaprox]').count()==0,'passo 5 não tem Próximo (o botão é Gravar consumo)')
    pg.click('#mpPasso [data-act=protocolar]'); pg.wait_for_timeout(500)
    ok('Passo 6' in passo(pg),'depois de gravar, vai para o passo 6 (Protocolar)')
    st=pg.evaluate("PP.mapa.estado().processos")
    ok(len(st)==1 and st[0]['pack']=='030/2026' and st[0]['protocolado']==False,'consumo gravado, aguardando protocolo')
    ok(st[0]['sei']=='','SEI antigo esquecido no rascunho não vai para o pack novo')
    ok('Pack 030/2026' in pg.inner_text('#mpPasso') and vis(pg,'#mpPasso [data-act=marcarprot]'),'passo 6 mostra o pack e o botão Marcar como protocolado')
    pg.click('#mpPasso [data-act=marcarprot]'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.mapa.estado().processos[0].protocolado")==True,'Marcar como protocolado grava')
    ok(pg.evaluate("PP.mapa.estado().processos[0].sei")=='21010.009999/2026-09','o número do SEI é pedido e gravado só nesse momento')
    ok('Nenhum pack aguardando' in pg.inner_text('#mpPasso'),'passo 6 depois de protocolar: nada pendente')
    # abas antigas continuam
    pg.click('#mpTabs [data-tab=verificar]'); pg.wait_for_timeout(300)
    ok(vis(pg,'#colar') or pg.locator('#mpPedido').count()==1,'aba Verificar pedido continua funcionando')
    ok(not errs,'sem erro de JS: '+str(errs))
    b.close()
print('FALHAS:',fails) if fails else print('TUDO OK')
sys.exit(1 if fails else 0)

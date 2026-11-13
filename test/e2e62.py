import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
SIM='Paracheirodon simulans Neon verde'; CAR='Paracheirodon axelrodi Cardinal'
ST={'nfs':[
 {'id':'a','numero':'1676164','fornecedor':'Aramar','data':'2026-06-01','itens':[{'esp':SIM,'qtd':2900},{'esp':CAR,'qtd':1000}]},
 {'id':'c','numero':'1710124','fornecedor':'Eloisa','data':'2026-08-01','itens':[{'esp':SIM,'qtd':5000}]}],
 'processos':[],'meta':{},'marcas':[],
 'draft':{'pack':'019/2026','sei':'','destino':'Ruinemans Group','historico':False,'linhas':[
   {'esp':SIM,'qtd':4200,'aloc':[{'nfId':'c','qtd':4200}]},
   {'esp':CAR,'qtd':800,'aloc':[]}]}}
def vis(pg,sel): return pg.locator(sel).first.is_visible()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("s=>PP.store.set('mapa',s)",ST); pg.reload(); pg.wait_for_timeout(600)
    pg.click('#nav [data-view="mapa"]'); pg.wait_for_timeout(300); pg.click('#mpTabs [data-tab="verificar"]'); pg.wait_for_timeout(300)
    # --- Verificar pedido, pack em andamento
    ok(pg.locator('#mpFluxo [data-step]').count()==5,'faixa curta com 5 etapas')
    ok(vis(pg,'#mpAgora [data-act=sugerirtudo]'),'"Agora, faça isto" mostra o botão do próximo passo')
    ok(not pg.evaluate("document.getElementById('mpDados').open"),'Dados do pack começa recolhido quando o pack já tem número')
    ok('019/2026' in pg.inner_text('#mpDados summary') and 'Ruinemans' in pg.inner_text('#mpDados summary'),'linha recolhida mostra pack e destino')
    ok(not vis(pg,'[data-f=pack]'),'campo Pack escondido enquanto recolhido')
    ok(not pg.evaluate("document.getElementById('mpPedido').open"),'Pedido recolhido quando já há espécies')
    ok('2 espécie' in pg.inner_text('#mpPedido summary'),'resumo do Pedido diz quantas espécies')
    ok(not vis(pg,'[data-act=addlinha]') and not vis(pg,'[data-f=modo]'),'Adicionar espécie e Como sugerir ficam em Mais opções (escondidos)')
    ok(not vis(pg,'[data-act=limpar]') and not vis(pg,'[data-act=grifosdraft]'),'Limpar pedido e Folha de grifos escondidos em Mais opções')
    ok(vis(pg,'[data-act=protocolar]'),'Gravar consumo continua à vista')
    ok(not pg.evaluate("document.getElementById('mpOk').open"),'"Tudo certo" recolhido enquanto há espécie com problema')
    ok(vis(pg,'#L1'),'espécie com problema fica aberta')
    # abrir Dados do pack e editar
    pg.click('#mpDados summary'); pg.wait_for_timeout(150)
    ok(vis(pg,'[data-f=pack]'),'clicar em Editar abre os dados do pack')
    pg.fill('[data-f=pack]','020/2026'); pg.wait_for_timeout(150)
    ok(pg.evaluate("PP.mapa.estado().draft.pack")=='020/2026','editar o pack grava no rascunho')
    # abrir Mais opções do Pedido
    pg.click('#mpPedido summary'); pg.wait_for_timeout(150)
    pg.click('#mpPedido details.maisop summary'); pg.wait_for_timeout(150)
    ok(vis(pg,'[data-act=addlinha]') and vis(pg,'[data-f=hist]'),'Mais opções mostra Adicionar espécie e Registro de histórico')
    pg.click('#mpPedido summary'); pg.wait_for_timeout(100)
    # resolver e ver "Tudo certo" abrir
    pg.click('#mpAgora [data-act=sugerirtudo]'); pg.wait_for_timeout(400)
    ok(pg.evaluate("document.getElementById('mpOk').open"),'sem pendência, "Tudo certo" abre sozinho')
    ok(pg.locator('#mpOk .okrow').count()==2,'as 2 espécies aparecem em Tudo certo')
    ok(vis(pg,'#mpAgora [data-act=pdfdraft]'),'depois de conferido, o próximo passo é o PDF único')
    # --- ler pedido recolhe o bloco
    pg.evaluate("()=>{var e=PP.mapa.estado();e.draft.linhas=[];e.draft.pack='';PP.store.set('mapa',{nfs:e.nfs,processos:e.processos,meta:e.meta,draft:e.draft,marcas:e.marcas||[]});}")
    pg.click('#mpTabs [data-tab="nfs"]'); pg.click('#mpTabs [data-tab="verificar"]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.getElementById('mpPedido').open") and pg.evaluate("document.getElementById('mpDados').open"),'pedido vazio: Pedido e Dados do pack abrem sozinhos')
    pg.fill('#colar','Paracheirodon axelrodi Cardinal 100'); pg.click('[data-act=ler]'); pg.wait_for_timeout(400)
    ok(not pg.evaluate("document.getElementById('mpPedido').open"),'depois de Ler pedido o bloco Pedido recolhe')
    ok(pg.evaluate("PP.mapa.estado().draft.linhas.length")==1,'a espécie lida entrou no pedido')
    # --- aba NFs
    pg.click('#mpTabs [data-tab="nfs"]'); pg.wait_for_timeout(300)
    ok(vis(pg,'#dropnf'),'NFs: anexar PDF fica à vista')
    ok(not vis(pg,'[data-n=numero]'),'NFs: formulário "digitando" recolhido')
    pg.click('#mpDigitar summary'); pg.wait_for_timeout(150)
    ok(vis(pg,'[data-n=numero]'),'NFs: clicar abre o formulário')
    ok(pg.locator('#mpTabs button.menos').count()==3,'3 abas pouco usadas ficam discretas')
    ok(not errs,'sem erro de JS: '+str(errs))
    b.close()
print('FALHAS:',fails) if fails else print('TUDO OK')
sys.exit(1 if fails else 0)

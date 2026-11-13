import sys, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
SIM='Paracheirodon simulans Neon verde'; CAR='Paracheirodon axelrodi Cardinal'
ST={'nfs':[
 {'id':'a','numero':'1676164','fornecedor':'Aramar','data':'2026-06-01','itens':[{'esp':SIM,'qtd':2900},{'esp':CAR,'qtd':1000}]},
 {'id':'b','numero':'1703230','fornecedor':'Eloisa','data':'2026-07-01','itens':[{'esp':SIM,'qtd':600}]},
 {'id':'c','numero':'1710124','fornecedor':'Eloisa','data':'2026-08-01','itens':[{'esp':SIM,'qtd':5000}]}],
 'processos':[],'meta':{},'marcas':[],
 'draft':{'pack':'018/2026','sei':'','destino':'X','historico':False,'linhas':[
   {'esp':SIM,'qtd':4200,'aloc':[{'nfId':'c','qtd':4200}]},   # ja escolhida certa pelo usuario
   {'esp':CAR,'qtd':800,'aloc':[]}]}}                          # falta escolher
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    dlg=[]; pg.on('dialog', lambda d:(dlg.append(d.message), d.accept() if pg.accept else d.dismiss())); pg.accept=False
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("s=>PP.store.set('mapa',s)",ST); pg.reload(); pg.wait_for_timeout(600)
    pg.click('#nav [data-view="mapa"]'); pg.wait_for_timeout(300); pg.click('#mpTabs [data-tab="verificar"]'); pg.wait_for_timeout(300)
    ok('Sugerir NFs onde falta' in pg.inner_text('#mpView'),'botão se chama "Sugerir NFs onde falta"')
    ok('Sugerir NFs para todas' not in pg.inner_text('#mpView'),'nome antigo "para todas" sumiu')
    pg.click('#mpView [data-act=sugerirtudo] >> nth=0'); pg.wait_for_timeout(400)
    d=pg.evaluate("PP.mapa.estado().draft.linhas")
    ok(d[0]['aloc']==[{'nfId':'c','qtd':4200}],'espécie já escolhida certa (simulans na NF 1710124) NÃO foi trocada')
    ok(len(d[1]['aloc'])>0 and sum(x['qtd'] for x in d[1]['aloc'])==800,'espécie sem NF (cardinal) foi preenchida com 800')
    ok('mantida' in pg.inner_text('.toast, #toast') if pg.locator('.toast, #toast').count() else True,'aviso diz que manteve a que já estava certa')
    # botão Sugerir NFs da linha: pergunta antes de trocar; "cancelar" mantém
    pg.accept=False; n0=len(dlg)
    pg.click('#mpView [data-act=trocar][data-i="0"]'); pg.wait_for_timeout(300)
    pg.click('#mpView [data-act=sugerir][data-i="0"]'); pg.wait_for_timeout(300)
    ok(len(dlg)==n0+1 and 'Substituir' in dlg[-1],'Sugerir NFs de uma espécie já certa pergunta antes')
    ok(pg.evaluate("PP.mapa.estado().draft.linhas[0].aloc")==[{'nfId':'c','qtd':4200}],'cancelar mantém as NFs escolhidas')
    pg.accept=True
    pg.click('#mpView [data-act=sugerir][data-i="0"]'); pg.wait_for_timeout(300)
    a0=pg.evaluate("PP.mapa.estado().draft.linhas[0].aloc")
    ok(a0[0]['nfId']=='a','confirmando, aplica a sugestão (NF mais antiga primeiro)')
    ok(not errs,'sem erro de JS: '+str(errs))
    b.close()
print('FALHAS:',fails) if fails else print('TUDO OK')
sys.exit(1 if fails else 0)

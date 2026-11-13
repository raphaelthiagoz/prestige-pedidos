import sys, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
tag=sys.argv[1]
SIM='Paracheirodon simulans Neon verde'; CAR='Paracheirodon axelrodi Cardinal'; HOP='Otocinclus hoppei Limpa vidro'; BLE='Corydoras bleheri'
ST={'nfs':[
 {'id':'a','numero':'1676164','fornecedor':'Aramar','data':'2026-06-01','itens':[{'esp':SIM,'qtd':2900},{'esp':CAR,'qtd':1000},{'esp':BLE,'qtd':1000}]},
 {'id':'b','numero':'1703230','fornecedor':'Eloisa','data':'2026-07-01','itens':[{'esp':SIM,'qtd':600}]},
 {'id':'c','numero':'1710124','fornecedor':'Eloisa','data':'2026-08-01','itens':[{'esp':SIM,'qtd':5000},{'esp':HOP,'qtd':3000}]}],
 'processos':[],'meta':{},'marcas':[],
 'draft':{'pack':'019/2026','sei':'21010.003135/2026-25','destino':'Ruinemans Group','historico':False,'linhas':[
   {'esp':SIM,'qtd':4200,'aloc':[{'nfId':'c','qtd':4200}]},
   {'esp':HOP,'qtd':2000,'aloc':[{'nfId':'c','qtd':800}]},
   {'esp':BLE,'qtd':500,'aloc':[{'nfId':'a','qtd':500}]},
   {'esp':CAR,'qtd':800,'aloc':[]}]}}
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block'); pg=ctx.new_page()
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("s=>PP.store.set('mapa',s)",ST); pg.reload(); pg.wait_for_timeout(600)
    pg.click('#nav [data-view="mapa"]'); pg.wait_for_timeout(300)
    pg.click('#mpTabs [data-tab="verificar"]'); pg.wait_for_timeout(400)
    pg.screenshot(path=f'out/foco/{tag}_verificar.png', full_page=True)
    pg.click('#mpTabs [data-tab="nfs"]'); pg.wait_for_timeout(400)
    pg.screenshot(path=f'out/foco/{tag}_nfs.png', full_page=True)
    b.close()

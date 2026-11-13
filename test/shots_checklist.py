import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
SIM='Paracheirodon simulans Neon verde'
ST={'nfs':[
 {'id':'a','numero':'1676164','fornecedor':'Aramar','data':'2026-06-01','arq':'x','itens':[{'esp':SIM,'qtd':3000}]},
 {'id':'b','numero':'1710124','fornecedor':'Eloisa','data':'2026-12-20','itens':[{'esp':SIM,'qtd':5000}]}],
 'processos':[],'meta':{'pesc':[{'id':'p-aramar','nome':'Aramar','ctf':'2026-12-30','ctfSalvo':True,'rgpSalvo':True,'rgpVal':''}],
   'docs':[{'id':'d-lic','nome':'Licença ambiental','venc':'2027-06-30'},{'id':'d-proc','nome':'Procuração','venc':'2026-10-01'}]},'marcas':[],
 'draft':{'pack':'019/2026','sei':'','destino':'Cliente X','data':'2026-11-16','historico':False,'linhas':[{'esp':SIM,'qtd':600,'aloc':[{'nfId':'a','qtd':500},{'nfId':'b','qtd':100}]}]}}
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1280,'height':1100},device_scale_factor=2,service_workers='block'); pg=ctx.new_page()
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("s=>PP.store.set('mapa',s)",ST); pg.reload(); pg.wait_for_timeout(600)
    pg.click('#nav [data-view="mapa"]'); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('#mpWiz [data-act=etapa][data-n=\"5\"]').click()"); pg.wait_for_timeout(400)
    pg.screenshot(path='out/foco/checklist_passo5.png')
    pg.click('#mpTabs [data-tab=pesc]'); pg.wait_for_timeout(400)
    pg.screenshot(path='out/foco/checklist_docs_empresa.png',clip={'x':0,'y':200,'width':1280,'height':520})
    b.close()

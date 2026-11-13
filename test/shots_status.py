import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
SIM='Paracheirodon simulans Neon verde'; CAR='Paracheirodon axelrodi Cardinal'
def P(i,pack,nf,qtd,esp=SIM,**k):
    d={'id':i,'pack':pack,'sei':k.get('sei',''),'destino':k.get('dest','Cliente'),'data':k.get('data','2026-10-01'),'status':'ativo','historico':False,'protocolado':k.get('prot',True),'dataProt':k.get('dp','2026-10-02'),'itens':[{'esp':esp,'nfId':nf,'qtd':qtd}]}
    if k.get('dev'): d['devolvido']={'em':'2026-10-09','motivo':k['dev']};d['log']=[{'em':'2026-10-02','ev':'protocolado','nota':'SEI '+k.get('sei','')},{'em':'2026-10-09','ev':'devolvido pelo MAPA','nota':k['dev']}]
    if k.get('ind'): d.update({'status':'cancelado','motivo':'indeferido','indeferido':{'em':'2026-10-29','motivo':k['ind']},'log':[{'em':'2026-10-03','ev':'protocolado','nota':''},{'em':'2026-10-29','ev':'indeferido pelo MAPA (saldo liberado)','nota':k['ind']}]})
    return d
ST={'nfs':[
 {'id':'a','numero':'1676164','fornecedor':'Aramar','data':'2026-06-01','itens':[{'esp':SIM,'qtd':6000},{'esp':CAR,'qtd':2000}]},
 {'id':'c','numero':'1710124','fornecedor':'Eloisa','data':'2026-08-01','itens':[{'esp':SIM,'qtd':5000}]}],
 'processos':[P('p1','016/2026','a',1500,sei='21010.003135/2026-25',dev='nota já usada em outro processo',data='2026-10-01'),
              P('p2','015/2026','a',1000,ind='NF usada em processo anterior',data='2026-09-20',sei='21010.002901/2026-11'),
              P('p3','018/2026','c',2000,prot=False,data='2026-11-12'),
              P('p4','014/2026','c',800,sei='21010.002500/2026-60',data='2026-09-10')],
 'meta':{},'marcas':[],
 'draft':{'pack':'019/2026','sei':'','destino':'Cliente Y','historico':False,'linhas':[{'esp':SIM,'qtd':1200,'aloc':[{'nfId':'a','qtd':1200}]},{'esp':CAR,'qtd':500,'aloc':[{'nfId':'a','qtd':500}]}]}}
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1280,'height':1000},device_scale_factor=2,service_workers='block'); pg=ctx.new_page()
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("s=>PP.store.set('mapa',s)",ST); pg.reload(); pg.wait_for_timeout(600)
    pg.click('#nav [data-view="mapa"]'); pg.wait_for_timeout(400)
    pg.click('#mpTabs [data-tab=processos]'); pg.wait_for_timeout(400)
    pg.screenshot(path='out/foco/status_processos.png',full_page=False)
    pg.click('#mpTabs [data-tab=verificar]'); pg.wait_for_timeout(600)
    pg.screenshot(path='out/foco/status_aviso_nota.png',full_page=False)
    b.close()

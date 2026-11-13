import sys, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
MOCK="""window.showDirectoryPicker=async()=>{const r=await navigator.storage.getDirectory();return r.getDirectoryHandle('pp-bk-test',{create:true});};"""
READ="""async()=>{const r=await navigator.storage.getDirectory();const d=await r.getDirectoryHandle('pp-bk-test',{create:true});const out=[];for await(const [n,h] of d.entries()){const f=await h.getFile();out.push({n,t:await f.text()});}return out;}"""
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block', accept_downloads=True); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_function('window.PP'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(2500)
    pg.evaluate(MOCK)
    pg.evaluate("document.getElementById('btnCfg').click();PP.cfgTab('dad')"); pg.wait_for_timeout(400)
    pg.evaluate("PP.autobk.telaPasta()"); pg.wait_for_timeout(300)
    ok(pg.locator('#bkPasta #bkAgora').count()==1 and pg.locator('#bkPasta #bkEscolhe').count()==1,'Configurações > Backup tem "Fazer backup agora" e "Escolher pasta de backup"')
    ok('cópia automática de hoje já existe' in pg.inner_text('#bkPasta') or 'cópia automática de hoje' in pg.inner_text('#bkPasta'),'a tela diz que a cópia automática existe só neste navegador')
    # sem pasta: baixa o arquivo
    with pg.expect_download() as dl:
        pg.evaluate("PP.autobk.backupAgora()")
    ok(dl.value.suggested_filename.startswith('prestige-pedidos-backup-') and dl.value.suggested_filename.endswith('.json'),'sem pasta: baixa o arquivo como sempre ('+dl.value.suggested_filename+')')
    ok(pg.evaluate("PP.store.get('lastBackupOnde','')")=='download','anota que o último backup foi baixado')
    # escolher pasta
    pg.evaluate("PP.store.set('lastBackup',0)")
    pg.locator('#bkEscolhe').dispatch_event('click'); pg.wait_for_timeout(600)
    ok('pp-bk-test' in pg.inner_text('#bkPasta'),'depois de escolher, a tela mostra o nome da pasta')
    ok(pg.locator('#bkTroca').count()==1 and pg.locator('#bkSem').count()==1,'aparecem "Trocar pasta" e "Parar de usar a pasta"')
    # um clique grava na pasta, sem download
    downloads=[]; pg.on('download', lambda d: downloads.append(d))
    pg.locator('#bkAgora').dispatch_event('click'); pg.wait_for_timeout(900)
    files=pg.evaluate(READ)
    ok(len(files)==1 and files[0]['n'].startswith('prestige-pedidos-backup-'),'um clique grava o arquivo na pasta: %s'%[f['n'] for f in files])
    d=json.loads(files[0]['t']) if files else {}
    ok(d.get('app')=='prestige-pedidos' and len(d.get('hist',[]))>0,'o arquivo é um backup válido (%d pedidos)'%len(d.get('hist',[])))
    ok(not downloads,'sem janela/arquivo de download quando a pasta está configurada')
    ok(pg.evaluate("PP.store.get('lastBackup',0)")>0 and pg.evaluate("PP.store.get('lastBackupOnde','')")=='pasta','marca o backup como feito na pasta')
    ok('na pasta' in pg.inner_text('#bkPasta'),'a tela mostra "Último backup em arquivo ... (na pasta)"')
    # segundo clique no mesmo dia sobrescreve (continua 1 arquivo)
    pg.locator('#bkAgora').dispatch_event('click'); pg.wait_for_timeout(700)
    ok(len(pg.evaluate(READ))==1,'backup repetido no mesmo dia sobrescreve (continua 1 arquivo)')
    # o backup restaura
    ok(pg.evaluate("(async()=>{const r=await navigator.storage.getDirectory();const d=await r.getDirectoryHandle('pp-bk-test');for await(const [n,h] of d.entries()){const j=JSON.parse(await (await h.getFile()).text());return j.hist.length===PP.S.hist.length;}})()"),'o arquivo tem os mesmos pedidos do app')
    # aviso do topo
    pg.evaluate("PP.store.set('lastBackup',Date.now()-9*864e5);PP.store.set('bkSnooze',0);PP.renderBanners()"); pg.wait_for_timeout(300)
    bt=pg.inner_text('#banners')
    ok('Fazer backup agora' in bt and '9 dias' in bt,'aviso do topo: "faz 9 dias" com botão "Fazer backup agora"')
    ok('cópia automática de hoje' in bt,'o aviso explica que a cópia automática fica só neste navegador')
    pg.locator('#bnBk').dispatch_event('click'); pg.wait_for_timeout(900)
    ok(pg.evaluate("Date.now()-PP.store.get('lastBackup',0)")<20000 and not downloads,'um clique no aviso grava na pasta (sem download)')
    ok('Backup:' not in pg.inner_text('#banners'),'o aviso some depois do backup')
    # Assistente
    pg.evaluate("PP.store.set('lastBackup',Date.now()-9*864e5);PP.store.set('bkSnooze',0)")
    its=pg.evaluate("PP.assist.items().filter(i=>i.key==='bk').map(i=>({t:i.title,s:i.sub,a:i.actions.map(x=>x.label)}))")
    ok(len(its)==1 and 'Fazer backup agora' in its[0]['a'],'Assistente oferece "Fazer backup agora": %s'%its)
    pg.evaluate("PP.assist.act('bk','bk')"); pg.wait_for_timeout(900)
    ok(pg.evaluate("Date.now()-PP.store.get('lastBackup',0)")<20000 and not downloads,'o botão do Assistente também grava direto na pasta')
    # sem permissão: cai para download
    pg.evaluate("FileSystemDirectoryHandle.prototype.queryPermission=async()=>'prompt';FileSystemDirectoryHandle.prototype.requestPermission=async()=>'denied';")
    with pg.expect_download() as dl2:
        pg.evaluate("PP.autobk.backupAgora()")
    ok(dl2.value.suggested_filename.endswith('.json'),'sem permissão na pasta: baixa o arquivo em vez de falhar')
    # parar de usar
    pg.locator('#bkSem').dispatch_event('click'); pg.wait_for_timeout(500)
    ok(pg.locator('#bkEscolhe').count()==1 and pg.evaluate("PP.autobk.get('dir')")is None,'"Parar de usar a pasta" esquece a pasta')
    # sem suporte (Firefox/Safari)
    pg.evaluate("delete window.showDirectoryPicker; try{Object.defineProperty(window,'showDirectoryPicker',{value:undefined,configurable:true})}catch(e){}; PP.autobk.telaPasta()"); pg.wait_for_timeout(300)
    ok(pg.locator('#bkEscolhe').count()==0 and 'só baixa o arquivo' in pg.inner_text('#bkPasta'),'sem suporte do navegador: explica e mantém só o download')
    ok(not errs,'sem erro de JS: '+str(errs))
    b.close()
print('FALHAS:',fails) if fails else print('TUDO OK')
sys.exit(1 if fails else 0)

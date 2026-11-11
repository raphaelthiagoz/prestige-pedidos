import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.click('#btnCfg'); pg.wait_for_timeout(300)
    ok(pg.locator('#config .cnav button').count()==6,'6 abas nas configurações')
    names=[t.strip() for t in pg.locator('#config .cnav button b').all_inner_texts()]
    ok(names==['Empresa e documentos','Valores e numeração','Nomes e etiquetas','Stocklist','Aparência e assistente','Dados e nuvem'],'nomes das abas: %s'%names)
    exp={'emp':['Empresa','Veterinária do atestado'],'val':['Valores padrão','Numeração e prazo'],'nom':['Nomes nos documentos','Nomes na notinha','Programação de embarques','Etiquetas'],'stock':['Stocklist'],'apa':['Aparência e assistente'],'dad':['Backup','Nuvem (vários computadores)']}
    for k,v in exp.items():
        pg.click(f'#config [data-cgo="{k}"]'); pg.wait_for_timeout(120)
        vis=[t.strip() for t in pg.locator('#config .block:not(.cgone) h3').all_inner_texts()]
        ok(vis==v,f'aba {k} mostra só: {vis}')
    # campos continuam funcionando (salvam e sobrevivem à troca de aba e ao recarregar)
    pg.click('#config [data-cgo="emp"]'); pg.fill('[id="c_empresa.endereco"]','Rua Teste das Abas, 99'); pg.wait_for_timeout(200)
    pg.click('#config [data-cgo="apa"]'); pg.fill('#uNome','Raphael Teste'); pg.wait_for_timeout(200)
    pg.click('#config [data-cgo="emp"]')
    ok(pg.input_value('[id="c_empresa.endereco"]')=='Rua Teste das Abas, 99','Empresa: valor continua ao voltar na aba')
    pg.reload(); pg.wait_for_timeout(500); pg.click('#btnCfg'); pg.click('#config [data-cgo="emp"]'); pg.wait_for_timeout(150)
    ok(pg.input_value('[id="c_empresa.endereco"]')=='Rua Teste das Abas, 99','Empresa: valor gravado depois de recarregar')
    pg.click('#config [data-cgo="apa"]'); ok(pg.input_value('#uNome')=='Raphael Teste','Aparência: nome gravado depois de recarregar')
    pg.click('#config [data-cgo="dad"]')
    ok(pg.locator('#cloudCard').is_visible(),'Nuvem: cartão de status visível na aba Dados e nuvem')
    ok(pg.locator('#bkExport').is_visible(),'botão Baixar backup visível na aba Dados e nuvem')
    pg.click('#config [data-cgo="emp"]'); ok(not pg.locator('#cloudCard').is_visible(),'outras abas ficam escondidas')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200); ok(pg.locator('#config[open]').count()==0,'Esc fecha')
    # aviso "Comece por aqui" abre direto em Stocklist
    pg.evaluate("PP.S.catalog=[];PP.store.set('catalog',[]);PP.renderBanners&&PP.renderBanners()"); pg.reload(); pg.wait_for_timeout(600)
    if pg.locator('#bnCfg').count():
        pg.click('#bnCfg'); pg.wait_for_timeout(250); ok(pg.locator('#config .block:not(.cgone) h3').first.inner_text().strip()=='Stocklist','"Abrir Configurações" do aviso vai direto na aba Stocklist')
    else: ok(True,'(aviso de stocklist não apareceu com o seed)')
    ok(len(errs)==0,'sem erros de JS %s'%errs)
    m=b.new_context(viewport={'width':390,'height':844}, service_workers='block'); mp=m.new_page(); mp.on('pageerror', lambda e: errs.append(str(e)))
    mp.goto('http://localhost:8765/index.html'); mp.wait_for_timeout(300); mp.evaluate(SEED); mp.evaluate("sessionStorage.setItem('pp.asShown','1')"); mp.reload(); mp.wait_for_timeout(500)
    mp.evaluate("document.getElementById('btnCfg').click()"); mp.wait_for_timeout(300)
    ok(mp.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'mobile: sem rolagem horizontal')
    mp.click('#config [data-cgo="nom"]'); mp.wait_for_timeout(150); ok(mp.locator('#config .block:not(.cgone)').count()==4,'mobile: troca de aba funciona')
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); print('TUDO OK' if not fails else 'COM FALHAS')

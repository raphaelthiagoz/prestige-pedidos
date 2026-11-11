import sys, os, hashlib; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e37/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1000},accept_downloads=True,service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(700)
    pg.click('#nav button[data-view="mapa"]'); pg.wait_for_timeout(500); pg.click('#mpTabs button[data-tab="pesc"]'); pg.wait_for_timeout(300)
    for nm in ('JOAO DA SILVA','PEDRO ALMEIDA','CARLOS PINTO'):
        pg.fill('#pescNovo',nm); pg.click('[data-act="addpesc"]'); pg.wait_for_timeout(300)
    ok(pg.locator('input[data-pfile="ctf"]').count()==3,'3 pescadores com botão Anexar CTF')
    # anexa CTF do João
    with pg.expect_file_chooser() as fc: pg.locator('tr:has-text("JOAO DA SILVA") [data-act="escolherpesc"]').first.click()
    fc.value.set_files('test/fx/ctf_joao.pdf'); pg.wait_for_timeout(2500)
    pg.locator('input[data-pfile="ctf"][data-pk="JOAO DA SILVA"]').set_input_files('test/fx/ctf_joao.pdf'); pg.wait_for_timeout(2500)
    v=pg.evaluate("PP.store.get('mapa').meta.pesc.find(x=>x.nome=='JOAO DA SILVA')")
    ok(v['ctf']=='2027-03-15' and v['ctfArq'] and v['ctfLido'],'validade lida do PDF: %s'%v['ctf'])
    pg.locator('input[data-pfile="rgp"][data-pk="JOAO DA SILVA"]').set_input_files('test/fx/rgp_sem_data.pdf'); pg.wait_for_timeout(2000)
    v=pg.evaluate("PP.store.get('mapa').meta.pesc.find(x=>x.nome=='JOAO DA SILVA')")
    ok(v['rgpArq'] and not v['rgpVal'],'RGP sem data: guardado, validade fica em branco')
    pg.locator('input[data-pfile="ctf"][data-pk="PEDRO ALMEIDA"]').set_input_files('test/fx/ctf_pedro.pdf'); pg.wait_for_timeout(2500)
    v=pg.evaluate("PP.store.get('mapa').meta.pesc.find(x=>x.nome=='PEDRO ALMEIDA')")
    ok(v['ctf']=='2026-09-20','CTF do Pedro: "Valido ate" lido (%s)'%v['ctf'])
    t=pg.inner_text('#mpView'); print('  ',t.replace('\n',' | ')[:900])
    ok('Em dia' in t and 'solicitar outro' in t and 'Sem CTF anexado' in t,'situações: em dia / vencido → solicitar outro / sem CTF')
    pg.screenshot(path=OUT+'pesc.png')
    # baixar
    with pg.expect_download() as d: pg.click('[data-act="baixarpesc"][data-pk="JOAO DA SILVA"][data-pt="ctf"]')
    dl=d.value; path=OUT+dl.suggested_filename; dl.save_as(path)
    ok(dl.suggested_filename=='CTF_JOAO-DA-SILVA.pdf','nome do download: '+dl.suggested_filename)
    ok(hashlib.sha256(open(path,'rb').read()).hexdigest()==hashlib.sha256(open('test/fx/ctf_joao.pdf','rb').read()).hexdigest(),'arquivo baixado idêntico ao anexado')
    # persiste após recarregar
    pg.reload(); pg.wait_for_timeout(900); pg.click('#nav button[data-view="mapa"]'); pg.wait_for_timeout(500); pg.click('#mpTabs button[data-tab="pesc"]'); pg.wait_for_timeout(300)
    with pg.expect_download() as d2: pg.click('[data-act="baixarpesc"][data-pk="PEDRO ALMEIDA"][data-pt="ctf"]')
    ok(d2.value.suggested_filename=='CTF_PEDRO-ALMEIDA.pdf','após recarregar ainda baixa (IndexedDB)')
    # KPIs
    k=pg.inner_text('#mpView'); ok('CTF em dia' in k and 'Vencem em até 30 dias' in k,'cartões de resumo')
    # avisos
    av=pg.evaluate("PP.mapa.ctfAvisos()"); print('  avisos',av)
    ok(not errs,'sem erros de página %s'%errs)
    b.close()
print('FALHAS',fails)

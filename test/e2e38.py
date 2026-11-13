import sys, os; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e38/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
errs=[]
def novo(b):
    ctx=b.new_context(viewport={'width':1500,'height':1100},service_workers='block',accept_downloads=True); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("PP.go('mapa')"); pg.wait_for_timeout(400); return pg
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=novo(b)
    tabs=pg.locator('#mpTabs button').all_inner_texts(); print('  abas',tabs)
    ok('Passo a passo' in tabs[0] and 'NFs de entrada' in tabs[1] and 'Verificar' in tabs[2],'abas na ordem de uso (Passo a passo, NFs, Verificar)')
    pg.click('#mpTabs button[data-tab="verificar"]'); pg.wait_for_timeout(300)
    ok(pg.locator('#mpFluxo [data-step]').count()==5,'faixa com 5 passos')
    ok('now' in (pg.get_attribute('#mpFluxo [data-step="1"]','class') or ''),'sem NFs: passo 1 é o atual')
    ok('Cadastre as NFs' in pg.inner_text('#mpAgora'),'"Agora, faça isto" manda cadastrar NFs')
    # com NF + pedido
    pg.click('#mpTabs button[data-tab="nfs"]'); pg.wait_for_timeout(200)
    pg.set_input_files('#nfpdf','test/fx/modelo_sem_grifos.pdf'); pg.wait_for_timeout(5000); pg.click('[data-act=salvarrev]'); pg.wait_for_timeout(700)
    ok('done' in (pg.get_attribute('#mpFluxo [data-step="1"]','class') or ''),'depois de cadastrar NFs: passo 1 concluído')
    pg.click('#mpTabs button[data-tab="verificar"]'); pg.wait_for_timeout(300)
    ok('now' in (pg.get_attribute('#mpFluxo [data-step="2"]','class') or '') and 'packing list' in pg.inner_text('#mpAgora'),'passo 2 atual: anexar packing/colar pedido')
    esp=pg.evaluate("PP.mapa.estado().nfs.flatMap(n=>(n.itens||n.especies||[]).slice(0,1).map(i=>i.esp||i.especie||i.nome))[0]")
    nm=pg.evaluate("(()=>{const n=PP.mapa.estado().nfs[0];const k=Object.keys(n);return JSON.stringify(k)})()"); print('  nf keys',nm)
    pg.fill('#colar','Paracheirodon axelrodi Cardinal 100'); pg.click('[data-act=ler]'); pg.wait_for_timeout(500)
    t=pg.inner_text('#mpAgora'); print('  agora:',t.replace('\n',' | '))
    ok('now' in (pg.get_attribute('#mpFluxo [data-step="3"]','class') or '') and 'Pedido conferido' in t,'pedido coberto: passo 3 (gerar PDF) é o atual')
    with pg.expect_download() as d: pg.click('#mpAgora [data-act="pdfdraft"]')
    pg.wait_for_timeout(1500); print('  pdf',d.value.suggested_filename)
    ok(d.value.suggested_filename.startswith('NOTAS_DE_ENTRADA_UNIFICADAS'),'PDF baixa com nome NOTAS_DE_ENTRADA_UNIFICADAS…')
    pg.keyboard.press('Escape'); pg.evaluate("document.querySelector('[data-act=fechar]')&&document.querySelector('[data-act=fechar]').click()"); pg.wait_for_timeout(300)
    ok('now' in (pg.get_attribute('#mpFluxo [data-step="4"]','class') or '') or 'PDF pronto' in pg.inner_text('#mpAgora'),'depois do PDF: passo 4 (protocolar)')
    t=pg.inner_text('#mpFluxo'); print('  fluxo:',t.replace('\n',' | ')[:500])
    pg.screenshot(path=OUT+'fluxo.png')
    ok(not errs,'sem erros de página %s'%errs)
    b.close()
print('FALHAS',fails)

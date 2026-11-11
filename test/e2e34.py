import sys, json, subprocess, time, urllib.request, os
sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
mock=subprocess.Popen(['node','test/mock_supabase2.js','9012'],stdout=subprocess.PIPE); time.sleep(0.8)
def mdb(): return json.loads(urllib.request.urlopen('http://localhost:9012/__db').read())
INIT="if(!localStorage.getItem('pp.cloudtest'))localStorage.setItem('pp.cloudtest',JSON.stringify({url:'http://localhost:9012',pollMs:1500}))"
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    def novo():
        ctx=b.new_context(viewport={'width':1400,'height':900},service_workers='block',accept_downloads=True); ctx.add_init_script(INIT); pg=ctx.new_page(); pg.errs=[]
        pg.on('pageerror',lambda e:pg.errs.append(str(e))); pg.on('dialog',lambda d:d.accept()); return ctx,pg
    def entrar(pg):
        pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(600)
        pg.fill('#lgEmail','raphael@prestige.com'); pg.fill('#lgPass','senha123'); pg.click('#lgGo'); pg.wait_for_timeout(2200)
    cA,A=novo(); entrar(A)
    A.evaluate("sessionStorage.setItem('pp.asShown','1')")
    A.evaluate("PP.go('mapa')"); A.wait_for_timeout(400); A.click('[data-tab=nfs]'); A.wait_for_timeout(200)
    A.set_input_files('#nfpdf','test/fx/modelo_sem_grifos.pdf'); A.wait_for_timeout(5000); A.click('[data-act=salvarrev]'); A.wait_for_timeout(800)
    ok(A.evaluate("PP.mapa.estado().nfs.every(n=>n.arq&&n.pags)"),'A: NFs cadastradas já guardam o PDF')
    A.wait_for_timeout(1500)
    d=mdb(); ok(len(d['files'])==1,'A: o PDF foi para a nuvem (tabela pp_files): %s'%d['files'])
    # pack com 2 NFs: Cardinal (1670814) e Discus (1685322)
    A.evaluate("""()=>{const S=PP.mapa.estado();const nf=n=>S.nfs.find(x=>x.numero===n);const d=S.draft;d.pack='018/2026';d.destino='Miami';
      d.linhas=[{esp:'Symphysodon discus Disco',qtd:200,aloc:[{nfId:nf('1685322').id,qtd:200}]},{esp:'Paracheirodon axelrodi Cardinal',qtd:1000,aloc:[{nfId:nf('1670814').id,qtd:1000}]}];
      PP.store.set('mapa',{nfs:S.nfs,processos:S.processos,meta:S.meta,draft:S.draft,marcas:S.marcas||[]});PP.mapa.invalidate();}""")
    A.evaluate("PP.go('mapa')"); A.wait_for_timeout(300); A.click('[data-tab=verificar]'); A.wait_for_timeout(300)
    btn=A.locator('#mpView [data-act=pdfdraft]').last; ok(A.locator('#mpView [data-act=pdfdraft]').count()>=1,'A: botão "PDF das NFs (SEI)" na aba Verificar pedido')
    with A.expect_download() as dl: btn.click()
    f=dl.value; path='/tmp/pl/ui_out.pdf'; f.save_as(path)
    ok(f.suggested_filename=='NOTAS_DE_ENTRADA_UNIFICADAS_018-2026.pdf','A: nome do arquivo '+f.suggested_filename)
    import subprocess as sp
    info=sp.run(['pdfinfo',path],capture_output=True,text=True).stdout; ok(__import__('re').search(r'Pages:\s+2\b',info),'A: PDF com 2 páginas (as 2 NFs usadas)')
    ok('PDF das notas pronto' in A.inner_text('#mpModal'),'A: janela confirma "PDF das notas pronto"')
    A.click('#mpModal [data-act=fechar]')
    # PC B: aparelho novo, entra, recebe dados e baixa o PDF da nuvem
    cB,B=novo(); entrar(B)
    B.evaluate("sessionStorage.setItem('pp.asShown','1')")
    ok(B.evaluate("PP.mapa.estado().nfs.length")==6,'B: recebeu as 6 NFs pela sincronização')
    B.evaluate("PP.go('mapa')"); B.wait_for_timeout(300); B.click('[data-tab=verificar]'); B.wait_for_timeout(300)
    with B.expect_download() as dl2: B.locator('[data-act=pdfdraft]').first.click()
    dl2.value.save_as('/tmp/pl/ui_outB.pdf'); info=sp.run(['pdfinfo','/tmp/pl/ui_outB.pdf'],capture_output=True,text=True).stdout
    ok(__import__('re').search(r'Pages:\s+2\b',info),'B: sem ter o PDF no aparelho, baixou da nuvem e montou o PDF')
    # C: NFs cadastradas ANTES (sem PDF) -> pede os PDFs uma vez
    cC=b.new_context(viewport={'width':1400,'height':900},service_workers='block',accept_downloads=True); C=cC.new_page(); C.errs=[]; C.on('pageerror',lambda e:C.errs.append(str(e))); C.on('dialog',lambda d:d.accept()); C.goto('http://localhost:8765/index.html'); C.wait_for_timeout(500); C.evaluate(SEED); C.evaluate("sessionStorage.setItem('pp.asShown','1')"); 
    C.reload(); C.wait_for_timeout(600)
    C.evaluate("PP.go('mapa')"); C.wait_for_timeout(400); C.click('[data-tab=nfs]'); C.wait_for_timeout(200)
    C.set_input_files('#nfpdf','test/fx/modelo_sem_grifos.pdf'); C.wait_for_timeout(5000); C.click('[data-act=salvarrev]'); C.wait_for_timeout(600)
    C.evaluate("""()=>{const S=PP.mapa.estado();S.nfs.forEach(n=>{delete n.arq;delete n.pags;});const nf=n=>S.nfs.find(x=>x.numero===n);const d=S.draft;d.pack='019/2026';
      d.linhas=[{esp:'Symphysodon discus Disco',qtd:200,aloc:[{nfId:nf('1685322').id,qtd:200}]}];PP.store.set('mapa',{nfs:S.nfs,processos:S.processos,meta:S.meta,draft:S.draft,marcas:S.marcas||[]});PP.mapa.invalidate();}""")
    C.evaluate("PP.go('mapa')"); C.wait_for_timeout(300); C.click('[data-tab=verificar]'); C.wait_for_timeout(300); C.locator('[data-act=pdfdraft]').first.click(); C.wait_for_timeout(1500)
    ok('Faltam os PDFs de 1 nota' in C.inner_text('#mpModal'),'C: NF sem PDF -> pede para anexar (1 nota)')
    with C.expect_download() as dl3: C.set_input_files('#pdfanexo','test/fx/modelo_sem_grifos.pdf')
    dl3.value.save_as('/tmp/pl/ui_outC.pdf'); info=sp.run(['pdfinfo','/tmp/pl/ui_outC.pdf'],capture_output=True,text=True).stdout
    ok(__import__('re').search(r'Pages:\s+1\b',info),'C: depois de anexar, monta o PDF (1 página)')
    ok(C.evaluate("PP.mapa.estado().nfs.every(n=>n.arq)"),'C: todas as NFs do arquivo ficaram com PDF guardado')
    C.wait_for_timeout(800); C.click('#mpModal [data-act=fechar]')
    # processos: botão aparece
    C.evaluate("(()=>{const S=PP.mapa.estado();const nf=S.nfs.find(x=>x.numero==='1685322');S.processos.push({id:'pp1',pack:'019/2026',sei:'',destino:'x',data:'2026-11-01',status:'ativo',historico:false,itens:[{esp:'Symphysodon discus Disco',nfId:nf.id,qtd:200}]});PP.store.set('mapa',{nfs:S.nfs,processos:S.processos,meta:S.meta,draft:S.draft,marcas:S.marcas||[]});PP.mapa.invalidate();})()")
    C.evaluate("PP.go('mapa')"); C.wait_for_timeout(300); C.click('[data-tab=processos]'); C.wait_for_timeout(300)
    ok(C.locator('[data-act=pdfproc]').count()==1,'C: botão também na aba Processos')
    for pg in (A,B,C): ok(not pg.errs,'sem erros de página %s'%pg.errs)
finally:
  mock.terminate()
print('FALHAS',fails)

import sys, json, base64; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
def novo(b):
    ctx=b.new_context(viewport={'width':1500,'height':1000}, service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("PP.go('mapa')"); pg.wait_for_timeout(400); pg.click('[data-tab=nfs]'); pg.wait_for_timeout(200)
    return pg
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    # 1) com o modelo original (tem os grifos dele): lista de espécies marcadas por NF
    pg=novo(b); pg.set_input_files('#nfpdf','test/fx/modelo_ams.pdf'); pg.wait_for_timeout(5000); pg.click('[data-act=salvarrev]'); pg.wait_for_timeout(600)
    usos=pg.evaluate("()=>{const S=PP.mapa.estado();return S.marcas.map(m=>({num:m.nfNum,esp:m.esp}))}")
    print('  marcas do modelo:',len(usos))
    ok(len(usos)==9,'9 espécies marcadas no modelo')
    # 2) com o PDF SEM grifos: o app grifa sozinho
    pg=novo(b); pg.set_input_files('#nfpdf','test/fx/modelo_sem_grifos.pdf'); pg.wait_for_timeout(5000); pg.click('[data-act=salvarrev]'); pg.wait_for_timeout(800)
    nn=pg.evaluate("PP.mapa.estado().nfs.map(n=>[n.numero,n.pags,!!n.arq])"); print('  nfs:',nn)
    ok(len(nn)==6 and all(x[2] and x[1] for x in nn),'6 NFs com PDF e páginas ligadas')
    res=pg.evaluate("""async (usos)=>{const S=PP.mapa.estado();const itens=usos.map(u=>{const nf=S.nfs.find(n=>n.numero===u.num);return {esp:u.esp,nfId:nf.id,qtd:1};});
      const r=await PP.nfpdf.montar(S,itens);let s='';const u8=r.pdf;for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));
      return {b64:btoa(s),faltam:r.faltam.length,semLinha:r.semLinha.map(x=>x.esp+' @'+x.nf.numero),nNFs:r.nNFs,nPag:r.nPag,nG:r.nGrifos,boxes:r.boxes};}""",usos)
    open('/tmp/pl/out.pdf','wb').write(base64.b64decode(res['b64']))
    json.dump(res['boxes'],open('/tmp/pl/boxes.json','w'))
    print('  nNFs',res['nNFs'],'nPag',res['nPag'],'grifos',res['nG'],'semLinha',res['semLinha'])
    ok(res['faltam']==0 and res['nNFs']==5 and res['nPag']==5,'junta só as 5 NFs usadas (a 6ª não tem espécie usada)')
    ok(not res['semLinha'],'achou a linha de todas as espécies')
    ok(not errs,'sem erros de página %s'%errs)
    b.close()
print('FALHAS',fails)

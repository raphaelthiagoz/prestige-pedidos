import sys, json, os
sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
# 45 espécies, 30 clientes, 8 destinos, 20 espécies com perda, período grande (mês) -> paginação e gráficos semanais
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1280,'height':900}, service_workers='block').new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    res=pg.evaluate("""()=>{
      const H=PP.S.hist; H.length=0; const X=PP.exp.hist(); X.length=0; const t=PP.Features.todayISO();
      const names=[...Array(45)].map((_,i)=>({sci:'GENUS SPECIES'+i,comum:'ESPÉCIE LONGA NÚMERO '+i+' DE TESTE'}));
      const dests=['MIA','AMS','JPN','ORD','LAX','FRA','HKG','SIN'];
      for(let i=0;i<60;i++){const dia=PP.Features.addDays(t,-(i%28)); const ls=[0,1,2].map(k=>{const n=names[(i*3+k)%45];return {key:n.sci,sci:n.sci,comum:n.comum,nome:n.comum,preco:0.5+k,peixes:400*(k+1),boxes:k+1,qtyBox:400}}); const mort=i%3===0?{dead:{0:5+i%7,1:3},credito:10,mortos:8,destino:'guardar'}:null;
        const e={id:'n'+i,ts:i,cliente:{nome:'CLIENTE NÚMERO '+(i%30)+' COMÉRCIO DE PEIXES'},inv:''+i,nf:'',dataISO:dia,totais:{caixas:6,peixes:2800,valor:1000,total:1100},pay:{status:'aguardando',pago:0},lines:ls}; if(mort)e.mort=mort; H.push(e);}
      for(let i=0;i<24;i++){const dia=PP.Features.addDays(t,-(i%28)); X.push({id:'x'+i,n:i+1,ano:2026,dest:dests[i%8],dateISO:dia,cons:{name:'IMPORTER '+(i%9)},items:[0,1].map(k=>({sci:names[(i+k*7)%45].sci,pt:names[(i+k*7)%45].comum,boxes:5,qpb:400,price:0.3})),conv:{on:true,rate:5.2,date:dia},ex:{},tot:{boxes:10,fish:4000,goods:1200,fee:120,total:1320},ts:i});}
      PP.relatorio.state.p='mes'; PP.relatorio.state.rate=5.4;
      const r=PP.relatorio.rangeOf('livre'); const R=PP.relatorio.detail(PP.Features.addDays(t,-40),t,'livre',5.4);
      const pages=PP.relatorio.pages(R); const host=document.createElement('div'); host.style.cssText='position:absolute;left:0;top:0;width:794px'; host.innerHTML=pages.join(''); document.body.appendChild(host);
      const out=[...host.querySelectorAll('.rpg')].map((pg,i)=>{const f=pg.querySelector('.rpfoot'); const pr=pg.getBoundingClientRect(); if(!f) return {i,cover:true}; const ft=f.getBoundingClientRect().top; let mx=0; [...pg.children].forEach(c=>{if(c!==f){const r=c.getBoundingClientRect(); mx=Math.max(mx,r.bottom)}}); return {i,over:Math.round(mx-ft), h:Math.round(pr.height), title:(pg.querySelector('h1')||{}).textContent}});
      host.remove(); return {n:pages.length,out,weekly:R.dias.weekly,evShort:R.evo.short,spec:R.species.length,cliN:R.cliN.length,dest:R.destinos.length,perdas:R.perdas.length};
    }""")
    print(json.dumps(res,ensure_ascii=False)[:1200])
    ok(res['weekly'] and not res['evShort'],'período de 41 dias: gráfico por semana e evolução em 6 meses')
    ok(all((o.get('cover') or o['over']<=0) for o in res['out']),'nenhuma página invade o rodapé: %s'%[ (o['i'],o.get('over')) for o in res['out'] if not o.get('cover')])
    ok(res['n']>=7,'paginação: %d páginas com 45 espécies'%res['n'])
    ok(len(errs)==0,'sem erros %s'%errs)
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma')

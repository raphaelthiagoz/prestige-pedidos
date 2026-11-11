const { chromium } = require('playwright'); const fs=require('fs'); const JSZip=require('jszip');
let fail=0; const ok=(c,m)=>{console.log((c?'  ok  ':' FALHA ')+m); if(!c) fail++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const ctx=await b.newContext({viewport:{width:1400,height:900},acceptDownloads:true}); const p=await ctx.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push('PAGE '+e)); p.on('console',m=>{if(m.type()==='error'&&!/ERR_|Failed to load resource/.test(m.text()))errs.push(m.text())}); p.on('dialog',d=>d.accept());
 await p.goto('http://localhost:8765/index.html'); await p.evaluate(()=>PP.go('pedido')); await p.setInputFiles('#fStock','test/stocklist.xlsx'); await p.waitForFunction(()=>__app.S.catalog.length>0);
 // pedido salvo hoje, cliente com aeroporto
 await p.click('#cliNovo'); await p.fill('#cliNome','NATALHIA VIEIRA'); await p.fill('#cliAero','poa'); await p.fill('#cliCidade','Porto Alegre – RS');
 await p.fill('#txt','2 cx neon cardinal\n1 cx rodostomus'); await p.waitForFunction(()=>__app.S.rows.length>=2); await p.click('[data-dl="invoice"]'); await p.waitForFunction(()=>__app.S.hist.length===1);
 await p.click('#cliNovo'); await p.fill('#cliNome','CEZAR APARECIDO'); await p.fill('#cliAero','vcp'); await p.click('#novoPed'); await p.fill('#txt','1 cx rodostomus'); await p.waitForFunction(()=>__app.S.rows.length>=1); await p.click('[data-dl="invoice"]'); await p.waitForFunction(()=>__app.S.hist.length===2);
 await p.click('[data-view="embarque"]'); console.log('  vazio:',(await p.innerText('#vEmbarque')).slice(0,120).replace(/\n/g,' '));ok((await p.innerText('#vEmbarque')).includes('Nenhum embarque'),'tela vazia no início');
 await p.click('[data-em="new"]'); ok(await p.isVisible('#emTb'),'embarque criado');
 await p.click('[data-em="pull"]'); await p.waitForFunction(()=>document.querySelectorAll('#emTb tbody tr').length===2);
 const vals=await p.evaluate(()=>[...document.querySelectorAll('#emTb tbody tr')].map(tr=>[...tr.querySelectorAll('[data-lf]')].map(i=>i.value).slice(0,5).join('|'))); console.log('  linhas',JSON.stringify(vals)); ok(vals[0].startsWith('NATALHIA VIEIRA|POA|Porto Alegre – RS|3')&&vals[1].startsWith('CEZAR APARECIDO|VCP||1'),'puxou cliente, aeroporto, cidade e caixas do histórico');
 await p.click('[data-em="pull"]'); ok((await p.locator('#emTb tbody tr').count())===2,'puxar de novo não duplica');
 // editar: caixas, peso manual, nova linha, situação
 await p.fill('tr[data-l] >> nth=1 >> [data-lf=caixas]','6'); ok((await p.getAttribute('tr[data-l] >> nth=1 >> [data-lf=peso]','placeholder'))==='48 KG','peso automático 6 cx = 48 KG');
 await p.fill('tr[data-l] >> nth=0 >> [data-lf=peso]','30 KG'); 
 await p.click('[data-em="add"]'); await p.fill('tr[data-l] >> nth=2 >> [data-lf=cliente]','RA BADAUY'); await p.fill('tr[data-l] >> nth=2 >> [data-lf=aero]','gyn'); await p.fill('tr[data-l] >> nth=2 >> [data-lf=caixas]','12'); await p.fill('tr[data-l] >> nth=2 >> [data-lf=dim]','12 CXS DE 40L: 50x50x30');
 await p.selectOption('tr[data-l] >> nth=0 >> [data-lf=status]','chegou'); ok(await p.evaluate(()=>__app.PP.S.embarques[0].linhas[0].chegou.length===10),'situação "Chegou" preenche a data');
 await p.fill('tr[data-l] >> nth=1 >> [data-lf=awb]','957-12345678'); await p.fill('tr[data-l] >> nth=1 >> [data-lf=obs]','voo trocado');
 console.log('  kpis:',(await p.innerText('#emKpi')).replace(/\n+/g,' '));
 ok(/21/.test(await p.innerText('#emKpi'))&&/1 de 3/.test(await p.innerText('#emKpi')),'totais: 3+6+12 = 21 caixas, 1 de 3 chegaram');
 await p.screenshot({path:'test/s_emb.png',fullPage:true});
 // persistência
 await p.reload(); await p.click('[data-view="embarque"]'); ok((await p.locator('#emTb tbody tr').count())===3&&(await p.inputValue('tr[data-l] >> nth=1 >> [data-lf=awb]'))==='957-12345678','dados persistem após recarregar');
 // docx
 const [dl]=await Promise.all([p.waitForEvent('download'),p.click('[data-em="docx"]')]); await dl.saveAs('/tmp/emb_app.docx');
 const x=await (await JSZip.loadAsync(fs.readFileSync('/tmp/emb_app.docx'))).file('word/document.xml').async('string'); const txt=x.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g,'[$1]').replace(/<[^>]+>/g,'');
 ok(/NATALHIA VIEIRA/.test(txt)&&/\[30 KG\]/.test(txt)&&/\[48 KG\]/.test(txt)&&/12 CXS DE 40L: 50x50x30/.test(txt)&&/\[06\]/.test(txt)&&/\[21\]/.test(txt),'Word com peso manual, automático, dimensão manual e total 21');
 fs.copyFileSync('/tmp/emb_app.docx','out/emb/APP.docx');
 // duplicar e sync de chaves
 await p.click('[data-em="dup"]'); ok((await p.locator('#emSel option').count())===2,'duplicar cria 2º embarque');
 ok(await p.evaluate(()=>{const e=__app.PP.S.embarques.find(x=>x.id===document.getElementById('emSel').value);return e.linhas.every(l=>l.status==='programado'&&!l.awb)}),'duplicado volta limpo (sem situação/AWB)');
 const bk=await p.evaluate(()=>__app.PP.snapshot().embarques.length); ok(bk===2,'backup leva os embarques');
 console.log('erros',errs); if(errs.length) fail++; console.log(fail?'\n'+fail+' FALHA(S)':'\nTUDO OK'); await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});

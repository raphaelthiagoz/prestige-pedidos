/* Prestige Pedidos — aba Frete: CT-e (PDF) → frete + taxa do despachante, avisos de chegada e controle de pagamento. */
(function () {
  'use strict';
  const PP = window.PP, FC = window.FreteCore, $ = PP.$, esc = PP.esc, store = PP.store, F = PP.Features, S = PP.S;
  const today = () => F.todayISO();
  const dBR = iso => (iso ? iso.split('-').reverse().join('/') : '');
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const diaDe = iso => { const [y, m, d] = iso.split('-').map(Number); return DIAS[new Date(y, m - 1, d).getDay()]; };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const money = FC.money;

  /* ---------- dados ---------- */
  let D = load();
  function load() { const d = store.get('fretes', null) || {}; const cfg = Object.assign({ taxa: 90, modelo: FC.DEF_MODELO, detalhe: false, vooawb: false }, d.cfg || {}); if (!cfg.modelo || cfg.modelo.trim() === FC.DEF_MODELO_ANTIGO) cfg.modelo = FC.DEF_MODELO; return { cfg, rec: d.rec || {} }; }
  const save = () => store.set('fretes', D);
  const ST = { sub: 'dia', emb: null, sel: null, filt: 'aberto', q: '', pend: [], msg: '', copyMsg: '' };
  const key = (e, l) => e.id + '|' + l.id;
  const R = (e, l) => D.rec[key(e, l)] || {};
  // mensagem do cliente: {dia} vira HOJE / AMANHÃ comparando a chegada (e-mail > voo do CT-e > chegada prevista do embarque) com o dia de hoje
  const msgOf = (e, l) => { const r = R(e, l); return FC.msgFor(l.cliente, Object.assign({}, r, { chegaDia: r.chegaDia || e.chegadaPrev || '' }), D.cfg, today()); };
  const isoDia = (e, dia, mes) => { const [y, m, d0] = e.saida.split('-').map(Number); let mm = mes || m, yy = y; if (!mes && +dia < d0) mm = m + 1; if (mm > 12) { mm = 1; yy++; } if (mes && mes < m - 6) yy++; return yy + '-' + String(mm).padStart(2, '0') + '-' + String(+dia).padStart(2, '0'); };
  const setR = (e, l, o) => { D.rec[key(e, l)] = Object.assign(D.rec[key(e, l)] || {}, o); };
  const embs = () => (S.embarques || []).slice().sort((a, b) => b.saida.localeCompare(a.saida));
  const curEmb = () => { const L = embs(); if (!ST.emb || !L.find(e => e.id === ST.emb)) ST.emb = (L[0] || {}).id || null; return L.find(e => e.id === ST.emb) || null; };
  function nfOf(l) { const h = (S.hist || []).find(x => x.id === l.pedidoId) || (S.hist || []).filter(x => FC.up(x.cliente && x.cliente.nome) === FC.up(l.cliente)).sort((a, b) => b.ts - a.ts)[0]; return h && h.nf ? String(parseInt(h.nf, 10) || h.nf) : ''; }
  const totOf = (e, l) => FC.totalOf(R(e, l), D.cfg);
  function summary(e) {
    let tot = 0, rec = 0, abre = 0, semF = 0, semH = 0;
    e.linhas.forEach(l => { const r = R(e, l), t = totOf(e, l); if (!(+r.frete > 0)) semF++; if (!r.hora) semH++; if (t > 0) { tot += t; if (r.pago) rec += t; else abre += t; } });
    return { tot: FC.r2(tot), rec: FC.r2(rec), abre: FC.r2(abre), semF, semH };
  }

  /* ---------- leitura do CT-e ---------- */
  let pdfReady = null;
  function loadPdf() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfReady) pdfReady = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/pdf.min.js'; s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; ok(window.pdfjsLib); }; s.onerror = () => no(new Error('não consegui carregar o leitor de PDF')); document.head.appendChild(s); });
    return pdfReady;
  }
  async function readCte(file) {
    const lib = await loadPdf(), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const items = []; for (let p = 1; p <= Math.min(doc.numPages, 2); p++) { const t = await (await doc.getPage(p)).getTextContent(); t.items.forEach(i => { if (i.str && i.str.trim()) items.push({ s: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) + (p - 1) * -2000 }); }); }
    return FC.parseCteItems(items);
  }
  function aplicar(e, l, c, arq, por) {
    const r = R(e, l);
    setR(e, l, { cte: c.cte, awb: c.awb, vol: c.vol, peso: c.peso, voo: c.voo, vooDia: c.vooDia, entrega: c.entrega, frete: c.total, taxa: r.taxa != null && r.taxa !== '' ? r.taxa : D.cfg.taxa, nf: c.nf, arq, por });
    // o CT-e traz a DATA prevista, mas não a hora: sugere a hora que você digitou da última vez para este mesmo voo + aeroporto
    if (c.vooDia && /^\d{2}\/\d{2}$/.test(c.vooDia) && !R(e, l).chegaDia) setR(e, l, { chegaDia: isoDia(e, c.vooDia.slice(0, 2), +c.vooDia.slice(3)) });
    const sug = !r.hora && c.voo && l.aero && D.cfg.horas && D.cfg.horas[c.voo + '|' + l.aero];
    if (sug) setR(e, l, { hora: sug, horaAuto: true, avisado: false, msg: null });
  }
  function importMail(text, ocr) {
    const e = curEmb(); ST.mail = text; ST.mailOpen = true; ST.nextMsg = '';
    if (!e) { ST.mailMsg = 'Crie primeiro o embarque na Programação de voos.'; render(); return; }
    let rows = ocr ? [] : FC.parseEmail(text); if (!rows.length) rows = FC.parseEmailOcr(text);
    if (!rows.length) { ST.mailMsg = ocr ? 'Não consegui ler a tabela neste print. Tire o print só da tabela (bem de perto, sem cortar a última coluna) e tente de novo.' : 'Não achei nenhuma linha com AWB (ex.: 957-43219691). Cole a tabela do e-mail, com as linhas dos clientes.'; render(); return; }
    const out = [], usados = new Set();
    rows.forEach(w => {
      const m = w.ocr ? FC.matchEmailRowOcr(w, e.linhas, l => R(e, l)) : FC.matchEmailRow(w, e.linhas, l => R(e, l)), conx = w.voos.filter(v => v.num).map(v => `${v.cia}${v.num}/${v.dia}`).join(' → ');
      if (!m) { out.push(`? ${w.awb ? 'AWB ' + w.awb : 'Linha'} (${w.cliente || '—'} · ${w.dest || '—'}${w.hora ? ' · ' + w.hora : ''}): não achei o cliente neste embarque.`); return; }
      const r = R(e, m.linha), p = { avisado: false, msg: null };
      if (w.hora) { p.hora = w.hora; p.horaAuto = false; p.horaMail = true; }
      if (conx) p.vooMail = conx;
      if (w.voos.length) p.chegaDia = isoDia(e, w.voos[w.voos.length - 1].dia);
      if (!r.awb && w.awb && !w.ocr) p.awb = w.awb; if (!r.voo && w.voos[0] && w.voos[0].num) p.voo = w.voos[0].num;
      setR(e, m.linha, p); usados.add(m.linha.id);
      out.push(w.hora ? `✓ ${m.linha.cliente} (casou por: ${m.por}) · chega ${w.hora}${conx ? ' · ' + conx : ''}${w.janela ? ' · ' + w.janela : ''}` : `! ${m.linha.cliente}: a linha do e-mail não tem horário.`);
    });
    const sem = e.linhas.filter(l => !usados.has(l.id)).map(l => l.cliente); if (sem.length) out.push(`Sem linha no e-mail: ${sem.join(', ')}`);
    ST.mailMsg = (ocr ? 'Lido do print (confira as horas com o e-mail):\n' : '') + out.join('\n'); ST.mailOpen = true; save(); render();
  }
  async function importPrint(file) {
    ST.nextMsg = 'Lendo o print… 0%'; render();
    try { const t = await ocrImagem(file, p => { const n = $('frNext'); if (n) n.textContent = 'Lendo o print… ' + p + '%'; }); ST.mail = ''; ST.nextMsg = ''; importMail(t, true); }
    catch (err) { ST.nextMsg = 'Não consegui ler o print: ' + (err.message || err); render(); }
  }
  async function importCtes(files) {
    const e = curEmb(); if (!e) { ST.msg = 'Crie primeiro o embarque na Programação de voos.'; render(); return; }
    const out = []; ST.msg = 'Lendo…'; ST.nextMsg = ''; render();
    for (const f of files) {
      try {
        const c = await readCte(f);
        if (!c.ok) { out.push(`✗ ${f.name}: não achei o valor do frete neste PDF (anexe o CTE original, não foto).`); continue; }
        const m = FC.matchLinha(c, e.linhas, S.hist);
        if (m) { aplicar(e, m.linha, c, f.name, m.por); out.push(`✓ CTE ${c.awb || c.cte} → ${m.linha.cliente} (casou por: ${m.por}) · R$ ${money(c.total)}`); }
        else { ST.pend.push({ id: Math.random().toString(36).slice(2, 8), name: f.name, c }); out.push(`? CTE ${c.awb || c.cte} (${c.dest || 'destinatário não lido'}) não casou com nenhum cliente: escolha abaixo.`); }
      } catch (err) { out.push(`✗ ${f.name}: ${err.message || err}`); }
    }
    ST.msg = out.join('\n'); save(); render();
  }

  /* ---------- tela: embarque do dia ---------- */
  const chipPg = (e, l) => { const r = R(e, l); return r.pago ? `<span class="chip ok">PAGO ${r.pagoEm ? dBR(r.pagoEm).slice(0, 5) : ''}</span>` : '<span class="chip bad">EM ABERTO</span>'; };
  function rowsDia(e) {
    return e.linhas.map((l, i) => {
      const r = R(e, l), t = totOf(e, l), k = key(e, l), nf = r.nf || nfOf(l);
      const vol = r.vol ? (+r.vol === +l.caixas || !l.caixas ? `${r.vol} <span class="grn">✓</span>` : `<span class="red" title="A programação tem ${l.caixas} caixas">${r.vol} ≠ ${l.caixas} ⚠</span>`) : (l.caixas || '—');
      const cteTxt = r.cte ? `${esc(r.cte)}<br>${latamUrl(r.awb) ? `<a href="#" data-fr="latam" data-k="${k}" title="Abre o rastreio da LATAM Cargo com este AWB">${esc(r.awb)}</a>` : `<span class="muted">${esc(r.awb || '')}</span>`}` : '<span class="chip bad">falta CTE</span>';
      const aviso = !(+r.frete > 0) || !r.hora ? `<span class="chip bad">${!(+r.frete > 0) ? 'falta frete' : 'falta hora'}</span>` : r.avisado ? '<span class="chip ok">copiado ✓</span>' : '<span class="chip warn">a copiar</span>';
      return `<tr class="${r.pago ? 'pg' : 'dev'}" data-k="${k}"><td>${esc(l.cliente) || '—'}</td><td>${esc(nf) || '—'}</td><td>${cteTxt}${r.voo ? `<br><a href="#" data-fr="voo" data-k="${k}" title="Abre uma busca do Google com o voo">voo ${esc(r.voo)}</a>` : ''}</td>
      <td class="n">${vol}</td>
      <td class="n"><input data-fi="frete" data-k="${k}" value="${+r.frete > 0 ? money(r.frete) : ''}" placeholder="valor" style="width:94px;text-align:right" aria-label="Frete ${esc(l.cliente)}">${r.por ? ' <span class="chip ok" title="' + esc(r.arq || '') + '">CTE</span>' : ''}</td>
      <td class="n">${+r.frete > 0 ? money(r.taxa != null && r.taxa !== '' ? r.taxa : D.cfg.taxa) : '—'}</td><td class="n"><b>${t ? money(t) : '—'}</b></td>
      <td><input type="time" data-fi="hora" data-k="${k}" value="${esc(r.hora || '')}" style="width:116px" aria-label="Hora de chegada ${esc(l.cliente)}">${r.entrega ? `<div class="frprev" title="Data prevista de entrega que está no CT-e">prev. ${esc(String(r.entrega).slice(0, 5))}</div>` : ''}${r.horaMail && r.hora ? `<div class="frprev ok" title="Horário que o despachante escreveu no e-mail">e-mail do despachante${r.vooMail ? ' · ' + esc(r.vooMail) : ''}</div>` : ''}${r.horaAuto && r.hora ? '<div class="frprev warn" title="Sugerida pela última vez que você informou a hora deste voo. Confirme com o rastreio.">sugerida · confirme</div>' : ''}</td>
      <td>${aviso}</td><td style="white-space:nowrap">${chipPg(e, l)} <button type="button" class="${r.pago ? '' : 'baixa'}" data-fr="${r.pago ? 'desfaz' : 'baixa'}" data-k="${k}">${r.pago ? 'Desfazer' : 'Dar baixa'}</button></td></tr>`;
    }).join('');
  }
  function msgPane(e) {
    const ls = e.linhas; if (!ls.length) return '';
    if (!ST.sel || !ls.find(l => key(e, l) === ST.sel)) ST.sel = key(e, ls[0]);
    const l = ls.find(x => key(e, x) === ST.sel), r = R(e, l), txt = msgOf(e, l);
    return `<section class="step"><h2>Avisos de chegada (você copia e manda para sua chefe)</h2>
      <div class="frmsg"><div class="cl">${ls.map(x => { const rr = R(e, x); const st = !(+rr.frete > 0) || !rr.hora ? '—' : rr.avisado ? '✓' : '•'; return `<button type="button" data-fr="sel" data-k="${key(e, x)}" aria-pressed="${key(e, x) === ST.sel}"><span>${esc(x.cliente)}</span><span>${st}</span></button>`; }).join('')}
        <button type="button" class="primary" data-fr="copyall">Copiar todos (um bloco por cliente)</button><span class="note" id="frCopy">${esc(ST.copyMsg)}</span></div>
      <div style="display:flex;flex-direction:column;gap:8px;min-width:0"><div class="field" style="flex:0 0 auto"><label>Modelo da mensagem — use {cliente} {dia} {hora} {total} {frete} {taxa} {awb} {cte} {voo}</label><textarea data-fi="modelo" style="min-height:84px">${esc(D.cfg.modelo)}</textarea></div>
        <div class="row"><label style="color:var(--fg)"><input type="checkbox" data-fi="detalhe" ${D.cfg.detalhe ? 'checked' : ''}> Mostrar o detalhe (frete + taxa do despachante)</label><label style="color:var(--fg)"><input type="checkbox" data-fi="vooawb" ${D.cfg.vooawb ? 'checked' : ''}> Incluir voo e AWB</label></div>
        <div class="field" style="flex:0 0 auto"><label>Mensagem para ${esc(l.cliente)} (pode editar só esta)${r.msg ? ' — editada' : ''}</label><textarea data-fi="msg" data-k="${ST.sel}" style="min-height:96px">${esc(txt)}</textarea></div>
        <div class="row"><button type="button" class="primary" data-fr="copyone">Copiar mensagem</button>${r.msg ? '<button type="button" data-fr="resetmsg">Voltar ao modelo</button>' : ''}${latamUrl(r.awb) ? '<button type="button" class="primary" data-fr="latam" data-k="' + ST.sel + '">Abrir rastreio LATAM</button>' : ''}${r.voo ? '<button type="button" data-fr="voo" data-k="' + ST.sel + '">Buscar voo no Google</button>' : ''}${r.awb ? '<button type="button" data-fr="awb" data-k="' + ST.sel + '">Copiar AWB</button>' : ''}</div></div></div></section>`;
  }
  /* ---------- dia do embarque: um fluxo só (CT-es + e-mail -> horas -> avisos) ---------- */
  function fluxo(e) {
    const ls = e.linhas, n = ls.length; if (!n) return '';
    const semCte = ls.filter(l => !(+R(e, l).frete > 0)), semHora = ls.filter(l => !R(e, l).hora);
    const prontos = ls.filter(l => +R(e, l).frete > 0 && R(e, l).hora), aCopiar = prontos.filter(l => !R(e, l).avisado);
    const nomes = L => L.slice(0, 6).map(l => esc(l.cliente)).join(', ') + (L.length > 6 ? ` e mais ${L.length - 6}` : '');
    const st = (ok, parc) => (ok ? 'done' : parc ? 'now' : 'todo');
    const passo = (num, tit, feito, tot, cls, sub) => `<div class="frst ${cls}"><b>${num}</b><div><span>${tit}</span><small>${feito}/${tot}${sub ? ' · ' + sub : ''}</small></div></div>`;
    let prox;
    if (aCopiar.length) prox = `<button type="button" class="primary" data-fr="copynext">Copiar próximo aviso: ${esc(aCopiar[0].cliente)}</button>${aCopiar.length > 1 ? `<button type="button" data-fr="copyall">Copiar os ${aCopiar.length} de uma vez</button>` : ''}`;
    else if (prontos.length === n) prox = '<span class="chip ok">Tudo pronto: todos os avisos foram copiados</span>';
    else prox = `<span class="note">${semCte.length ? 'Solte os CT-es que faltam' : 'Cole o e-mail do despachante (ou digite a hora na tabela)'} para liberar os avisos.</span>`;
    return `<div class="frflow" id="frFlow">
      <div class="frdrop" id="frDrop"><b>Solte aqui os CT-es (PDF) e cole o PRINT do e-mail do despachante (Ctrl+V)</b><span class="note">Tire um print da tabela do e-mail (Win+Shift+S) e aperte Ctrl+V aqui: o app lê as horas de chegada da imagem. Também aceita o texto copiado. Pode fazer tudo em qualquer ordem. <a href="#" data-fr="pick">Escolher CT-es (PDF)</a> · <a href="#" data-fr="pickimg">Escolher print (imagem)</a></span><input type="file" id="frImg" accept="image/*" hidden></div>
      <div class="frsteps">${passo(1, 'CT-e e frete', n - semCte.length, n, st(!semCte.length, semCte.length < n), semCte.length ? 'falta: ' + nomes(semCte) : '')}${passo(2, 'Hora de chegada', n - semHora.length, n, st(!semHora.length, semHora.length < n), semHora.length ? 'falta: ' + nomes(semHora) : '')}${passo(3, 'Avisos copiados', prontos.length - aCopiar.length, n, st(prontos.length === n && !aCopiar.length, prontos.length > 0), aCopiar.length ? 'a copiar: ' + nomes(aCopiar) : '')}</div>
      <div class="row" style="align-items:center">${prox}<span class="note" id="frNext">${esc(ST.nextMsg || '')}</span></div></div>`;
  }
  function viewDia() {
    const L = embs(), e = curEmb();
    if (!e) return '<section class="step"><h2>Frete</h2><p class="note">Ainda não há embarques. Crie um na aba <b>Programação de voos</b>; os clientes dele aparecem aqui.</p></section>';
    const s = summary(e);
    const pend = ST.pend.map(p => `<div class="row" style="align-items:center"><span class="chip warn">CTE ${esc(p.c.awb || p.c.cte)}</span><span>${esc(p.c.dest || '')} · R$ ${money(p.c.total)} · NF ${esc(p.c.nf || '—')}</span><select data-fi="pendsel" data-p="${p.id}"><option value="">Escolher cliente…</option>${e.linhas.map(l => `<option value="${l.id}">${esc(l.cliente)}</option>`).join('')}</select><button type="button" data-fr="pendok" data-p="${p.id}">Usar</button><button type="button" data-fr="penddel" data-p="${p.id}">Descartar</button></div>`).join('');
    return `<section class="step"><div class="row between" style="align-items:center"><h2>Frete do embarque · controle de pagamento</h2>${subTabs()}</div>
      <div class="row" style="align-items:flex-end"><div class="field" style="flex:0 1 340px"><label for="frEmb">Embarque (da Programação de voos)</label><select id="frEmb">${L.map(x => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${cap(diaDe(x.saida))} ${dBR(x.saida).slice(0, 5)} · ${x.linhas.length} cliente(s)</option>`).join('')}</select></div>
        <div class="field" style="flex:0 1 160px"><label for="frTaxa">Taxa do despachante (R$)</label><input id="frTaxa" data-fi="taxa" value="${money(D.cfg.taxa)}"></div>
        <input type="file" id="frFile" accept="application/pdf,.pdf" multiple hidden></div>
      ${fluxo(e)}
      <details class="frmail" ${ST.mailOpen ? 'open' : ''}><summary>Colar o e-mail numa caixa de texto (para celular, ou se o Ctrl+V direto não funcionar)</summary>
        <p class="note">Copie a tabela do e-mail (as linhas com AWB, destino, voo e horário) e cole aqui. O app acha cada cliente pelo AWB do CT-e (ou pelo nome) e preenche a hora de chegada prevista.</p>
        <textarea id="frMail" rows="6" placeholder="PRESTIGE&#9;MAEDA&#9;BSB&#9;957-43219691&#9;6,0&#9;48,0&#9;11/nov&#9;tarde&#9;LA3747/12&#9;&#9;08:30">${esc(ST.mail || '')}</textarea>
        <div class="row"><button type="button" class="primary" data-fr="mailgo">Ler e-mail e preencher horas</button>${ST.mail ? '<button type="button" data-fr="mailclr">Limpar</button>' : ''}</div>${ST.mailMsg ? `<div class="warnbox" style="white-space:pre-line;margin-top:8px">${esc(ST.mailMsg)}</div>` : ''}</details>
      ${ST.msg ? `<div class="warnbox" style="white-space:pre-line">${esc(ST.msg)}</div>` : ''}${pend}
      <div class="kp"><div><span class="muted">Total do embarque</span><b>${money(s.tot)}</b></div><div><span class="muted">Recebido</span><b class="grn">${money(s.rec)}</b></div><div><span class="muted">Em aberto</span><b class="${s.abre ? 'red' : ''}">${money(s.abre)}</b></div><div><span class="muted">Falta frete / hora</span><b>${s.semF} / ${s.semH}</b></div></div>
      ${e.linhas.length ? `<div class="tablewrap"><table class="fr"><thead><tr><th>Cliente</th><th>NF</th><th>CTE · AWB</th><th class="n">Vol.</th><th class="n">Frete (CTE)</th><th class="n">Taxa DM</th><th class="n">Total</th><th>Chega às</th><th>Aviso</th><th>Pagamento</th></tr></thead><tbody>${rowsDia(e)}
      <tr class="tot"><td colspan="3">TOTAL (${e.linhas.length} cliente${e.linhas.length > 1 ? 's' : ''})</td><td class="n">${e.linhas.reduce((a, l) => a + (+R(e, l).vol || +l.caixas || 0), 0)}</td><td class="n">${money(e.linhas.reduce((a, l) => a + (+R(e, l).frete || 0), 0))}</td><td class="n">${money(e.linhas.reduce((a, l) => a + (+R(e, l).frete > 0 ? (R(e, l).taxa != null && R(e, l).taxa !== '' ? +R(e, l).taxa : +D.cfg.taxa) : 0), 0))}</td><td class="n">${money(s.tot)}</td><td colspan="3"></td></tr></tbody></table></div>` : '<p class="note">Este embarque não tem clientes. Use "Puxar pedidos do histórico" na Programação de voos.</p>'}
      <div class="row"><button type="button" class="primary" data-fr="xlsx">⬇ Baixar planilha (.xlsx)</button><button type="button" data-fr="copylist">Copiar lista</button><span class="note" id="frList"></span></div></section>${msgPane(e)}`;
  }

  /* ---------- tela: controle (todos) ---------- */
  function allRows() {
    const out = []; (S.embarques || []).forEach(e => e.linhas.forEach(l => { const r = R(e, l), t = totOf(e, l); if (t > 0) out.push({ e, l, r, t, k: key(e, l) }); }));
    return out.sort((a, b) => b.e.saida.localeCompare(a.e.saida) || a.l.cliente.localeCompare(b.l.cliente));
  }
  const diasAbertos = e => Math.max(0, Math.round((new Date(today() + 'T12:00:00') - new Date(e.saida + 'T12:00:00')) / 86400000));
  function viewCtl() {
    const all = allRows(), q = ST.q.trim().toLowerCase(), mes = today().slice(0, 7);
    const list = all.filter(x => (ST.filt === 'todos' || (ST.filt === 'aberto' ? !x.r.pago : x.r.pago)) && (!q || (x.l.cliente + ' ' + (x.r.cte || '')).toLowerCase().includes(q)));
    const abre = all.filter(x => !x.r.pago), recM = all.filter(x => x.r.pago && (x.r.pagoEm || '').slice(0, 7) === mes);
    const dev = {}; abre.forEach(x => { (dev[x.l.cliente] = dev[x.l.cliente] || { v: 0, n: 0 }); dev[x.l.cliente].v += x.t; dev[x.l.cliente].n++; });
    return `<section class="step"><div class="row between" style="align-items:center"><h2>Controle de fretes · todos os embarques</h2>${subTabs()}</div>
      <div class="kp"><div><span class="muted">Em aberto (todos)</span><b class="${abre.length ? 'red' : ''}">R$ ${money(abre.reduce((a, x) => a + x.t, 0))}</b></div><div><span class="muted">Recebido no mês</span><b class="grn">R$ ${money(recM.reduce((a, x) => a + x.t, 0))}</b></div><div><span class="muted">Clientes devendo</span><b class="${Object.keys(dev).length ? 'red' : ''}">${Object.keys(dev).length}</b></div></div>
      <div class="row" style="align-items:center"><div class="chips">${[['aberto', 'Em aberto'], ['pago', 'Pagos'], ['todos', 'Todos']].map(([k, n]) => `<button type="button" class="xchip" data-fr="filt" data-v="${k}" aria-pressed="${ST.filt === k}">${n}</button>`).join('')}</div><div class="field" style="flex:0 1 240px"><input id="frQ" data-fi="q" placeholder="Buscar cliente ou CTE…" value="${esc(ST.q)}"></div></div>
      ${list.length ? `<div class="tablewrap"><table class="fr"><thead><tr><th>Embarque</th><th>Cliente</th><th>CTE</th><th class="n">Total (frete + taxa)</th><th>Situação</th><th></th></tr></thead><tbody>${list.map(x => `<tr class="${x.r.pago ? 'pg' : 'dev'}"><td>${dBR(x.e.saida).slice(0, 5)}</td><td>${esc(x.l.cliente)}</td><td>${esc(x.r.cte || '—')}</td><td class="n">${money(x.t)}</td><td>${x.r.pago ? `<span class="chip ok">PAGO ${x.r.pagoEm ? dBR(x.r.pagoEm).slice(0, 5) : ''}</span>` : `<span class="chip bad">EM ABERTO · ${diasAbertos(x.e)} dia(s)</span>`}</td><td><button type="button" class="${x.r.pago ? '' : 'baixa'}" data-fr="${x.r.pago ? 'desfaz' : 'baixa'}" data-k="${x.k}">${x.r.pago ? 'Desfazer' : 'Dar baixa'}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Nada por aqui com este filtro.</p>'}
      ${Object.keys(dev).length ? `<p class="note"><b>Quem está devendo:</b> ${Object.entries(dev).sort((a, b) => b[1].v - a[1].v).map(([n, v]) => `${esc(n)} R$ ${money(v.v)} (${v.n} embarque${v.n > 1 ? 's' : ''})`).join(' · ')}</p>` : ''}</section>`;
  }
  const subTabs = () => `<div class="tabs"><button type="button" data-fr="sub" data-v="dia" aria-selected="${ST.sub === 'dia'}">Embarque do dia</button><button type="button" data-fr="sub" data-v="ctl" aria-selected="${ST.sub === 'ctl'}">Controle de fretes (todos)</button></div>`;
  function render() { $('vFrete').innerHTML = ST.sub === 'ctl' ? viewCtl() : viewDia(); }

  /* ---------- planilha e cópia ---------- */
  const b64buf = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
  function rowsList(e) { return e.linhas.map(l => ({ nome: l.cliente, r: R(e, l), t: totOf(e, l) })).filter(x => +x.r.frete > 0); }
  async function xlsx() {
    const e = curEmb(); if (!e) return; const rows = rowsList(e);
    if (!rows.length) { $('frList').textContent = 'Nenhum frete preenchido ainda.'; return; }
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(b64buf(window.TPL_FRETE)); const ws = wb.worksheets[0];
    const st = c => JSON.parse(JSON.stringify(ws.getRow(3).getCell(c).style || {})), sty = [1, 2, 3, 4].map(st);
    for (let r = 2; r <= Math.max(ws.rowCount, 8); r++) for (let c = 1; c <= 4; c++) ws.getRow(r).getCell(c).value = null;
    rows.forEach((x, i) => { const rr = ws.getRow(2 + i); const taxa = x.r.taxa != null && x.r.taxa !== '' ? +x.r.taxa : +D.cfg.taxa; rr.getCell(1).value = x.nome.toUpperCase(); rr.getCell(2).value = FC.r2(x.r.frete); rr.getCell(3).value = taxa; rr.getCell(4).value = { formula: `(B${2 + i}+C${2 + i})`, result: x.t }; for (let c = 1; c <= 4; c++) rr.getCell(c).style = Object.assign({}, sty[c - 1]); rr.commit && rr.commit(); });
    const tr = ws.getRow(2 + rows.length), n1 = 2, n2 = 1 + rows.length;
    tr.getCell(1).value = 'TOTAL'; tr.getCell(2).value = { formula: `SUM(B${n1}:B${n2})`, result: FC.r2(rows.reduce((a, x) => a + +x.r.frete, 0)) }; tr.getCell(3).value = { formula: `SUM(C${n1}:C${n2})`, result: FC.r2(rows.reduce((a, x) => a + (x.t - +x.r.frete), 0)) }; tr.getCell(4).value = { formula: `SUM(D${n1}:D${n2})`, result: FC.r2(rows.reduce((a, x) => a + x.t, 0)) };
    for (let c = 1; c <= 4; c++) { tr.getCell(c).style = Object.assign({}, sty[c - 1]); tr.getCell(c).font = Object.assign({}, sty[c - 1].font || {}, { bold: true }); }
    const buf = await wb.xlsx.writeBuffer(), d = dBR(e.saida).slice(0, 5).replace('/', '.');
    PP.saveBlob(`FRETE_${d}.xlsx`, new Blob([buf], { type: PP.MIME.xlsx }));
    $('frList').textContent = rows.length < e.linhas.length ? `Baixei ${rows.length} de ${e.linhas.length} clientes (os sem frete não entram).` : 'Planilha baixada.';
  }
  function latamUrl(awb) { const m = String(awb || '').match(/(\d{3})\D*(\d{8})/); return m ? 'https://www.latamcargo.com/en/trackshipment?docNumber=' + m[2] + '&docPrefix=' + m[1] + '&soType=SO' : ''; }
  async function copy(text) { try { await navigator.clipboard.writeText(text); return true; } catch (_) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_2) { /* */ } t.remove(); return ok; } }

  /* ---------- eventos ---------- */
  const view = () => $('vFrete');
  document.addEventListener('change', async ev => {
    const t = ev.target; if (!view() || !view().contains(t)) return;
    if (t.id === 'frEmb') { ST.emb = t.value; ST.sel = null; ST.pend = []; ST.msg = ''; render(); return; }
    if (t.id === 'frImg') { const f = t.files[0]; t.value = ''; if (f) await importPrint(f); return; }
    if (t.id === 'frFile') { const f = Array.from(t.files); t.value = ''; if (f.length) await importCtes(f); return; }
    const fi = t.dataset.fi; if (!fi) return;
    const e = curEmb(), [eid, lid] = (t.dataset.k || '').split('|'), l = e && e.linhas.find(x => x.id === lid);
    if (fi === 'taxa') { const v = FC.parseMoney(t.value); if (v >= 0) D.cfg.taxa = v; save(); render(); return; }
    if (fi === 'frete' && l) { const v = FC.parseMoney(t.value); setR(e, l, { frete: v > 0 ? v : '', taxa: (R(e, l).taxa != null && R(e, l).taxa !== '') ? R(e, l).taxa : D.cfg.taxa, por: R(e, l).por }); if (!(v > 0)) setR(e, l, { frete: '' }); save(); render(); return; }
    if (fi === 'hora' && l) {
      setR(e, l, { hora: t.value, horaAuto: false, horaMail: false, avisado: false, msg: null });
      const rr = R(e, l); if (t.value && rr.voo && l.aero) { D.cfg.horas = D.cfg.horas || {}; D.cfg.horas[rr.voo + '|' + l.aero] = t.value; } // memoriza: voo 3747 em BSB chega às hh:mm
      save(); render(); return;
    }
    if (fi === 'detalhe' || fi === 'vooawb') { D.cfg[fi] = t.checked; save(); render(); return; }
    if (fi === 'q') return;
  });
  document.addEventListener('input', ev => {
    const t = ev.target; if (!view() || !view().contains(t)) return; const fi = t.dataset.fi;
    if (fi === 'modelo') { D.cfg.modelo = t.value; save(); const e = curEmb(), ta = view().querySelector('[data-fi="msg"]'); if (ta && e) { const l = e.linhas.find(x => key(e, x) === ST.sel); if (l && !R(e, l).msg) ta.value = msgOf(e, l); } return; }
    if (fi === 'msg') { const e = curEmb(), [, lid] = t.dataset.k.split('|'), l = e && e.linhas.find(x => x.id === lid); if (l) { setR(e, l, { msg: t.value, avisado: false }); save(); } return; }
    if (fi === 'q') { ST.q = t.value; const pos = t.selectionStart; render(); const n = $('frQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  });
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-fr]'); if (!b || !view() || !view().contains(b)) return; ev.preventDefault();
    const a = b.dataset.fr, e = curEmb(), k = b.dataset.k, find = kk => { const [eid, lid] = (kk || '').split('|'), ee = (S.embarques || []).find(x => x.id === eid), ll = ee && ee.linhas.find(x => x.id === lid); return ee && ll ? { e: ee, l: ll } : null; };
    if (a === 'sub') { ST.sub = b.dataset.v; render(); return; }
    if (a === 'filt') { ST.filt = b.dataset.v; render(); return; }
    if (a === 'pickimg') { const fi = $('frImg'); if (fi) fi.click(); return; }
    if (a === 'pick') { const fi = $('frFile'); if (fi) fi.click(); return; }
    if (a === 'copynext' && e) {
      const l = e.linhas.find(x => +R(e, x).frete > 0 && R(e, x).hora && !R(e, x).avisado); if (!l) return;
      if (await copy(l.cliente + '\n' + msgOf(e, l))) { setR(e, l, { avisado: true }); save(); ST.sel = key(e, l); ST.nextMsg = `Aviso de ${l.cliente} copiado. Cole no WhatsApp e volte para o próximo.`; render(); }
      else { ST.nextMsg = 'Não consegui copiar. Use o botão "Copiar mensagem" lá embaixo.'; render(); }
      return;
    }
    if (a === 'mailclr') { ST.mail = ''; ST.mailMsg = ''; render(); return; }
    if (a === 'mailgo') { importMail(($('frMail') || {}).value || ''); return; }
    if (a === 'sel') { ST.sel = k; render(); return; }
    if (a === 'baixa' || a === 'desfaz') { const x = find(k); if (x) { setR(x.e, x.l, a === 'baixa' ? { pago: true, pagoEm: today() } : { pago: false, pagoEm: '' }); save(); render(); } return; }
    if (a === 'xlsx') { await xlsx(); return; }
    if (a === 'copylist' && e) { const rows = rowsList(e); const txt = ['NOME CLIENTE\tFRETE\tTAXA DM\tTOTAL'].concat(rows.map(x => `${x.nome.toUpperCase()}\t${money(x.r.frete)}\t${money(x.t - x.r.frete)}\t${money(x.t)}`)).join('\n'); $('frList').textContent = (await copy(txt)) ? `Lista copiada (${rows.length} clientes).` : 'Não consegui copiar.'; return; }
    if (a === 'copyone') { const x = find(ST.sel); if (!x) return; const r = R(x.e, x.l); if (await copy(x.l.cliente + '\n' + msgOf(x.e, x.l))) { setR(x.e, x.l, { avisado: true }); save(); ST.copyMsg = 'Mensagem copiada.'; render(); } return; }
    if (a === 'resetmsg') { const x = find(ST.sel); if (x) { setR(x.e, x.l, { msg: null }); save(); render(); } return; }
    if (a === 'copyall' && e) {
      const ready = e.linhas.filter(l => +R(e, l).frete > 0 && R(e, l).hora), miss = e.linhas.length - ready.length;
      if (!ready.length) { ST.copyMsg = 'Preencha frete e hora de pelo menos um cliente.'; render(); return; }
      if (await copy(ready.map(l => l.cliente + '\n' + msgOf(e, l)).join('\n\n'))) { ready.forEach(l => setR(e, l, { avisado: true })); save(); ST.copyMsg = `Copiei ${ready.length} aviso(s)${miss ? `; faltam ${miss} (sem frete ou hora)` : ''}.`; render(); }
      return;
    }
    if (a === 'latam') { const x = find(k); if (!x) return; const u = latamUrl(R(x.e, x.l).awb); if (u) window.open(u, '_blank', 'noopener'); return; }
    if (a === 'voo' || a === 'awb') { const x = find(k); if (!x) return; const r = R(x.e, x.l); if (a === 'awb') { await copy(r.awb); ST.copyMsg = 'AWB copiado.'; render(); } else window.open('https://www.google.com/search?q=' + encodeURIComponent(`voo LATAM ${r.voo} ${r.vooDia || ''}`), '_blank', 'noopener'); return; }
    if (a === 'penddel') { ST.pend = ST.pend.filter(p => p.id !== b.dataset.p); render(); return; }
    if (a === 'pendok') { const p = ST.pend.find(x => x.id === b.dataset.p), sel = view().querySelector(`[data-fi="pendsel"][data-p="${b.dataset.p}"]`), l = p && e && e.linhas.find(x => x.id === (sel && sel.value)); if (p && l) { aplicar(e, l, p.c, p.name, 'escolha manual'); ST.pend = ST.pend.filter(x => x !== p); save(); render(); } return; }
  });
  /* lê o texto de um PRINT (imagem) do e-mail: amplia, passa para preto no branco e roda o OCR */
  async function ocrImagem(file, onProg) {
    if (!window.Tesseract) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'vendor/ocr/tesseract.min.js'; sc.onload = ok; sc.onerror = () => no(new Error('Não consegui carregar o leitor de imagem (sem internet na primeira vez?).')); document.head.appendChild(sc); });
    const bmp = await createImageBitmap(file), k = Math.max(1, Math.min(4, 3700 / bmp.width)), cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingQuality = 'high'; cx.drawImage(bmp, 0, 0, cv.width, cv.height);
    const W = cv.width, H = cv.height, im = cx.getImageData(0, 0, W, H), d = im.data, N = W * H;
    // 1) texto = o que destoa do fundo ao redor (funciona com tema escuro, células coloridas e letras lilás/vermelhas)
    const g = new Uint8Array(N), mx = new Uint8Array(N);
    for (let i = 0, p = 0; p < N; i += 4, p++) { g[p] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8; mx[p] = Math.max(d[i], d[i + 1], d[i + 2]); }
    // fundo = mediana numa janela de ~13 px da imagem ORIGINAL (rápido), depois ampliado
    const w0 = bmp.width, h0 = bmp.height, c0 = document.createElement('canvas'); c0.width = w0; c0.height = h0;
    const x0c = c0.getContext('2d', { willReadFrequently: true }); x0c.drawImage(bmp, 0, 0); const i0 = x0c.getImageData(0, 0, w0, h0), d0 = i0.data, n0 = w0 * h0;
    const g0 = new Uint8Array(n0), m0 = new Uint8Array(n0); for (let i = 0, p = 0; p < n0; i += 4, p++) { g0[p] = (d0[i] * 77 + d0[i + 1] * 150 + d0[i + 2] * 29) >> 8; m0[p] = Math.max(d0[i], d0[i + 1], d0[i + 2]); }
    const mediana = src => { const R = 6, out = new Uint8Array(n0), hs = new Uint16Array(256); for (let y = 0; y < h0; y++) { hs.fill(0); let cnt = 0; const ya = Math.max(0, y - R), yb = Math.min(h0 - 1, y + R); const add = (x, s) => { for (let yy = ya; yy <= yb; yy++) hs[src[yy * w0 + x]] += s; cnt += s * (yb - ya + 1); }; for (let x = 0; x <= Math.min(w0 - 1, R); x++) add(x, 1); for (let x = 0; x < w0; x++) { if (x > 0) { if (x + R < w0) add(x + R, 1); if (x - R - 1 >= 0) add(x - R - 1, -1); } let acc = 0, v = 0; const half = cnt >> 1; while (v < 255 && (acc += hs[v]) <= half) v++; out[y * w0 + x] = v; } } return out; };
    const bg0 = mediana(g0), bm0 = mediana(m0); for (let i = 0, p = 0; p < n0; i += 4, p++) { d0[i] = bg0[p]; d0[i + 1] = bm0[p]; d0[i + 2] = 0; d0[i + 3] = 255; } x0c.putImageData(i0, 0, 0);
    const cb = document.createElement('canvas'); cb.width = W; cb.height = H; const xb = cb.getContext('2d', { willReadFrequently: true }); xb.imageSmoothingQuality = 'high'; xb.drawImage(c0, 0, 0, W, H); const db = xb.getImageData(0, 0, W, H).data;
    const mg = new Uint8Array(N), mm = new Uint8Array(N); for (let i = 0, p = 0; p < N; i += 4, p++) { mg[p] = db[i]; mm[p] = db[i + 1]; }
    const df = new Uint8Array(N), hist = new Uint32Array(256);
    for (let p = 0; p < N; p++) { const v = Math.max(Math.abs(g[p] - mg[p]), Math.abs(mx[p] - mm[p])); df[p] = v; hist[v]++; }
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i]; let sB = 0, wB = 0, best = 0, th = 40; // limiar de Otsu
    for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = N - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; th = i; } }
    const bin = new Uint8Array(N); for (let p = 0; p < N; p++) bin[p] = df[p] > th ? 1 : 0;
    // 2) apaga as linhas da tabela (traços compridos na horizontal e na vertical), que atrapalham a leitura
    const LH = Math.round(30 * k), LV = Math.round(22 * k);
    for (let y = 0; y < H; y++) { let x = 0; while (x < W) { if (!bin[y * W + x]) { x++; continue; } let x2 = x; while (x2 < W && bin[y * W + x2]) x2++; if (x2 - x >= LH) for (let q = x; q < x2; q++) bin[y * W + q] = 2; x = x2; } }
    for (let x = 0; x < W; x++) { let y = 0; while (y < H) { if (!bin[y * W + x]) { y++; continue; } let y2 = y; while (y2 < H && bin[y2 * W + x]) y2++; if (y2 - y >= LV) for (let q = y; q < y2; q++) bin[q * W + x] = 2; y = y2; } }
    for (let i = 0, p = 0; p < N; i += 4, p++) { const v = bin[p] === 1 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    cx.putImageData(im, 0, 0);
    const w = await Tesseract.createWorker('por', 1, { workerPath: 'vendor/ocr/worker.min.js', corePath: 'vendor/ocr/', langPath: 'vendor/ocr/', gzip: true, workerBlobURL: false, logger: m => { if (onProg && m.status === 'recognizing text') onProg(Math.round(m.progress * 100)); } });
    try { await w.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1' }); const { data } = await w.recognize(cv); return data.text; } finally { try { await w.terminate(); } catch (_) { /* ok */ } }
  }
  PP.ocrImagem = ocrImagem;
  // soltar PDFs / texto em qualquer lugar da tela Frete, e colar (Ctrl+V) o e-mail sem precisar clicar em caixa nenhuma
  const naFrete = () => S.view === 'frete' && (ST.sub || 'dia') === 'dia';
  const imgs = fl => Array.from(fl || []).filter(f => /^image\//.test(f.type));
  const pdfs = fl => Array.from(fl || []).filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
  document.addEventListener('dragover', ev => { if (!naFrete() || !view() || !view().contains(ev.target)) return; const dt = ev.dataTransfer; if (!dt || !Array.from(dt.types || []).some(t => t === 'Files' || t === 'text/plain')) return; ev.preventDefault(); const d = $('frDrop'); if (d) d.classList.add('over'); });
  document.addEventListener('dragleave', ev => { if (ev.target === document.documentElement || !ev.relatedTarget) { const d = $('frDrop'); if (d) d.classList.remove('over'); } });
  document.addEventListener('drop', async ev => {
    if (!naFrete() || !view() || !view().contains(ev.target)) return; const dt = ev.dataTransfer; if (!dt) return;
    const f = pdfs(dt.files), txt = dt.getData && dt.getData('text/plain');
    if (!f.length && !txt && !imgs(dt.files).length) return; ev.preventDefault(); const d = $('frDrop'); if (d) d.classList.remove('over');
    const im = imgs(dt.files);
    if (f.length) await importCtes(f); else if (im.length) await importPrint(im[0]); else if (/\d{3}-\d{8}/.test(txt)) importMail(txt);
  });
  document.addEventListener('paste', async ev => {
    if (!naFrete()) return; const t = ev.target; if (t && t.closest && t.closest('input,textarea,[contenteditable="true"]')) return;
    const cd = ev.clipboardData; if (!cd) return; const f = pdfs(cd.files), txt = cd.getData('text/plain') || '';
    if (f.length) { ev.preventDefault(); await importCtes(f); }
    else if (imgs(cd.files).length) { ev.preventDefault(); await importPrint(imgs(cd.files)[0]); }
    else if (/\d{3}-\d{8}/.test(txt)) { ev.preventDefault(); importMail(txt); ST.mailOpen = false; render(); }
    else if (txt.trim().length > 20) { ST.nextMsg = 'O texto colado não tem nenhum AWB (ex.: 957-43219691). Copie a tabela do e-mail do despachante.'; render(); }
  });
  PP.frete = { render, reload() { D = load(); }, FC };
})();

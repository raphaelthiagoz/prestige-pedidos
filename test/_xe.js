
  /* ============================================================
     eventos
     ============================================================ */
  const rotSave = () => { if (S.curId) saveEntry(); else persist(); };
  const consKeys = /^cons\./;
  function onInput(e) {
    const t = e.target, el = $('vExp'); if (!el || !el.contains(t)) return;
    if (t.dataset.xp) {
      const p = t.dataset.xp; let v = t.type === 'checkbox' ? t.checked : t.value;
      if (p === 'ex.fee') v = v === '' ? '' : +v;
      if (p === 'conv.rate') v = v === '' ? '' : +v;
      setP(p, v);
      if (consKeys.test(p)) { CFG.cons[S.dest] = Object.assign(CFG.cons[S.dest] || {}, { [p.slice(5)]: v }); saveCfg(); }
      if (p === 'conv.on' && e.type === 'change') { renderExp(); return; }
      if (e.type === 'change' && p === 'date') { S.conv.date = S.conv.date || v; }
      live(); return;
    }
    if (t.dataset.xi != null) {
      const x = S.items[+t.dataset.xi], k = t.dataset.xk; if (!x) return;
      x[k] = t.value;
      if (k === 'sci' && e.type === 'change' && !x.pt) { x.pt = ptOf(x.sci); renderExp(); return; }
      live();
    }
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'xFile' && t.files[0]) { await importFile(t.files[0]); t.value = ''; renderExp(); return; }
    if (t.id === 'xLast') { const n = Math.max(0, parseInt(t.value, 10) || 0); if (n === CFG.last) return; CFG.last = n; saveCfg(); S.numOpen = true; renderExp(); return; }
    if (t.id === 'xAno') { const n = parseInt(t.value, 10) || CFG.ano; if (n === CFG.ano) return; CFG.ano = n; saveCfg(); S.numOpen = true; renderExp(); return; }
    if (t.id === 'xRotOnly') { S.rot.only = t.checked; persist(); renderRot(); return; }
    if (t.dataset && (t.dataset.xp === 'conv.on' || (t.dataset.xi != null && t.dataset.xk === 'sci'))) onInput(e);
  });
  document.addEventListener('input', e => {
    const t = e.target; if (t.dataset && t.dataset.xnt) { S.rot.nt = S.rot.nt || {}; S.rot.nt[t.dataset.xnt] = t.value; rotSave(); }
  });

  /* edição direta na prévia */
  const cleanTxt = t => String(t).replace(/\s+/g, ' ').trim();
  document.addEventListener('input', e => {
    const t = e.target; if (!t.dataset || !t.dataset.xe) return;
    const p = t.dataset.xe; let v = cleanTxt(t.textContent);
    if (/^items\.\d+\.(boxes|qpb|price|kg)$/.test(p)) v = v.replace(',', '.').replace(/[^0-9.]/g, '');
    if (p === 'ex.fee') v = +v || 0;
    setP(p, v); t.dataset.raw = v; t.classList.toggle('blank', v === '');
    if (consKeys.test(p)) { CFG.cons[S.dest] = Object.assign(CFG.cons[S.dest] || {}, { [p.slice(5)]: v }); saveCfg(); }
    liveForm();
  });
  document.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.xe && t.dataset.raw != null && cleanTxt(t.textContent) !== t.dataset.raw) t.textContent = t.dataset.raw; });
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key === 'Enter' && t.dataset && t.dataset.xe) { e.preventDefault(); t.blur(); }
    if (e.key === 'Escape' && prevOpen()) closePrev();
  });
  document.addEventListener('focusout', e => {
    const t = e.target; if (!t.dataset || !t.dataset.xe) return;
    const r = e.relatedTarget; if (r && r.dataset && r.dataset.xe) return;
    if (r && r.closest && r.closest('#xStage')) setTimeout(refreshStage, 200); else refreshStage();
  });
  document.addEventListener('paste', e => { const t = e.target; if (t.dataset && t.dataset.xe) { e.preventDefault(); document.execCommand('insertText', false, cleanTxt((e.clipboardData || window.clipboardData).getData('text'))); } });
  document.addEventListener('toggle', e => { if (e.target && e.target.id === 'xCons') { S.consOpen = e.target.open; persist(); } if (e.target && e.target.id === 'xNum') { S.numOpen = e.target.open; persist(); } }, true);

  /* arrastar as espécies */
  let dragX = -1;
  document.addEventListener('dragstart', e => { const g = e.target.closest && e.target.closest('[data-xgrip]'); if (!g) return; dragX = +g.dataset.xgrip; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(dragX)); } catch (_) { /* ok */ } g.closest('tr').classList.add('dragging'); });
  document.addEventListener('dragover', e => { if (dragX < 0) return; e.preventDefault(); document.querySelectorAll('tr.dragover').forEach(x => x.classList.remove('dragover')); const tr = e.target.closest && e.target.closest('tr[data-xrow]'); if (tr) tr.classList.add('dragover'); });
  document.addEventListener('drop', e => { if (dragX < 0) return; e.preventDefault(); const tr = e.target.closest && e.target.closest('tr[data-xrow]'); const to = tr ? +tr.dataset.xrow : dragX, f = dragX; dragX = -1; moveItem(f, to); });
  document.addEventListener('dragend', () => { dragX = -1; document.querySelectorAll('tr.dragover,tr.dragging').forEach(x => x.classList.remove('dragover', 'dragging')); });

  async function act(a, b) {
    if (a === 'ordauto') { autoOrder(); return; }
    if (a === 'ordsave') { saveOrdem(); return; }
    if (a === 'ordclear') { clearOrdem(); return; }
    if (a === 'nac') { PPx.go('pedido'); return; }
    if (a === 'prev') { openPrev(); return; }
    if (a === 'closeprev') { closePrev(); return; }
    if (a === 'novo') { if (S.items.length && !S.curId && !confirm('Começar uma nova exportação? O rascunho atual será descartado (ele ainda não foi salvo no histórico).')) return; newExp(S.dest); renderExp(); return; }
    if (a === 'addtxt') { importText($('xTxt').value); renderExp(); return; }
    if (a === 'addrow') { addItem({ boxes: 1 }); renderExp(); return; }
    if (a === 'ptax') { await buscaPtax(); return; }
    if (a === 'zip') { b.disabled = true; try { await downloadAll(); } catch (e) { S.msg = 'Erro ao gerar: ' + (e.message || e); renderExp(); } return; }
    if (a === 'save') { saveEntry(); S.msg = `Exportação ${numStr()} salva no histórico.`; persist(); if (S.xview === 'rot') renderRot(); else renderExp(); return; }
    if (a === 'rot' || a === 'vrot') { S.xview = 'rot'; persist(); render(); window.scrollTo(0, 0); return; }
    if (a === 'vped') { S.xview = 'ped'; persist(); render(); return; }
    if (a === 'alllab') { S.allLabels = !S.allLabels; live(); return; }
    if (a === 'copymail') { const ta = $('xMail'); if (ta) { ta.select(); try { await navigator.clipboard.writeText(ta.value); } catch (_) { document.execCommand('copy'); } b.textContent = '✓ Copiado'; } return; }
    if (a === 'rotprint') { document.body.classList.add('printrot'); window.print(); setTimeout(() => document.body.classList.remove('printrot'), 500); return; }
    if (a === 'rotclear') { if (confirm('Zerar o roteiro desta exportação?')) { S.rot = newRot(); rotSave(); renderRot(); } return; }
  }
  document.addEventListener('click', async e => {
    const t = e.target.closest('button,[data-xjump]'); if (!t) return;
    const d = t.dataset;
    if (t.id === 'modExp') { PPx.go('exp'); return; }
    const inPrev = $('xModal') && $('xModal').contains(t), inExp = $('vExp') && $('vExp').contains(t), inRot = S.xview === 'rot' && $('vExp') && $('vExp').contains(t), inNum = $('vHist') && $('vHist').contains(t);
    if (!inExp && !inRot && !inNum && !inPrev) return;
    if (d.xa) { await act(d.xa, t); return; }
    if (inExp && S.xview !== 'rot') {
      if (d.xmv) { moveItem(+d.xi2, +d.xi2 + +d.xmv); return; }
      if (d.xdest) { S.dest = d.xdest; S.cons = consOf(S.dest); S.sub = { atest: DEST[S.dest].atest[0], czi: DEST[S.dest].czi[0] }; persist(); renderExp(); return; }
      if (d.xdl) { await downloadOne(d.xdl); return; }
      if (d.xdel != null) { S.items.splice(+d.xdel, 1); renderExp(); return; }
    }
    if (inPrev) {
      if (d.xtab) { S.tab = d.xtab; renderPrev(); return; }
      if (d.xsub) { const [k, v] = d.xsub.split(':'); S.sub[k] = v; renderPrev(); return; }
      if (d.xiv) { S.invView = d.xiv; renderPrev(); return; }
    }
    if (inRot) {
      if (d.xst) { const [k, v] = d.xst.split(':'); S.rot.st = S.rot.st || {}; S.rot.st[k] = v; rotSave(); renderRot(); const r = $('rv_' + k); if (r) r.scrollIntoView({ block: 'nearest' }); return; }
      if (d.xnote) { const k = d.xnote; S.rot.no = S.rot.no || {}; S.rot.no[k] = !S.rot.no[k]; persist(); renderRot(); const i = document.querySelector(`[data-xnt="${k}"]`); if (i) i.focus(); return; }
      if (d.xjump) { const r = $('rv_' + d.xjump); if (r) { S.rot.only = false; r.scrollIntoView({ behavior: 'smooth', block: 'center' }); r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 1600); } return; }
      if (d.xrotgo) { S.xview = 'ped'; S.tab = d.xrotgo; if (d.xrsub) { if (d.xrotgo === 'at') S.sub.atest = d.xrsub; } persist(); PPx.go('exp'); openPrev(); return; }
    }
    if (inNum) {
      if (d.xopen) { openEntry(d.xopen); return; }
      if (d.xdelh) { if (confirm('Excluir esta exportação do histórico? O número continua marcado como usado.')) { HIST = HIST.filter(x => x.id !== d.xdelh); if (S.curId === d.xdelh) { S.curId = null; S.n = null; } saveHist(); persist(); if (window.PP.extra) window.PP.extra.render('hist'); } return; }
    }
  });

  window.PP.exp = { render, state: () => S, cfg: () => CFG, hist: () => HIST, docList, orderObj };
  document.addEventListener('DOMContentLoaded', () => {});
})();

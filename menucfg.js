/* Prestige Pedidos — Configurações > Menu lateral: reordenar e ocultar abas. A ordem fica em S.cfg.menu (sincroniza). */
(function () {
  'use strict';
  const PP = window.PP, $ = PP.$, esc = PP.esc;
  let drag = null;
  function lista() { return PP.nav.order(); }
  function render() {
    const el = $('menuCfg'); if (!el || !PP.nav) return;
    const ord = lista(), hide = PP.nav.hidden(), H = PP.nav.heads;
    el.innerHTML = '<div class="mnl" role="list">' + ord.map((k, i) => {
      const head = H[k] !== undefined, off = hide.includes(k), fix = k === 'hoje';
      return `<div class="mni${head ? ' head' : ''}${off ? ' off' : ''}" role="listitem" draggable="true" data-mk="${k}">
        <span class="mnh" title="Arraste para mudar de lugar" aria-hidden="true">⠿</span>
        <span class="mnn">${head ? '<small>TÍTULO</small> ' : ''}${esc(PP.nav.name(k))}</span>
        <button type="button" class="btn sm" data-mup="${k}" aria-label="Subir ${esc(PP.nav.name(k))}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="btn sm" data-mdn="${k}" aria-label="Descer ${esc(PP.nav.name(k))}" ${i === ord.length - 1 ? 'disabled' : ''}>▼</button>
        <label class="mnv"><input type="checkbox" data-mvis="${k}" ${off ? '' : 'checked'} ${fix ? 'disabled' : ''}> mostrar</label>
      </div>`;
    }).join('') + '</div><div class="row" style="margin-top:12px"><button type="button" class="btn" id="menuReset">Voltar à ordem padrão</button></div>';
  }
  function mover(k, de) {
    const o = lista(), i = o.indexOf(k), j = i + de; if (i < 0 || j < 0 || j >= o.length) return;
    o.splice(i, 1); o.splice(j, 0, k); PP.nav.save(o, PP.nav.hidden());
  }
  function mudar(from, to, depois) {
    if (from === to) return; const o = lista().filter(k => k !== from), i = o.indexOf(to);
    o.splice(depois ? i + 1 : i, 0, from); PP.nav.save(o, PP.nav.hidden());
  }
  document.addEventListener('click', e => {
    const el = $('menuCfg'); if (!el || !el.contains(e.target)) return;
    const up = e.target.closest('[data-mup]'), dn = e.target.closest('[data-mdn]');
    if (up) mover(up.dataset.mup, -1); else if (dn) mover(dn.dataset.mdn, 1);
    else if (e.target.closest('#menuReset')) { PP.nav.save(PP.nav.def.slice(), []); PP.toast && PP.toast('Menu voltou à ordem padrão.'); }
  });
  document.addEventListener('change', e => {
    const c = e.target.closest && e.target.closest('[data-mvis]'); if (!c || !$('menuCfg').contains(c)) return;
    const h = PP.nav.hidden().filter(k => k !== c.dataset.mvis); if (!c.checked) h.push(c.dataset.mvis);
    PP.nav.save(lista(), h);
  });
  document.addEventListener('dragstart', e => { const it = e.target.closest && e.target.closest('.mni'); if (!it) return; drag = it.dataset.mk; it.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', drag); } catch (_) { /* ok */ } });
  document.addEventListener('dragover', e => { const it = e.target.closest && e.target.closest('.mni'); if (!it || !drag) return; e.preventDefault(); document.querySelectorAll('#menuCfg .mni').forEach(x => x.classList.remove('over', 'overb')); const r = it.getBoundingClientRect(); it.classList.add(e.clientY > r.top + r.height / 2 ? 'overb' : 'over'); });
  document.addEventListener('drop', e => { const it = e.target.closest && e.target.closest('.mni'); if (!it || !drag) return; e.preventDefault(); const r = it.getBoundingClientRect(); mudar(drag, it.dataset.mk, e.clientY > r.top + r.height / 2); drag = null; });
  document.addEventListener('dragend', () => { drag = null; document.querySelectorAll('#menuCfg .mni').forEach(x => x.classList.remove('dragging', 'over', 'overb')); });
  PP.menuCfg = { render };
  render();
})();

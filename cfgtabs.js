/* Configurações em 6 abas (em vez de tudo numa página só). Não mexe nos campos: só agrupa e mostra um grupo por vez. */
(function () {
  'use strict';
  const PP = window.PP, $ = PP.$;
  const G = [
    ['emp', 'Empresa e documentos', 'Quem emite os documentos', ['Empresa', 'Veterinária']],
    ['val', 'Valores e numeração', 'GTA, embalagem, prazo e números', ['Valores padrão', 'Numeração']],
    ['nom', 'Nomes e etiquetas', 'Como as espécies saem nos documentos', ['Nomes nos documentos', 'Nomes na notinha', 'Etiquetas', 'Programação']],
    ['stock', 'Stocklist', 'Planilha de estoque e preços', ['Stocklist']],
    ['apa', 'Aparência e assistente', 'Saudação e cardinal', ['Aparência', 'Menu lateral']],
    ['dad', 'Dados e nuvem', 'Backup, nuvem e login', ['Backup', 'Cópias', 'Nuvem']],
  ];
  const cfg = document.querySelector('#config .cfg'); if (!cfg) return;
  const blocks = [...cfg.querySelectorAll(':scope > .block')];
  const groupOf = b => { const t = ((b.querySelector('h3') || {}).textContent || '').trim(); const g = G.find(x => x[3].some(p => t.startsWith(p))); return g ? g[0] : G[G.length - 1][0]; };
  blocks.forEach(b => { b.dataset.cg = groupOf(b); });
  const nav = document.createElement('div'); nav.className = 'cnav'; nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'Seções das configurações');
  const head = document.createElement('div'); head.className = 'cphead';
  const pane = document.createElement('div'); pane.className = 'cpane';
  pane.appendChild(head); blocks.forEach(b => pane.appendChild(b));
  cfg.innerHTML = ''; cfg.classList.add('cfgtabs'); cfg.appendChild(nav); cfg.appendChild(pane);
  let cur = G[0][0];
  function show(k, focus) {
    if (!G.some(x => x[0] === k)) k = G[0][0]; cur = k;
    nav.innerHTML = G.map(g => `<button type="button" role="tab" data-cgo="${g[0]}" aria-selected="${g[0] === k}" class="${g[0] === k ? 'on' : ''}"><span><b>${g[1]}</b><small>${g[2]}</small></span></button>`).join('');
    const g = G.find(x => x[0] === k); head.innerHTML = `<h2>${g[1]}</h2><p>${g[2]}</p>`;
    blocks.forEach(b => b.classList.toggle('cgone', b.dataset.cg !== k));
    const el = $('config'); if (el) el.scrollTop = 0;
    if (focus) { const a = nav.querySelector('.on'); if (a) a.scrollIntoView({ inline: 'center', block: 'nearest' }); }
  }
  nav.addEventListener('click', e => { const b = e.target.closest('[data-cgo]'); if (b) show(b.dataset.cgo, true); });
  show(cur);
  PP.cfgTab = k => show(k, true);
})();

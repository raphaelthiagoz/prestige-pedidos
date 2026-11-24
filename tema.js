/* Prestige Pedidos — escolha de aparência: Escuro, Claro (vidro líquido) ou Automático (segue o aparelho).
   A escolha fica só neste aparelho (localStorage "pp.tema"). O index.html aplica a escolha antes de desenhar a tela, para não piscar. */
(function () {
  'use strict';
  const PP = window.PP, K = 'pp.tema';
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  const get = () => { try { const v = localStorage.getItem(K); return v === 'claro' || v === 'auto' ? v : 'escuro'; } catch (_) { return 'escuro'; } };
  const efetivo = m => (m === 'claro' || (m === 'auto' && mq && mq.matches)) ? 'light' : 'dark';
  function aplicar() {
    const m = get(), t = efetivo(m);
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', t === 'light' ? '#dfe8f1' : '#0a0e11');
    document.querySelectorAll('#temaRow [data-tema]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === m)));
  }
  function definir(m) { try { localStorage.setItem(K, m); } catch (_) { /* ok */ } aplicar(); }
  function botoes() {
    const f = document.querySelector('.sidefoot'); if (!f || document.getElementById('temaRow')) return;
    const r = document.createElement('div'); r.id = 'temaRow'; r.setAttribute('role', 'group'); r.setAttribute('aria-label', 'Aparência do sistema');
    r.innerHTML = '<span class="tmlb">Aparência</span><div class="tmbt"><button type="button" data-tema="escuro">Escuro</button><button type="button" data-tema="claro">Claro</button><button type="button" data-tema="auto" title="Segue o modo claro ou escuro do celular ou do computador">Auto</button></div>';
    r.addEventListener('click', e => { const b = e.target.closest('[data-tema]'); if (b) definir(b.dataset.tema); });
    f.insertBefore(r, f.firstChild);
  }
  if (mq) { const f = () => { if (get() === 'auto') aplicar(); }; if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f); }
  botoes(); aplicar();
  PP.tema = { get, set: definir };
})();

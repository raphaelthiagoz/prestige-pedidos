/* Prestige Pedidos — modo offline. Com internet usa sempre a versão mais nova; sem internet abre a última guardada. */
const V = 'pp-v68';
const CORE = ['./', 'index.html', 'style.css', 'theme.css', 'core.js', 'features.js', 'docs.js', 'app.js', 'cloudcfg.js', 'logo-login.png', 'extra.js', 'logos.js', 'templates.js', 'templates_exp.js', 'exportdocs.js', 'exportui.js', 'fretecore.js', 'freteui.js', 'hoje.js','hojeplus.js', 'financeiro.js', 'motion.js', 'motion.css', 'fundo.jpg', 'assist.js', 'kanban.js', 'cfgtabs.js', 'menucfg.js', 'logo-menu.png', 'mapa.js', 'nfpdf.js', 'clientes.js', 'relatorio.js', 'side.js', 'pednovo.js', 'auth.js', 'autobk.js', 'guia.js', 'topo.js', 'templates_frete.js', 'manifest.webmanifest', 'icon-192.png', 'manifest.json', 'icon-512.png',
  'vendor/exceljs.min.js', 'vendor/docx.iife.js', 'vendor/jszip.min.js', 'vendor/pdf-lib.min.js', 'vendor/logo.png', 'vendor/fonts/outfit-300.woff2', 'vendor/fonts/outfit-400.woff2', 'vendor/fonts/outfit-500.woff2', 'vendor/fonts/outfit-600.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return; // nuvem e outros: direto
  e.respondWith(fetch(r).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(V).then(ca => ca.put(r, c)); } return res; }).catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});

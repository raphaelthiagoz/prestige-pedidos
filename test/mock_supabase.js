// servidor de simulação do Supabase (PostgREST mínimo) só para testar a sincronização
const http=require('http'); const db={};
module.exports=port=>new Promise(ok=>{const s=http.createServer((q,r)=>{
  r.setHeader('Access-Control-Allow-Origin','*');r.setHeader('Access-Control-Allow-Headers','*');r.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(q.method==='OPTIONS'){r.writeHead(204);return r.end();}
  if(!q.headers.apikey){r.writeHead(401);return r.end('{}');}
  const u=new URL(q.url,'http://x');
  if(q.method==='GET'){const id=(u.searchParams.get('id')||'').replace('eq.','');r.setHeader('Content-Type','application/json');return r.end(JSON.stringify(db[id]?[db[id]]:[]));}
  let b='';q.on('data',d=>b+=d);q.on('end',()=>{const o=JSON.parse(b);db[o.id]=o;r.writeHead(201);r.end();});
}).listen(port,()=>ok({db,close:()=>s.close()}));});

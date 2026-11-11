const fs=require('fs'),path=require('path'),JSZip=require('jszip');
const E=path.join(__dirname,'exp');
const b64=f=>fs.readFileSync(path.join(E,f)).toString('base64');
const TPL={inv:b64('invoice.xlsx'),invBrl:b64('invoice_brl.xlsx'),packing:b64('packing.docx'),etiq:b64('etiquetas_full.docx'),
 sisaEU:b64('sisa_eu.docx'),sisaUS:b64('sisa_us.docx'),sisaJP:b64('sisa_jp.docx'),vigAMS:b64('vig_ams.docx'),vigUS:b64('vig_us.docx'),vigJP:b64('vig_jp.docx'),
 cziEN:b64('czi_en.docx'),cziUS:b64('czi_us.docx'),cziDE:b64('czi_de.docx'),cziJP:b64('czi_jp.docx')};
const items=JSON.parse(fs.readFileSync('/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/exp2/items.json','utf8'));
const CONS={
 MIA:{name:'RUINEMANS AQUARIUM INC',nameAt:'RUINEMANS INC',addr1:'19150 SW 248TH STREET',addr2:'HOMESTEAD = FLORIDA = USA = 33031',country:'ESTADOS UNIDOS',phone:'305-279-2349',email:'miami@ruinemans.com'},
 AMS:{name:'RUINEMANS GROUP',addr1:'IJSSELVELD 9',addr2:'3417 XH MONTFOORT - HOLLAND',phone:'+31 20 316 5090'},
};
module.exports={fs,path,JSZip,E,TPL,items,CONS,OUT:path.join(__dirname,'..','out','exp')};
const PT={'Corydoras schwartzi':'CORIDORA','Corydoras sodalis':'CORIDORA','Corydoras elegans':'CORIDORA','Brochis splendens':'CORIDORA','Dianema urostriatum':'RABO DE CHICOTE','Carnegiella strigata':'BORBOLETA LISTRADA','Hemigrammus bleheri':'RODOSTOMUS','Paracheirodon axelrodi':'CARDINAL','Paracheirodon simulans':'NEON VERDE','Otocinclus hoppei':'LIMPA VIDRO','Tucanoichthys tucano':'TUCANO'};
module.exports.PT=PT;
module.exports.mkOrder=(extra)=>Object.assign({dest:'MIA',cons:CONS.MIA,invNum:'018',ano:2026,dateISO:'2026-11-04',rate:5.4772,ex:{fee:12},items:items.map(i=>Object.assign({kg:8,pt:PT[i.sci[0].toUpperCase()+i.sci.slice(1).toLowerCase()]||i.en.toUpperCase()},i))},extra||{});

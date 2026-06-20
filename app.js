'use strict';

// ═══════════════════════════════════════════════════════════════════════
// AUTH — logins e senhas conforme solicitado
// ═══════════════════════════════════════════════════════════════════════
var USERS = {
  'gerentefrei':       {pw:'frei99',    role:'manager', loja:'frei',     label:'Frei Serafim'},
  'gerenteeliseu':     {pw:'eliseu88',  role:'manager', loja:'eliseu',   label:'Eliseu Martins'},
  'gerentepetronio':   {pw:'petronio77',role:'manager', loja:'petronio', label:'Universitária'},
  'modelopanificadora':{pw:'petro00',   role:'owner',   loja:'todas',    label:'Modelo Panificadora'},
};
var CUR = null, AUTO_T = null;

document.getElementById('l-pw').addEventListener('keydown', function(e){
  if(e.key === 'Enter') doLogin();
});
document.getElementById('l-user').addEventListener('keydown', function(e){
  if(e.key === 'Enter') document.getElementById('l-pw').focus();
});

function doLogin(){
  var u = el('l-user').value.trim().toLowerCase();
  var p = el('l-pw').value;
  if(USERS[u] && USERS[u].pw === p){
    CUR = Object.assign({}, USERS[u], {username: u});
    el('login-err').style.display = 'none';
    el('login-screen').style.display = 'none';
    el('app').style.display = 'block';
    initApp();
  } else {
    el('login-err').style.display = 'block';
    el('l-pw').value = '';
    el('l-pw').focus();
  }
}

function doLogout(){
  CUR = null;
  destroyCharts();
  el('app').style.display = 'none';
  el('login-screen').style.display = 'flex';
  el('l-user').value = '';
  el('l-pw').value = '';
  if(AUTO_T){clearInterval(AUTO_T); AUTO_T = null;}
}

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO — SheetDB + metas calculadas
// ═══════════════════════════════════════════════════════════════════════
var SHEETDB = 'https://sheetdb.io/api/v1/lk49ktwqz8hfv';

// Metas configuráveis via aba METAS na planilha (proprietário edita sem mexer no código)
// Formato da aba METAS: colunas CHAVE | VALOR | DESCRICAO
// Chaves aceitas: META_SEG, META_TER, META_QUA, META_QUI, META_SEX, META_SAB,
//                 META_MES_FREI, META_MES_ELISEU, META_MES_PETRONIO
var METAS_CONFIG = {
  dia: {SEG:16000, TER:16000, QUA:16000, QUI:16000, SEX:16000, 'SÁB':10000, DOM:0},
  mes: {frei:357103, eliseu:216871, petronio:295668}
};

// Metas calculadas: base histórica Jul-Dez/25 × (1+5%)^mês
// JAN/26 = base × 1.05¹
var ABAS = {
  frei:    {v:'VD - FREI SERAFIM',    d:'DESPESAS - FREI',          cx:'DESP CAIXA - FREI',     label:'Frei Serafim',
            metaSemFex:17000, metaSab:10000, metaDom:0,
            metaTeto:42000, metaWhats:0, metaLucro:0.22,
            meta:357103, metaDia:17000, cor:'#B8860B'},
  eliseu:  {v:'VD - ELISEU MARTINS',  d:'DESPESAS - ELISEU',        cx:'DESP CAIXA - ELISEU',   label:'Eliseu Martins',
            metaSemFex:12000, metaSab:9000,  metaDom:0,
            metaTeto:40000, metaWhats:0, metaLucro:0.21,
            meta:216871, metaDia:12000, cor:'#1E6B3A'},
  petronio:{v:'VD - PETRÔNIO PORTELA',d:'DESPESAS - UNIVERSITÁRIA', cx:'DESP CAIXA - UNIVERSITÁRIA', label:'Universitária',
            metaSemFex:12000, metaSab:9000,  metaDom:9000,
            metaTeto:20000, metaWhats:0, metaLucro:0.22,
            meta:295668, metaDia:12000, cor:'#6B1A1A'},
};

// Histórico últimos 6 meses (Jul-Dez/25) para gráfico
var HIST_PREV = {
  frei:    [369000,319000,314000,323000,279000,334000,311000,300000],
  eliseu:  [222000,191000,198000,215000,163000,188000,214000,172000],
  petronio:[262000,270000,246000,277000,278000,273000,192000,242000],
};
var HIST_LABELS = ['Jul/25','Ago/25','Set/25','Out/25','Nov/25','Dez/25','Jan/26','Fev/26'];
var HIST = {
  frei:    [388079, 336000, 330459, 340272, 293794, 351988, 327245, 315521],
  eliseu:  [234124, 201448, 208128, 226429, 171376, 197760, 224810, 180720],
  petronio:[275848, 284343, 258384, 291460, 292236, 287258, 202204, 254379],
};

var CC_COR = {
  'Insumos':'#B8860B','Pessoal':'#C47A00','Adm':'#2E6B8A','Fiscal':'#6B1A1A',
  'Imóvel':'#1E6B3A','Tecnologia':'#4A6B8B','Logística':'#2E6B3A','Marketing':'#8B4A1A','Embalagens':'#7A6B2A'
};

// Estado global
var STATE = {
  frei:    {dias:[], desp:[]},
  eliseu:  {dias:[], desp:[]},
  petronio:{dias:[], desp:[]},
};
var CHARTS = {}, FILIAL = 'frei', ORC_LOJA = 'frei';

// Orçamento estimado por loja (base real → usado quando API indisponível)
var ORC = (function(){
  var base = [
    {cc:'Pessoal',    contas:[{c:'Folha de Pagamento',orc:32700},{c:'Comissão Gerente',orc:null,formula:'5% lucro'},{c:'Saúde e Exames',orc:500},{c:'Uniformes',orc:350}]},
    {cc:'Insumos',    contas:[{c:'Matéria-Prima',orc:null,formula:'var. receita'},{c:'Gás de Cozinha',orc:840},{c:'Compras Gerais',orc:3200}]},
    {cc:'Adm',        contas:[{c:'Manutenção',orc:1200},{c:'Higiene e Limpeza',orc:600},{c:'Geral',orc:400}]},
    {cc:'Fiscal',     contas:[{c:'Simples Nacional',orc:null,formula:'8% receita'},{c:'Impostos e Taxas',orc:800}]},
    {cc:'Logística',  contas:[{c:'Combustível',orc:400},{c:'Entregas',orc:600}]},
    {cc:'Tecnologia', contas:[{c:'Telecomunicações',orc:151}]},
    {cc:'Marketing',  contas:[{c:'Digital',orc:2500},{c:'iFood (comissão)',orc:null,formula:'1% receita iFood'}]},
    {cc:'Embalagens', contas:[{c:'Descartáveis',orc:800}]},
  ];
  var mults = {frei:1, eliseu:0.61, petronio:0.83};
  var result = {};
  ['frei','eliseu','petronio'].forEach(function(l){
    var m = mults[l];
    result[l] = base.map(function(cc){
      return {cc:cc.cc, contas:cc.contas.map(function(c){
        return Object.assign({}, c, {orc:c.orc?Math.round(c.orc*m):null});
      })};
    });
  });
  return result;
})();

// Investimentos (fixos no dash — baseados na planilha)
var INVEST = [
  {loja:'Frei Serafim',   mes:'Fev/2026',cc:'Equipamentos',conta:'Aquisição',item:'Freezer Expositor Horizontal',valor:4800, cond:'3x',obs:'Substituição'},
  {loja:'Eliseu Martins', mes:'Fev/2026',cc:'Equipamentos',conta:'Aquisição',item:'Vitrine Refrigerada 120cm',    valor:6200, cond:'1x',obs:'Ampliação frios'},
  {loja:'Universitária',       mes:'Fev/2026',cc:'Equipamentos',conta:'Aquisição',item:'Forno Combinado',              valor:12500,cond:'6x',obs:'Aumento produção'},
  {loja:'Frei Serafim',   mes:'Fev/2026',cc:'Melhorias',   conta:'Reforma',  item:'Sistema de Som Ambiente',      valor:1800, cond:'1x',obs:'Experiência cliente'},
  {loja:'Eliseu Martins', mes:'Fev/2026',cc:'Segurança',   conta:'Aquisição',item:'Câmeras de Segurança (4un)',   valor:2400, cond:'2x',obs:'4 câmeras + DVR'},
  {loja:'Universitária',       mes:'Fev/2026',cc:'Equipamentos',conta:'Aquisição',item:'Balcão Refrigerado 1,5m',      valor:5500, cond:'4x',obs:'Exposição produtos'},
  {loja:'Todas',          mes:'Fev/2026',cc:'Tecnologia',  conta:'Licença',  item:'Sistema de PDV (3 lojas)',      valor:9800, cond:'12x',obs:'Licença anual'},
];

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════
function el(id){return document.getElementById(id);}
function fmt(v){return 'R$\u202F'+Math.round(Number(v)||0).toLocaleString('pt-BR');}
function fmtK(v){var n=Math.round(Number(v)||0); return n>=1000?'R$\u202F'+(n/1000).toFixed(1).replace('.',',')+'k':'R$\u202F'+n;}
var _MESES_ABR=['','JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
function dataMes(ds){
  var s=String(ds).trim(); var p=s.split(/[\/\-]/);
  if(p.length<3) return '';
  if(p[0].length===4){var yr=p[0];return(_MESES_ABR[parseInt(p[1])]||'?')+'/'+yr;} // ISO: YYYY-MM-DD
  var yr=p[2].length===2?'20'+p[2]:p[2]; // DD/MM/YY ou DD/MM/YYYY
  return(_MESES_ABR[parseInt(p[1])]||'?')+'/'+yr;
}
function normData(ds){ // garante exibição DD/MM/YYYY
  var s=String(ds).trim();
  if(/^\d{4}/.test(s)){var p=s.split(/[\/\-]/);return p[2]+'/'+p[1]+'/'+p[0];}
  return s;
}
function diaNumDe(ds){ // extrai número do dia independente do formato
  var s=String(ds).trim();
  return /^\d{4}/.test(s)?parseInt(s.substring(8,10)):parseInt(s.substring(0,2));
}
function mesLabel(m){if(!m)return 'Todos os meses';var p=m.split('/');return p[0].charAt(0)+p[0].slice(1).toLowerCase()+'/'+p[1];}
function fmtP(v){return ((Number(v)||0)*100).toFixed(1).replace('.',',')+'\u00a0%';}
function num(v){if(!v||v===''||v==='-')return 0;return parseFloat(String(v).replace(/[R$\s]/g,'').replace(/\./g,'').replace(',','.'))||0;}
function rb(pct,cor,max){max=max||100;return '<div class="rb"><div class="rbf" style="width:'+Math.min(pct,max).toFixed(1)+'%;background:'+cor+'"></div></div>';}
function pill(ok,txt){return '<span class="pill '+(ok?'pill-ok':'pill-ko')+'">'+txt+'</span>';}
function destroyCharts(){Object.keys(CHARTS).forEach(function(k){try{CHARTS[k].destroy();}catch(e){}});CHARTS={};}
function dc(id){if(CHARTS[id]){try{CHARTS[id].destroy();}catch(e){} delete CHARTS[id];}}
function gF(id){var e=el(id);return e?e.value:'';}

function getDias(loja){
  var d=STATE[loja]?STATE[loja].dias:[];
  var fm=gF('f-mes'),fd=gF('f-dia');
  if(fm) d=d.filter(function(x){return x.mes===fm;});
  if(fd) d=d.filter(function(x){return x.dia_num===parseInt(fd);});
  return d;
}
function getDesp(loja){
  var d = STATE[loja]?STATE[loja].desp:[];
  var fm = gF('f-mes');
  if(fm) d = d.filter(function(x){return x.mes===fm;});
  return d;
}

// ═══════════════════════════════════════════════════════════════════════
// DADOS DE AMOSTRA — usados quando API indisponível
// ═══════════════════════════════════════════════════════════════════════
// ── Meta por dia da semana: replica exatamente AVERAGEIF($D:$D, dia, $K:$K)
// Só chama DEPOIS que STATE[loja].dias já tem dados com receita real
function getMetaDia(loja,wd){
  var a=ABAS[loja]; if(!a) return 0;
  if(wd==='SÁB') return a.metaSab;
  if(wd==='DOM') return a.metaDom||0;
  return a.metaSemFex;
}

function getMetaMensal(loja,mesAno){
  try{var s=localStorage.getItem('mp_metas_mensais');
    var mm=s?JSON.parse(s):{};
    if(mm[loja]&&mm[loja][mesAno]) return mm[loja][mesAno];
  }catch(e){}
  return ABAS[loja]?ABAS[loja].meta:0;
}

function calcMetasDia(diasArr,loja){
  if(loja&&ABAS[loja]){
    var wds=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'],m={};
    wds.forEach(function(wd){m[wd]=getMetaDia(loja,wd);});
    return m;
  }
  var grupos={};
  diasArr.forEach(function(d){
    if(d.receita>0){if(!grupos[d.dia])grupos[d.dia]=[];grupos[d.dia].push(d.receita);}
  });
  var medias={};
  Object.keys(grupos).forEach(function(dw){
    var arr=grupos[dw];medias[dw]=arr.reduce(function(s,v){return s+v;},0)/arr.length;
  });
  return medias;
}

function getSampleDias(loja){
  var mults = {frei:1, eliseu:0.585, petronio:0.814};
  var m = mults[loja]||1;
  // Receitas reais de Fev/2026 (base Frei; escaladas para outras lojas)
  var recs = [15843,18954,16554,17341,16473,9057, 17764,17658,20414,17369,14046,5215,
              4431,0,11801,15983,17828,7951, 15676,17607,17976,20255,19577,8625];
  var dates=['02/02/2026','03/02/2026','04/02/2026','05/02/2026','06/02/2026','07/02/2026',
             '09/02/2026','10/02/2026','11/02/2026','12/02/2026','13/02/2026','14/02/2026',
             '16/02/2026','17/02/2026','18/02/2026','19/02/2026','20/02/2026','21/02/2026',
             '23/02/2026','24/02/2026','25/02/2026','26/02/2026','27/02/2026','28/02/2026'];
  var dias= ['SEG','TER','QUA','QUI','SEX','SÁB',
             'SEG','TER','QUA','QUI','SEX','SÁB',
             'SEG','TER','QUA','QUI','SEX','SÁB',
             'SEG','TER','QUA','QUI','SEX','SÁB'];

  // Primeira passagem: monta receitas sem metaDia
  var raw = dates.map(function(dt,i){
    var r = Math.round(recs[i]*m);
    return{data:dt, mes:dataMes(dt), dia:dias[i], dia_num:parseInt(dt.substring(0,2)),
      especie:Math.round(r*.08), cartao:Math.round(r*.50), pix:Math.round(r*.28),
      ifood:Math.round(r*.09), whats:Math.round(r*.05),
      despCx:Math.round(r*.04), receita:r, metaDia:0, bateu:false, fechado:r===0};
  });

  // Segunda passagem: calcula metaDia por AVERAGEIF (igual planilha)
  var medias = calcMetasDia(raw);
  return raw.map(function(d){
    var md = d.fechado ? 0 : Math.round(medias[d.dia] || 0);
    d.metaDia = md;
    d.bateu = d.receita > 0 && md > 0 && d.receita >= md;
    return d;
  });
}
function getSampleDesp(loja){
  var m={frei:1,eliseu:0.585,petronio:0.814}[loja]||1;
  var base=[
    ['FEV/2026','01/02/2026','Insumos','Matéria-Prima','T R MACEDO',319],
    ['FEV/2026','02/02/2026','Adm','Higiene e Limpeza','COMPRAS',437],
    ['FEV/2026','02/02/2026','Insumos','Matéria-Prima','FRANGOFORTE',799],
    ['FEV/2026','03/02/2026','Marketing','Digital','GESTÃO IFOOD',500],
    ['FEV/2026','03/02/2026','Marketing','Digital','GESTÃO META',1500],
    ['FEV/2026','03/02/2026','Insumos','Matéria-Prima','MOINHO PIAUÍ',1576],
    ['FEV/2026','05/02/2026','Insumos','Matéria-Prima','ART PAN',10827],
    ['FEV/2026','05/02/2026','Fiscal','Simples Nacional','SIMPLES NACIONAL',14455],
    ['FEV/2026','05/02/2026','Insumos','Gás de Cozinha','COM.GAS',840],
    ['FEV/2026','07/02/2026','Logística','Combustível','GASOLINA',194],
    ['FEV/2026','07/02/2026','Pessoal','Folha de Pagamento','FOLHA',32700],
    ['FEV/2026','07/02/2026','Imóvel','Aluguel','PROPRIETÁRIO',10000],
    ['FEV/2026','09/02/2026','Pessoal','Folha de Pagamento','LUIS GONZAGA',1500],
    ['FEV/2026','09/02/2026','Insumos','Gás de Cozinha','GÁS',1400],
    ['FEV/2026','11/02/2026','Imóvel','Água','AGUAS DE TERESINA',2621],
    ['FEV/2026','11/02/2026','Tecnologia','Telecomunicações','CLARO NET',151],
    ['FEV/2026','13/02/2026','Pessoal','Folha de Pagamento','INES SILVA',5000],
    ['FEV/2026','14/02/2026','Pessoal','Saúde e Exames','EXAME PERIÓDICO',320],
    ['FEV/2026','21/02/2026','Insumos','Matéria-Prima','G M CEARENCE',4305],
    ['FEV/2026','25/02/2026','Insumos','Matéria-Prima','KASANA',3200],
    ['FEV/2026','27/02/2026','Logística','Combustível','GASOLINA',194],
    ['FEV/2026','28/02/2026','Pessoal','Folha de Pagamento','ELINALDA',2400],
    ['FEV/2026','28/02/2026','Adm','Manutenção','ENGECOP',318],
  ];
  return base.map(function(d){
    return{mes:d[0],venc:d[1],dia_num:parseInt(d[1].substring(0,2)),
      cc:d[2],conta:d[3],forn:d[4],val:Math.round(d[5]*m)};
  });
}

// ═══════════════════════════════════════════════════════════════════════
// PARSE — Google Sheets (SheetDB)
// ═══════════════════════════════════════════════════════════════════════
function parseVendas(rows, loja){
  function gf(r,keys){
    for(var i=0;i<keys.length;i++){var v=r[keys[i]];if(v!==undefined&&v!==null&&v!=='')return v;}
    return '';
  }
  function toNum(v){
    if(typeof v==='number') return v;
    if(!v) return 0;
    return parseFloat(String(v).replace(/[R$\s.]/g,'').replace(',','.')) || 0;
  }
  function toMes(ds){
    var p=String(ds).trim().split(/[\/\-]/);
    if(p.length<3) return '';
    var mn,yr;
    if(p[0].length===4){mn=parseInt(p[1]);yr=p[0];}
    else{mn=parseInt(p[1]);yr=p[2].length===2?'20'+p[2]:p[2];}
    var ns=['','JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    return (ns[mn]||'')+'/'+yr;
  }
  var reData=/^\d{2}[\/\-]\d{2}/;
  var parsed=rows.filter(function(r){
    return reData.test(String(gf(r,['DATA'])||'').trim());
  }).map(function(r){
    var ds    = String(gf(r,['DATA'])).trim();
    var dia   = String(gf(r,['DIA'])).trim().toUpperCase();
    var despCx= toNum(gf(r,['DESP CAIXA\n(R$)','DESP CAIXA (R$)','DESP/CAIXA (R$)','DESP/CAIXA']));
    var sang  = toNum(gf(r,['SANGRIA\n(R$)','SANGRIA (R$)','SANGRIA']));
    var cart  = toNum(gf(r,['CARTÃO\n(R$)','CARTÃO (R$)','CARTAO (R$)','CARTÃO']));
    var pix   = toNum(gf(r,['PIX\n(R$)','PIX (R$)','PIX']));
    var ifood = toNum(gf(r,['IFOOD/VENDA ONLINE (R$)','IFOOD (R$)','VEND ONLINE (R$)']));
    var extras= toNum(gf(r,['VENDAS\nEXTRAS (R$)','VENDAS EXTRAS (R$)','VEND.EXTRAS (R$)']));
    var esp   = toNum(gf(r,['ESPÉCIE\n(R$)','ESPÉCIE (R$)','ESPECIE (R$)']));
    if(!esp && (despCx||sang)) esp = despCx + sang;
    var rec   = cart + pix + ifood + extras + esp;
    var totSheet = toNum(gf(r,['TOTAL\nDIA (R$)','TOTAL DIA (R$)','TOTAL DIA']));
    if(totSheet > 0) rec = totSheet;
    var metaSheet = toNum(gf(r,['META\nDIA (R$)','META DIA (R$)','META DIA']));
    var dn = parseInt(ds.split('/')[0]||'0');
    return {
      data:ds, dia:dia, dia_num:dn,
      despCx:despCx, sangria:sang,
      cartao:cart, pix:pix, ifood:ifood, extras:extras, especie:esp,
      receita:rec, metaDiaSheet:metaSheet, metaDia:0, bateu:false, fechado:rec===0,
      mes:toMes(ds)
    };
  });
  var medias=calcMetasDia(parsed,loja);
  return parsed.map(function(d){
    var md=d.metaDiaSheet>0?d.metaDiaSheet:(getMetaDia(loja,d.dia)||Math.round(medias[d.dia]||0));
    d.metaDia=md;
    d.bateu=d.receita>0&&md>0&&d.receita>=md;
    return d;
  });
}

function parseDespesas(rows){
  function gf(r,keys){
    for(var i=0;i<keys.length;i++){var v=r[keys[i]];if(v!==undefined&&v!==null&&v!=='')return v;}
    return '';
  }
  function toNum(v){
    if(typeof v==='number') return v;
    if(!v) return 0;
    return parseFloat(String(v).replace(/[R$\s.]/g,'').replace(',','.')) || 0;
  }
  function toMes(ds){
    var p=String(ds).trim().split(/[\/\-]/);
    if(p.length<3) return '';
    var mn,yr;
    if(p[0].length===4){mn=parseInt(p[1]);yr=p[0];}
    else{mn=parseInt(p[1]);yr=p[2].length===2?'20'+p[2]:p[2];}
    var ns=['','JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    return (ns[mn]||'')+'/'+yr;
  }
  var reData=/^\d{2}[\/\-]\d{2}/;
  return rows.filter(function(r){
    return reData.test(String(gf(r,['DATA'])||'').trim());
  }).map(function(r){
    var ds  =String(gf(r,['DATA'])).trim();
    var forn=gf(r,['FORNECEDOR / DESCRIÇÃO','FORNECEDOR \/ DESCRIÇÃO','FORNECEDOR / DESCRICAO','FORNECEDOR']);
    var val =toNum(gf(r,['VALOR (R$)','VALOR']));
    var tipo=String(gf(r,['TIPO'])||'').toUpperCase();
    var meta=String(gf(r,['ENTRA\nNA META?','ENTRA NA META?'])||'').toUpperCase();
    var extra=tipo==='EXTRA'||meta==='NÃO'||meta==='NAO'||meta==='NÃO';
    var cat =gf(r,['CATEGORIA']);
    var forma=gf(r,['FORMA DE\nPAGAMENTO','FORMA DE PAGAMENTO']);
    return {data:ds, mes:toMes(ds), forn:forn, val:val, cat:cat, tipo:tipo, extra:extra, forma:forma};
  }).filter(function(d){return d.val>0;});
}

function parseDespCaixa(rows){
  function toNum(v){
    if(typeof v==='number') return v;
    if(!v) return 0;
    return parseFloat(String(v).replace(/[R$\s.]/g,'').replace(',','.')) || 0;
  }
  function toMes(ds){
    var p=String(ds).trim().split(/[\/\-]/);
    if(p.length<3) return '';
    var mn,yr;
    if(p[0].length===4){mn=parseInt(p[1]);yr=p[0];}
    else{mn=parseInt(p[1]);yr=p[2].length===2?'20'+p[2]:p[2];}
    var ns=['','JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    return (ns[mn]||'')+'/'+yr;
  }
  var reData=/^\d{2}[\/\-]\d{2}/;
  return rows.filter(function(r){
    return reData.test(String(r['DATA']||'').trim());
  }).map(function(r){
    var ds=String(r['DATA']).trim();
    return {
      data:ds, mes:toMes(ds),
      forn:r['FORNECEDOR / DESCRIÇÃO']||r['FORNECEDOR']||'',
      val:toNum(r['VALOR (R$)']||r['VALOR']||0),
      extra:false
    };
  }).filter(function(d){return d.val>0;});
}

function parseMetas(rows){
  var dmap = {META_SEG:'SEG',META_TER:'TER',META_QUA:'QUA',META_QUI:'QUI',
              META_SEX:'SEX',META_SAB:'SÁB',META_DOM:'DOM'};
  rows.forEach(function(r){
    var k = String(r['CHAVE']||r['chave']||'').trim().toUpperCase();
    var v = parseFloat(String(r['VALOR']||r['valor']||'0').replace(/\./g,'').replace(',','.')) || 0;
    if(!k || !v) return;
    if(dmap[k]) METAS_CONFIG.dia[dmap[k]] = v;
    if(k==='META_MES_FREI')     { METAS_CONFIG.mes.frei = v;     ABAS.frei.meta = v; }
    if(k==='META_MES_ELISEU')   { METAS_CONFIG.mes.eliseu = v;   ABAS.eliseu.meta = v; }
    if(k==='META_MES_PETRONIO'||k==='META_MES_PET'){ METAS_CONFIG.mes.petronio = v; ABAS.petronio.meta = v; }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// API FETCH
// ═══════════════════════════════════════════════════════════════════════
function fetchSheet(sheet){
  return fetch(SHEETDB+'?sheet='+encodeURIComponent(sheet)+'&limit=1000',{cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error(r.status); return r.json();});
}

function carregarTudo(){
  var lojas=['frei','eliseu','petronio'];
  el('h-upd').textContent='Carregando...';
  // Carrega METAS primeiro para garantir valores corretos antes dos dados de venda
  fetchSheet('METAS').then(parseMetas).catch(function(){}).finally(function(){
    Promise.all(lojas.reduce(function(arr,l){
      return arr.concat([
        fetchSheet(ABAS[l].v).then(function(rows){return parseVendas(rows,l);}).catch(function(e){console.warn('[API] vendas '+l+' falhou:',e);return null;}),
        fetchSheet(ABAS[l].d).then(parseDespesas).catch(function(e){console.warn('[API] desp '+l+' falhou:',e);return null;}),
      fetchSheet(ABAS[l].cx).then(parseDespCaixa).catch(function(e){console.warn('[API] despCx '+l+' (aba: '+ABAS[l].cx+') falhou:',e);return[];}),
      ]);
    },[])).then(function(res){
      var usandoDemo = false;
      lojas.forEach(function(l,i){
        var dias  = res[i*3]&&res[i*3].length   ? res[i*3]   : null;
        var desp  = res[i*3+1]&&res[i*3+1].length ? res[i*3+1] : [];
        var despCx= res[i*3+2]&&res[i*3+2].length ? res[i*3+2] : [];
        if(!dias){usandoDemo=true; console.warn('[Dashboard] '+l+': sem dados de vendas – usando amostra');}
        else console.log('[Dashboard] '+l+': '+dias.length+' dias carregados, meses:',
          [...new Set(dias.map(function(d){return d.mes;}))].join(', '));
        STATE[l].dias   = dias || getSampleDias(l);
        STATE[l].desp   = desp || getSampleDesp(l);
        STATE[l].despCx = despCx || [];
      });
      var badge = el('h-badge');
      if(usandoDemo && badge && !badge.textContent.includes('meta')){
        badge.textContent='⚠ Dados de amostra'; badge.className='badge b-ko';
      }
    }).catch(function(e){
      console.error('[Dashboard] Erro geral:',e);
      lojas.forEach(function(l){STATE[l].dias=getSampleDias(l);STATE[l].desp=getSampleDesp(l);});
    }).finally(function(){
      var now=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      el('h-upd').textContent='Atualizado às '+now;
      atualizarFiltroAno();
      atualizarFiltroMes();
      var fMes=el('f-mes');
    if(fMes&&typeof buildMesOpts==='function'){
      var cur=fMes.value;
      fMes.innerHTML='<option value="">Todos os meses</option>'+buildMesOpts();
      if(!Array.from(fMes.options).some(function(o){return o.value===cur;})){
        if(fMes.options.length>1)fMes.selectedIndex=fMes.options.length-1;
      }else{fMes.value=cur;}
    }
    if(fMes&&!fMes.value){
      var _d=new Date();
      var _mesAtual=_MESES_ABR[_d.getMonth()+1]+'/'+_d.getFullYear();
      if(Array.from(fMes.options).some(function(o){return o.value===_mesAtual;})){
        fMes.value=_mesAtual;
      }else if(fMes.options.length>1){
        fMes.selectedIndex=fMes.options.length-1;
      }
    }
    renderAll();
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// INIT APP
// ═══════════════════════════════════════════════════════════════════════
function initApp(){
  el('h-name').textContent = CUR.label;
  el('h-role').textContent = CUR.role==='owner'
    ? 'Proprietário · Acesso Total'
    : 'Gerente · '+CUR.label;

  if(CUR.role==='manager') FILIAL = CUR.loja;
  else FILIAL = 'frei';

  buildTabs();
  buildFilters();
  buildPanes();
  carregarTudo();

  if(AUTO_T) clearInterval(AUTO_T);
  AUTO_T = setInterval(carregarTudo, 43200000); // 2x por dia = a cada 12h (~240 req/mês no SheetDB)
}

function buildTabs(){
  var isOwner = CUR.role === 'owner';
  var html = '';
  if(isOwner){
    html = '<button class="tab act" onclick="showTab(\'consolidado\',this)">📊 Consolidado</button>'
      +'<button class="tab" onclick="showTab(\'vendas\',this)">📈 Vendas</button>'
      +'<button class="tab" onclick="showTab(\'despesas\',this)">💸 Despesas</button>'
      +'<button class="tab" onclick="showTab(\'orcamento\',this)">🎯 Orçamento</button>'
      +'<button class="tab" onclick="showTab(\'investimentos\',this)">🔧 Despesas Extras</button>'
      +'<button class="tab" onclick="showTab(\'dre\',this)">📋 DRE</button>';
  } else {
    html = '<button class="tab act" onclick="showTab(\'vendas\',this)">📈 Vendas & Meta</button>';
  }
  el('tab-bar').innerHTML = html;
}

function atualizarFiltroAno(){
  var sel = el('f-ano'); if(!sel) return;
  var cur = sel.value;
  var set = {};
  ['frei','eliseu','petronio'].forEach(function(l){
    (STATE[l].dias||[]).forEach(function(d){if(d.mes) set[d.mes.split('/')[1]]=true;});
    (STATE[l].desp||[]).forEach(function(d){if(d.mes) set[d.mes.split('/')[1]]=true;});
  });
  var sorted = Object.keys(set).sort();
  sel.innerHTML = '<option value="">Todos os anos</option>'
    +sorted.map(function(a){return '<option value="'+a+'"'+(a===cur?' selected':'')+'>'+a+'</option>';}).join('');
}

function atualizarFiltroMes(){
  var sel = el('f-mes'); if(!sel) return;
  var cur = sel.value;
  var fa = gF('f-ano');
  var set = {};
  ['frei','eliseu','petronio'].forEach(function(l){
    (STATE[l].dias||[]).forEach(function(d){if(d.mes && (!fa || d.mes.split('/')[1]===fa)) set[d.mes]=true;});
    (STATE[l].desp||[]).forEach(function(d){if(d.mes && (!fa || d.mes.split('/')[1]===fa)) set[d.mes]=true;});
  });
  var sorted = Object.keys(set).sort(function(a,b){
    var pa=a.split('/'),pb=b.split('/');
    var dy=parseInt(pa[1])-parseInt(pb[1]);
    return dy!==0?dy:_MESES_ABR.indexOf(pa[0])-_MESES_ABR.indexOf(pb[0]);
  });
  sel.innerHTML = '<option value="">Todos os meses</option>'
    +sorted.map(function(m){return '<option value="'+m+'"'+(m===cur?' selected':'')+'>'+mesLabel(m)+'</option>';}).join('');
}

function trocarAno(){
  el('f-mes').value=''; // ano mudou: reseta o mês selecionado
  atualizarFiltroMes();
  renderAll();
}

function buildMesOpts(){
  var ORDEM={JAN:1,FEV:2,MAR:3,ABR:4,MAI:5,JUN:6,JUL:7,AGO:8,SET:9,OUT:10,NOV:11,DEZ:12};
  var meses={};
  ['frei','eliseu','petronio'].forEach(function(l){
    (STATE[l]?STATE[l].dias:[]).forEach(function(d){if(d.mes)meses[d.mes]=true;});
  });
  return Object.keys(meses).sort(function(a,b){
    var pa=a.split('/'),pb=b.split('/');
    var ya=parseInt(pa[1]||0),yb=parseInt(pb[1]||0);
    if(ya!==yb)return ya-yb;
    return(ORDEM[pa[0]]||0)-(ORDEM[pb[0]]||0);
  }).map(function(m){
    var p=m.split('/');
    return '<option value="'+m+'">'+p[0].charAt(0)+p[0].slice(1,3).toLowerCase()+'/'+p[1]+'</option>';
  }).join('');
}

function buildFilters(){
  var isOwner = CUR.role === 'owner';
  var diasOpts = '<option value="">Todos os dias</option>';
  for(var i=1;i<=31;i++) diasOpts += '<option value="'+i+'">'+i+'</option>';
  var anoOpts = '<option value="">Carregando...</option>';
  var mesOpts = '<option value="">Carregando...</option>';

  var html = '';
  if(isOwner){
    html += '<span class="flbl">Filial:</span><select id="f-filial" onchange="trocarFilial(this.value)">'
      +'<option value="frei">Frei Serafim</option>'
      +'<option value="eliseu">Eliseu Martins</option>'
      +'<option value="petronio">Universitária</option>'
      +'</select>';
  }
  html += '<span class="flbl">Ano:</span><select id="f-ano" onchange="trocarAno()">'+anoOpts+'</select>';
  html += '<span class="flbl">Mês:</span><select id="f-mes" onchange="renderAll()">'+mesOpts+'</select>';
  html += '<span class="flbl">Dia:</span><select id="f-dia" onchange="renderAll()">'+diasOpts+'</select>';
  html += '<button class="refresh-btn" onclick="carregarTudo()">↻ Atualizar</button>';
  el('filter-bar').innerHTML = html;
}

function buildPanes(){
  var isOwner = CUR.role === 'owner';
  var h = '';
  if(isOwner){
    h += '<div id="pane-consolidado" class="pane act"><div class="main" id="m-consolidado"></div></div>';
  }
  h += '<div id="pane-vendas" class="pane'+(isOwner?'':' act')+'"><div class="main" id="m-vendas"></div></div>';
  if(isOwner){
    h += '<div id="pane-despesas" class="pane"><div class="main" id="m-despesas"></div></div>';
    h += '<div id="pane-orcamento" class="pane"><div class="main" id="m-orcamento"></div></div>';
    h += '<div id="pane-investimentos" class="pane"><div class="main" id="m-investimentos"></div></div>';
    h += '<div id="pane-dre" class="pane"><div class="main" id="m-dre"></div></div>';
  }
  el('pane-container').innerHTML = h;
}

function showTab(id, btn){
  document.querySelectorAll('.pane').forEach(function(p){p.classList.remove('act');});
  document.querySelectorAll('.tab').forEach(function(b){b.classList.remove('act');});
  var p = el('pane-'+id); if(p) p.classList.add('act');
  if(btn) btn.classList.add('act');
  renderAll();
}

function trocarFilial(f){FILIAL=f; renderAll();}

function renderAll(){
  renderVendas();
  if(CUR && CUR.role==='owner'){
    renderConsolidado();
    renderDespesas();
    renderOrcamento();
    renderInvestimentos();
    renderDRE();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER VENDAS — gerente vê só sua loja; proprietário vê via filtro
// ═══════════════════════════════════════════════════════════════════════
function calcLucro(loja, diasArr){
  var a=ABAS[loja];
  var desp  =(STATE[loja]?STATE[loja].desp  :[]).filter(function(d){return !d.extra;});
  var despCx=(STATE[loja]?STATE[loja].despCx:[]);
  var fm=gF('f-mes');
  if(fm){
    desp  =desp.filter(function(d){return d.mes===fm;});
    despCx=despCx.filter(function(d){return d.mes===fm;});
  }
  var totVenda =diasArr.reduce(function(s,d){return s+(d.receita||0);},0);
  var totExtras=diasArr.reduce(function(s,d){return s+(d.extras||0);},0);
  var totDesp  =desp.reduce(function(s,d){return s+(d.val||0);},0);
  var totDespCx=despCx.reduce(function(s,d){return s+(d.val||0);},0)
               +diasArr.reduce(function(s,d){return s+(d.despCx||0);},0);
  var receita  =totVenda+totExtras;
  var lucro    =receita-totDesp-totDespCx;
  var pctLucro =receita>0?lucro/receita:0;
  var diasOp   =diasArr.filter(function(d){return !d.fechado;}).length;
  var projecao =diasOp>0?(receita/diasOp)*26:0;
  var lucroProj=projecao-(totDesp+totDespCx);
  var pctProj  =projecao>0?lucroProj/projecao:0;
  var teto=a.metaTeto||0;
  var pctTeto=teto>0?totDespCx/teto:0;
  return{
    receita:receita,lucro:lucro,pctLucro:pctLucro,
    metaLucro:a.metaLucro||0,
    projecao:projecao,pctProj:pctProj,lucroProj:lucroProj,
    totDespCx:totDespCx,teto:teto,pctTeto:pctTeto,
    bateuLucro:pctLucro>=(a.metaLucro||0)
  };
}

function fmtPct2(v){return((v||0)*100).toFixed(1).replace('.',',')+' %';}

function renderVendas(){
  var loja = FILIAL;
  var rawDias = STATE[loja]?STATE[loja].dias:[];
  var ev = el('m-vendas'); if(!ev) return;
  if(!rawDias.length){ev.innerHTML='<div class="loading"><div class="spin"></div><div>Carregando dados...</div></div>';return;}

  var allDias = getDias(loja); // já respeita os filtros de Ano/Mês/Dia selecionados
  if(!allDias.length){ev.innerHTML='<div class="loading"><div>Nenhum dado para o período selecionado.</div></div>';return;}

  var diasOp = allDias.filter(function(d){return !d.fechado;});

  var totR=0,totE=0,totC=0,totP=0,totI=0,totW=0,totDC=0;
  diasOp.forEach(function(d){totR+=d.receita;totE+=d.especie;totC+=d.cartao;totP+=d.pix;totI+=d.ifood;totW+=d.whats;totDC+=d.despCx;});

  var nOk = diasOp.filter(function(d){return d.bateu;}).length;
  var metaM = ABAS[loja].meta;
  var pct = metaM>0 ? totR/metaM : 0;
  var ticket = diasOp.length ? totR/diasOp.length : 0;
  var cor = ABAS[loja].cor;

  el('h-badge').textContent = ABAS[loja].label+' · '+fmtP(pct)+' meta';
  el('h-badge').className = 'badge '+(pct>=1?'b-ok':'b-gold');
  el('h-period').textContent = gF('f-mes') ? mesLabel(gF('f-mes')) : (gF('f-ano') || (allDias.length ? dataMes(allDias[0].data)+' – '+dataMes(allDias[allDias.length-1].data) : '—'));

  var canais = [
    {l:'Espécie',v:totE,c:'#8B6200'},
    {l:'Cartão',v:totC,c:cor},
    {l:'PIX',v:totP,c:'#1E6B3A'},
    {l:'iFood',v:totI,c:'#C62828'},
    {l:'WhatsApp',v:totW,c:'#0A7040'},
  ].filter(function(x){return x.v>0;});

  var canaisHtml = canais.map(function(c){
    var w = totR>0?((c.v/totR)*100).toFixed(1):0;
    return '<div class="canal-row"><div class="canal-name">'+c.l+'</div>'
      +'<div class="canal-track"><div class="canal-fill" style="width:'+w+'%;background:'+c.c+'">'
      +'<span>'+fmtP(c.v/(totR||1))+'</span></div></div>'
      +'<div class="canal-val">'+fmt(c.v)+'</div></div>';
  }).join('');

  var topDias = [].concat(diasOp).sort(function(a,b){return b.receita-a.receita;}).slice(0,7)
    .map(function(d,i){
      return '<tr><td style="color:var(--tx3);font-size:9px">'+(i+1)+'</td>'
        +'<td class="tdn">'+d.data.substring(0,5)+'</td>'
        +'<td style="color:var(--tx3)">'+d.dia+'</td>'
        +'<td class="tdv">'+fmt(d.receita)+'</td>'
        +'<td class="tdr">'+pill(d.bateu,(d.bateu?'✓ Meta':'✗'))+'</td></tr>';
    }).join('');

  var lucroColH = CUR.role==='owner'?'<th class="tdr">Lucro</th>':'';
  var diarioRows = allDias.map(function(d){
    var l = d.receita - d.despCx;
    var lucroTd = CUR.role==='owner'?'<td class="tdv" style="color:'+(l>=0?'var(--grn)':'var(--red)')+'">'+( d.fechado?'—':fmt(l))+'</td>':'';
    return '<tr style="'+(d.fechado?'opacity:.4':'')+'"><td class="tdn">'+d.data.substring(0,5)+'</td>'
      +'<td style="color:var(--tx3)">'+d.dia+'</td>'
      +'<td>'+( d.fechado?'<span style="font-size:9px;color:var(--tx3)">FECHADO</span>':pill(d.bateu,d.bateu?'✓':'✗'))+'</td>'
      +'<td class="tdv">'+(d.fechado?'—':fmt(d.receita))+'</td>'
      +'<td class="tdv">'+(d.fechado?'—':fmt(d.especie))+'</td>'
      +'<td class="tdv">'+(d.fechado?'—':fmt(d.cartao))+'</td>'
      +'<td class="tdv">'+(d.fechado?'—':fmt(d.pix))+'</td>'
      +'<td class="tdv">'+(d.fechado?'—':fmt(d.ifood))+'</td>'
      +'<td class="tdv">'+(d.fechado?'—':fmt(d.whats))+'</td>'
      +lucroTd
      +'<td class="tdr" style="color:'+(d.bateu?'var(--grn)':d.fechado?'var(--tx3)':'var(--red)')+'">'+( d.fechado?'—':fmtP(d.receita/(d.metaDia||1)))+'</td></tr>';
  }).join('');

  var diasOpArr=diasOp.filter?diasOp:diasFiltrados.filter(function(d){return !d.fechado;});
  var L=calcLucro(loja,diasOpArr);
  var lucroKpi=CUR.role==='owner'?(
    '<div class="kpi" style="--kt:'+(L.bateuLucro?'var(--grn)':'var(--red)')+'">'
    +'<div class="kpi-label">% Lucro do Mês</div>'
    +'<div class="kpi-val" style="color:'+(L.bateuLucro?'var(--grn)':'var(--red)')+'">'+fmtP(L.pctLucro)+'</div>'
    +'<div class="kpi-sub">Meta: '+fmtP(L.metaLucro)+' · '+(L.bateuLucro?'✓ Atingida':'✗ Abaixo')+'</div></div>'
    +'<div class="kpi" style="--kt:var(--blu)">'
    +'<div class="kpi-label">Projeção Fechamento</div>'
    +'<div class="kpi-val" style="color:var(--blu)">'+fmtP(L.pctProj)+'</div>'
    +'<div class="kpi-sub">Se fechar hoje: '+fmt(L.lucroProj)+'</div></div>'
    +'<div class="kpi" style="--kt:'+(L.pctTeto>=1?'var(--red)':L.pctTeto>=0.8?'var(--amb)':'var(--grn)')+'">'
    +'<div class="kpi-label">Desp. Caixa / Teto</div>'
    +'<div class="kpi-val" style="color:'+(L.pctTeto>=1?'var(--red)':L.pctTeto>=0.8?'var(--amb)':'var(--grn)')+'">'+fmtP(L.pctTeto)+'</div>'
    +'<div class="kpi-sub">'+fmt(L.totDespCx)+' de '+fmt(L.teto)+'</div></div>'
  ):'';

  // ── Meta cards: dia / semana / mês ──────────────────────────────────
  var dwNames = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
  var dwFull  = {DOM:'Domingo',SEG:'Segunda-feira',TER:'Terça-feira',QUA:'Quarta-feira',QUI:'Quinta-feira',SEX:'Sexta-feira','SÁB':'Sábado'};
  var todayDW  = dwNames[new Date().getDay()];
  var metaHoje = getMetaDia(loja, todayDW);
  var metaSemana = ['SEG','TER','QUA','QUI','SEX'].reduce(function(s,d){return s+getMetaDia(loja,d);},0)
                 + getMetaDia(loja,'SÁB');
  var metaCards = ''
    +'<div class="meta-card" style="--mc:var(--amb)">'
      +'<div class="meta-card-label">Meta do Dia</div>'
      +'<div class="meta-card-val">'+fmt(metaHoje)+'</div>'
      +'<div class="meta-card-sub">Hoje: <strong>'+dwFull[todayDW]+'</strong></div>'
      +'<div style="font-size:9px;color:var(--tx4);margin-top:6px">Seg–Sex: '+fmt(getMetaDia(loja,'SEG'))+' &nbsp;·&nbsp; Sáb: '+fmt(getMetaDia(loja,'SÁB'))+'</div>'
    +'</div>'
    +'<div class="meta-card" style="--mc:var(--blu)">'
      +'<div class="meta-card-label">Meta Semanal</div>'
      +'<div class="meta-card-val">'+fmt(metaSemana)+'</div>'
      +'<div class="meta-card-sub">5 dias úteis + 1 sábado</div>'
      +'<div style="font-size:9px;color:var(--tx4);margin-top:6px">'+fmt(getMetaDia(loja,'SEG'))+' × 5 + '+fmt(getMetaDia(loja,'SÁB'))+' × 1</div>'
    +'</div>'
    +'<div class="meta-card" style="--mc:'+(pct>=1?'var(--grn)':'var(--red)')+'">'
      +'<div class="meta-card-label">Meta do Mês</div>'
      +'<div class="meta-card-val">'+fmt(metaM)+'</div>'
      +'<div class="meta-card-sub" style="color:'+(pct>=1?'var(--grn)':'var(--red)')+'"><strong>'+fmtP(pct)+'</strong> atingido · '+fmt(totR)+' realizado</div>'
      +'<div style="margin-top:7px">'+rb(Math.min(pct*100,100),(pct>=1?'var(--grn)':'var(--amb)'))+'</div>'
    +'</div>';

  // ── Bloco de indicadores: ranking entre lojas (só proprietário) ──────
  var rankHtml = '';
  if(CUR.role==='owner'){
    var lojas3=['frei','eliseu','petronio'];
    var rankData = lojas3.map(function(l){
      var d=getDias(l).filter(function(x){return !x.fechado;});
      var rec=d.reduce(function(s,x){return s+x.receita;},0);
      var ok=d.filter(function(x){return x.bateu;}).length;
      return{l:l, rec:rec, ok:ok, n:d.length, pct:ABAS[l].meta?rec/ABAS[l].meta:0};
    }).sort(function(a,b){return b.pct-a.pct;});

    var medals=['🥇','🥈','🥉'];
    var rankRows = rankData.map(function(r,i){
      var destaque = r.l===loja ? ';border:1px solid '+ABAS[r.l].cor+';background:'+ABAS[r.l].cor+'0A' : '';
      return '<div class="rank-item" style="'+destaque+'">'
        +'<span style="font-size:16px;width:22px;text-align:center;flex-shrink:0">'+medals[i]+'</span>'
        +'<div class="rank-name">'+ABAS[r.l].label+'</div>'
        +'<div style="flex:2;margin:0 8px">'+rb(Math.min(r.pct*100,100),(r.pct>=1?'var(--grn)':'var(--amb)'))+'</div>'
        +'<div class="rank-pct" style="color:'+(r.pct>=1?'var(--grn)':'var(--red)')+'">'+fmtP(r.pct)+'</div>'
        +'<div class="rank-dias">'+r.ok+'/'+r.n+' dias</div>'
        +'</div>';
    }).join('');

    var posMes = rankData.findIndex(function(r){return r.l===loja;})+1;
    var diasConjunto = rankData.reduce(function(s,r){return s+r.ok;},0)+'/'+rankData.reduce(function(s,r){return s+r.n;},0);
    rankHtml = ''
      +'<div class="sec-hdr">Indicadores · Ranking entre Filiais</div>'
      +'<div class="g32">'
        +'<div class="card"><div class="card-title">Ranking por % Meta Mensal <span>todas as filiais</span></div>'
          +'<div class="rank-block">'+rankRows+'</div>'
        +'</div>'
        +'<div class="card"><div class="card-title">Resumo de Atingimento</div>'
          +'<div class="kpi-grid" style="grid-template-columns:1fr 1fr;gap:8px">'
            +'<div class="kpi" style="--kt:var(--amb)"><div class="kpi-label">Posição da Filial</div>'
              +'<div class="kpi-val">'+posMes+'º<span style="font-size:13px;color:var(--tx3)">/3</span></div>'
              +'<div class="kpi-sub">'+ABAS[loja].label+'</div></div>'
            +'<div class="kpi" style="--kt:var(--brd2)"><div class="kpi-label">Dias c/ Meta (rede)</div>'
              +'<div class="kpi-val" style="font-size:18px">'+diasConjunto+'</div>'
              +'<div class="kpi-sub">3 filiais consolidado</div></div>'
            +'<div class="kpi" style="--kt:'+(nOk/diasOp.length>=.5?'var(--grn)':'var(--red)')+'"><div class="kpi-label">% Dias c/ Meta</div>'
              +'<div class="kpi-val" style="color:'+(nOk/diasOp.length>=.5?'var(--grn)':'var(--red)')+'">'+fmtP(diasOp.length?nOk/diasOp.length:0)+'</div>'
              +'<div class="kpi-sub">'+nOk+' de '+diasOp.length+' dias</div></div>'
            +'<div class="kpi" style="--kt:var(--g2)"><div class="kpi-label">Dias c/ Meta (filial)</div>'
              +'<div class="kpi-val">'+nOk+'<span style="font-size:14px;color:var(--tx3)">/'+diasOp.length+'</span></div>'
              +'<div class="kpi-sub">'+ABAS[loja].label+'</div></div>'
          +'</div>'
        +'</div>'
      +'</div>';
  }

  ev.innerHTML = ''
    +'<div class="insight"><div class="insight-label">💡 Análise do Período</div>'
    +'<div class="insight-body">Faturamento <strong>'+fmt(totR)+'</strong> · <strong>'+nOk+'/'+diasOp.length+'</strong> dias com meta atingida · '
    +'% meta mensal: <strong style="color:'+(pct>=1?'var(--grn)':'var(--red)')+'">'+fmtP(pct)+'</strong> · '
    +'Ticket médio/dia: <strong>'+fmt(ticket)+'</strong></div></div>'

    +'<div class="sec-hdr">Metas de Referência</div>'
    +'<div class="meta-card-grid">'+metaCards+'</div>'

    +'<div class="sec-hdr">Indicadores do Mês</div>'
    +'<div class="kpi-grid" style="grid-template-columns:repeat('+(CUR.role==='owner'?6:3)+',1fr)">'
    +'<div class="kpi" style="--kt:var(--g2)"><div class="kpi-label">Faturamento</div><div class="kpi-val">'+fmt(totR)+'</div><div class="kpi-sub">Meta: '+fmt(metaM)+'</div></div>'
    +'<div class="kpi" style="--kt:'+(pct>=1?'var(--grn)':'var(--red)')+'"><div class="kpi-label">% Meta Mensal</div><div class="kpi-val" style="color:'+(pct>=1?'var(--grn)':'var(--red)')+'">'+fmtP(pct)+'</div><div class="kpi-sub">'+nOk+'/'+diasOp.length+' dias ✓</div></div>'
    +lucroKpi
    +'<div class="kpi" style="--kt:var(--brd2)"><div class="kpi-label">Dias c/ Meta</div><div class="kpi-val">'+nOk+'<span style="font-size:14px;color:var(--tx3)">/'+diasOp.length+'</span></div><div class="kpi-sub">'+fmtP(diasOp.length?nOk/diasOp.length:0)+' de aproveitamento</div></div>'
    +'</div>'

    +(CUR.role==='owner'&&L&&L.teto>0?(
    '<div class="sec-hdr">Acompanhamento — Despesa de Caixa</div>'
    +'<div class="card">'
    +'<div class="card-title">Despesa de Caixa vs Teto Mensal <span>'+ABAS[loja].label+'</span></div>'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">'
    +'<div style="flex:1"><div class="rb"><div class="rbf" style="width:'+Math.min(L.pctTeto*100,100).toFixed(1)+'%;background:'+(L.pctTeto>=1?'var(--red)':L.pctTeto>=0.8?'var(--amb)':'var(--grn)')+'"></div></div></div>'
    +'<div style="font-size:13px;font-weight:700;color:'+(L.pctTeto>=1?'var(--red)':L.pctTeto>=0.8?'var(--amb)':'var(--grn)')+'">'+fmtP(L.pctTeto)+'</div>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tx3)">'
    +'<span>Realizado: <strong style="color:var(--tx)">'+fmt(L.totDespCx)+'</strong></span>'
    +'<span>Teto: <strong style="color:var(--tx)">'+fmt(L.teto)+'</strong></span>'
    +'<span>Saldo: <strong style="color:'+(L.teto-L.totDespCx>=0?'var(--grn)':'var(--red)')+'">'+fmt(L.teto-L.totDespCx)+'</strong></span>'
    +'</div>'
    +(L.pctTeto>=0.8?'<div style="margin-top:10px;padding:8px 12px;background:#FEF3DC;border-radius:8px;font-size:11px;color:#7A4A00">⚠ Atenção: despesa de caixa atingiu '+fmtP(L.pctTeto)+' do teto mensal.</div>':'')
    +'</div>'
  ):'')
  
    +'<div class="sec-hdr">Análise de Vendas</div>'
    +'<div class="g32">'
    +'<div class="card"><div class="card-title">Receita Diária vs Meta <span>'+allDias[0].data.substring(0,5)+'–'+allDias[allDias.length-1].data.substring(0,5)+'</span></div>'
    +'<div class="legend"><span class="li"><span class="ld" style="background:var(--grn)"></span>Bateu meta</span>'
    +'<span class="li"><span class="ld" style="background:'+cor+'"></span>Abaixo</span>'
    +'<span class="li"><span class="ld" style="background:var(--red);border-radius:0;height:3px;width:16px"></span>Linha meta</span></div>'
    +'<div style="position:relative;height:200px"><canvas id="cv-d"></canvas></div></div>'
    +'<div class="card"><div class="card-title">Mix de Canais</div>'+canaisHtml
    +'<div style="padding-top:8px;border-top:1px solid var(--brd);font-size:10px;color:var(--tx3)">Total: '+fmt(totR)+'</div></div>'
    +'</div>'

    +'<div class="g2">'
    +'<div class="card"><div class="card-title">Top 7 Dias por Receita</div><div class="tw"><table><thead><tr><th>#</th><th>Data</th><th>Dia</th><th class="tdr">Receita</th><th class="tdr">Status</th></tr></thead><tbody>'+topDias+'</tbody></table></div></div>'
    +'<div class="card"><div class="card-title">Histórico 8 Meses</div><div style="position:relative;height:185px"><canvas id="cv-hist"></canvas></div></div>'
    +'</div>'

    +rankHtml

    +'<div class="sec-hdr">Diário de Vendas</div>'
    +'<div class="twx"><table><thead><tr><th>Data</th><th>Dia</th><th>Meta</th><th class="tdr">Receita</th><th class="tdr">Espécie</th><th class="tdr">Cartão</th><th class="tdr">PIX</th><th class="tdr">iFood</th><th class="tdr">WhatsApp</th>'
    +(CUR.role==='owner'?'<th class="tdr">Lucro</th>':'')
    +'<th class="tdr">% Meta</th></tr></thead>'
    +'<tbody>'+diarioRows
    +'<tr style="background:#FDF6E8;font-weight:700"><td colspan="3">TOTAL</td>'
    +'<td class="tdv">'+fmt(totR)+'</td><td class="tdv">'+fmt(totE)+'</td><td class="tdv">'+fmt(totC)+'</td>'
    +'<td class="tdv">'+fmt(totP)+'</td><td class="tdv">'+fmt(totI)+'</td><td class="tdv">'+fmt(totW)+'</td>'
    +(CUR.role==='owner'?'<td class="tdv" style="color:var(--grn)">'+fmt(totR-totDC)+'</td>':'')
    +'<td class="tdr">'+fmtP(pct)+'</td></tr>'
    +'</tbody></table></div>';

  // Gráfico diário
  dc('cv-d');
  CHARTS['cv-d'] = new Chart(el('cv-d'),{
    type:'bar',
    data:{
      labels:allDias.map(function(d){return d.data.substring(0,5);}),
      datasets:[
        {label:'Receita',data:allDias.map(function(d){return d.receita||0;}),
         backgroundColor:allDias.map(function(d){return d.fechado?'rgba(180,180,180,.2)':d.bateu?'rgba(30,107,58,.7)':'rgba(184,134,11,.65)';}),
         borderColor:allDias.map(function(d){return d.fechado?'#bbb':d.bateu?'#1E6B3A':'#B8860B';}),
         borderWidth:1,borderRadius:3},
        {label:'Meta',data:allDias.map(function(d){return d.metaDia;}),type:'line',
         borderColor:'#9B2020',borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false,tension:0}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return ' '+c.dataset.label+': '+fmt(c.parsed.y);}}}},
      scales:{
        x:{ticks:{color:'#9B7A3A',font:{size:9},maxRotation:45,autoSkip:false},grid:{display:false}},
        y:{ticks:{color:'#9B7A3A',font:{size:9},callback:function(v){return 'R$'+(v/1000).toFixed(0)+'k';}},grid:{color:'rgba(184,134,11,.07)'}}
      }
    }
  });

  // Gráfico histórico
  dc('cv-hist');
  CHARTS['cv-hist'] = new Chart(el('cv-hist'),{
    type:'bar',
    data:{
      labels:HIST_LABELS,
      datasets:[{
        label:ABAS[loja].label,
        data:HIST[loja],
        backgroundColor:cor+'88',
        borderColor:cor,
        borderWidth:1,borderRadius:3
      }]
    },
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return ' '+fmt(c.parsed.y);}}}},
      scales:{
        x:{ticks:{color:'#9B7A3A',font:{size:9}},grid:{display:false}},
        y:{ticks:{color:'#9B7A3A',font:{size:9},callback:function(v){return 'R$'+(v/1000).toFixed(0)+'k';}},grid:{color:'rgba(184,134,11,.07)'}}
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER CONSOLIDADO — só proprietário
// ═══════════════════════════════════════════════════════════════════════
function renderConsolidado(){
  var ev = el('m-consolidado'); if(!ev) return;
  var lojas = ['frei','eliseu','petronio'];
  var T = {};
  lojas.forEach(function(l){
    var d = getDias(l).filter(function(d){return !d.fechado;});
    T[l] = {rec:0, desp:0, nOk:0, nDias:d.length, meta:ABAS[l].meta};
    d.forEach(function(x){T[l].rec+=x.receita; T[l].desp+=x.despCx; if(x.bateu)T[l].nOk++;});
    T[l].lucro = T[l].rec - T[l].desp;
    T[l].pct = T[l].meta>0?T[l].rec/T[l].meta:0;
    T[l].marg = T[l].rec>0?T[l].lucro/T[l].rec:0;
  });
  var sR=0,sL=0,sD=0,sM=0,sOk=0,sDias=0;
  lojas.forEach(function(l){sR+=T[l].rec;sL+=T[l].lucro;sD+=T[l].desp;sM+=T[l].meta;sOk+=T[l].nOk;sDias+=T[l].nDias;});

  var lojaCards=lojas.map(function(l){
    var Ll=calcLucro(l,getDias(l).filter(function(d){return !d.fechado;}));
    var mL=ABAS[l].metaLucro||0;
    return '<div class="loja-card" style="--kt:'+ABAS[l].cor+'">'
      +'<div class="loja-name" style="color:'+ABAS[l].cor+'">'+ABAS[l].label+'</div>'
      +'<div class="loja-val">'+fmt(T[l].rec)+'</div>'
      +'<div class="meta-bar"><div class="meta-fill" style="width:'+Math.min(T[l].pctMeta*100,100).toFixed(1)+'%;background:'+ABAS[l].cor+'"></div></div>'
      +'<div style="font-size:9px;color:var(--tx3)">'+fmtP(T[l].pctMeta)+' da meta · '+T[l].nOk+'/'+T[l].nDias+' dias ✓</div>'
      +'<div style="font-size:10px;margin-top:6px;display:flex;gap:10px">'
      +'<span>% Lucro: <strong style="color:'+(Ll.pctLucro>=mL?'var(--grn)':'var(--red)')+'">'+fmtP(Ll.pctLucro)+'</strong></span>'
      +'<span>Meta: <strong>'+fmtP(mL)+'</strong></span>'
      +'</div>'
      +'<div style="font-size:10px;margin-top:3px;display:flex;gap:10px">'
      +'<span>Desp.Cx: <strong>'+fmt(Ll.totDespCx)+'</strong></span>'
      +'<span style="color:'+(Ll.pctTeto>=1?'var(--red)':Ll.pctTeto>=0.8?'var(--amb)':'var(--grn)')+'">'+fmtP(Ll.pctTeto)+' teto</span>'
      +'</div>'
      +'</div>';
  }).join('');

  var sortFat = [].concat(lojas).sort(function(a,b){return T[b].rec-T[a].rec;});
  var maxRec = Math.max.apply(null,lojas.map(function(l){return T[l].rec;}));

  var rankFat = sortFat.map(function(l,i){
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">'
      +'<div style="width:20px;height:20px;border-radius:5px;background:'+ABAS[l].cor+'22;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:'+ABAS[l].cor+'">'+(i+1)+'</div>'
      +'<div style="flex:1"><div style="font-size:10px;font-weight:600;color:var(--tx2)">'+ABAS[l].label+'</div>'+rb(T[l].rec/(maxRec||1)*100,ABAS[l].cor)+'</div>'
      +'<div style="font-size:11px;font-weight:700;color:'+ABAS[l].cor+'">'+fmt(T[l].rec)+'</div></div>';
  }).join('');

  var rankMeta = [].concat(lojas).sort(function(a,b){return T[b].pct-T[a].pct;}).map(function(l,i){
    var cor = T[l].pct>=1?'var(--grn)':'var(--red)';
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
      +'<div style="width:20px;height:20px;border-radius:5px;background:'+(T[l].pct>=1?'rgba(30,107,58,.12)':'rgba(155,32,32,.1)')+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:'+cor+'">'+(i+1)+'</div>'
      +'<div style="flex:1"><div style="font-size:10px;color:var(--tx2)">'+ABAS[l].label+'</div>'
      +rb(Math.min(T[l].pct*100,100),(T[l].pct>=1?'var(--grn)':'var(--amb)'))+'</div>'
      +'<div style="font-size:11px;font-weight:700;color:'+cor+'">'+fmtP(T[l].pct)+'</div></div>';
  }).join('');

  ev.innerHTML = ''
    +'<div class="insight"><div class="insight-label">📊 Visão Corporativa — Fev/2026</div>'
    +'<div class="insight-body">Faturamento consolidado <strong>'+fmt(sR)+'</strong> · Meta total: <strong>'+fmt(sM)+'</strong> · '
    +'Performance: <strong style="color:'+(sR/sM>=1?'var(--grn)':'var(--red)')+'">'+fmtP(sR/sM)+'</strong> · '
    +'Resultado líquido: <strong style="color:var(--grn)">'+fmt(sL)+'</strong> (margem '+fmtP(sL/(sR||1))+')</div></div>'

    +'<div class="sec-hdr">Consolidado da Rede</div>'
    +'<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">'
    +'<div class="kpi" style="--kt:var(--g2)"><div class="kpi-label">Faturamento Total</div><div class="kpi-val">'+fmt(sR)+'</div><div class="kpi-sub">'+fmtP(sR/sM)+' da meta</div></div>'
    +'<div class="kpi" style="--kt:var(--grn)"><div class="kpi-label">Resultado Líquido</div><div class="kpi-val" style="color:var(--grn)">'+fmt(sL)+'</div><div class="kpi-sub">Margem '+fmtP(sR>0?sL/sR:0)+'</div></div>'
    +'<div class="kpi" style="--kt:var(--red)"><div class="kpi-label">Despesas Caixa</div><div class="kpi-val">'+fmt(sD)+'</div><div class="kpi-sub">'+fmtP(sR>0?sD/sR:0)+' do faturamento</div></div>'
    +'<div class="kpi" style="--kt:var(--brd2)"><div class="kpi-label">Dias c/ Meta</div><div class="kpi-val">'+sOk+'<span style="font-size:14px;color:var(--tx3)">/'+sDias+'</span></div><div class="kpi-sub">3 lojas consolidado</div></div>'
    +'</div>'

    +'<div class="sec-hdr">Desempenho por Loja</div>'
    +'<div class="g3">'+lojaCards+'</div>'

    +'<div class="sec-hdr">Rankings e Histórico</div>'
    +'<div class="g32">'
    +'<div class="card"><div class="card-title">Histórico 8 Meses — Todas as Lojas</div>'
    +'<div class="legend">'
    +lojas.map(function(l){return '<span class="li"><span class="ld" style="background:'+ABAS[l].cor+'"></span>'+ABAS[l].label+'</span>';}).join('')
    +'</div>'
    +'<div style="position:relative;height:200px"><canvas id="cv-consol-h"></canvas></div></div>'
    +'<div class="card"><div class="card-title">Rankings Fev/2026</div>'
    +'<div style="font-size:9px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:1px;margin-bottom:9px">Faturamento</div>'+rankFat
    +'<div style="margin-top:12px;padding-top:9px;border-top:1px solid var(--brd);font-size:9px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:1px;margin-bottom:9px">% Meta Atingida</div>'+rankMeta
    +'</div></div>';

  dc('cv-consol-h');
  CHARTS['cv-consol-h'] = new Chart(el('cv-consol-h'),{
    type:'bar',
    data:{labels:HIST_LABELS, datasets:lojas.map(function(l){
      return{label:ABAS[l].label,data:HIST[l],backgroundColor:ABAS[l].cor+'88',borderColor:ABAS[l].cor,borderWidth:1,borderRadius:2};
    })},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#7A5C28',font:{size:10}}}},
      scales:{
        x:{ticks:{color:'#9B7A3A',font:{size:9}},grid:{display:false}},
        y:{ticks:{color:'#9B7A3A',font:{size:9},callback:function(v){return 'R$'+(v/1000).toFixed(0)+'k';}},grid:{color:'rgba(184,134,11,.07)'}}
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER DESPESAS — só proprietário
// ═══════════════════════════════════════════════════════════════════════
function renderDespesas(){
  var loja = FILIAL;
  var desp = getDesp(loja);
  var ev = el('m-despesas'); if(!ev) return;

  var total = desp.reduce(function(s,d){return s+d.val;},0);
  var ccMap = {};
  desp.forEach(function(d){ccMap[d.cc]=(ccMap[d.cc]||0)+d.val;});
  var ccMax = Math.max.apply(null,Object.values(ccMap).concat([1]));

  var fornMap = {};
  desp.forEach(function(d){
    if(!fornMap[d.forn]) fornMap[d.forn]={nome:d.forn,val:0,cc:d.cc,conta:d.conta};
    fornMap[d.forn].val+=d.val;
  });
  var fornList = Object.values(fornMap).sort(function(a,b){return b.val-a.val;});

  // Vencimentos por dia
  var porData = {};
  desp.forEach(function(d){
    var k = d.venc?d.venc.substring(0,5):'?';
    if(!porData[k]) porData[k]=0;
    porData[k]+=d.val;
  });
  var diasV = Object.keys(porData).filter(function(k){return k!=='?';}).sort().map(function(k){return[k,porData[k]];});
  var picoE = diasV.slice().sort(function(a,b){return b[1]-a[1];})[0]||['—',0];

  var kpiLojas = ['frei','eliseu','petronio'].map(function(l){
    var t = getDesp(l).reduce(function(s,d){return s+d.val;},0);
    var fatL = getDias(l).reduce(function(s,d){return s+d.receita;},0);
    return '<div class="kpi" style="--kt:'+ABAS[l].cor+'"><div class="kpi-label">'+ABAS[l].label+'</div>'
      +'<div class="kpi-val">'+fmt(t)+'</div>'
      +'<div class="kpi-sub">'+fmtP(fatL>0?t/fatL:0)+' do faturamento</div></div>';
  }).join('');

  var ccBars = Object.keys(ccMap).sort(function(a,b){return ccMap[b]-ccMap[a];}).map(function(cc){
    var v = ccMap[cc];
    return '<div class="cat-row"><div class="cat-name">'+cc+'</div>'
      +'<div class="cat-track"><div class="cat-fill" style="width:'+(v/ccMax*100).toFixed(1)+'%;background:'+(CC_COR[cc]||'#B8860B')+'">'
      +'<span>'+fmtP(v/total)+'</span></div></div>'
      +'<div class="cat-val">'+fmt(v)+'</div></div>';
  }).join('');

  var fornRows = fornList.slice(0,15).map(function(f,i){
    return '<tr><td style="color:var(--tx3);font-size:9px">'+(i+1)+'</td>'
      +'<td class="tdn">'+f.nome+'</td>'
      +'<td><span style="background:'+(CC_COR[f.cc]||'#eee')+'22;color:'+(CC_COR[f.cc]||'#555')+';font-size:9px;padding:2px 7px;border-radius:20px;font-weight:700">'+f.cc+'</span></td>'
      +'<td style="color:var(--tx3)">'+f.conta+'</td>'
      +'<td class="tdv">'+fmt(f.val)+'</td>'
      +'<td class="tdr" style="color:var(--tx3)">'+fmtP(f.val/total)+'</td>'
      +'<td style="padding:7px 10px">'+rb(f.val/(fornList[0]?fornList[0].val:1)*100,'var(--g2)')+'</td></tr>';
  }).join('');

  ev.innerHTML = ''
    +'<div class="insight"><div class="insight-label">💸 Despesas — '+ABAS[loja].label+'</div>'
    +'<div class="insight-body">Total: <strong>'+fmt(total)+'</strong> · Maior vencimento: <strong>'+picoE[0]+'</strong> ('+fmt(picoE[1])+') · '
    +'Top fornecedor: <strong>'+(fornList[0]?fornList[0].nome:'—')+'</strong> ('+fmt(fornList[0]?fornList[0].val:0)+')</div></div>'

    +'<div class="sec-hdr">Por Loja</div>'
    +'<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">'+kpiLojas+'</div>'

    +'<div class="sec-hdr">Composição e Vencimentos</div>'
    +'<div class="g32">'
    +'<div class="card"><div class="card-title">Despesas por Vencimento</div><div style="position:relative;height:185px"><canvas id="cv-desp-d"></canvas></div></div>'
    +'<div class="card"><div class="card-title">Por Centro de Custo</div>'+ccBars+'</div>'
    +'</div>'

    +'<div class="sec-hdr">Ranking de Fornecedores</div>'
    +'<div class="twx"><table><thead><tr><th>#</th><th>Fornecedor</th><th>CC</th><th>Conta</th><th class="tdr">Valor</th><th class="tdr">%</th><th style="width:90px">Part.</th></tr></thead>'
    +'<tbody>'+fornRows+'</tbody></table></div>';

  dc('cv-desp-d');
  CHARTS['cv-desp-d'] = new Chart(el('cv-desp-d'),{
    type:'bar',
    data:{labels:diasV.map(function(d){return d[0];}),
      datasets:[{data:diasV.map(function(d){return d[1];}),
        backgroundColor:diasV.map(function(d){return d[1]>20000?'rgba(155,32,32,.7)':d[1]>10000?'rgba(196,122,0,.7)':'rgba(184,134,11,.55)';}),
        borderColor:diasV.map(function(d){return d[1]>20000?'#9B2020':d[1]>10000?'#C47A00':'#B8860B';}),
        borderWidth:1,borderRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{ticks:{color:'#9B7A3A',font:{size:9},maxRotation:45},grid:{display:false}},
        y:{ticks:{color:'#9B7A3A',font:{size:9},callback:function(v){return 'R$'+(v/1000).toFixed(0)+'k';}},grid:{color:'rgba(184,134,11,.07)'}}}}
  });
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER ORÇAMENTO — só proprietário
// ═══════════════════════════════════════════════════════════════════════
function renderOrcamento(){
  var ev = el('m-orcamento'); if(!ev) return;
  var tabsHtml = ['frei','eliseu','petronio'].map(function(l){
    return '<button class="stab '+(l===ORC_LOJA?'act':'')+'" onclick="switchOrcLoja(\''+l+'\',this)">'+ABAS[l].label+'</button>';
  }).join('');
  ev.innerHTML = '<div class="stabs">'+tabsHtml+'</div><div id="orc-content"></div>';
  renderOrcContent();
}
function switchOrcLoja(l,btn){
  ORC_LOJA=l;
  document.querySelectorAll('.stab').forEach(function(b){b.classList.remove('act');});
  btn.classList.add('act');
  renderOrcContent();
}
function renderOrcContent(){
  var ev = el('orc-content'); if(!ev) return;
  var loja=ORC_LOJA, desp=getDesp(loja), orcL=ORC[loja]||[];
  var GC='grid-template-columns:2fr 1fr 1fr 1fr 1fr';

  var rows = orcL.map(function(cc){
    var realCC = desp.filter(function(d){return d.cc===cc.cc;}).reduce(function(s,d){return s+d.val;},0);
    var orcCC = cc.contas.reduce(function(s,c){return s+(c.orc||0);},0);
    var items = cc.contas.map(function(c){
      var r = desp.filter(function(d){return d.cc===cc.cc&&d.conta===c.c;}).reduce(function(s,d){return s+d.val;},0);
      return Object.assign({},c,{realCalc:r,over:c.orc&&r>c.orc,pct:c.orc?r/c.orc:null});
    });
    return{cc:cc.cc,orc:orcCC,real:realCC,over:orcCC&&realCC>orcCC,pct:orcCC?realCC/orcCC:null,items:items};
  });

  var tO = rows.reduce(function(s,r){return s+r.orc;},0);
  var tR = rows.reduce(function(s,r){return s+r.real;},0);

  var html = rows.map(function(r){
    var pw = r.orc?Math.min(r.real/r.orc*100,100).toFixed(0):0;
    var pc = r.over?'var(--red)':'var(--grn)';
    var items = r.items.map(function(it){
      var fml = it.formula?' <span style="font-size:9px;color:var(--amb)">('+it.formula+')</span>':'';
      return '<div class="orc-grid orc-item" style="'+GC+'">'
        +'<div class="orc-cell">'+it.c+fml+'</div>'
        +'<div class="orc-cell" style="color:var(--tx3)">'+(it.orc?fmt(it.orc):'Auto')+'</div>'
        +'<div class="orc-cell '+(it.over?'orc-over':it.realCalc>0?'orc-under':'')+'">'+fmt(it.realCalc)+'</div>'
        +'<div class="orc-cell '+(it.over?'orc-over':it.realCalc>0?'orc-under':'')+'">'+(it.orc?(it.over?'+ ':'- ')+fmt(Math.abs(it.realCalc-it.orc)):'—')+'</div>'
        +'<div class="orc-cell">'+(it.pct?fmtP(it.pct):'—')+'</div></div>';
    }).join('');
    return '<div class="orc-grid orc-cat" style="'+GC+'" onclick="toggleOrc(this)">'
      +'<div class="orc-cell"><span class="orc-exp">▶</span><strong>'+r.cc+'</strong>'
      +rb(pw,pc)+'</div>'
      +'<div class="orc-cell">'+(r.orc?fmt(r.orc):'—')+'</div>'
      +'<div class="orc-cell '+(r.over?'orc-over':'orc-under')+'">'+fmt(r.real)+'</div>'
      +'<div class="orc-cell '+(r.over?'orc-over':'orc-under')+'">'+(r.orc?(r.over?'+ ':'- ')+fmt(Math.abs(r.real-r.orc)):'—')+'</div>'
      +'<div class="orc-cell">'+(r.pct?fmtP(r.pct):'—')+'</div></div>'
      +'<div style="display:none">'+items+'</div>';
  }).join('');

  ev.innerHTML = '<div class="tw">'
    +'<div class="orc-grid" style="'+GC+';background:#F2EAD8;border-bottom:1px solid var(--brd)">'
    +'<div class="orc-cell orc-hdr">CC / Conta</div><div class="orc-cell orc-hdr">Orçado</div>'
    +'<div class="orc-cell orc-hdr">Realizado</div><div class="orc-cell orc-hdr">Variação</div>'
    +'<div class="orc-cell orc-hdr">% Exec.</div></div>'
    +html
    +'<div class="orc-grid orc-total" style="'+GC+'">'
    +'<div class="orc-cell"><strong>TOTAL</strong></div><div class="orc-cell">'+fmt(tO)+'</div>'
    +'<div class="orc-cell '+(tR>tO?'orc-over':'orc-under')+'">'+fmt(tR)+'</div>'
    +'<div class="orc-cell '+(tR>tO?'orc-over':'orc-under')+'">'+(tR>tO?'+ ':'- ')+fmt(Math.abs(tR-tO))+'</div>'
    +'<div class="orc-cell '+(tR>tO?'orc-over':'orc-under')+'">'+fmtP(tO?tR/tO:0)+'</div></div></div>';
}
function toggleOrc(row){
  var next=row.nextElementSibling;if(!next)return;
  var open=next.style.display!=='none';
  next.style.display=open?'none':'block';
  var exp=row.querySelector('.orc-exp');if(exp)exp.textContent=open?'▶':'▼';
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER INVESTIMENTOS — só proprietário
// ═══════════════════════════════════════════════════════════════════════
function renderInvestimentos(){
  var ev = el('m-investimentos'); if(!ev) return;
  var total = INVEST.reduce(function(s,x){return s+x.valor;},0);

  var kpiLojas = '<div class="kpi" style="--kt:var(--g2)"><div class="kpi-label">Total Investido</div><div class="kpi-val">'+fmt(total)+'</div><div class="kpi-sub">Fev/2026</div></div>';
  ['frei','eliseu','petronio'].forEach(function(l){
    var label = ABAS[l].label;
    var v = INVEST.filter(function(x){return x.loja===label||x.loja==='Todas';}).reduce(function(s,x){return s+x.valor;},0);
    kpiLojas += '<div class="kpi" style="--kt:'+ABAS[l].cor+'"><div class="kpi-label">'+label+'</div><div class="kpi-val">'+fmt(v)+'</div><div class="kpi-sub">no período</div></div>';
  });

  var rows = INVEST.map(function(x){
    var lk = x.loja==='Frei Serafim'?'frei':x.loja==='Eliseu Martins'?'eliseu':x.loja==='Universitária'?'petronio':null;
    var cor = lk?ABAS[lk].cor:'#8B6200';
    var parc = parseInt(x.cond)||1;
    return '<tr>'
      +'<td><span style="background:'+cor+'22;color:'+cor+';font-size:9px;padding:2px 8px;border-radius:20px;font-weight:700">'+x.loja+'</span></td>'
      +'<td style="color:var(--tx3)">'+x.mes+'</td>'
      +'<td><span style="background:var(--sur3);font-size:9px;padding:2px 7px;border-radius:20px">'+x.cc+'</span></td>'
      +'<td><span class="itag">'+x.conta+'</span></td>'
      +'<td class="tdn">'+x.item+'</td>'
      +'<td class="tdv">'+fmt(x.valor)+'</td>'
      +'<td style="text-align:center;font-weight:600">'+x.cond+'</td>'
      +'<td class="tdv" style="color:var(--amb)">'+fmt(Math.round(x.valor/parc))+'</td>'
      +'<td style="color:var(--tx3);font-size:10px">'+x.obs+'</td>'
      +'</tr>';
  }).join('');

  ev.innerHTML = ''
    +'<div class="insight"><div class="insight-label">🔧 Controle de Investimentos</div>'
    +'<div class="insight-body">Investimentos são controlados separadamente do resultado operacional (CapEx vs OpEx). '
    +'Total investido: <strong>'+fmt(total)+'</strong> · Controlados na planilha ADM GERAL · Lançamentos sempre com item, valor total, condição e loja.</div></div>'

    +'<div class="sec-hdr">Resumo por Loja</div>'
    +'<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">'+kpiLojas+'</div>'

    +'<div class="sec-hdr">Lançamentos</div>'
    +'<div class="twx"><table><thead><tr>'
    +'<th>Loja</th><th>Mês</th><th>CC</th><th>Conta</th><th>Item / Descrição</th>'
    +'<th class="tdr">Valor Total</th><th>Cond.</th><th class="tdr">Parcela</th><th>Obs.</th>'
    +'</tr></thead><tbody>'+rows
    +'<tr style="background:#FDF6E8;font-weight:700"><td colspan="5">TOTAL</td>'
    +'<td class="tdv">'+fmt(total)+'</td><td colspan="3"></td></tr>'
    +'</tbody></table></div>';
}

// ═══════════════════════════════════════════════════════════════════════
// RENDER DRE — só proprietário
// ═══════════════════════════════════════════════════════════════════════
function renderDRE(){
  var ev = el('m-dre'); if(!ev) return;
  var lojas = ['frei','eliseu','petronio'];
  var T = {};
  lojas.forEach(function(l){
    var d = getDias(l).filter(function(x){return !x.fechado;});
    T[l] = {rec:0,desp:0,nOk:0,nDias:d.length,meta:ABAS[l].meta};
    d.forEach(function(x){T[l].rec+=x.receita;T[l].desp+=x.despCx;if(x.bateu)T[l].nOk++;});
    T[l].lucro=T[l].rec-T[l].desp;
    T[l].marg=T[l].rec?T[l].lucro/T[l].rec:0;
    T[l].pctMeta=T[l].meta?T[l].rec/T[l].meta:0;
  });
  var totR=0,totD=0,totM=0,totOk=0,totDias=0;
  lojas.forEach(function(l){totR+=T[l].rec;totD+=T[l].desp;totM+=T[l].meta;totOk+=T[l].nOk;totDias+=T[l].nDias;});
  var totL=totR-totD;
  var invTotal=INVEST.reduce(function(s,x){return s+x.valor;},0);
  var GC='grid-template-columns:2.2fr 1fr 1fr 1fr 1fr';

  function dreRow(label,vals,cls){
    var row='<div class="dre-row '+(cls||'')+'" style="'+GC+'"><div>'+label+'</div>';
    lojas.forEach(function(l){row+='<div>'+(typeof vals[l]==='string'?vals[l]:fmt(vals[l]))+'</div>';});
    row+='<div>'+(typeof vals.tot==='string'?vals.tot:fmt(vals.tot))+'</div></div>';
    return row;
  }

  ev.innerHTML = '<div class="tw">'
    +'<div class="dre-row" style="'+GC+';background:#F2EAD8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--tx2)">'
    +'<div>Indicador</div>'
    +lojas.map(function(l){return '<div style="color:'+ABAS[l].cor+'">'+ABAS[l].label.split(' ')[0]+'</div>';}).join('')
    +'<div>Consolidado</div></div>'

    +'<div class="dre-sec">RECEITAS</div>'
    +dreRow('(+) Receita Bruta',{frei:T.frei.rec,eliseu:T.eliseu.rec,petronio:T.petronio.rec,tot:totR})

    +'<div class="dre-sec">CUSTOS OPERACIONAIS</div>'
    +dreRow('(-) Despesas de Caixa',{frei:T.frei.desp,eliseu:T.eliseu.desp,petronio:T.petronio.desp,tot:totD})

    +'<div class="dre-sec">RESULTADO OPERACIONAL</div>'
    +dreRow('(=) Lucro Operacional',{frei:T.frei.lucro,eliseu:T.eliseu.lucro,petronio:T.petronio.lucro,tot:totL},'dre-sub')
    +dreRow('Margem (%)',{frei:fmtP(T.frei.marg),eliseu:fmtP(T.eliseu.marg),petronio:fmtP(T.petronio.marg),tot:fmtP(totR?totL/totR:0)})

    +'<div class="dre-sec">METAS</div>'
    +dreRow('Meta Mensal',{frei:T.frei.meta,eliseu:T.eliseu.meta,petronio:T.petronio.meta,tot:totM})
    +dreRow('% Meta Atingida',{frei:fmtP(T.frei.pctMeta),eliseu:fmtP(T.eliseu.pctMeta),petronio:fmtP(T.petronio.pctMeta),tot:fmtP(totM?totR/totM:0)})
    +dreRow('Dias c/ Meta',{frei:T.frei.nOk+'/'+T.frei.nDias,eliseu:T.eliseu.nOk+'/'+T.eliseu.nDias,petronio:T.petronio.nOk+'/'+T.petronio.nDias,tot:totOk+'/'+totDias})

    +'<div class="dre-sec dre-dim">INVESTIMENTOS (controle separado)</div>'
    +'<div class="dre-row dre-dim" style="'+GC+'">'
    +'<div>Investimentos CapEx</div>'
    +lojas.map(function(l){
      var label = ABAS[l].label;
      var v=INVEST.filter(function(x){return x.loja===label||x.loja==='Todas';}).reduce(function(s,x){return s+x.valor;},0);
      return '<div style="color:var(--tx3)">'+fmt(v)+'</div>';
    }).join('')
    +'<div style="color:var(--tx3)">'+fmt(invTotal)+'</div></div>'
    +'</div>';
}

// ═══════════════════════════════════════════════════════════════════════
// Como funciona o fluxo de dados — informação no painel de gerente
// ═══════════════════════════════════════════════════════════════════════
// O gerente preenche a planilha no Google Sheets → SheetDB API puxa os dados
// → Dashboard atualiza automaticamente a cada hora


/* Calculadora gráfica autocontenida. Sin CDN, sin internet, sin eval().
   Parser recursivo descendente -> árbol -> evaluación numérica.

   Soporta:
     · aritmética      + - * / ^ ( )  y multiplicación implícita (2x, 3sin(x), (x+1)(x-2))
     · trigonometría   sin cos tan asin acos atan sinh cosh tanh sec csc cot
     · otras           ln log sqrt abs exp floor ceil round sign max min mod raiz
     · constantes      pi  e   ·   símbolos  π √ ∫ ∂ · × ÷ ² ³
     · FUNCIONES CON NOMBRE   f(x)=x^2-4   y luego f(2), f(x)+g(x), f(g(x))
     · INTEGRAL DEFINIDA      int(x^2, 0, 3)   ó   ∫(x^2, 0, 3)
     · DERIVADA               der(x^2, 2) en un punto, ó der(x^2) como función

   Lo que hace y que a mano cuesta: marca los cortes con el eje X, las
   intersecciones entre curvas y sombrea el área encerrada entre dos de ellas
   calculando su valor. Eso es justo el laboratorio de área entre curvas.
*/

const Graf = (function(){

/* ---------- funciones que el usuario define: f(x)=..., g(x)=... ---------- */
const DEFS = {};                 // nombre -> {arg, arbol}
const MAX_ANIDADO = 24;          // corta f(x)=f(x) antes de reventar la pila

/* ---------- tokenizador ---------- */
/* Los símbolos del teclado de la app se traducen a su equivalente ASCII antes
   de tokenizar: así ∫, ×, ², π… entran sin ensuciar la gramática. */
const EQUIV = [
  [/[·×∗]/g, '*'], [/[÷]/g, '/'], [/[−–—]/g, '-'],
  [/π/g, 'pi'], [/√/g, 'sqrt'], [/∫/g, 'int'], [/∂/g, 'der'],
  [/²/g, '^2'], [/³/g, '^3'], [/⁴/g, '^4'],
];
function normalizar(s){
  s = String(s == null ? '' : s);
  EQUIV.forEach(([re, a]) => { s = s.replace(re, a); });
  return s.replace(/\s+/g, '');
}

function tokenizar(s){
  const t=[]; let i=0;
  s = normalizar(s);
  while(i<s.length){
    const c=s[i];
    if(/[0-9.]/.test(c)){
      let j=i; while(j<s.length && /[0-9.]/.test(s[j])) j++;
      t.push({t:'num',v:parseFloat(s.slice(i,j))}); i=j;
    } else if(/[a-zA-Z]/.test(c)){
      let j=i; while(j<s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      t.push({t:'id',v:s.slice(i,j).toLowerCase()}); i=j;
    } else if('+-*/^(),='.includes(c)){
      t.push({t:c}); i++;
    } else throw new Error('carácter no válido: '+c);
  }
  return t;
}

const F1 = {
  sin:Math.sin, cos:Math.cos, tan:Math.tan, asin:Math.asin, acos:Math.acos,
  atan:Math.atan, sinh:Math.sinh, cosh:Math.cosh, tanh:Math.tanh,
  ln:Math.log, log:x=>Math.log10(x), sqrt:Math.sqrt, abs:Math.abs,
  exp:Math.exp, floor:Math.floor, ceil:Math.ceil, round:Math.round,
  sign:Math.sign, sec:x=>1/Math.cos(x), csc:x=>1/Math.sin(x), cot:x=>1/Math.tan(x)
};
const F2 = {
  max:Math.max, min:Math.min, mod:(a,b)=>a-b*Math.floor(a/b),
  raiz:(n,x)=>Math.sign(x)*Math.pow(Math.abs(x),1/n), pow:Math.pow, log_:(b,x)=>Math.log(x)/Math.log(b)
};
const CTE = { pi:Math.PI, e:Math.E, inf:Infinity };

/* ---------- parser ---------- */
function parsear(txt){
  const t=tokenizar(txt); let p=0;
  const ver=()=>t[p], comer=k=>{ if(t[p]&&t[p].t===k){p++;return true;} return false; };

  function args(min, max, nombre){
    if(!comer('(')) throw new Error(nombre+' necesita paréntesis');
    const lista=[expr()];
    while(comer(',')) lista.push(expr());
    if(!comer(')')) throw new Error('falta un paréntesis en '+nombre);
    if(lista.length<min || lista.length>max)
      throw new Error(nombre+' espera '+(min===max?min:min+' o '+max)+' argumentos, no '+lista.length);
    return lista;
  }

  function expr(){
    let n=term();
    while(ver() && (ver().t==='+'||ver().t==='-')){
      const op=t[p++].t; n={op, a:n, b:term()};
    }
    return n;
  }
  function term(){
    let n=unario();
    for(;;){
      if(ver() && (ver().t==='*'||ver().t==='/')){ const op=t[p++].t; n={op,a:n,b:unario()}; }
      // multiplicación implícita: 2x, 3(x+1), (x+1)(x-2), 2sin(x)
      else if(ver() && (ver().t==='num'||ver().t==='id'||ver().t==='(')){ n={op:'*',a:n,b:unario()}; }
      else break;
    }
    return n;
  }
  /* La potencia liga MÁS fuerte que el menos unario: -x^2 es -(x^2), no (-x)^2.
     Por eso unario() envuelve a pot() y no al revés. Con el orden invertido,
     -x^2+6x-4 se evaluaba como x^2+6x-4 y los cortes salían mal. */
  function unario(){
    if(comer('-')) return {op:'neg',a:unario()};
    if(comer('+')) return unario();
    return pot();
  }
  function pot(){
    const b=prim();
    if(ver() && ver().t==='^'){ p++; return {op:'^',a:b,b:unario()}; }  // asociativa por la derecha
    return b;
  }
  function prim(){
    const k=ver();
    if(!k) throw new Error('expresión incompleta');
    if(k.t==='num'){ p++; return {op:'num',v:k.v}; }
    if(k.t==='('){ p++; const n=expr(); if(!comer(')')) throw new Error('falta un paréntesis'); return n; }
    if(k.t==='id'){
      p++;
      const nom=k.v;
      if(nom==='x') return {op:'x'};
      if(nom in CTE) return {op:'num',v:CTE[nom]};

      /* Integral definida: el primer argumento se guarda SIN evaluar, porque
         hay que recorrerlo punto a punto entre los dos límites. */
      if(nom==='int' || nom==='integral'){
        const a=args(3,3,'la integral');
        return {op:'int', f:a[0], desde:a[1], hasta:a[2]};
      }
      /* Derivada: con dos argumentos da el valor en un punto; con uno queda
         como función y se deriva en cada x que se dibuje. */
      if(nom==='der' || nom==='derivada'){
        const a=args(1,2,'la derivada');
        return {op:'der', f:a[0], punto:a[1]||null};
      }
      if(nom in F1){ return {op:'f1', f:nom, a:args(1,1,nom)[0]}; }
      if(nom in F2){ const a=args(2,2,nom); return {op:'f2', f:nom, a:a[0], b:a[1]}; }
      if(nom in DEFS){ return {op:'llamada', nombre:nom, a:args(1,1,nom)[0]}; }

      throw new Error('no conozco «'+nom+'». Defínela como '+nom+'(x)=… o revisa el nombre');
    }
    throw new Error('no esperaba ese símbolo');
  }
  const raiz=expr();
  if(p<t.length) throw new Error('sobra algo al final');
  return raiz;
}

/* ---------- evaluación ---------- */
function ev(n,x,prof){
  prof = prof || 0;
  if(prof > MAX_ANIDADO) throw new Error('una función se llama a sí misma sin parar');
  switch(n.op){
    case 'num': return n.v;
    case 'x':   return x;
    case '+':   return ev(n.a,x,prof)+ev(n.b,x,prof);
    case '-':   return ev(n.a,x,prof)-ev(n.b,x,prof);
    case '*':   return ev(n.a,x,prof)*ev(n.b,x,prof);
    case '/':   return ev(n.a,x,prof)/ev(n.b,x,prof);
    case '^':   return Math.pow(ev(n.a,x,prof),ev(n.b,x,prof));
    case 'neg': return -ev(n.a,x,prof);
    case 'f1':  return F1[n.f](ev(n.a,x,prof));
    case 'f2':  return F2[n.f](ev(n.a,x,prof), ev(n.b,x,prof));
    case 'llamada': {
      const d=DEFS[n.nombre];
      if(!d) throw new Error('«'+n.nombre+'» ya no está definida');
      return ev(d.arbol, ev(n.a,x,prof), prof+1);
    }
    case 'int': {
      const a=ev(n.desde,x,prof), b=ev(n.hasta,x,prof);
      return simpson(t=>ev(n.f,t,prof+1), a, b);
    }
    case 'der': {
      const x0 = n.punto ? ev(n.punto,x,prof) : x;
      return derivar(t=>ev(n.f,t,prof+1), x0);
    }
  }
  return NaN;
}

/* Simpson compuesto. 2000 tramos: para los polinomios y las funciones suaves
   del curso el error queda por debajo de lo que se ve en pantalla, y el coste
   es despreciable frente a redibujar la gráfica. */
function simpson(f,a,b,n){
  if(a===b) return 0;
  const signo = b<a ? -1 : 1;
  if(b<a){ const t=a; a=b; b=t; }
  n = n || 2000; if(n%2) n++;
  const h=(b-a)/n;
  let s=f(a)+f(b);
  for(let i=1;i<n;i++) s += f(a+i*h) * (i%2 ? 4 : 2);
  return signo * s*h/3;
}

/* Diferencias centradas con paso relativo: en x grandes un paso fijo se pierde
   en el error de redondeo del propio double. */
function derivar(f,x0){
  const h = Math.max(1e-7, Math.abs(x0)*1e-7);
  return (f(x0+h)-f(x0-h))/(2*h);
}

function compilar(txt){ const a=parsear(txt); return x=>ev(a,x,0); }

/* ---------- definiciones con nombre ---------- */
/* Devuelve el nombre si el texto es una definición «f(x)=…», o null si es una
   expresión normal. Así la misma casilla sirve para las dos cosas. */
function esDefinicion(txt){
  const m = normalizar(txt).match(/^([a-zA-Z][a-zA-Z0-9_]*)\(([a-zA-Z][a-zA-Z0-9_]*)\)=(.+)$/);
  if(!m) return null;
  const nombre=m[1].toLowerCase();
  if(nombre==='x' || nombre in CTE || nombre in F1 || nombre in F2 ||
     ['int','integral','der','derivada'].includes(nombre))
    throw new Error('«'+nombre+'» es un nombre reservado, usa otro');
  return {nombre, arg:m[2].toLowerCase(), cuerpo:m[3]};
}
function definir(txt){
  const d = esDefinicion(txt);
  if(!d) return null;
  const previa = DEFS[d.nombre];
  delete DEFS[d.nombre];                       // no se puede usar a sí misma
  try{
    // El argumento se llame como se llame, dentro se maneja como x.
    const cuerpo = d.arg==='x' ? d.cuerpo
      : d.cuerpo.replace(new RegExp('\\b'+d.arg+'\\b','g'), 'x');
    DEFS[d.nombre] = {arg:d.arg, arbol:parsear(cuerpo)};
  }catch(err){
    if(previa) DEFS[d.nombre]=previa;
    throw err;
  }
  return d.nombre;
}
function olvidar(nombre){ delete DEFS[String(nombre).toLowerCase()]; }
function definidas(){ return Object.keys(DEFS); }

/* ---------- raíces y cortes por bisección ---------- */
function ceros(f,x0,x1,n){
  const out=[]; const h=(x1-x0)/n;
  let xa=x0, ya=f(xa);
  for(let i=1;i<=n;i++){
    const xb=x0+i*h, yb=f(xb);
    if(isFinite(ya)&&isFinite(yb)&&ya!==0&&Math.sign(ya)!==Math.sign(yb)){
      // salto de asíntota: si el brinco es enorme, no es un cero
      if(Math.abs(yb-ya) < 1e6){
        let a=xa,b=xb;
        for(let k=0;k<60;k++){ const m=(a+b)/2; (Math.sign(f(m))===Math.sign(f(a))) ? a=m : b=m; }
        out.push((a+b)/2);
      }
    } else if(ya===0) out.push(xa);
    xa=xb; ya=yb;
  }
  // quitar duplicados muy próximos
  return out.filter((v,i)=> i===0 || Math.abs(v-out[i-1])>1e-6).slice(0,20);
}

/* Área entre dos curvas: la integral del valor absoluto de la diferencia, que
   sale positiva sin tener que averiguar antes cuál va por encima. */
function area(f,g,a,b){ return Math.abs(simpson(x=>f(x)-g(x), a, b)); }

/* ---------- dibujo ---------- */
function crear(cv, estado){
  const ctx=cv.getContext('2d');
  const S = estado;

  function px(x){ return (x - S.cx)/S.esc + cv.width/2; }
  function py(y){ return cv.height/2 - (y - S.cy)/S.esc; }
  function ux(p){ return (p - cv.width/2)*S.esc + S.cx; }
  function uy(p){ return (cv.height/2 - p)*S.esc + S.cy; }

  function paso(){
    const bruto = S.esc*70;
    const p10 = Math.pow(10, Math.floor(Math.log10(bruto)));
    const r = bruto/p10;
    return p10 * (r<1.5?1 : r<3.5?2 : r<7.5?5 : 10);
  }

  function dibujar(){
    const w=cv.width, h=cv.height;
    const css = getComputedStyle(document.body);
    const cLine = css.getPropertyValue('--line').trim() || '#ddd';
    const cTx   = css.getPropertyValue('--tx2').trim()  || '#666';
    const cEje  = css.getPropertyValue('--tx3').trim()  || '#999';
    ctx.clearRect(0,0,w,h);

    const d=paso();
    // rejilla
    ctx.strokeStyle=cLine; ctx.lineWidth=1; ctx.beginPath();
    const x0=ux(0), x1=ux(w), y0=uy(h), y1=uy(0);
    for(let x=Math.ceil(x0/d)*d; x<=x1; x+=d){ const X=Math.round(px(x))+.5; ctx.moveTo(X,0); ctx.lineTo(X,h); }
    for(let y=Math.ceil(y0/d)*d; y<=y1; y+=d){ const Y=Math.round(py(y))+.5; ctx.moveTo(0,Y); ctx.lineTo(w,Y); }
    ctx.stroke();

    // región sombreada, antes que las curvas para que no tape sus trazos
    if(S.sombra && S.sombra.a < S.sombra.b) dibujarSombra();

    // ejes
    ctx.strokeStyle=cEje; ctx.lineWidth=1.4; ctx.beginPath();
    const Y0=Math.round(py(0))+.5, X0=Math.round(px(0))+.5;
    ctx.moveTo(0,Y0); ctx.lineTo(w,Y0); ctx.moveTo(X0,0); ctx.lineTo(X0,h);
    ctx.stroke();

    // números
    ctx.fillStyle=cTx; ctx.font='10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='top';
    const dec = d<1 ? Math.min(4, Math.ceil(-Math.log10(d))) : 0;
    for(let x=Math.ceil(x0/d)*d; x<=x1; x+=d){
      if(Math.abs(x)<d/2) continue;
      ctx.fillText(x.toFixed(dec), px(x), Math.min(Math.max(Y0+4,2), h-14));
    }
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(let y=Math.ceil(y0/d)*d; y<=y1; y+=d){
      if(Math.abs(y)<d/2) continue;
      ctx.fillText(y.toFixed(dec), Math.min(Math.max(X0-5,26), w-2), py(y));
    }

    // curvas
    S.fs.forEach(fn=>{
      if(!fn.ok || !fn.f) return;
      ctx.strokeStyle=fn.color; ctx.lineWidth=2; ctx.beginPath();
      let arriba=false;
      for(let p=0;p<=w;p++){
        const x=ux(p); let y;
        try{ y=fn.f(x); }catch(e){ y=NaN; }
        if(!isFinite(y)){ arriba=false; continue; }
        const Y=py(y);
        if(Y<-1e4||Y>1e4){ arriba=false; continue; }
        if(!arriba){ ctx.moveTo(p,Y); arriba=true; } else ctx.lineTo(p,Y);
      }
      ctx.stroke();
    });

    // puntos marcados (cortes e intersecciones)
    S.pts.forEach(pt=>{
      const X=px(pt.x), Y=py(pt.y);
      if(X<0||X>w||Y<0||Y>h) return;
      ctx.beginPath(); ctx.arc(X,Y,4,0,7); ctx.fillStyle=pt.color; ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=1.2; ctx.stroke();
    });
  }

  /* La región se rellena columna a columna entre las dos curvas. Recortar a la
     altura del lienzo evita que una asíntota fuera de pantalla haga un relleno
     gigante y lento. */
  function dibujarSombra(){
    const {f, g, a, b, color} = S.sombra;
    const pa = Math.max(0, Math.floor(px(a)));
    const pb = Math.min(cv.width, Math.ceil(px(b)));
    ctx.save();
    ctx.fillStyle = color || 'rgba(79,140,255,.22)';
    ctx.beginPath();
    let abierto=false;
    for(let p=pa;p<=pb;p++){
      const x=ux(p); let y;
      try{ y=f(x); }catch(e){ y=NaN; }
      if(!isFinite(y)){ abierto=false; continue; }
      const Y=Math.min(Math.max(py(y),-5), cv.height+5);
      if(!abierto){ ctx.moveTo(p,Y); abierto=true; } else ctx.lineTo(p,Y);
    }
    for(let p=pb;p>=pa;p--){
      const x=ux(p); let y;
      try{ y = g ? g(x) : 0; }catch(e){ y=NaN; }
      if(!isFinite(y)) continue;
      ctx.lineTo(p, Math.min(Math.max(py(y),-5), cv.height+5));
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  return {dibujar, px,py,ux,uy};
}

return {
  compilar, ceros, crear,
  definir, olvidar, definidas, esDefinicion,
  integrar: simpson, derivar, area, normalizar
};
})();

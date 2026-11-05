/* El cajón de herramientas — lo que sirve en cualquier carrera.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUE ESTO Y NO GENERAR DIAGRAMAS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Se estuvo a punto de intentar que la IA dibujara los diagramas del panel
 * derecho, como los que hay escritos a mano en `apoyo.js`. Habría salido mal:
 * esos SVG llevan coordenadas puestas una a una y un modelo pequeño no los
 * hace, y prometerlo era vender humo.
 *
 * La idea correcta es la contraria. Un diagrama de «cómo diseccionar una
 * frase lógica» sirve para UNA lección; una tabla periódica sirve para toda
 * la química de cualquier universidad, y una calculadora gráfica para
 * cálculo, física, estadística y economía a la vez.
 *
 * Así que en vez de generar contenido por materia, se reparten HERRAMIENTAS:
 * código escrito una vez que vale para todos, y que el alumno abre cuando lo
 * necesita en vez de tenerlo estorbando.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TODAS FUNCIONAN SIN INTERNET
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ninguna consulta nada fuera. Los datos que necesitan —los 118 elementos,
 * las constantes, los factores de conversión— van dentro. El tutor se instala
 * desde una USB en computadores que a veces no tienen conexión, y una
 * herramienta que necesita internet es una herramienta que falla el día del
 * examen.
 */

const Herramientas = (() => {
  const registro = [];

  /* EL ESTILO VIAJA CON LA HERRAMIENTA, NO EN LA PAGINA QUE LA USA.
   *
   * Estaba en la página de prueba y ya se notó: `.el{width:100%}` funciona
   * dentro de la rejilla —cada elemento llena su celda— y rompe en la fila de
   * lantánidos, donde los quince salían apilados uno debajo de otro ocupando
   * todo el ancho.
   *
   * Con el CSS aquí dentro no hay dos sitios que mantener sincronizados: la
   * herramienta llega entera o no llega. Se inyecta una sola vez, la primera
   * vez que se abre alguna.
   */
  let estiloPuesto = false;
  const ESTILO = `
    .hpt .pt{display:grid;grid-template-columns:repeat(18,minmax(0,1fr));
      gap:2px;margin:.6rem 0}
    .hpt .el{border:0;border-radius:3px;padding:.18rem .1rem;cursor:pointer;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      font:inherit;line-height:1.05;color:#1a1a1a;width:100%}
    .hpt .el:hover{outline:2px solid #111}
    .hpt .el .z{font-size:.52rem;opacity:.75}
    .hpt .el .s{font-size:.78rem;font-weight:700}
    /* En las filas de abajo NO se estira: son quince en línea, no quince
       barras. Se le da un ancho fijo y se deja envolver en pantallas
       estrechas. */
    .hpt .ptf{display:flex;gap:2px;align-items:center;margin:2px 0;flex-wrap:wrap}
    .hpt .ptf > span:first-child{font-size:.68rem;color:#666;width:5.4rem;flex:none}
    .hpt .ptf .el{width:auto;min-width:2.2rem;flex:0 0 auto}
    .hpt .ptleyenda{display:flex;gap:.7rem;flex-wrap:wrap;font-size:.7rem;
      color:#555;margin:.6rem 0}
    .hpt .ptleyenda i{display:inline-block;width:.7rem;height:.7rem;
      border-radius:2px;margin-right:.25rem;vertical-align:-1px}
    .hpt .ptdet{background:#f5f5f5;border-radius:8px;padding:.6rem .8rem;
      font-size:.9rem;min-height:2.4rem}
    .htab{border-collapse:collapse;font-size:.88rem;margin:.4rem 0;width:100%}
    .htab td,.htab th{border-bottom:1px solid #eee;padding:.28rem .7rem .28rem 0;
      text-align:left}
    .hsim{display:flex;flex-wrap:wrap;gap:.3rem;margin:.4rem 0}
    .hsim .sim{border:1px solid #ddd;border-radius:6px;background:#fff;
      cursor:pointer;padding:.25rem .45rem;font:inherit;display:flex;
      flex-direction:column;align-items:center;min-width:3.1rem;transition:background .15s}
    .hsim .sim b{font-size:1rem}
    .hsim .sim span{font-size:.6rem;color:#666}
    .hconv .fila{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin:.5rem 0}
    .hconv output{min-width:9rem;display:inline-block;background:#f5f5f5;
      font-weight:600;padding:.35rem .5rem;border-radius:7px}
  `;

  function ponerEstilo() {
    if (estiloPuesto) return;
    const s = document.createElement('style');
    s.id = 'estilo-herramientas';
    s.textContent = ESTILO;
    document.head.appendChild(s);
    estiloPuesto = true;
  }

  /** Da de alta una herramienta. `materias` son pistas, no un filtro duro. */
  function registrar(h) { registro.push(h); }

  // ── LA TABLA PERIODICA ─────────────────────────────────────────────────
  //
  // Los 118 elementos en una línea por elemento: símbolo, nombre, número
  // atómico, masa, grupo, periodo y familia. Comprimido a mano porque un JSON
  // con nombres de campo repetidos 118 veces pesa cuatro veces más y esto
  // viaja en una USB.
  //
  // Las masas son las de la IUPAC 2021. Los elementos sintéticos llevan la
  // masa del isótopo más estable, que es lo que hacen todas las tablas.
  const ELEMENTOS = (
    'H Hidrógeno 1 1.008 1 1 nm|He Helio 2 4.0026 18 1 ng|Li Litio 3 6.94 1 2 am|' +
    'Be Berilio 4 9.0122 2 2 at|B Boro 5 10.81 13 2 me|C Carbono 6 12.011 14 2 nm|' +
    'N Nitrógeno 7 14.007 15 2 nm|O Oxígeno 8 15.999 16 2 nm|F Flúor 9 18.998 17 2 ha|' +
    'Ne Neón 10 20.180 18 2 ng|Na Sodio 11 22.990 1 3 am|Mg Magnesio 12 24.305 2 3 at|' +
    'Al Aluminio 13 26.982 13 3 mp|Si Silicio 14 28.085 14 3 me|P Fósforo 15 30.974 15 3 nm|' +
    'S Azufre 16 32.06 16 3 nm|Cl Cloro 17 35.45 17 3 ha|Ar Argón 18 39.95 18 3 ng|' +
    'K Potasio 19 39.098 1 4 am|Ca Calcio 20 40.078 2 4 at|Sc Escandio 21 44.956 3 4 mt|' +
    'Ti Titanio 22 47.867 4 4 mt|V Vanadio 23 50.942 5 4 mt|Cr Cromo 24 51.996 6 4 mt|' +
    'Mn Manganeso 25 54.938 7 4 mt|Fe Hierro 26 55.845 8 4 mt|Co Cobalto 27 58.933 9 4 mt|' +
    'Ni Níquel 28 58.693 10 4 mt|Cu Cobre 29 63.546 11 4 mt|Zn Zinc 30 65.38 12 4 mt|' +
    'Ga Galio 31 69.723 13 4 mp|Ge Germanio 32 72.630 14 4 me|As Arsénico 33 74.922 15 4 me|' +
    'Se Selenio 34 78.971 16 4 nm|Br Bromo 35 79.904 17 4 ha|Kr Kriptón 36 83.798 18 4 ng|' +
    'Rb Rubidio 37 85.468 1 5 am|Sr Estroncio 38 87.62 2 5 at|Y Itrio 39 88.906 3 5 mt|' +
    'Zr Circonio 40 91.224 4 5 mt|Nb Niobio 41 92.906 5 5 mt|Mo Molibdeno 42 95.95 6 5 mt|' +
    'Tc Tecnecio 43 98 7 5 mt|Ru Rutenio 44 101.07 8 5 mt|Rh Rodio 45 102.91 9 5 mt|' +
    'Pd Paladio 46 106.42 10 5 mt|Ag Plata 47 107.87 11 5 mt|Cd Cadmio 48 112.41 12 5 mt|' +
    'In Indio 49 114.82 13 5 mp|Sn Estaño 50 118.71 14 5 mp|Sb Antimonio 51 121.76 15 5 me|' +
    'Te Telurio 52 127.60 16 5 me|I Yodo 53 126.90 17 5 ha|Xe Xenón 54 131.29 18 5 ng|' +
    'Cs Cesio 55 132.91 1 6 am|Ba Bario 56 137.33 2 6 at|La Lantano 57 138.91 0 6 ln|' +
    'Ce Cerio 58 140.12 0 6 ln|Pr Praseodimio 59 140.91 0 6 ln|Nd Neodimio 60 144.24 0 6 ln|' +
    'Pm Prometio 61 145 0 6 ln|Sm Samario 62 150.36 0 6 ln|Eu Europio 63 151.96 0 6 ln|' +
    'Gd Gadolinio 64 157.25 0 6 ln|Tb Terbio 65 158.93 0 6 ln|Dy Disprosio 66 162.50 0 6 ln|' +
    'Ho Holmio 67 164.93 0 6 ln|Er Erbio 68 167.26 0 6 ln|Tm Tulio 69 168.93 0 6 ln|' +
    'Yb Iterbio 70 173.05 0 6 ln|Lu Lutecio 71 174.97 0 6 ln|Hf Hafnio 72 178.49 4 6 mt|' +
    'Ta Tantalio 73 180.95 5 6 mt|W Wolframio 74 183.84 6 6 mt|Re Renio 75 186.21 7 6 mt|' +
    'Os Osmio 76 190.23 8 6 mt|Ir Iridio 77 192.22 9 6 mt|Pt Platino 78 195.08 10 6 mt|' +
    'Au Oro 79 196.97 11 6 mt|Hg Mercurio 80 200.59 12 6 mt|Tl Talio 81 204.38 13 6 mp|' +
    'Pb Plomo 82 207.2 14 6 mp|Bi Bismuto 83 208.98 15 6 mp|Po Polonio 84 209 16 6 me|' +
    'At Astato 85 210 17 6 ha|Rn Radón 86 222 18 6 ng|Fr Francio 87 223 1 7 am|' +
    'Ra Radio 88 226 2 7 at|Ac Actinio 89 227 0 7 ac|Th Torio 90 232.04 0 7 ac|' +
    'Pa Protactinio 91 231.04 0 7 ac|U Uranio 92 238.03 0 7 ac|Np Neptunio 93 237 0 7 ac|' +
    'Pu Plutonio 94 244 0 7 ac|Am Americio 95 243 0 7 ac|Cm Curio 96 247 0 7 ac|' +
    'Bk Berkelio 97 247 0 7 ac|Cf Californio 98 251 0 7 ac|Es Einstenio 99 252 0 7 ac|' +
    'Fm Fermio 100 257 0 7 ac|Md Mendelevio 101 258 0 7 ac|No Nobelio 102 259 0 7 ac|' +
    'Lr Lawrencio 103 266 0 7 ac|Rf Rutherfordio 104 267 4 7 mt|Db Dubnio 105 268 5 7 mt|' +
    'Sg Seaborgio 106 269 6 7 mt|Bh Bohrio 107 270 7 7 mt|Hs Hasio 108 269 8 7 mt|' +
    'Mt Meitnerio 109 278 9 7 mt|Ds Darmstadtio 110 281 10 7 mt|Rg Roentgenio 111 282 11 7 mt|' +
    'Cn Copernicio 112 285 12 7 mt|Nh Nihonio 113 286 13 7 mp|Fl Flerovio 114 289 14 7 mp|' +
    'Mc Moscovio 115 290 15 7 mp|Lv Livermorio 116 293 16 7 mp|Ts Teneso 117 294 17 7 ha|' +
    'Og Oganesón 118 294 18 7 ng'
  ).split('|').map((l) => {
    const p = l.split(' ');
    return { s: p[0], n: p[1], z: +p[2], m: p[3], g: +p[4], per: +p[5], f: p[6] };
  });

  const FAMILIAS = {
    am: ['Alcalinos', '#ff8a65'], at: ['Alcalinotérreos', '#ffb74d'],
    mt: ['Metales de transición', '#ffd54f'], mp: ['Metales del bloque p', '#aed581'],
    me: ['Metaloides', '#4db6ac'], nm: ['No metales', '#64b5f6'],
    ha: ['Halógenos', '#9575cd'], ng: ['Gases nobles', '#f06292'],
    ln: ['Lantánidos', '#a1887f'], ac: ['Actínidos', '#90a4ae'],
  };

  registrar({
    id: 'periodica',
    nombre: 'Tabla periódica',
    icono: '⚗',
    // Pistas para sugerirla: no filtran, solo ordenan. Un estudiante de
    // cualquier carrera puede abrir cualquier herramienta.
    materias: ['quimica', 'química', 'biolog', 'material', 'farmac', 'medic'],
    pinta() {
      // Se dibuja con la rejilla de verdad: 18 columnas por grupo, 7 filas
      // por periodo. Lantánidos y actínidos van abajo, como en cualquier
      // tabla — meterlos en su hueco real la haría ilegible.
      const celda = (e) => `<button class="el" data-z="${e.z}"
          style="background:${FAMILIAS[e.f][1]}"
          title="${e.n} · masa ${e.m}">
          <span class="z">${e.z}</span><span class="s">${e.s}</span></button>`;
      const principales = ELEMENTOS.filter((e) => e.g > 0);
      const rejilla = principales.map((e) =>
        `<div style="grid-column:${e.g};grid-row:${e.per}">${celda(e)}</div>`).join('');
      const abajo = (f) => ELEMENTOS.filter((e) => e.f === f).map(celda).join('');

      return `<div class="hpt">
        <div class="pt">${rejilla}</div>
        <div class="ptf"><span>Lantánidos</span>${abajo('ln')}</div>
        <div class="ptf"><span>Actínidos</span>${abajo('ac')}</div>
        <div class="ptleyenda">${Object.entries(FAMILIAS).map(([k, v]) =>
          `<span><i style="background:${v[1]}"></i>${v[0]}</span>`).join('')}</div>
        <div class="ptdet" id="ptdet">Pulsa un elemento.</div>
      </div>`;
    },
    engancha(raiz) {
      const det = raiz.querySelector('#ptdet');
      raiz.querySelectorAll('.el').forEach((b) => {
        b.onclick = () => {
          const e = ELEMENTOS.find((x) => x.z === +b.dataset.z);
          det.innerHTML = `<b>${e.n}</b> (${e.s}) · Z = ${e.z}
            · masa ${e.m} u · ${FAMILIAS[e.f][0]}
            · periodo ${e.per}${e.g ? ' · grupo ' + e.g : ''}`;
        };
      });
    },
  });

  // ── CONSTANTES FISICAS Y QUIMICAS ──────────────────────────────────────
  registrar({
    id: 'constantes',
    nombre: 'Constantes',
    icono: 'π',
    materias: ['fisic', 'físic', 'quimic', 'químic', 'termo', 'electr'],
    pinta() {
      const C = [
        ['Velocidad de la luz', 'c', '299 792 458 m/s'],
        ['Constante de Planck', 'h', '6,62607015 × 10⁻³⁴ J·s'],
        ['Carga del electrón', 'e', '1,602176634 × 10⁻¹⁹ C'],
        ['Número de Avogadro', 'N_A', '6,02214076 × 10²³ mol⁻¹'],
        ['Constante de los gases', 'R', '8,314462618 J/(mol·K)'],
        ['Constante de Boltzmann', 'k_B', '1,380649 × 10⁻²³ J/K'],
        ['Gravitación universal', 'G', '6,67430 × 10⁻¹¹ N·m²/kg²'],
        ['Gravedad en la Tierra', 'g', '9,80665 m/s²'],
        ['Masa del electrón', 'mₑ', '9,1093837015 × 10⁻³¹ kg'],
        ['Masa del protón', 'mₚ', '1,67262192369 × 10⁻²⁷ kg'],
        ['Permitividad del vacío', 'ε₀', '8,8541878128 × 10⁻¹² F/m'],
        ['Cero absoluto', '0 K', '−273,15 °C'],
      ];
      return `<table class="htab">${C.map(([n, s, v]) =>
        `<tr><td>${n}</td><td><code>${s}</code></td><td>${v}</td></tr>`).join('')}</table>`;
    },
  });

  // ── CONVERSOR DE UNIDADES ──────────────────────────────────────────────
  //
  // Todo se convierte pasando por la unidad base del SI. Con una tabla de
  // «de X a Y» harían falta n² entradas y bastaría una mal puesta para dar
  // un resultado creíble y falso.
  const UNIDADES = {
    Longitud: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144 },
    Masa: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523 },
    Tiempo: { s: 1, min: 60, h: 3600, día: 86400, ms: 0.001 },
    Presión: { Pa: 1, kPa: 1000, bar: 1e5, atm: 101325, psi: 6894.757, mmHg: 133.322 },
    Energía: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, kWh: 3.6e6, eV: 1.602176634e-19 },
    Volumen: { L: 1, mL: 0.001, 'm³': 1000, gal: 3.785411784 },
  };

  registrar({
    id: 'conversor',
    nombre: 'Conversor de unidades',
    icono: '⇄',
    materias: ['fisic', 'físic', 'quimic', 'químic', 'ingenier', 'termo', 'mecanic'],
    pinta() {
      const g = Object.keys(UNIDADES);
      return `<div class="hconv">
        <select id="cv-mag">${g.map((x) => `<option>${x}</option>`).join('')}</select>
        <div class="fila">
          <input id="cv-val" type="number" value="1" step="any">
          <select id="cv-de"></select>
          <span>→</span>
          <output id="cv-res">—</output>
          <select id="cv-a"></select>
        </div>
        <p class="sub" id="cv-nota"></p>
      </div>`;
    },
    engancha(raiz) {
      const $ = (s) => raiz.querySelector(s);
      const llenar = () => {
        const u = Object.keys(UNIDADES[$('#cv-mag').value]);
        for (const sel of ['#cv-de', '#cv-a']) {
          $(sel).innerHTML = u.map((x) => `<option>${x}</option>`).join('');
        }
        $('#cv-a').selectedIndex = Math.min(1, u.length - 1);
        calcular();
      };
      const calcular = () => {
        const t = UNIDADES[$('#cv-mag').value];
        const v = parseFloat($('#cv-val').value);
        if (!isFinite(v)) { $('#cv-res').textContent = '—'; return; }
        const r = v * t[$('#cv-de').value] / t[$('#cv-a').value];
        // Se enseñan las cifras que hacen falta y no más: 15 decimales en un
        // conversor es ruido, y redondear a 2 pierde los órdenes pequeños.
        $('#cv-res').textContent = Math.abs(r) >= 1e-4 && Math.abs(r) < 1e7
          ? +r.toFixed(6) : r.toExponential(6);
        $('#cv-nota').textContent = `Todo pasa por la unidad del SI: `
          + `1 ${$('#cv-de').value} = ${t[$('#cv-de').value]} `
          + `${Object.keys(t)[0]}`;
      };
      $('#cv-mag').onchange = llenar;
      ['#cv-val', '#cv-de', '#cv-a'].forEach((s) => { $(s).oninput = calcular; $(s).onchange = calcular; });
      llenar();
    },
  });

  // ── DERIVADAS E INTEGRALES DE MEMORIA ──────────────────────────────────
  registrar({
    id: 'calculo',
    nombre: 'Derivadas e integrales',
    icono: '∫',
    materias: ['calcul', 'cálcul', 'matem', 'analisis', 'análisis', 'fisic', 'físic'],
    pinta() {
      const D = [['xⁿ', 'n·xⁿ⁻¹'], ['eˣ', 'eˣ'], ['aˣ', 'aˣ·ln a'],
        ['ln x', '1/x'], ['sen x', 'cos x'], ['cos x', '−sen x'],
        ['tan x', 'sec²x'], ['arcsen x', '1/√(1−x²)'], ['arctan x', '1/(1+x²)']];
      const I = [['xⁿ (n≠−1)', 'xⁿ⁺¹/(n+1) + C'], ['1/x', 'ln|x| + C'],
        ['eˣ', 'eˣ + C'], ['sen x', '−cos x + C'], ['cos x', 'sen x + C'],
        ['sec²x', 'tan x + C'], ['1/(1+x²)', 'arctan x + C'],
        ['1/√(1−x²)', 'arcsen x + C']];
      const tabla = (t, filas, a, b) => `<h4>${t}</h4><table class="htab">
        <tr><th>${a}</th><th>${b}</th></tr>
        ${filas.map(([x, y]) => `<tr><td><code>${x}</code></td><td><code>${y}</code></td></tr>`).join('')}
        </table>`;
      return `<div class="hcalc">
        ${tabla('Derivadas', D, 'f(x)', "f'(x)")}
        ${tabla('Integrales', I, 'f(x)', '∫f(x)dx')}
        <p class="sub">Regla del producto: <code>(uv)' = u'v + uv'</code> ·
          Cadena: <code>(f∘g)' = f'(g)·g'</code> ·
          Por partes: <code>∫u dv = uv − ∫v du</code></p>
      </div>`;
    },
  });

  // ── ALFABETO GRIEGO Y SIMBOLOS ─────────────────────────────────────────
  registrar({
    id: 'simbolos',
    nombre: 'Símbolos',
    icono: 'Σ',
    materias: ['matem', 'fisic', 'físic', 'estad', 'logic', 'lógic', 'ingenier'],
    pinta() {
      const G = 'α alfa|β beta|γ gamma|δ delta|ε épsilon|ζ zeta|η eta|θ theta|'
        + 'λ lambda|μ mu|ν nu|ξ xi|π pi|ρ rho|σ sigma|τ tau|φ phi|χ chi|ψ psi|ω omega|'
        + 'Γ Gamma|Δ Delta|Θ Theta|Λ Lambda|Ξ Xi|Π Pi|Σ Sigma|Φ Phi|Ψ Psi|Ω Omega';
      const M = '∀ para todo|∃ existe|∈ pertenece|∉ no pertenece|⊂ subconjunto|'
        + '∪ unión|∩ intersección|∅ vacío|∞ infinito|≈ aproximado|≠ distinto|'
        + '≤ menor o igual|≥ mayor o igual|± más menos|√ raíz|∑ sumatorio|∏ productorio|'
        + '∫ integral|∂ parcial|∇ nabla|→ implica|↔ equivale|¬ negación|∧ y|∨ o';
      const bloque = (t, s) => `<h4>${t}</h4><div class="hsim">${
        s.split('|').map((x) => {
          const [c, ...n] = x.split(' ');
          return `<button class="sim" data-c="${c}" title="clic para copiar">
            <b>${c}</b><span>${n.join(' ')}</span></button>`;
        }).join('')}</div>`;
      return bloque('Alfabeto griego', G) + bloque('Matemáticas y lógica', M);
    },
    engancha(raiz) {
      raiz.querySelectorAll('.sim').forEach((b) => {
        b.onclick = async () => {
          // Se copia al portapapeles: escribir «∫» en un teclado normal no se
          // puede, y es justo lo que hace falta al redactar una entrega.
          try {
            await navigator.clipboard.writeText(b.dataset.c);
            const antes = b.style.background;
            b.style.background = '#c8e6c9';
            setTimeout(() => { b.style.background = antes; }, 400);
          } catch { /* sin permiso de portapapeles: no pasa nada */ }
        };
      });
    },
  });

  return {
    todas() { return registro; },

    /**
     * Las que probablemente sirvan para estas materias, primero.
     *
     * ORDENA, NO FILTRA. Un estudiante de Química puede querer el conversor
     * de unidades igual que uno de Física, y esconderle una herramienta
     * porque un texto no coincidió sería peor que enseñársela de más.
     */
    sugeridas(nombresDeMaterias) {
      const t = (nombresDeMaterias || []).join(' ').toLowerCase();
      const puntua = (h) => (h.materias || []).some((m) => t.includes(m)) ? 0 : 1;
      return [...registro].sort((a, b) => puntua(a) - puntua(b));
    },

    /** Pinta una dentro de un contenedor. */
    abrir(id, donde) {
      const h = registro.find((x) => x.id === id);
      if (!h) return false;
      ponerEstilo();
      donde.innerHTML = h.pinta();
      if (h.engancha) h.engancha(donde);
      return true;
    },
  };
})();

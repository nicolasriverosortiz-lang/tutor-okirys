/* «Nuevo trabajo» — el estudiante arma sus entregas desde las instrucciones
 * de su profesor. (11/09/2026)
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUE EXISTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * «Mis trabajos» es de lo mejor del tutor: la estructura exacta que pide
 * cada profesor, el borrador que se guarda solo, la IA que revisa lo que
 * llevas y la exportación a PDF o Word con portada APA. Pero en la versión
 * que se vende venía VACÍO: los trabajos de Nicolás están escritos a mano en
 * `trabajos.js`, y un estudiante no tenía forma de crear los suyos desde la
 * pantalla. Se anunciaba lo mejor del tutor y el comprador no lo recibía.
 *
 * Ahora el estudiante carga el PDF con las instrucciones —o las pega—, la IA
 * saca la estructura (qué partes pide, qué pide en cada una y por dónde
 * empezar) y el trabajo entra en la misma lista `TRABAJOS` que usa todo lo
 * demás: mismo editor, misma revisión, misma exportación. No hay dos caminos.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LO QUE LA IA HACE Y LO QUE NO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Saca la ESTRUCTURA y los pasos para arrancar. No escribe el trabajo: el
 * encargo se lo prohíbe, y además no hay ningún campo donde pudiera ponerlo
 * —los trabajos del estudiante no llevan «desarrollo de referencia»—. La
 * revisión de lo que escribe es la de siempre, que señala lo que falta sin
 * dar la respuesta.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SOLO EXISTE EN EL PRODUCTO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Vive en `Tutor Universidades\fuente\`, no en el tutor de Nicolás. Sus
 * cuatro enganches —el botón, «Eliminar trabajo», la activación y el
 * `<script>`— los pone `empaquetar.py` en el `tutor.html` del paquete; el de
 * Nicolás no se toca. Y dentro del producto, el botón solo aparece con la
 * licencia activada, como «Ajustes».
 */

const TrabajosNuevos = (() => {
  const CLAVE = 'tutor_trab_propios';
  let activo = false;
  let borrador = null;      // lo que se está armando en la ventana

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Los modelos escriben el código entre comillas invertidas —«`.py`»—, como
  // en Markdown. Escapado primero y convertido después: se ve como código y
  // no puede colarse ninguna etiqueta.
  const conCodigo = (s) => esc(s).replace(/`([^`]{1,80})`/g, '<code>$1</code>');

  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch (e) { return []; }
  }
  function escribir(lista) { localStorage.setItem(CLAVE, JSON.stringify(lista)); }

  // LOS QUE YA CREÓ ENTRAN AL CARGAR, antes de que el tutor pinte nada: así
  // se ven en la barra y se abren como cualquier otro trabajo.
  if (typeof TRABAJOS !== 'undefined') for (const t of leer()) TRABAJOS.push(t);

  /* ── LA IA ─────────────────────────────────────────────────────────────── */

  function encargo(texto, materia, titulo) {
    return `Eres un tutor universitario. Te paso las INSTRUCCIONES que un profesor
dio para el trabajo «${titulo}» de la materia «${materia}».

Tu tarea NO es hacer el trabajo: es sacar su ESTRUCTURA para que el estudiante
lo desarrolle él.

Devuelve SOLO un objeto JSON, sin explicaciones ni bloques de código, así:

{
  "formato": "lo que pide sobre formato, extensión, normas o archivos, en una frase; vacío si no dice nada",
  "secciones": [
    {
      "titulo": "nombre corto de la parte, máximo 60 caracteres",
      "pide": "qué pide el profesor en esta parte, en 1 a 3 frases",
      "empezar": ["un paso concreto para arrancar", "otro paso", "otro paso"]
    }
  ]
}

REGLAS:
- Entre 3 y 10 secciones, en el orden en que las pide el profesor.
- Si pide introducción, va primera; conclusiones y referencias, al final.
- La portada, el formato, la extensión y las normas de entrega NO son
  secciones: van en "formato".
- No añadas partes que el profesor no pide, como «revisión final» o
  «consideraciones adicionales».
- "pide" sale del TEXTO. No inventes requisitos que no estén.
- "empezar" son pasos para ARRANCAR: qué buscar, qué preparar, cómo ordenar
  las ideas. NUNCA la respuesta ni el contenido del trabajo.
- En español.

INSTRUCCIONES:
"""
${texto}
"""`;
  }

  function sacarJSON(t) {
    if (typeof Generador !== 'undefined' && Generador._sacarJSON) return Generador._sacarJSON(t);
    const a = (t || '').indexOf('{'), b = (t || '').lastIndexOf('}');
    if (a === -1 || b <= a) throw new Error('La IA no devolvió la estructura.');
    return JSON.parse(t.slice(a, b + 1));
  }

  /* Lo que devuelve la IA, limpio — o una excepción que dice qué falla.
   * Un modelo pequeño se sale del formato a menudo: se rechaza en vez de
   * pintar un trabajo con partes vacías o repetidas. */
  // LO QUE UN MODELO PEQUEÑO AÑADE AUNQUE SE LE DIGA QUE NO (11/09/2026).
  // Con un enunciado corto, gemma-3-4b rellenó con «Portada», «Formato
  // Documento», «Normas de Entrega» y «Revisión Final». La portada la pone la
  // exportación APA, y el resto no son partes que se escriban: se quitan aquí,
  // que es donde la regla sí se cumple siempre.
  const NO_ES_PARTE = /^(portada|car[aá]tula|formato|normas|presentaci[oó]n del documento|revisi[oó]n final|consideraciones adicionales|entrega|organizaci[oó]n|estructura del (trabajo|documento))\b/i;
  const PRIMERA = /^introducci[oó]n/i;
  const CONCLUSION = /^conclusi[oó]n/i;
  const REFERENCIAS = /^(referencias|bibliograf[ií]a)/i;

  function validar(bruto) {
    const lista = Array.isArray(bruto?.secciones) ? bruto.secciones : [];
    const vistos = new Set();
    let secciones = [];
    for (const s of lista) {
      const titulo = String(s?.titulo || '').trim().slice(0, 60);
      if (titulo.length < 2 || vistos.has(titulo.toLowerCase())) continue;
      if (NO_ES_PARTE.test(titulo)) continue;
      vistos.add(titulo.toLowerCase());
      const pasos = (Array.isArray(s.empezar) ? s.empezar : [s.empezar])
        .map((p) => String(p || '').trim().slice(0, 220)).filter((p) => p.length > 3).slice(0, 5);
      secciones.push({ titulo, pide: String(s.pide || '').trim().slice(0, 500), empezar: pasos });
    }
    // El orden de siempre, aunque el modelo lo baraje: la introducción
    // primero; al final, UNA conclusión —la primera, que suele ser la que
    // nombra lo que pidió el profesor; la segunda era un «Conclusiones»
    // genérico repetido— y después las referencias.
    const es = (re) => (s) => re.test(s.titulo);
    const conclusion = secciones.filter(es(CONCLUSION)).slice(0, 1);
    secciones = [
      ...secciones.filter(es(PRIMERA)),
      ...secciones.filter((s) => !PRIMERA.test(s.titulo) && !CONCLUSION.test(s.titulo)
                              && !REFERENCIAS.test(s.titulo)),
      ...conclusion,
      ...secciones.filter(es(REFERENCIAS)),
    ];
    if (secciones.length < 2) throw new Error('La IA no encontró las partes del trabajo.');
    return { formato: String(bruto?.formato || '').trim().slice(0, 300),
             secciones: secciones.slice(0, 12) };
  }

  async function preguntar(mensajes, maxTok) {
    // El motor que el estudiante eligió al instalar (LM Studio o su clave).
    if (typeof IA !== 'undefined') {
      try { await IA.cargarDelAlmacen(); return await IA.preguntar(mensajes, maxTok); }
      catch (e) { if (!(typeof LM_OK !== 'undefined' && LM_OK)) throw e; }
    }
    // Y si no, el LM Studio que el tutor ya detectó arriba.
    if (typeof LM_OK !== 'undefined' && LM_OK && typeof pedirLM === 'function') {
      return await pedirLM(mensajes, maxTok);
    }
    throw new Error('No hay IA conectada.');
  }

  /* ── EL DESARROLLO ─────────────────────────────────────────────────────
   *
   * Esto escribe el texto de cada parte. Va al campo `modelo`, que el motor
   * ya sabe enseñar: pone «Ver desarrollo» en cada sección y «Volcar todo el
   * desarrollo» arriba, con su aviso de revisarlo antes de exportar. No hubo
   * que tocar el motor ni una línea.
   *
   * SE ESCRIBE PARTE POR PARTE, NO EL TRABAJO ENTERO DE UNA.
   * Un trabajo completo en una sola petición se pasa del límite de tokens y
   * vuelve cortado por la mitad —y cortado sin avisar, que es lo peor—.
   * Parte por parte también deja guardar según avanza: si la quinta falla,
   * las cuatro primeras ya están.
   *
   * Y CON EL MATERIAL DEL ALUMNO, no con lo que el modelo crea recordar.
   * Antes de escribir cada parte se buscan los pasajes de SUS PDF que hablan
   * del tema y se le pasan. Es lo que separa esto de pegarle el enunciado a
   * un chat cualquiera: el texto sale de su temario, con los términos que
   * usa su profesor.
   */

  /** Pasajes del temario del alumno que hablan de esto. Solapamiento de
   *  términos, igual que el buscador del tutor: suficiente y sin depender
   *  de nada que haya que instalar. */
  async function pasajesDe(materia, consulta, tope) {
    if (typeof Almacen === 'undefined') return [];
    let todos = [];
    try { todos = await Almacen.todosLosPasajes(); } catch (e) { return []; }
    if (!todos.length) return [];

    const limpia = (s) => String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9ñ\s]/g, ' ');
    const term = limpia(consulta).split(/\s+/).filter((t) => t.length > 3);
    if (!term.length) return [];

    const m = limpia(materia);
    const res = [];
    todos.forEach((p) => {
      const txt = limpia(p.texto || p);
      let punt = 0;
      term.forEach((w) => {
        const veces = (txt.match(new RegExp('\\b' + w, 'g')) || []).length;
        if (veces) punt += 1 + Math.min(veces, 4) * 0.4;
      });
      // Los de la misma materia pesan más, pero los de otras no se descartan:
      // un trabajo de Estadística puede apoyarse en los apuntes de Cálculo.
      if (punt && m && limpia(p.materia).includes(m)) punt += 2;
      if (punt > 0) res.push({ punt, texto: p.texto || String(p) });
    });
    return res.sort((a, b) => b.punt - a.punt).slice(0, tope || 6);
  }

  function encargoDesarrollo(sec, datos, pasajes, antes) {
    const material = pasajes.length
      ? `\n\nDEL TEMARIO DEL ESTUDIANTE (úsalo como fuente; son sus apuntes y
presentaciones de clase):\n"""\n${pasajes.map((p) => p.texto).join('\n---\n').slice(0, 6000)}\n"""`
      : '';
    const previo = antes
      ? `\n\nLO QUE YA SE ESCRIBIÓ EN LAS PARTES ANTERIORES (para no repetirte
y para enlazar con ello):\n"""\n${antes.slice(0, 1800)}\n"""`
      : '';
    return `Eres un estudiante universitario escribiendo el trabajo
«${datos.titulo}» de la materia «${datos.materia}».

Escribe el DESARROLLO COMPLETO de esta parte:

PARTE: ${sec.titulo}
LO QUE PIDE EL PROFESOR: ${sec.pide || 'Desarrolla esta parte del trabajo.'}${material}${previo}

REGLAS:
- Escribe el texto final, listo para leer. Nada de «aquí deberías explicar»
  ni instrucciones: el contenido de verdad.
- De 3 a 6 párrafos. Si la parte es «Referencias», lista las fuentes en APA.
- Prosa académica en español, en primera persona del plural o impersonal.
  Sin florituras y sin repetir el enunciado.
- Apóyate en el temario de arriba cuando diga algo del tema; si no trae nada
  útil, escribe con lo que sepas del asunto, sin inventar datos, cifras ni
  citas. Una cita inventada se detecta y hunde el trabajo.
- NO inventes resultados de experimentos, mediciones ni encuestas que el
  estudiante tendría que haber hecho. Si la parte los pide, explica el
  procedimiento y deja marcado entre corchetes [aquí van tus datos].
- Devuelve SOLO el texto, con los párrafos separados por una línea en
  blanco. Sin títulos, sin viñetas de markdown y sin comillas alrededor.`;
  }

  /** Convierte lo que devuelve la IA en HTML seguro para `modelo`.
   *  Se escapa TODO y se arman los <p> aquí: nunca se mete en innerHTML
   *  texto que vino de fuera sin pasar por esto. */
  function aParrafos(txt) {
    return String(txt || '').trim().split(/\n\s*\n/)
      .map((p) => p.trim()).filter(Boolean)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
  }

  /** Escribe el desarrollo de todas las partes. `avisar(hechas, total)` va
   *  contando para que la pantalla no parezca colgada. */
  async function redactarTodo(estructura, datos, avisar) {
    const secs = estructura.secciones;
    let antes = '';
    let escritas = 0;
    for (let i = 0; i < secs.length; i++) {
      if (avisar) avisar(i, secs.length);
      const s = secs[i];
      try {
        const pasajes = await pasajesDe(datos.materia,
                                        `${s.titulo} ${s.pide || ''}`, 6);
        const txt = await preguntar(
          [{ role: 'user', content: encargoDesarrollo(s, datos, pasajes, antes) }],
          1100);
        const html = aParrafos(txt);
        if (html) {
          s.modelo = html;
          escritas++;
          // Solo el texto plano y recortado: lo que viaja a la siguiente
          // petición es para dar hilo, no para volver a mandarlo entero.
          antes += (antes ? '\n\n' : '') + `[${s.titulo}] `
                 + String(txt).replace(/\s+/g, ' ').slice(0, 600);
        }
      } catch (e) {
        // Una parte que falla no puede llevarse las demás: se deja sin
        // desarrollo y el estudiante la escribe o la vuelve a pedir.
        s.modelo = '';
      }
    }
    return escritas;
  }

  /* Sin IA no se deja al estudiante sin nada: una estructura base que vale
   * para casi cualquier trabajo escrito, y se le dice que la ajuste. */
  const BASE = {
    formato: '',
    secciones: [
      { titulo: 'Introducción', pide: 'Presenta el tema, el objetivo del trabajo y cómo está organizado.',
        empezar: ['Relee el enunciado y subraya el verbo de cada consigna: analizar, comparar, calcular…',
                  'Escribe en una sola frase qué vas a resolver o demostrar.',
                  'Si no sabes cómo empezar, déjala para el final: se escribe mejor cuando ya sabes qué dijiste.'] },
      { titulo: 'Desarrollo', pide: 'Responde cada punto que pide el profesor, en su orden.',
        empezar: ['Haz una lista con cada punto del enunciado: cada uno será un apartado.',
                  'Busca en tu temario («Buscar en el temario», arriba) lo que dice de cada punto.',
                  'Escribe primero un borrador sin preocuparte por la forma.'] },
      { titulo: 'Conclusiones', pide: 'Lo que se concluye de tu desarrollo, sin información nueva.',
        empezar: ['Vuelve al objetivo de tu introducción: ¿lo cumpliste?',
                  'Resume en tres o cuatro frases lo que encontraste.'] },
      { titulo: 'Referencias', pide: 'Las fuentes que usaste, en el formato que pida el profesor (normalmente APA).',
        empezar: ['Anota cada fuente mientras la usas, no al final.',
                  'APA: Autor, A. (año). Título. Editorial.'] },
    ],
  };

  function enDosSemanas() {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  }

  /* El trabajo con la MISMA forma que los de `trabajos.js`: así el editor, la
   * revisión y la exportación lo tratan igual sin saber de dónde salió. */
  function construir({ titulo, materia, entrega, texto }, estructura, sinIA) {
    const aviso = sinIA
      ? '<b>Estructura base.</b> No había IA conectada, así que se armó una estructura general. Cambia los títulos para que coincidan con lo que pide tu profesor.'
      : '<b>Esta estructura salió de las instrucciones que cargaste.</b> Revísala con el enunciado antes de empezar: si falta alguna parte, créala de nuevo o avísale al tutor en el chat.';
    const instr = texto
      ? `<details style="margin-top:10px"><summary style="cursor:pointer">Ver las instrucciones del profesor</summary>`
        + `<div style="white-space:pre-wrap;margin-top:8px;font-size:13.5px;max-height:320px;overflow:auto">${esc(texto)}</div></details>`
      : '';
    return {
      id: 'propio-' + Date.now().toString(36),
      propio: true,
      titulo: esc(titulo),
      materia: esc(materia),
      entrega: entrega || enDosSemanas(),
      archivo: titulo.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 50) || 'trabajo',
      formato: estructura.formato ? esc(estructura.formato) : '',
      secciones: [
        { tipo: 'nota', texto: aviso + instr },
        ...estructura.secciones.map((s) => ({
          tipo: 'texto',
          titulo: esc(s.titulo),
          ayuda: conCodigo(s.pide),
          orientacion: s.empezar.length
            ? '<ol>' + s.empezar.map((p) => `<li>${conCodigo(p)}</li>`).join('') + '</ol>' : '',
          placeholder: 'Escribe aquí tu desarrollo…',
          // Solo si de verdad hay texto. Un `modelo` vacío haría que el motor
          // pintara «Ver desarrollo» y no enseñara nada al pulsarlo.
          ...(s.modelo ? { modelo: s.modelo } : {}),
        })),
      ],
      creado: new Date().toISOString(),
    };
  }

  /* ── LA VENTANA ────────────────────────────────────────────────────────── */

  /* Los estilos de lo que se añadió para el desarrollo. Van aparte del
     bloque de abajo para que se vea de un vistazo qué entró con esto. */
  const CSS_DESARROLLO = `
      .tn .tn-des{display:flex;gap:10px;align-items:flex-start;margin-top:14px;
        padding:12px 14px;border:1px solid var(--line);border-radius:8px;
        background:var(--panel);cursor:pointer}
      .tn .tn-des input{margin-top:3px;flex:none}
      .tn .tn-des small{display:block;color:var(--tx2);font-size:12.5px;
        margin-top:4px;font-weight:400;line-height:1.5}
      .tn .tn-prog{margin-top:12px;font-size:13.5px;color:var(--tx2)}
      .tn .tn-barra{height:6px;border-radius:999px;background:var(--line);
        overflow:hidden;margin-bottom:8px}
      .tn .tn-barra i{display:block;height:100%;background:var(--acc);
        transition:width .4s ease}
      .tn .tn-hecho{color:var(--ok);font-weight:600}
      .tn .tn-prog .mal{color:var(--bad)}`;

  function estilos() {
    if (document.getElementById('tnEstilos')) return;
    const st = document.createElement('style');
    st.id = 'tnEstilos';
    st.textContent = `
      .tn{display:grid;gap:12px;font-size:14.5px}
      .tn p.tn-intro{margin:0;color:var(--tx2);line-height:1.6}
      .tn label{display:grid;gap:5px;font-weight:600;font-size:13.5px}
      .tn input,.tn textarea{font:inherit;font-weight:400;padding:8px 10px;border:1px solid var(--line);
        border-radius:8px;background:var(--bg);color:var(--tx);width:100%}
      .tn textarea{resize:vertical;min-height:110px}
      .tn input:focus,.tn textarea:focus{outline:2px solid var(--acc);outline-offset:-1px}
      .tn .tn-fila{display:grid;grid-template-columns:1fr 170px;gap:12px}
      .tn .tn-o{text-align:center;color:var(--tx3);font-size:12.5px;margin:-4px 0}
      .tn .tn-acc{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      .tn .tn-est{color:var(--tx2);font-size:13.5px}
      .tn .tn-est.mal{color:var(--bad)}
      .tn .tn-parte{display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:start;
        border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--panel)}
      .tn .tn-parte .n{font-weight:700;color:var(--acc);padding-top:8px;text-align:center}
      .tn .tn-parte small{display:block;color:var(--tx2);font-size:12.5px;margin-top:5px;line-height:1.5}
      .tn .tn-parte button{padding:4px 9px;font-size:13px}
      .tn .tn-lista{display:grid;gap:8px}
      .tn .tn-ok{background:var(--ok-bg);color:var(--ok);border-radius:8px;padding:10px 12px;font-size:13.5px}`
      + CSS_DESARROLLO;
    document.head.appendChild(st);
  }

  function abrir() {
    estilos();
    borrador = null;
    abrirCapa('Nuevo trabajo', (caja) => {
      const materias = (typeof CURRICULO !== 'undefined' ? CURRICULO : [])
        .map((m) => `<option value="${esc(m.titulo)}">`).join('');
      caja.innerHTML = `
        <div class="tn">
          <p class="tn-intro">Carga las instrucciones que te dio tu profesor. El tutor arma la
            estructura del trabajo —cada parte con lo que pide y por dónde empezar— y tú lo
            desarrollas. Cuando quieras, la IA revisa tu borrador y te dice qué falta; no lo
            escribe por ti.</p>
          <div class="tn-fila">
            <label>Nombre del trabajo<input id="tnTitulo" placeholder="Ej.: Laboratorio 2 · Árboles binarios"></label>
            <label>Entrega<input id="tnFecha" type="date"></label>
          </div>
          <label>Materia<input id="tnMateria" list="tnMaterias" placeholder="Ej.: Algoritmia y Complejidad">
            <datalist id="tnMaterias">${materias}</datalist></label>
          <label>Instrucciones del profesor (PDF)<input id="tnPdf" type="file" accept=".pdf,application/pdf"></label>
          <div class="tn-o">o</div>
          <label>Pégalas aquí<textarea id="tnTexto" placeholder="Copia el enunciado de la actividad…"></textarea></label>
          <div class="tn-acc">
            <button class="primary" id="tnArmar" onclick="TrabajosNuevos.armar()">Armar la estructura</button>
            <span class="tn-est" id="tnEst"></span>
          </div>
          <div id="tnVista"></div>
        </div>`;
    });
  }

  function estado(t, mal) {
    const el = document.getElementById('tnEst');
    if (el) { el.textContent = t; el.classList.toggle('mal', !!mal); }
  }

  async function armar() {
    const titulo = document.getElementById('tnTitulo').value.trim();
    const materia = document.getElementById('tnMateria').value.trim();
    const entrega = document.getElementById('tnFecha').value;
    const archivo = document.getElementById('tnPdf').files[0];
    let texto = document.getElementById('tnTexto').value.trim();
    if (!titulo) return estado('Ponle un nombre al trabajo.', true);
    if (!materia) return estado('Escribe de qué materia es.', true);

    const boton = document.getElementById('tnArmar');
    boton.disabled = true;
    try {
      if (archivo) {
        estado('Leyendo el PDF…');
        const trozos = await Cargador.leerPDF(archivo, (h, n) => estado(`Leyendo el PDF… página ${h} de ${n}`));
        texto = trozos.map((t) => t.texto).join('\n\n');
      }
      if (texto.length < 40) {
        boton.disabled = false;
        return estado('Faltan las instrucciones: carga el PDF o pega el enunciado.', true);
      }
      let estructura, sinIA = false;
      try {
        estado('La IA está leyendo las instrucciones… (puede tardar un minuto)');
        const crudo = await preguntar([{ role: 'user', content: encargo(texto.slice(0, 7000), materia, titulo) }], 1400);
        estructura = validar(sacarJSON(crudo));
      } catch (e) {
        console.warn('[trabajos] sin estructura de la IA:', e);
        estructura = BASE; sinIA = true;
      }
      borrador = { datos: { titulo, materia, entrega, texto }, estructura, sinIA };
      estado(sinIA ? 'No había IA conectada: te dejo una estructura base para ajustar.' : '');
      pintarVista();
    } catch (e) {
      estado(String(e.message || e), true);
    } finally {
      boton.disabled = false;
    }
  }

  function pintarVista() {
    const v = document.getElementById('tnVista');
    if (!v || !borrador) return;
    const partes = borrador.estructura.secciones;
    v.innerHTML = `
      <div class="tn-ok">${partes.length} partes. Revisa los nombres: los puedes cambiar, quitar o añadir.</div>
      <div class="tn-lista" style="margin-top:10px">
        ${partes.map((s, i) => `
          <div class="tn-parte">
            <span class="n">${i + 1}</span>
            <div><input data-parte="${i}" value="${esc(s.titulo)}">${s.pide ? `<small>${esc(s.pide)}</small>` : ''}</div>
            <button title="Quitar esta parte" onclick="TrabajosNuevos._quitar(${i})">✕</button>
          </div>`).join('')}
      </div>
      <div class="tn-acc" style="margin-top:12px">
        <button onclick="TrabajosNuevos._anadir()">+ Añadir una parte</button>
        <button class="primary" onclick="TrabajosNuevos.crear()">Crear el trabajo</button>
      </div>
      <!-- La casilla va DESPUÉS de revisar los nombres de las partes, no
           antes: escribir el desarrollo tarda minutos y se escribe sobre la
           estructura que quede aquí. Pedirlo antes de que la revise sería
           gastarle el tiempo en partes que va a borrar. -->
      <label class="tn-des">
        <input type="checkbox" id="tnDesarrollo">
        <span><b>Escribir también el desarrollo de cada parte</b>
          <small>La IA redacta el texto con tu temario y tus instrucciones.
            Tarda alrededor de un minuto por parte. Lo revisas y lo ajustas
            antes de entregar.</small></span>
      </label>
      <div class="tn-prog" id="tnProg" hidden></div>`;
  }

  // Los títulos que se hayan editado se leen antes de tocar la lista, para no
  // perder lo que el estudiante escribió en los recuadros.
  function recogerTitulos() {
    document.querySelectorAll('#tnVista input[data-parte]').forEach((inp) => {
      const s = borrador.estructura.secciones[+inp.dataset.parte];
      if (s) s.titulo = inp.value.trim().slice(0, 60) || s.titulo;
    });
  }
  function _quitar(i) {
    recogerTitulos();
    if (borrador.estructura.secciones.length <= 1) return;
    borrador.estructura = { ...borrador.estructura,
      secciones: borrador.estructura.secciones.filter((_, k) => k !== i) };
    pintarVista();
  }
  function _anadir() {
    recogerTitulos();
    borrador.estructura = { ...borrador.estructura,
      secciones: [...borrador.estructura.secciones, { titulo: 'Nueva parte', pide: '', empezar: [] }] };
    pintarVista();
  }

  async function crear() {
    if (!borrador) return;
    recogerTitulos();

    const quiere = document.getElementById('tnDesarrollo')?.checked;
    if (quiere) {
      const prog = document.getElementById('tnProg');
      const acc = document.querySelector('#tnVista .tn-acc');
      if (acc) acc.style.display = 'none';
      if (prog) prog.hidden = false;
      const pintar = (hechas, total) => {
        if (!prog) return;
        prog.innerHTML = `<div class="tn-barra"><i style="width:${
          Math.round((hechas / total) * 100)}%"></i></div>
          <span>Escribiendo la parte ${hechas + 1} de ${total}… no cierres esta ventana.</span>`;
      };
      const escritas = await redactarTodo(borrador.estructura, borrador.datos, pintar);
      if (prog) {
        prog.innerHTML = escritas
          ? `<span class="tn-hecho">Listo: ${escritas} de ${
              borrador.estructura.secciones.length} partes con desarrollo.</span>`
          : `<span class="mal">No se pudo escribir el desarrollo. Revisa la IA
             en Ajustes; el trabajo se crea igual con su estructura.</span>`;
      }
    }

    const t = construir(borrador.datos, borrador.estructura, borrador.sinIA);
    const lista = leer(); lista.push(t); escribir(lista);
    TRABAJOS.push(t);
    borrador = null;
    cerrarCapa();
    irTrabajo(TRABAJOS.length - 1);
  }

  function eliminar(tid) {
    const i = TRABAJOS.findIndex((t) => t.id === tid);
    if (i < 0 || !TRABAJOS[i].propio) return;
    const nombre = document.createElement('div');
    nombre.innerHTML = TRABAJOS[i].titulo;
    if (!confirm(`¿Eliminar «${nombre.textContent}» y todo lo que escribiste en él?`)) return;
    escribir(leer().filter((t) => t.id !== tid));
    TRABAJOS.splice(i, 1);
    if (typeof trabajos !== 'undefined') { delete trabajos[tid]; guardarTrab(); }
    vista = 'leccion';
    render();
  }

  function botonNav() {
    if (!activo) return '';
    return `<button class="lec" onclick="TrabajosNuevos.abrir()">
      <span class="mark" style="border-style:dashed">+</span><span><b>Nuevo trabajo</b><br>
      <span style="font-size:11.5px;color:var(--tx3)">desde las instrucciones del profesor</span></span></button>`;
  }

  function activar() {
    if (activo) return;
    activo = true;
    if (typeof pintarNav === 'function') pintarNav();
  }

  return { abrir, armar, crear, eliminar, botonNav, activar,
           activo: () => activo, _quitar, _anadir, _validar: validar, _construir: construir,
           _encargo: encargo, _BASE: BASE,
           _redactarTodo: redactarTodo, _aParrafos: aParrafos,
           _pasajesDe: pasajesDe, _encargoDesarrollo: encargoDesarrollo };
})();

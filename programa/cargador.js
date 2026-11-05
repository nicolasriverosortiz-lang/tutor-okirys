/* El cargador de temarios — de un PDF del alumno a pasajes buscables.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * QUE SUSTITUYE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * El `contenido.json` que hay hoy salió de raspar el campus de UNIR con
 * Playwright y las credenciales de Nicolás: 425 pasajes de 29 temas de
 * Ingeniería de Sistemas. Funciona, y no se puede vender — está atado a una
 * universidad, a una carrera y a una cuenta.
 *
 * Esto hace lo mismo desde el lado del alumno: arrastra los PDF que ya tiene
 * —el temario que le da su universidad, sus apuntes, la guía docente— y sale
 * el mismo tipo de material buscable, para cualquier carrera.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUE SE TROCEA, Y POR QUE ASI
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Un PDF de 80 páginas es inútil de una pieza: ni se busca bien, ni cabe en
 * lo que se le puede mandar a un modelo como contexto. Hay que partirlo.
 *
 * Se parte por PARRAFOS y no por número de caracteres. Cortar cada 500
 * letras parte las frases por la mitad, y un pasaje que empieza a media
 * oración no se entiende ni al buscarlo ni al enseñárselo al modelo. Los
 * párrafos son la unidad que el autor ya eligió.
 *
 * Y se juntan los cortos: un párrafo de una línea —un título, un pie de
 * figura— no dice nada solo, pero pegado al siguiente sí.
 */

const Cargador = (() => {
  // Ni tan corto que no diga nada, ni tan largo que no quepa en el contexto
  // del modelo. Unos 900 caracteres son ~200 palabras: un párrafo largo o
  // dos normales.
  const MINIMO = 220;
  const OBJETIVO = 900;

  /** Quita lo que ensucia el texto de un PDF sin aportar nada. */
  function limpiar(t) {
    return t
      // Los guiones de final de línea parten palabras: «propo-\nsición».
      .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')
      // Saltos sueltos dentro de una frase: en un PDF son de maquetación,
      // no de párrafo. Los dobles sí separan párrafos y se respetan.
      .replace(/([^\n])\n(?!\n)/g, '$1 ')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Los números de página sueltos y los pies repetidos no son contenido. */
  function esBasura(p) {
    const s = p.trim();
    if (s.length < 25) return true;
    if (/^\d+$/.test(s)) return true;                 // «17»
    if (/^p[áa]gina\s+\d+/i.test(s)) return true;
    if (/^\d+\s*\/\s*\d+$/.test(s)) return true;      // «17 / 80»
    return false;
  }

  function trocear(texto) {
    const parrafos = limpiar(texto).split(/\n{2,}/).filter((p) => !esBasura(p));
    const trozos = [];
    let acumulado = '';

    for (const p of parrafos) {
      const cabe = acumulado.length + p.length < OBJETIVO * 1.4;
      if (acumulado && cabe) {
        acumulado += '\n\n' + p;
      } else {
        if (acumulado.length >= MINIMO) trozos.push(acumulado);
        acumulado = p;
      }
      if (acumulado.length >= OBJETIVO) { trozos.push(acumulado); acumulado = ''; }
    }
    if (acumulado.length >= MINIMO) trozos.push(acumulado);
    return trozos;
  }

  /**
   * El título de un pasaje: la primera línea corta que parezca un epígrafe.
   *
   * Sirve para que el buscador enseñe «1.4. Componentes del razonamiento» en
   * vez de las primeras diez palabras del párrafo, que es lo que hacía que
   * los resultados fueran ilegibles.
   */
  function tituloDe(trozo, respaldo) {
    // EL EPIGRAFE NO ESTA EN SU PROPIA LINEA, Y ESO NO SE PODIA SUPONER.
    //
    // La primera versión miraba `trozo.split('\n')[0]` dando por hecho que
    // «2.1. Introducción y objetivos» venía en un renglón aparte. Medido
    // contra tres PDF reales: 0 títulos detectados de 72 pasajes. pdf.js solo
    // marca fin de línea donde el PDF lo dice, y en un temario maquetado el
    // epígrafe y el texto que le sigue van seguidos:
    //
    //   «2.1. Introducción y objetivos En este tema trataremos…»
    //
    // Así que se busca el epígrafe AL PRINCIPIO del texto, no como línea.
    const limpio = trozo.trim().replace(/\s+/g, ' ');

    // SOLO SE ACEPTA UN EPIGRAFE NUMERADO, Y COMPLETO.
    //
    // Se intentó afinar más —cortar el título donde empieza el cuerpo— y sale
    // mal en cuanto el título lleva un nombre propio: «2.2. Sintaxis de
    // Python» se quedaba en «2.2. Sintaxis de», porque «Python» parece el
    // comienzo de la frase siguiente. Y una cabecera de página con fórmulas
    // pasaba por título.
    //
    // No hay regla que saque títulos fiables de un PDF cualquiera, y un
    // título equivocado es peor que ninguno: el alumno busca algo, lee el
    // rótulo y descarta el pasaje que sí le servía.
    //
    // Así que se acepta el patrón inequívoco —número, punto, y un texto que
    // termina antes de que empiece una oración de verdad— y para todo lo
    // demás se enseñan las primeras palabras del pasaje. Eso nunca miente.
    const num = limpio.match(/^(\d+(?:\.\d+){0,3}\.?\s+[^.]{4,60}?)(?=\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\s+[a-záéíóúñ]|\.\s|$)/);
    if (num && !/[+=(){}]|\d\s*\)/.test(num[1])) return num[1].trim();

    // EL RESPALDO SON LAS PRIMERAS PALABRAS, no «parte 3».
    // «matrices · parte 3» no le dice nada a nadie; las primeras palabras del
    // pasaje sí dejan reconocerlo en una lista de resultados.
    const asomo = limpio.slice(0, 62);
    return asomo.length < limpio.length
      ? asomo.replace(/\s\S*$/, '') + '…'
      : (asomo || respaldo);
  }

  return {
    /**
     * Lee un PDF y devuelve sus pasajes. No guarda nada: eso lo decide quien
     * llama, después de enseñárselos al alumno.
     *
     * `alAvanzar(hecho, total)` se llama por página, porque un temario de 200
     * páginas tarda y una barra parada parece que se colgó.
     */
    async leerPDF(archivo, alAvanzar) {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('No se cargó el lector de PDF. Comprueba que '
          + 'pdfjs.js y pdfjs-worker.js están junto a tutor.html.');
      }
      const datos = new Uint8Array(await archivo.arrayBuffer());
      const doc = await pdfjsLib.getDocument({ data: datos }).promise;

      let texto = '';
      for (let n = 1; n <= doc.numPages; n++) {
        const pag = await doc.getPage(n);
        const cont = await pag.getTextContent();
        // `str` con un espacio entre trozos, y salto donde pdf.js marca fin
        // de línea. Sin `hasEOL` el texto sale todo pegado en un renglón y
        // no hay párrafos que trocear.
        let linea = '';
        for (const it of cont.items) {
          linea += it.str;
          if (it.hasEOL) { texto += linea.trimEnd() + '\n'; linea = ''; }
          else if (!it.str.endsWith(' ')) linea += ' ';
        }
        if (linea.trim()) texto += linea + '\n';
        texto += '\n';
        if (alAvanzar) alAvanzar(n, doc.numPages);
      }

      const nombre = archivo.name.replace(/\.pdf$/i, '');
      const trozos = trocear(texto);

      // UN PDF SIN TEXTO ES UN ESCANEO, Y HAY QUE DECIRLO.
      // Una foto de una hoja no tiene texto que sacar. Si se devuelve una
      // lista vacía sin explicar, el alumno cree que la app está rota.
      if (!trozos.length) {
        throw new Error(
          `«${nombre}» no tiene texto que se pueda leer. Suele pasar con los `
          + 'PDF escaneados: son fotos de páginas. Necesitas una versión '
          + 'con texto, o pasarlo antes por un OCR.');
      }

      return trozos.map((t, i) => ({
        nombreMateria: nombre,
        titulo: tituloDe(t, `${nombre} · parte ${i + 1}`),
        texto: t,
        origen: archivo.name,
        pagina: null,
      }));
    },

    /** Para pegar texto a mano, sin PDF. */
    deTexto(texto, nombre) {
      return trocear(texto).map((t, i) => ({
        nombreMateria: nombre,
        titulo: tituloDe(t, `${nombre} · parte ${i + 1}`),
        texto: t,
        origen: 'escrito a mano',
        pagina: null,
      }));
    },

    trocear,
  };
})();

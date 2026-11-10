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

  // LOS TOPES. Un temario universitario de una materia rara vez pasa de
  // 300 páginas o 40 MB; lo que llega por encima o es un libro entero
  // —que da peores lecciones, porque el contexto se diluye— o es un
  // archivo pensado para tumbar la app. En los dos casos la respuesta
  // es la misma y hay que decirla con palabras, no con una ventana
  // colgada.
  const MAX_BYTES = 60 * 1e6;
  const MAX_PAGINAS = 400;
  const MAX_CARACTERES = 4e6;

  // ───────────────────────────────────────────────────────────────────
  // LO QUE SE LE QUITA A UN PDF ANTES DE QUE NADIE LO TOQUE
  // ───────────────────────────────────────────────────────────────────
  //
  // El PDF lo trae el alumno y puede venir de cualquier parte: un grupo
  // de WhatsApp, una web de apuntes, un correo. No es un archivo de
  // confianza, aunque quien lo carga sí lo sea.
  //
  // Tres cosas que un PDF preparado puede esconder y que aquí se van:
  //
  // 1. CARACTERES INVISIBLES. El ancho cero (U+200B-200D, U+FEFF) y los
  //    de dirección (U+202A-202E, U+2066-2069) no se ven al leer el PDF
  //    pero sí llegan al modelo. Con ellos se puede escribir una
  //    instrucción que una persona no lee y la máquina sí. También
  //    sirven para partir palabras y saltarse filtros: «scr​ipt».
  //
  // 2. CARACTERES DE CONTROL. No aportan nada a un temario y ensucian
  //    tanto el prompt como el almacén.
  //
  // 3. ETIQUETAS. Un PDF puede llevar «<img src=x onerror=...>» como
  //    texto. Hoy el buscador lo escapa bien, pero basta que algún día
  //    alguien pinte un pasaje sin escapar para abrir un agujero. Se
  //    quita en el origen y deja de ser un problema de quien pinta.
  //
  // Lo que NO se intenta aquí es detectar inyecciones de prompt por su
  // texto —«ignora las instrucciones anteriores»—. Esa lista siempre va
  // por detrás de quien la quiere saltar. Contra eso vale delimitar el
  // pasaje en el prompt y limpiar lo que el modelo devuelve, que es lo
  // que ya hace `generador.js`.
  const INVISIBLES =
    /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
  const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

  function desarmar(t) {
    return String(t || '')
      .replace(INVISIBLES, '')
      .replace(CONTROL, ' ')
      // Las etiquetas se convierten en texto legible en vez de borrarse:
      // si el temario habla DE HTML —y en ingeniería de sistemas pasa—,
      // el alumno tiene que poder leer el ejemplo.
      .replace(/</g, '‹')
      .replace(/>/g, '›');
  }

  /** Quita lo que ensucia el texto de un PDF sin aportar nada. */
  function limpiar(t) {
    return desarmar(t)
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
    _desarmar: desarmar,     // lo usa revisar_limpieza.html
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

      // ─────────────────────────────────────────────────────────────
      // EL WORKER. SIN ESTA LÍNEA LA APP SE CONGELA ENTERA.
      // ─────────────────────────────────────────────────────────────
      // `pdfjs-worker.js` estaba junto a `tutor.html` —un mega entero— y
      // hasta el mensaje de error de aquí arriba lo nombraba. Pero nadie
      // le decía nunca a pdf.js dónde encontrarlo.
      //
      // Sin `workerSrc`, pdf.js no se queja: se pasa a su modo de
      // respaldo y analiza el PDF EN EL HILO DE LA INTERFAZ. Con un
      // temario de cien páginas la ventana deja de responder por
      // completo —no cierra, no abre, nada— y el proceso padre marca 0 %
      // de CPU, porque quien está quemando el procesador es el proceso
      // hijo del WebView. Parece colgada sin motivo.
      //
      // Encontrado el 09/11/2026, cargando sus PDF de verdad.
      //
      // Se pone aquí y no al cargar la página porque `pdfjsLib` no existe
      // hasta que el navegador termina de leer `pdfjs.js`; en `<head>`
      // sería `undefined`. Es idempotente: cuesta nada repetirlo.
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-worker.js';
      }

      // EL TAMAÑO, ANTES DE ABRIRLO.
      // Un PDF de 400 MB no se rechaza por sospechoso: se rechaza porque
      // cargarlo entero en memoria deja la app inservible, y el alumno
      // merece saber por qué en vez de ver una ventana muerta.
      if (archivo.size > MAX_BYTES) {
        throw new Error(
          `«${archivo.name}» pesa ${(archivo.size / 1e6).toFixed(0)} MB y el `
          + `tope son ${MAX_BYTES / 1e6} MB. Pártelo por capítulos: además `
          + 'el tutor arma mejores lecciones con un temario por materia.');
      }

      const datos = new Uint8Array(await archivo.arrayBuffer());
      const doc = await pdfjsLib.getDocument({
        data: datos,
        // SIN `new Function`, PARA PODER CERRAR LA CSP.
        //
        // pdf.js compila con `new Function` las funciones PostScript de
        // tipo 4 que algunos PDF usan para degradados. Es la única razón
        // por la que la app necesitaba `unsafe-eval` en su política de
        // seguridad, y `unsafe-eval` es lo que convierte una inyección
        // en ejecución de código arbitrario.
        //
        // Con esto pdf.js usa su intérprete propio: algo más lento en
        // esos PDF concretos, y ninguna diferencia en un temario, que no
        // lleva degradados. A cambio se quita un permiso que valía para
        // todo el programa.
        isEvalSupported: false,
        // Tampoco hace falta ejecutar el JavaScript que un PDF puede
        // llevar incrustado. Un temario no lo necesita; un PDF hostil
        // sí lo agradecería.
        enableScripting: false,
      }).promise;

      if (doc.numPages > MAX_PAGINAS) {
        throw new Error(
          `«${archivo.name}» tiene ${doc.numPages} páginas y el tope son `
          + `${MAX_PAGINAS}. Carga el capítulo que estés estudiando.`);
      }

      let texto = '';
      for (let n = 1; n <= doc.numPages; n++) {
        // Y EL TOPE DE TEXTO, POR SI LAS PÁGINAS SON POCAS PERO ENORMES.
        // Un PDF puede tener diez páginas con un millón de caracteres
        // cada una. El contador de páginas no lo ve venir.
        if (texto.length > MAX_CARACTERES) {
          texto += '\n\n[El temario se cortó aquí: superó el tamaño máximo.]';
          break;
        }
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

/* Abre el generador de lecciones, que en el producto viaja cifrado.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUE EXISTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `generador.js` es lo que convierte los PDF del alumno en lecciones. Sin
 * él, el tutor abre y no sirve para nada.
 *
 * Hasta ahora la licencia se comprobaba entera en el computador del alumno:
 * un `return {}` en `licencia.js` desbloqueaba el tutor completo, y como la
 * descarga es publica, sin comprar ni una licencia. Ahora el generador va
 * cifrado y la llave la entrega el servidor solo contra una licencia valida.
 *
 * LO QUE ESTO CONSIGUE: que haga falta una licencia de verdad, al menos una
 * vez.
 *
 * LO QUE NO: quien compre una puede sacar el codigo descifrado de su propio
 * navegador. En un programa que corre sin servidor eso no se puede evitar, y
 * fingir lo contrario seria peor que no hacer nada.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUE UN <script> CON UNA CADENA Y NO UN fetch()
 * ══════════════════════════════════════════════════════════════════════════
 *
 * El tutor se abre desde el disco. Un `fetch('generador.cif')` desde
 * `file://` lo bloquea el navegador: no hay servidor y el origen es `null`.
 * Un `<script src>` si funciona desde ahi — es el mismo motivo por el que la
 * huella del equipo vive en `config.js` y no en un archivo de datos.
 *
 * Asi que el cifrado viaja como `generador-cifrado.js`, que solo declara una
 * cadena en base64.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SE ABRE TARDE, NO AL ARRANCAR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * El generador solo hace falta cuando el alumno pulsa «Generar». Descifrar
 * al arrancar alargaria cada apertura del tutor para algo que se usa una vez
 * por materia. Este objeto tiene la misma forma que el `Generador` de
 * verdad; en la primera llamada lo descifra y a partir de ahi le pasa todo.
 */

const Generador = (() => {
  let real = null;
  let abriendo = null;

  function bytesDeHex(hex) {
    const n = hex.length / 2;
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
    return b;
  }

  function bytesDeBase64(b64) {
    const s = atob(b64);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  async function descifrar() {
    if (typeof GENERADOR_CIFRADO === 'undefined' || !GENERADOR_CIFRADO) {
      throw new Error('Falta generador-cifrado.js. Vuelve a ejecutar el '
        + 'instalador.');
    }
    // `crypto.subtle` solo existe en un contexto seguro. `file://` lo es en
    // Chrome, Edge y Firefox; en Safari no siempre. Se dice con todas las
    // letras porque el sintoma —«Generar» que no hace nada— no lleva a
    // nadie a sospechar del navegador.
    if (!globalThis.crypto || !crypto.subtle) {
      throw new Error('Este navegador no deja descifrar el generador. '
        + 'Abre el tutor en Chrome.');
    }

    const lic = await Licencia.activa();
    if (!lic) throw new Error('Activa tu licencia antes de generar.');
    if (!lic.gen) {
      // Pasa si activo con una version anterior del servidor. Reactivar
      // vuelve a pedirla y no gasta otro puesto: la activacion ya existe
      // para esta huella.
      throw new Error('Tu activacion es de una version anterior. Vuelve a '
        + 'escribir tu licencia en Ajustes para terminar de activarla.');
    }

    const crudo = bytesDeBase64(GENERADOR_CIFRADO);
    // Los 12 primeros bytes son el vector; el resto, el contenido.
    const vector = crudo.slice(0, 12);
    const cuerpo = crudo.slice(12);
    const llave = await crypto.subtle.importKey(
      'raw', bytesDeHex(lic.gen), { name: 'AES-GCM' }, false, ['decrypt']);

    let fuente;
    try {
      const abierto = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: vector }, llave, cuerpo);
      fuente = new TextDecoder().decode(abierto);
    } catch (e) {
      // AES-GCM comprueba la integridad: si la llave no es la que cifro, o
      // el archivo esta tocado, falla aqui y no devuelve basura.
      throw new Error('La llave de tu licencia no abre este generador. '
        + 'Escribenos y lo revisamos.');
    }

    // El codigo descifrado declara `const Generador`. Se evalua dentro de
    // una funcion para que ese nombre viva ahi y no choque con este de
    // fuera, y se devuelve lo que construyo.
    const fabricar = new Function(`${fuente}\n;return Generador;`);
    const g = fabricar();
    if (!g || typeof g.generar !== 'function') {
      throw new Error('El generador descifrado no es el que se esperaba.');
    }
    return g;
  }

  async function abrir() {
    if (real) return real;
    // Una sola apertura aunque lleguen dos llamadas a la vez: descifrar dos
    // veces no rompe nada, pero son dos evaluaciones del mismo codigo.
    if (!abriendo) {
      abriendo = descifrar().then((g) => { real = g; return g; })
        .catch((e) => { abriendo = null; throw e; });
    }
    return abriendo;
  }

  return {
    async generar(...args) { return (await abrir()).generar(...args); },
    async fichas(...args) { return (await abrir()).fichas(...args); },
    /** Para las pruebas: ¿se puede abrir aqui y ahora? */
    async disponible() {
      try { await abrir(); return { ok: true }; }
      catch (e) { return { ok: false, motivo: String(e.message || e) }; }
    },
  };
})();

/* La licencia — activar una vez, funcionar siempre.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * QUE PROTEGE Y QUE NO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Protege contra que un alumno le pase la carpeta a treinta compañeros. El
 * token de descifrado depende del equipo: copiada, no abre.
 *
 * NO protege contra alguien decidido que ya activó y quiere extraer el
 * contenido. El programa corre en su navegador y todo lo que el navegador
 * puede leer, él puede leerlo. Cualquiera que prometa lo contrario está
 * vendiendo humo.
 *
 * La diferencia entre las dos cosas es la que hace que valga la pena: copiar
 * deja de ser trivial, y con eso basta para que la gente compre.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LA HUELLA DEL EQUIPO: POR QUE VIENE DE UN ARCHIVO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Un navegador no puede leer el número de serie del disco ni nada parecido —
 * y menos mal, porque eso sería rastrear a la gente.
 *
 * Lo primero que se piensa es guardar un identificador al azar en el almacén
 * del navegador. Y funciona hasta que el alumno borra los datos de
 * navegación: entonces sale una huella nueva, la activación gasta OTRO
 * puesto, y a la tercera vez se queda fuera de su propia licencia. Un fallo
 * que solo aparece semanas después y que se lleva por delante la confianza.
 *
 * Por eso la huella la escribe EL INSTALADOR en `equipo.js`, un archivo que
 * se carga con `<script src>` — que sí funciona desde `file://`. Vive en la
 * carpeta del programa, no en el navegador: borrar el historial no lo toca,
 * y cambiar de navegador tampoco.
 *
 * Si ese archivo no está —alguien copió la carpeta a mano— se cae al almacén
 * del navegador, para no dejar el programa muerto. Pero se avisa, porque esa
 * huella sí se puede perder.
 */

const Licencia = (() => {
  // Se rellenan al instalar. Aquí van vacías a propósito: este archivo se
  // lee tal cual en el repositorio y no debe llevar credenciales.
  const CFG = {
    url: (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) || '',
    clave: (typeof SUPABASE_ANON !== 'undefined' && SUPABASE_ANON) || '',
  };

  async function huella() {
    // 1. La que dejó el instalador. Es la buena.
    if (typeof EQUIPO !== 'undefined' && EQUIPO) return EQUIPO;

    // 2. Respaldo: una al azar guardada en el almacén. Se avisa arriba de por
    //    qué es peor.
    let h = await Almacen.ajuste('huella');
    if (!h) {
      h = 'nav-' + crypto.randomUUID();
      await Almacen.ajuste('huella', h);
    }
    return h;
  }

  return {
    /** ¿Ya está activado en este equipo? No pregunta al servidor. */
    async activa() {
      const g = await Almacen.ajuste('licencia');
      if (!g?.token) return null;
      // La activación guardada tiene que ser de ESTA huella. Si la carpeta se
      // copió a otro computador, la huella cambia y esto no vale.
      if (g.huella !== await huella()) return null;
      return g;
    },

    /**
     * Activa contra el servidor. Devuelve {ok, motivo} — nunca lanza.
     *
     * Un fallo de red no puede parecer una licencia inválida: son dos cosas
     * distintas y se arreglan de forma distinta. Quien esté sin internet
     * tiene que saber que es eso, no creer que le vendieron una clave mala.
     */
    async activar(clave) {
      if (!CFG.url || !CFG.clave) {
        return { ok: false, motivo: 'Esta copia no está configurada. Avisa a quien te la instaló.' };
      }
      const h = await huella();
      let r;
      try {
        r = await fetch(`${CFG.url}/rest/v1/rpc/activar`, {
          method: 'POST',
          signal: AbortSignal.timeout(20000),
          headers: {
            apikey: CFG.clave,
            Authorization: `Bearer ${CFG.clave}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_clave: clave, p_huella: h }),
        });
      } catch (e) {
        return {
          ok: false,
          red: true,
          motivo: 'No hay conexión con internet. La activación se hace una '
            + 'sola vez; después el tutor funciona sin conexión.',
        };
      }
      if (!r.ok) {
        return { ok: false, red: true,
          motivo: `El servidor de licencias respondió ${r.status}. Inténtalo en un rato.` };
      }

      const j = await r.json();
      if (!j?.ok) return { ok: false, motivo: j?.motivo || 'Licencia no válida.' };

      // `gen` es la llave con la que se abre el generador de lecciones en el
      // producto. Se guarda AQUI, al activar, y no se vuelve a pedir: el
      // tutor tiene que funcionar sin internet, y pedirla en cada arranque
      // lo ataría a tener conexión. El servidor solo la entrega a quien
      // presenta una licencia válida, que es justo lo que se quería: sin
      // comprar una vez, el generador no abre.
      //
      // En el tutor de Nicolás este campo llega vacío y no pasa nada: ahí el
      // generador va en claro.
      await Almacen.ajuste('licencia', {
        clave, token: j.token, huella: h, gen: j.gen || null,
        activada: new Date().toISOString(),
        vence: j.vence || null,
      });
      return { ok: true, ...j };
    },

    /** El token con el que se descifra el contenido. */
    async token() {
      return (await this.activa())?.token || null;
    },

    /** Para la pantalla de ajustes: qué licencia hay puesta, sin enseñarla entera. */
    async resumen() {
      const g = await this.activa();
      if (!g) return null;
      return {
        clave: g.clave.slice(0, 6) + '…' + g.clave.slice(-4),
        activada: g.activada,
        vence: g.vence,
        propia: typeof EQUIPO !== 'undefined' && !!EQUIPO,
      };
    },

    /** Solo para pruebas: olvida la activación de este equipo. */
    async olvidar() {
      await Almacen.ajuste('licencia', null);
    },
  };
})();

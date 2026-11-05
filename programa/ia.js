/* El motor de IA — uno solo por fuera, tres por dentro.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUE HACE FALTA
 * ══════════════════════════════════════════════════════════════════════════
 *
 * El tutor de hoy habla con LM Studio y solo con LM Studio, en
 * `localhost:1234`, escrito a mano dentro de `tutor.html`. Para el que lo
 * hizo está bien; para vendérselo a un estudiante, no:
 *
 *   · No todos van a instalar 2 GB de LM Studio, y en un portátil justo va
 *     lento hasta ser inservible.
 *   · Quien prefiera poner su propia clave y pagar por uso no tiene forma.
 *
 * Aquí conviven los dos caminos detrás de la MISMA interfaz, para que el
 * resto de la aplicación —el chat, el generador de lecciones— no tenga que
 * saber cuál está puesto.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LA CLAVE DEL ALUMNO NO PASA POR NINGUN SERVIDOR NUESTRO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Va del navegador del alumno al proveedor, directa. Nosotros no la vemos, no
 * la guardamos y no la podemos perder. Es una decisión de diseño, no un
 * descuido: en cuanto una clave ajena pasa por un servidor propio, se
 * convierte en algo que hay que custodiar, y un fallo ahí le cuesta dinero a
 * quien confió.
 *
 * Se guarda en el almacén local del alumno, en SU computador. Si lo formatea,
 * la vuelve a poner.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SE RESPETA EL COMPORTAMIENTO QUE YA TENIA
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `temperature: 0.3`, `max_tokens` por defecto 220, tiempos de espera de 4 s
 * para detectar y 90 s para responder, y descartar los modelos de embeddings
 * al elegir. Todo eso viene de `tutor.html` tal cual: son decisiones que ya
 * funcionan y no se tocan por gusto.
 */

const IA = (() => {
  const LOCAL_POR_DEFECTO = 'http://localhost:1234/v1';

  let cfg = {
    motor: 'local',        // 'local' | 'openai' | 'anthropic'
    url: LOCAL_POR_DEFECTO,
    clave: '',
    modelo: null,
  };
  let listo = false;

  const esperar = (ms) => AbortSignal.timeout(ms);

  /** Traduce un fallo de red a algo que el alumno pueda arreglar. */
  function explicar(e, motor) {
    const t = String(e?.message || e);
    if (/aborted|timeout|abort/i.test(t)) {
      return 'La IA tardó demasiado en responder.';
    }
    if (motor === 'local') {
      // «Failed to fetch» contra localhost casi siempre es una de dos cosas,
      // y las dos tienen arreglo. Decir «error de red» no ayuda a nadie.
      return 'No se pudo hablar con LM Studio. Comprueba que está abierto y '
        + 'que el servidor está encendido con CORS: en una terminal, '
        + '«lms server start --cors».';
    }
    if (/401|403|invalid.*key|unauthorized/i.test(t)) {
      return 'La clave de API no es válida o no tiene permiso.';
    }
    if (/429/.test(t)) return 'El proveedor pidió esperar: demasiadas peticiones seguidas.';
    if (/insufficient|quota|credit/i.test(t)) {
      return 'La cuenta del proveedor se quedó sin saldo.';
    }
    return t;
  }

  async function json(url, opciones) {
    const r = await fetch(url, opciones);
    if (!r.ok) {
      let detalle = '';
      try { detalle = (await r.text()).slice(0, 200); } catch { /* da igual */ }
      throw new Error(`HTTP ${r.status} ${detalle}`);
    }
    return r.json();
  }

  return {
    LOCAL_POR_DEFECTO,

    configurar(nuevo) {
      // AL CAMBIAR DE MOTOR SE OLVIDA EL MODELO DEL ANTERIOR.
      //
      // Sin esto, quien pasa de LM Studio a su clave de OpenAI se lleva
      // `google/gemma-3-4b` puesto, y la primera pregunta falla con un
      // «modelo no encontrado» que no explica nada. Lo cazó la prueba: los
      // ajustes salían con motor «openai» y modelo de gemma.
      //
      // Se olvida solo cuando CAMBIA el motor, no en cada guardado: si no,
      // tocar cualquier ajuste obligaría a volver a elegir modelo.
      const cambiaMotor = nuevo.motor && nuevo.motor !== cfg.motor;
      cfg = { ...cfg, ...nuevo };
      if (cambiaMotor && !nuevo.modelo) cfg.modelo = null;
      listo = false;
      return cfg;
    },

    ajustes() {
      // La clave NO se devuelve entera: esto se usa para pintar la pantalla
      // de ajustes, y una clave completa en el DOM acaba en una captura de
      // pantalla o en un registro de errores.
      return {
        ...cfg,
        clave: cfg.clave ? '••••' + cfg.clave.slice(-4) : '',
        listo,
      };
    },

    conectado() { return listo; },
    modelo() { return cfg.modelo; },

    /**
     * ¿Responde? Y con qué modelos. Es lo que pinta el semáforo de arriba.
     *
     * Devuelve `{ok, modelos, modelo, error}` — nunca lanza. Un tutor que se
     * cae porque la IA no está no sirve: las lecciones y los ejercicios
     * funcionan sin ella, y así estaba hecho.
     */
    async probar() {
      try {
        if (cfg.motor === 'anthropic') {
          // Anthropic no expone `/models` sin clave válida, así que la prueba
          // es una pregunta mínima. Un token de respuesta basta para saber
          // que la clave sirve.
          await json(`${cfg.url || 'https://api.anthropic.com'}/v1/messages`, {
            method: 'POST',
            signal: esperar(15000),
            headers: {
              'content-type': 'application/json',
              'x-api-key': cfg.clave,
              'anthropic-version': '2023-06-01',
              // SIN ESTA CABECERA, ANTHROPIC RECHAZA AL NAVEGADOR.
              // Su API bloquea las llamadas directas desde el navegador por
              // defecto, justamente para que nadie exponga su clave en una
              // web pública. Aquí es distinto: la clave es del alumno, está
              // en su computador y no sale a ningún sitio más.
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
              model: cfg.modelo || 'claude-haiku-4-5',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'hola' }],
            }),
          });
          listo = true;
          return { ok: true, modelos: [], modelo: cfg.modelo };
        }

        // LM Studio y cualquier API compatible con OpenAI comparten `/models`.
        const j = await json(`${cfg.url}/models`, {
          signal: esperar(cfg.motor === 'local' ? 4000 : 15000),
          headers: cfg.clave ? { Authorization: `Bearer ${cfg.clave}` } : {},
        });
        // Fuera los de embeddings: no contestan a un chat y elegir uno deja
        // el tutor mudo sin decir por qué. Viene de `tutor.html`.
        const todos = (j.data || []).map((m) => m.id)
          .filter((id) => !/embed/i.test(id));
        if (!todos.length) throw new Error('No hay modelos de chat disponibles.');

        // Y FUERA LOS QUE TAMPOCO SON DE CHAT, aunque no digan «embed».
        //
        // Se vio con Groq el 22/10/2026. Su lista trae, mezclados y sin
        // orden: transcriptores (whisper), voces (orpheus), clasificadores
        // de seguridad (prompt-guard, safeguard) y los de conversar. Como
        // aquí se cogía `modelos[0]`, el tutor se quedaba con el primero que
        // devolviera la API — ese día, un clasificador de seguridad.
        //
        // Lo peligroso es la forma del fallo: `probar()` dice OK porque
        // `/models` contestó, el tutor se pinta «Conectada con…», y es cada
        // pregunta la que falla después. Si el que sale primero es whisper,
        // la respuesta es «no soporta chat completions» y el alumno no tiene
        // forma de saber que basta con cambiar de modelo.
        const NO_CHAT = /whisper|orpheus|\bguard\b|guard-|safeguard|tts|rerank|moderation/i;
        const chat = todos.filter((id) => !NO_CHAT.test(id));
        // Si el filtro se lo lleva todo, manda la lista sin filtrar: en LM
        // Studio los nombres los pone el alumno y no hay que adivinarlos.
        const modelos = chat.length ? chat : todos;
        if (!cfg.modelo || !modelos.includes(cfg.modelo)) cfg.modelo = modelos[0];
        listo = true;
        return { ok: true, modelos, modelo: cfg.modelo };
      } catch (e) {
        listo = false;
        return { ok: false, modelos: [], modelo: null, error: explicar(e, cfg.motor) };
      }
    },

    /**
     * Una pregunta. `mensajes` en el formato de siempre: [{role, content}].
     *
     * `maxTok` por defecto 220 como en el tutor original — las respuestas del
     * chat son cortas a propósito. El generador de lecciones pide más.
     */
    async preguntar(mensajes, maxTok = 220) {
      if (!listo) {
        const p = await this.probar();
        if (!p.ok) throw new Error(p.error);
      }

      if (cfg.motor === 'anthropic') {
        // Anthropic separa el mensaje de sistema del resto; los demás lo
        // llevan dentro de `messages`. Se traduce aquí para que quien llama
        // no tenga que saberlo.
        const sistema = mensajes.filter((m) => m.role === 'system')
          .map((m) => m.content).join('\n\n');
        const resto = mensajes.filter((m) => m.role !== 'system');
        const j = await json(`${cfg.url || 'https://api.anthropic.com'}/v1/messages`, {
          method: 'POST',
          signal: esperar(90000),
          headers: {
            'content-type': 'application/json',
            'x-api-key': cfg.clave,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: cfg.modelo || 'claude-haiku-4-5',
            max_tokens: maxTok,
            ...(sistema ? { system: sistema } : {}),
            messages: resto,
          }),
        });
        return (j.content || []).filter((b) => b.type === 'text')
          .map((b) => b.text).join('').trim();
      }

      const j = await json(`${cfg.url}/chat/completions`, {
        method: 'POST',
        signal: esperar(90000),
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.clave ? { Authorization: `Bearer ${cfg.clave}` } : {}),
        },
        body: JSON.stringify({
          model: cfg.modelo,
          temperature: 0.3,
          max_tokens: maxTok,
          messages: mensajes,
        }),
      });
      return (j.choices?.[0]?.message?.content || '').trim();
    },

    /** Guarda y recupera la configuración del almacén del alumno. */
    async cargarDelAlmacen() {
      if (typeof Almacen === 'undefined') return cfg;
      const g = await Almacen.ajuste('ia');
      if (g) cfg = { ...cfg, ...g };
      return cfg;
    },

    async guardarEnAlmacen() {
      if (typeof Almacen === 'undefined') return;
      await Almacen.ajuste('ia', cfg);
    },
  };
})();

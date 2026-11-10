/* La primera pantalla — licencia, motor de IA y temario.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TRES PASOS, EN ESTE ORDEN, Y NO SE PUEDE SALTAR NINGUNO
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   1. Licencia   sin ella no hay token, y sin token no se descifra nada
 *   2. Motor      sin IA no se pueden generar lecciones
 *   3. Temario    sin material no hay nada que generar
 *
 * El orden no es capricho: cada paso necesita el anterior. Enseñarlos todos
 * a la vez dejaría al alumno cargando PDFs que luego no se pueden procesar
 * porque no puso la clave — y esa frustración pasa una sola vez antes de que
 * cierre el programa y no vuelva.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUE ESTA PANTALLA EXISTE APARTE DE `tutor.html`
 * ══════════════════════════════════════════════════════════════════════════
 *
 * El tutor de Nicolás arranca directamente en las lecciones porque su
 * contenido ya está ahí. El de un alumno nuevo arranca vacío, y una
 * aplicación vacía sin nada que decirte es una aplicación rota.
 *
 * Cuando los tres pasos están hechos, esta pantalla no vuelve a aparecer: se
 * llega a ella desde un botón, para cambiar la clave o añadir otra materia.
 */

const Ajustes = (() => {
  const $ = (s, d = document) => d.querySelector(s);

  /* ── los proveedores de IA, con su dirección puesta ──────────────────
   *
   * POR QUE ESTAN AQUI Y NO LOS ESCRIBE EL ALUMNO
   * Porque `https://api.groq.com/openai/v1` no se recuerda ni se dicta por
   * WhatsApp, y una barra de más devuelve un error de red que no dice nada.
   *
   * LOS TRES PRIMEROS SON GRATIS Y SIN TARJETA, y eso cambia a quién le
   * sirve el tutor: LM Studio son 2 GB y pide un equipo con fuerza, así que
   * quien estudia con un portátil justo se quedaba fuera.
   *
   * SE COMPROBO QUE DEJAN HABLAR A UN ARCHIVO LOCAL (22/10/2026). El tutor
   * se abre desde el disco, así que sus peticiones salen con `Origin: null`
   * y muchas APIs las rechazan de plano. Se midió la respuesta al preflight
   * de cada uno: Groq devuelve `allow-origin: *`, Gemini devuelve `null` y
   * Cerebras `*`. OpenRouter no contesta al preflight — por eso no está.
   */
  const PROVEEDORES = {
    groq: {
      url: 'https://api.groq.com/openai/v1',
      ayuda: 'Gratis y sin tarjeta. Crea la clave en console.groq.com '
           + '(entras con Google) → API Keys → Create. Empieza por «gsk_».',
    },
    gemini: {
      url: 'https://generativelanguage.googleapis.com/v1beta/openai',
      ayuda: 'Gratis y sin tarjeta. Crea la clave en '
           + 'aistudio.google.com/apikey con tu cuenta de Google.',
    },
    cerebras: {
      url: 'https://api.cerebras.ai/v1',
      ayuda: 'Gratis y sin tarjeta. Crea la clave en cloud.cerebras.ai '
           + '→ API Keys.',
    },
    openai: {
      url: 'https://api.openai.com/v1',
      ayuda: 'De pago por uso. La clave sale de platform.openai.com.',
    },
    anthropic: {
      url: 'https://api.anthropic.com',
      ayuda: 'De pago por uso. La clave sale de console.anthropic.com.',
    },
    otro: {
      url: '',
      ayuda: 'Cualquier servicio compatible con OpenAI. Escribe su dirección '
           + 'arriba, la que termina en «/v1».',
    },
  };

  /** Qué proveedor tiene puesto, deducido de la dirección guardada. */
  function proveedorDe(cfg) {
    if (cfg.motor === 'anthropic') return 'anthropic';
    if (!cfg.url) return 'groq';
    const hallado = Object.keys(PROVEEDORES)
      .find((k) => PROVEEDORES[k].url && PROVEEDORES[k].url === cfg.url);
    return hallado || 'otro';
  }

  /** ¿Qué falta por hacer? Decide qué se enseña al abrir. */
  async function estado() {
    const lic = await Licencia.activa();
    await IA.cargarDelAlmacen();
    const motor = await IA.probar();
    const materias = await Almacen.materias();
    return {
      licencia: !!lic,
      motor: motor.ok,
      motorDetalle: motor,
      materias,
      completo: !!lic && motor.ok && materias.length > 0,
    };
  }

  // ── paso 1 · licencia ──────────────────────────────────────────────────
  function pasoLicencia(e) {
    if (e.licencia) {
      return `<div class="paso hecho">
        <h3>✓ Licencia activada</h3>
        <p class="sub">Este computador ya tiene el tutor activado.
          No hace falta internet para usarlo.</p>
      </div>`;
    }
    return `<div class="paso">
      <h3>1 · Tu licencia</h3>
      <p class="sub">La que te dieron al comprar. Se activa una sola vez y
        queda guardada en este computador.</p>
      <div class="fila">
        <input id="aj-lic" placeholder="TUTOR-XXXX-XXXX" autocomplete="off"
               spellcheck="false">
        <button id="aj-activar" class="pri">Activar</button>
      </div>
      <p class="aviso" id="aj-lic-msg" hidden></p>
    </div>`;
  }

  // ── paso 2 · motor de IA ───────────────────────────────────────────────
  function pasoMotor(e) {
    const c = IA.ajustes();
    const ok = e.motor;
    return `<div class="paso ${ok ? 'hecho' : ''}">
      <h3>${ok ? '✓' : '2 ·'} La IA</h3>
      ${ok ? `<p class="sub">Conectada con <b>${e.motorDetalle.modelo}</b>.</p>`
        : `<p class="sub">El tutor necesita una IA para leer tu temario y
             armar las lecciones. Elige cómo:</p>`}

      <div class="opciones">
        <label class="op ${c.motor === 'local' ? 'sel' : ''}">
          <input type="radio" name="aj-motor" value="local"
                 ${c.motor === 'local' ? 'checked' : ''}>
          <div>
            <b>En mi computador (LM Studio)</b>
            <span>Gratis y para siempre. Tu temario no sale de aquí.
              Hay que instalar LM Studio y pide un equipo con algo de fuerza.</span>
          </div>
        </label>
        <label class="op ${c.motor !== 'local' ? 'sel' : ''}">
          <input type="radio" name="aj-motor" value="openai"
                 ${c.motor !== 'local' ? 'checked' : ''}>
          <div>
            <b>Con una clave en internet</b>
            <span>No hay que instalar nada y va rápido en cualquier equipo,
              aunque sea viejo. <b>Groq, Gemini y Cerebras tienen plan
              gratuito y no piden tarjeta.</b> Tu clave se guarda solo aquí:
              no pasa por ningún servidor nuestro.</span>
          </div>
        </label>
      </div>

      <div id="aj-conf-local" ${c.motor === 'local' ? '' : 'hidden'}>
        <div class="fila">
          <input id="aj-url" value="${c.url || IA.LOCAL_POR_DEFECTO}">
          <button id="aj-probar" class="pri">Probar</button>
        </div>
        <p class="sub">Abre LM Studio y enciende el servidor. Si no conecta,
          en una terminal: <code>lms server start --cors</code></p>
      </div>

      <div id="aj-conf-clave" ${c.motor !== 'local' ? '' : 'hidden'}>
        <div class="fila">
          <select id="aj-proveedor">
            ${[['groq', 'Groq — gratis'], ['gemini', 'Google Gemini — gratis'],
               ['cerebras', 'Cerebras — gratis'], ['openai', 'OpenAI'],
               ['anthropic', 'Anthropic (Claude)'], ['otro', 'Otro compatible']]
              .map(([v, t]) => `<option value="${v}"${
                proveedorDe(c) === v ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
          <input id="aj-clave" type="password" placeholder="pega aquí tu clave"
                 autocomplete="off">
          <button id="aj-probar2" class="pri">Probar</button>
        </div>
        <!-- La casilla de la direccion estaba solo en el bloque de LM Studio.
             «Otro compatible» leia de ahi, de un campo oculto que seguia
             apuntando al propio computador: elegir «Otro» y pegar una clave
             la mandaba a localhost y fallaba sin decir por que. Ahora tiene
             la suya, y solo sale cuando hace falta.
             (Sin comillas invertidas aqui dentro: esto vive en una plantilla
             de texto y una sola la parte en dos.) -->
        <div class="fila" id="aj-fila-url-nube" hidden>
          <input id="aj-url-nube" placeholder="https://… la dirección de tu proveedor"
                 autocomplete="off" spellcheck="false">
        </div>
        <p class="sub" id="aj-ayuda-proveedor"></p>
        ${c.clave ? `<p class="sub">Guardada: <code>${c.clave}</code></p>` : ''}
      </div>
      <p class="aviso" id="aj-motor-msg" hidden></p>
    </div>`;
  }

  // ── paso 3 · temario ───────────────────────────────────────────────────
  function pasoTemario(e) {
    const hay = e.materias.length;
    return `<div class="paso ${hay ? 'hecho' : ''}">
      <h3>${hay ? '✓' : '3 ·'} Tu temario</h3>
      <p class="sub">Arrastra los PDF de tus materias: el temario que te da la
        universidad, la guía docente, tus apuntes. El tutor los lee y arma las
        lecciones con ESE material, no con lo que se invente.</p>

      <div class="soltar" id="aj-soltar">
        <b>Arrastra tus PDF aquí</b>
        <span>o pulsa para buscarlos</span>
        <input type="file" id="aj-archivos" accept="application/pdf" multiple hidden>
      </div>
      <p class="aviso" id="aj-pdf-msg" hidden></p>

      ${hay ? `<table class="materias">
        ${e.materias.map((m) => `<tr>
          <td><b>${m.nombre}</b></td>
          <td>${m.pasajes} pasajes</td>
          <td><button class="min" data-generar="${m.clave}">armar lecciones</button></td>
          <td><button class="min" data-borrar="${m.clave}">quitar</button></td>
        </tr>`).join('')}
      </table>
      <p class="aviso" id="aj-gen-msg" hidden></p>` : ''}
    </div>`;
  }

  return {
    async pintar(donde) {
      const e = await estado();
      donde.innerHTML = `
        <div class="bienvenida">
          <h2>${e.completo ? 'Ajustes' : 'Vamos a montar tu tutor'}</h2>
          ${e.completo ? '' : `<p class="sub">Tres pasos y queda listo.
            Solo hay que hacerlo una vez.</p>`}
          ${pasoLicencia(e)}
          ${e.licencia ? pasoMotor(e) : ''}
          ${e.licencia && e.motor ? pasoTemario(e) : ''}
          ${e.completo ? `<button id="aj-entrar" class="pri grande">
             Entrar al tutor</button>` : ''}
        </div>`;
      this.enganchar(donde);
    },

    enganchar(donde) {
      const decir = (id, txt, mal) => {
        const p = $(id, donde);
        if (!p) return;
        p.hidden = false;
        p.className = 'aviso ' + (mal ? 'mal' : 'ok');
        p.textContent = txt;
      };

      // ── licencia ──
      const bAct = $('#aj-activar', donde);
      if (bAct) bAct.onclick = async () => {
        let clave = $('#aj-lic', donde).value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (/^TUTOR[A-Z0-9]{8}$/.test(clave)) clave = `TUTOR-${clave.slice(5, 9)}-${clave.slice(9)}`;
        if (!clave) return decir('#aj-lic-msg', 'Escribe tu licencia.', true);
        bAct.disabled = true;
        bAct.textContent = 'activando…';
        const r = await Licencia.activar(clave);
        bAct.disabled = false;
        bAct.textContent = 'Activar';
        if (!r.ok) return decir('#aj-lic-msg', r.motivo, true);
        await this.pintar(donde);
      };

      // ── motor ──
      donde.querySelectorAll('[name=aj-motor]').forEach((r) => {
        r.onchange = () => {
          const local = r.value === 'local';
          $('#aj-conf-local', donde).hidden = !local;
          $('#aj-conf-clave', donde).hidden = local;
        };
      });

      // El desplegable de proveedor: enseña su ayuda, y la casilla de la
      // dirección solo cuando de verdad hay que escribirla.
      const sel = $('#aj-proveedor', donde);
      if (sel) {
        const pintarProveedor = () => {
          const d = PROVEEDORES[sel.value] || PROVEEDORES.otro;
          const fila = $('#aj-fila-url-nube', donde);
          if (fila) fila.hidden = !!d.url;
          const ayuda = $('#aj-ayuda-proveedor', donde);
          if (ayuda) ayuda.textContent = d.ayuda;
        };
        sel.onchange = pintarProveedor;
        pintarProveedor();
      }

      const probar = async (motor) => {
        const conf = motor === 'local'
          ? { motor: 'local', url: $('#aj-url', donde).value.trim(), clave: '' }
          : (() => {
              const p = $('#aj-proveedor', donde).value;
              const d = PROVEEDORES[p] || {};
              return {
                motor: p === 'anthropic' ? 'anthropic' : 'openai',
                // Para «otro», la casilla de al lado. Para el resto, la
                // dirección del proveedor, que el alumno no tiene por qué
                // saberse de memoria.
                url: d.url || $('#aj-url-nube', donde)?.value.trim() || '',
                clave: $('#aj-clave', donde).value.trim(),
              };
            })();
        IA.configurar(conf);
        decir('#aj-motor-msg', 'probando…');
        const r = await IA.probar();
        if (!r.ok) return decir('#aj-motor-msg', r.error, true);
        await IA.guardarEnAlmacen();
        await this.pintar(donde);
      };
      const b1 = $('#aj-probar', donde);
      if (b1) b1.onclick = () => probar('local');
      const b2 = $('#aj-probar2', donde);
      if (b2) b2.onclick = () => probar('clave');

      // ── temario ──
      const zona = $('#aj-soltar', donde);
      const campo = $('#aj-archivos', donde);
      if (zona) {
        zona.onclick = () => campo.click();
        zona.ondragover = (ev) => { ev.preventDefault(); zona.classList.add('encima'); };
        zona.ondragleave = () => zona.classList.remove('encima');
        zona.ondrop = (ev) => {
          ev.preventDefault();
          zona.classList.remove('encima');
          this.cargar([...ev.dataTransfer.files], donde, decir);
        };
        campo.onchange = () => this.cargar([...campo.files], donde, decir);
      }

      donde.querySelectorAll('[data-borrar]').forEach((b) => {
        b.onclick = async () => {
          if (!window.confirm('¿Quitar esta materia y todo su temario?')) return;
          await Almacen.borrarMateria(b.dataset.borrar);
          await this.pintar(donde);
        };
      });

      // ── armar lecciones y fichas ──
      donde.querySelectorAll('[data-generar]').forEach((b) => {
        b.onclick = () => this.generar(b.dataset.generar, donde, decir, b);
      });

      const entrar = $('#aj-entrar', donde);
      if (entrar) entrar.onclick = () => {
        donde.dispatchEvent(new CustomEvent('tutor:listo', { bubbles: true }));
      };
    },

    /**
     * Arma lecciones y fichas de una materia.
     *
     * ════════════════════════════════════════════════════════════════════
     * SE AVISA DE LO QUE VA A TARDAR, ANTES DE EMPEZAR
     * ════════════════════════════════════════════════════════════════════
     *
     * Con un modelo local son unos 18 segundos por lección —medido: tres
     * lecciones en 53 s con gemma-3-4b— porque cada una lleva su
     * comprobación de respuestas. Diez lecciones son tres minutos largos.
     *
     * Un botón que se queda pensando tres minutos sin decir nada se pulsa
     * otra vez, y luego otra. Por eso: se dice cuánto va a tardar antes de
     * empezar, y se cuenta cada una mientras avanza.
     */
    /**
     * El aviso que se ve ESTÉ DONDE ESTÉ EL ALUMNO.
     *
     * El mensaje de progreso vivía dentro del panel de ajustes. Armar un
     * temario tarda de tres a cinco minutos, y quien cierra ese panel
     * —que es lo natural, para seguir estudiando mientras tanto— se
     * queda sin una sola señal de que algo esté pasando. Visto el
     * 09/11/2026: la app parecía colgada cuando estaba trabajando.
     *
     * Va pegado a la ventana y por encima de todo, para que no dependa
     * de qué pantalla esté abierta.
     */
    _barra(texto, estado) {
      let b = document.getElementById('gen-barra');
      if (!b) {
        b = document.createElement('div');
        b.id = 'gen-barra';
        b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);'
          + 'bottom:18px;z-index:9999;padding:.7rem 1.1rem;border-radius:999px;'
          + 'font:500 14px/1.4 inherit;box-shadow:0 6px 24px rgba(0,0,0,.28);'
          + 'max-width:min(92vw,560px);text-align:center;'
          + 'background:var(--panel,#1b2330);color:var(--ink,#e8edf4);'
          + 'border:1px solid var(--line,#2a323d)';
        document.body.appendChild(b);
      }
      if (texto === null) { b.remove(); return; }
      b.textContent = texto;
      b.style.borderColor = estado === 'mal' ? '#B3261E'
        : estado === 'bien' ? '#1B7F4C' : 'var(--line,#2a323d)';
      // El mensaje final se queda un rato y se va solo; el de progreso
      // se queda hasta que lo cambien.
      if (estado) setTimeout(() => {
        const v = document.getElementById('gen-barra');
        if (v === b) b.remove();
      }, 12000);
    },

    async generar(clave, donde, decir, boton) {
      const todos = await Almacen.todosLosPasajes();
      const pasajes = todos.filter((p) => p.materia === clave);
      if (!pasajes.length) return decir('#aj-gen-msg', 'Esa materia no tiene temario.', true);

      const cuantas = Math.min(10, pasajes.length);
      const minutos = Math.ceil(cuantas * 18 / 60);
      if (!window.confirm(
          `Voy a armar hasta ${cuantas} lecciones y 3 fichas de «${clave}».\n\n`
          + `Tarda unos ${minutos} minuto(s) con la IA que tienes puesta.\n`
          + 'Puedes dejarlo trabajando; no cierres esta ventana.\n\n¿Empiezo?')) return;

      boton.disabled = true;
      const antes = boton.textContent;
      const t0 = Date.now();
      const transcurrido = () => {
        const s = Math.round((Date.now() - t0) / 1000);
        return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
      };
      try {
        decir('#aj-gen-msg', 'Armando lecciones…');
        this._barra('Armando lecciones… puedes seguir usando el tutor.');
        const { lecciones, fallidos } = await Generador.generar(
          pasajes, clave,
          (n, t) => {
            boton.textContent = `lección ${n}/${t}`;
            decir('#aj-gen-msg', `Lección ${n} de ${t}…`);
            // CON EL TIEMPO TRANSCURRIDO. Un «3 de 10» no dice si va
            // bien o si lleva veinte minutos atascado; «3 de 10 · 1 min
            // 12 s» sí, y es la diferencia entre esperar y matar la app.
            this._barra(`Armando «${clave}»: lección ${n} de ${t} · ${transcurrido()}`);
          },
          cuantas);

        decir('#aj-gen-msg', 'Armando fichas de repaso…');
        this._barra(`Armando las fichas de repaso… · ${transcurrido()}`);
        boton.textContent = 'fichas…';
        const { fichas } = await Generador.fichas(pasajes, clave, null, 7, 3);

        const nf = Object.keys(fichas).length;

        // SE COMPRUEBA ANTES DE GUARDAR, no después.
        //
        // CERO LECCIONES NO ES UN ÉXITO CON UN NÚMERO PEQUEÑO.
        //
        // El mensaje decía «Listas 0 lecciones y 3 fichas» y se leía como
        // que todo había ido bien; el alumno cerraba los ajustes y se
        // encontraba «Aún no hay temario» sin ninguna explicación. Le
        // pasó a Nicolás el 09/11/2026 y dio la app por colgada.
        //
        // Cuando no sale ninguna hay un motivo concreto —el modelo no
        // devolvió JSON, copió el pasaje, los ejercicios no cuadraban— y
        // está en `fallidos`. Se enseña, porque dice qué hacer: casi
        // siempre es cambiar a un modelo más grande.
        if (!lecciones.length) {
          const porques = [...new Set(fallidos.map((f) => f.porque))].slice(0, 3);
          const msg = 'No salió ninguna lección utilizable de '
            + `${fallidos.length} intento(s). `
            + (porques.length ? `El modelo falló por: ${porques.join('; ')}. ` : '')
            + 'Con un modelo pequeño pasa a menudo: prueba con uno más '
            + 'grande, o con una clave en internet desde Ajustes.';
          decir('#aj-gen-msg', msg, true);
          this._barra('No salió ninguna lección. Abre Ajustes para ver por qué.', 'mal');
          return;                      // no se guarda un temario vacío
        }

        // Se guarda junto al temario, en el almacén del alumno. `tutor.html`
        // lo lee al arrancar igual que lee los pasajes.
        const antesGuardado = (await Almacen.ajuste('generado')) || {};
        antesGuardado[clave] = {
          materia: clave,
          lecciones,
          fichas,
          cuando: new Date().toISOString(),
        };
        await Almacen.ajuste('generado', antesGuardado);

        decir('#aj-gen-msg',
          `Listas ${lecciones.length} lecciones y ${nf} fichas.`
          + (fallidos.length
            ? ` Se descartaron ${fallidos.length} por no pasar la comprobación `
              + '—preferimos quitarlas a que te corrijan mal.'
            : '')
          + ' Cierra los ajustes para verlas.');
        this._barra(
          `Listas ${lecciones.length} lecciones de «${clave}» en ${transcurrido()}.`
          + (fallidos.length ? ` ${fallidos.length} descartadas.` : ''), 'bien');
      } catch (e) {
        decir('#aj-gen-msg', 'No se pudieron armar: ' + e.message, true);
        this._barra('No se pudieron armar las lecciones: ' + e.message, 'mal');
      } finally {
        boton.disabled = false;
        boton.textContent = antes;
      }
    },

    async cargar(archivos, donde, decir) {
      const pdfs = archivos.filter((f) => /\.pdf$/i.test(f.name));
      if (!pdfs.length) {
        return decir('#aj-pdf-msg', 'Solo se pueden cargar archivos PDF.', true);
      }
      for (const f of pdfs) {
        try {
          decir('#aj-pdf-msg', `Leyendo «${f.name}»…`);
          const pasajes = await Cargador.leerPDF(f, (n, t) => {
            decir('#aj-pdf-msg', `Leyendo «${f.name}» · página ${n} de ${t}`);
          });
          const materia = f.name.replace(/\.pdf$/i, '');
          await Almacen.guardarPasajes(materia, pasajes);
          decir('#aj-pdf-msg', `«${materia}»: ${pasajes.length} pasajes guardados.`);
        } catch (e) {
          // El mensaje de `Cargador` ya explica qué pasa —un escaneo, por
          // ejemplo—. No se tapa con un «error al cargar».
          decir('#aj-pdf-msg', e.message, true);
        }
      }
      await this.pintar(donde);
    },
  };
})();

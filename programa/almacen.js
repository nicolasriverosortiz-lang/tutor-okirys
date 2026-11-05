/* El almacén del alumno — IndexedDB, no localStorage.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * POR QUE INDEXEDDB Y NO EL localStorage QUE YA USA EL TUTOR
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `localStorage` guarda texto y tiene un tope de unos 5 MB por sitio. El
 * `contenido.json` de TRES asignaturas ya pesa 371 KB; una carrera entera son
 * decenas de asignaturas, y con los PDF que cargue cada alumno se pasa del
 * tope sin avisar — `setItem` lanza `QuotaExceededError` y, si nadie lo
 * atrapa, el alumno pierde lo que acababa de cargar.
 *
 * IndexedDB admite cientos de MB, guarda objetos sin convertirlos a texto y
 * funciona desde `file://`. Es la única opción que aguanta un temario de
 * verdad.
 *
 * El progreso y las entregas SIGUEN en localStorage: son pocos kilobytes, ya
 * funcionan, y moverlos sería romper lo que hay a cambio de nada.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * POR QUE ESTO EXISTE
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Hasta hoy el temario venía de `fetch('contenido.json')`, un archivo sacado
 * del campus de UNIR con las credenciales de Nicolás. Eso hace dos cosas
 * malas para un producto que se quiere vender:
 *
 *   1. Ata el tutor a una universidad y una carrera.
 *   2. Obliga a levantar un servidor web, porque `file://` bloquea `fetch`.
 *      Esa línea, y solo esa, es la razón de que hiciera falta Python.
 *
 * Con el temario aquí dentro, el alumno carga sus propios PDF y el tutor se
 * abre con doble clic. Sin instalar nada.
 */

const Almacen = (() => {
  const NOMBRE = 'tutor_okirys';
  const VERSION = 1;

  // Tres almacenes y no uno: se consultan por separado y mezclarlos obligaría
  // a leerlo todo para sacar una cosa.
  const PASAJES = 'pasajes';       // el temario troceado, lo que se busca
  const MATERIAS = 'materias';     // qué asignaturas cargó y de qué archivo
  const AJUSTES = 'ajustes';       // carrera, motor de IA, clave

  let bd = null;

  function abrir() {
    if (bd) return Promise.resolve(bd);
    return new Promise((ok, mal) => {
      const p = indexedDB.open(NOMBRE, VERSION);
      p.onupgradeneeded = () => {
        const d = p.result;
        if (!d.objectStoreNames.contains(PASAJES)) {
          const s = d.createObjectStore(PASAJES, { keyPath: 'id', autoIncrement: true });
          // Por materia, que es como se filtra al buscar y al borrar.
          s.createIndex('materia', 'materia', { unique: false });
        }
        if (!d.objectStoreNames.contains(MATERIAS)) {
          d.createObjectStore(MATERIAS, { keyPath: 'clave' });
        }
        if (!d.objectStoreNames.contains(AJUSTES)) {
          d.createObjectStore(AJUSTES, { keyPath: 'clave' });
        }
      };
      p.onsuccess = () => { bd = p.result; ok(bd); };
      // SI INDEXEDDB NO ESTA, SE DICE Y NO SE FINGE.
      // En una ventana de incógnito o con las cookies bloqueadas, `open`
      // falla. Devolver un almacén de mentira dejaría al alumno cargando
      // PDFs que se pierden al cerrar, sin enterarse.
      p.onerror = () => mal(new Error(
        'No se pudo abrir el almacén del navegador. Si estás en una ventana '
        + 'de incógnito, ábrelo en una normal.'));
    });
  }

  function pedir(almacen, modo, hacer) {
    return abrir().then((d) => new Promise((ok, mal) => {
      const t = d.transaction(almacen, modo);
      const s = t.objectStore(almacen);
      const r = hacer(s);
      t.oncomplete = () => ok(r && 'result' in r ? r.result : r);
      t.onerror = () => mal(t.error);
    }));
  }

  return {
    // ── el temario ─────────────────────────────────────────────────────
    async guardarPasajes(materia, pasajes) {
      const d = await abrir();
      return new Promise((ok, mal) => {
        const t = d.transaction([PASAJES, MATERIAS], 'readwrite');
        const s = t.objectStore(PASAJES);
        // Se borra lo anterior de ESA materia antes de meter lo nuevo:
        // volver a cargar el mismo PDF no puede duplicar el temario.
        const idx = s.index('materia');
        const cur = idx.openCursor(IDBKeyRange.only(materia));
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { s.delete(c.primaryKey); c.continue(); return; }
          for (const p of pasajes) s.add({ ...p, materia });
          t.objectStore(MATERIAS).put({
            clave: materia,
            nombre: pasajes[0]?.nombreMateria || materia,
            pasajes: pasajes.length,
            cargado: new Date().toISOString(),
          });
        };
        t.oncomplete = () => ok(pasajes.length);
        t.onerror = () => mal(t.error);
      });
    },

    async todosLosPasajes() {
      return pedir(PASAJES, 'readonly', (s) => s.getAll());
    },

    async materias() {
      return pedir(MATERIAS, 'readonly', (s) => s.getAll());
    },

    async borrarMateria(materia) {
      const d = await abrir();
      return new Promise((ok, mal) => {
        const t = d.transaction([PASAJES, MATERIAS], 'readwrite');
        const s = t.objectStore(PASAJES);
        const cur = s.index('materia').openCursor(IDBKeyRange.only(materia));
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { s.delete(c.primaryKey); c.continue(); }
        };
        t.objectStore(MATERIAS).delete(materia);
        t.oncomplete = () => ok(true);
        t.onerror = () => mal(t.error);
      });
    },

    // ── los ajustes ────────────────────────────────────────────────────
    async ajuste(clave, valor) {
      if (valor === undefined) {
        const r = await pedir(AJUSTES, 'readonly', (s) => s.get(clave));
        return r ? r.valor : undefined;
      }
      return pedir(AJUSTES, 'readwrite', (s) => s.put({ clave, valor }));
    },

    /** Cuánto ocupa lo cargado. Para poder decírselo al alumno. */
    async espacio() {
      if (!navigator.storage?.estimate) return null;
      const e = await navigator.storage.estimate();
      return { usado: e.usage || 0, disponible: e.quota || 0 };
    },
  };
})();

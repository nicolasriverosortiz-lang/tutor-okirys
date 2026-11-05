/* Panel derecho vacío — los diagramas van por lección.
 *
 * Se rellena a mano cuando una lección se lo merece. El tutor funciona sin
 * esto: el panel simplemente no muestra nada de apoyo.
 */
const APOYO = {};
const FICHAS_CTX = {};
// UN Set, NO UN OBJETO. `tutor.html` llama a `CALC_CTX.has(id)`, y con
// `{}` eso revienta con «CALC_CTX.has is not a function». El error salía
// en la consola del alumno y dejaba el panel derecho a medias.
const CALC_CTX = new Set();

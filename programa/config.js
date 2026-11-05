/* Lo que el instalador rellena en cada computador.
 *
 * ESTE ARCHIVO SE GENERA AL INSTALAR, no se escribe a mano.
 *
 * · SUPABASE_URL y SUPABASE_ANON identifican el servidor de licencias. Son
 *   públicas por diseño: van dentro de un programa que se reparte, así que
 *   cualquiera puede leerlas. Todo el esquema está montado dando eso por
 *   hecho — las tablas están cerradas con RLS y solo se puede llamar a la
 *   función `activar`.
 *
 * · EQUIPO es la huella de ESTA instalación. La escribe el instalador una
 *   sola vez y no se vuelve a tocar. Vive aquí y no en el navegador para que
 *   borrar los datos de navegación no obligue a reactivar — que gastaría
 *   otro puesto de la licencia.
 */

const SUPABASE_URL = 'https://clyortenqurudnsyxzxl.supabase.co';
const SUPABASE_ANON = 'sb_publishable_9Vm5UswAeIDA6909uIhfeQ_xu0STEXS';

// El instalador reemplaza esta línea. En desarrollo queda fija para que las
// pruebas no gasten un puesto distinto en cada recarga.
const EQUIPO = '';

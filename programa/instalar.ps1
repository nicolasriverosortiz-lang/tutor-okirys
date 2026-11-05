# Instalador del Tutor Okirys
#
# ============================================================================
# QUE HACE, Y POR QUE ASI
# ============================================================================
#
# Copia el tutor al computador del estudiante, le da una huella propia y deja
# un acceso directo en el escritorio. Se lanza desde una USB o desde una
# carpeta descargada.
#
# NO PIDE PERMISOS DE ADMINISTRADOR. Todo va a la carpeta del usuario. En un
# computador de universidad o de trabajo, pedir administrador es pedir que no
# se instale — y esa lección está escrita en el vault de Okirys, de cuando un
# DLL descargado no arrancaba en el equipo corporativo.
#
# NO INSTALA NADA MAS. Ni Python, ni LM Studio, ni dependencias. Comprueba si
# están y lo dice, pero no descarga a espaldas de nadie: un instalador que se
# baja cosas por su cuenta es lo que hace que los antivirus corporativos lo
# paren.
#
# ----------------------------------------------------------------------------
# LA HUELLA DEL EQUIPO
# ----------------------------------------------------------------------------
#
# Se genera aqui, una vez, y se escribe en `config.js`. Vive en la carpeta y
# no en el navegador a proposito: si estuviera en el navegador, borrar los
# datos de navegacion daria una huella nueva, la reactivacion gastaria otro
# puesto de la licencia, y a la tercera el estudiante se quedaria fuera de algo
# que pago.
#
# ----------------------------------------------------------------------------
# PARA PROBARLO SIN TOCAR EL ESCRITORIO
# ----------------------------------------------------------------------------
#
#   instalar.ps1 -Destino C:\ruta\de\prueba -SinPausa -SinAcceso
#
# Sin parametros hace lo de siempre: pregunta la carpeta y pone el acceso
# directo. Los parametros existen para poder comprobar una instalacion entera
# sin dejar un acceso directo de prueba en el escritorio de nadie.

param(
    [string]$Destino = '',
    [switch]$SinPausa,
    [switch]$SinAcceso
)

$ErrorActionPreference = 'Stop'
# Este archivo vive en `programa\`, junto al motor. Todo se copia de aqui.
$origen = Split-Path -Parent $MyInvocation.MyCommand.Path

function Titulo($t) { Write-Host ""; Write-Host "  $t" -ForegroundColor Cyan }
function Bien($t)   { Write-Host "    $t" -ForegroundColor Green }
function Ojo($t)    { Write-Host "    $t" -ForegroundColor Yellow }
function Mal($t)    { Write-Host "    $t" -ForegroundColor Red }

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   TUTOR OKIRYS - instalacion" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan

# --- donde ------------------------------------------------------------------
$porDefecto = Join-Path $env:LOCALAPPDATA 'Tutor Okirys'
Titulo "1. Donde se instala"
if ($Destino) {
    $destino = $Destino
    Write-Host "    $destino"
} else {
    Write-Host "    Por defecto: $porDefecto"
    $otro = Read-Host "    Enter para aceptar, o escribe otra carpeta"
    $destino = if ([string]::IsNullOrWhiteSpace($otro)) { $porDefecto } else { $otro }
}

# REINSTALAR NO PUEDE BORRAR LO QUE EL ESTUDIANTE YA CARGO.
# Su temario vive en el navegador, no aqui, asi que copiar encima es seguro.
# Pero `config.js` SI se conserva: dentro esta la huella, y cambiarla le
# costaria un puesto de su licencia.
$reinstala = Test-Path (Join-Path $destino 'tutor.html')
if ($reinstala) { Ojo "Ya habia una instalacion aqui. Se actualiza, no se borra." }

New-Item -ItemType Directory -Force -Path $destino | Out-Null

# --- copiar -----------------------------------------------------------------
Titulo "2. Copiando"

# SE COPIA TODO LO QUE TRAE `programa\`, MENOS LO QUE TIENE SU PROPIO TRATO.
#
# Antes aqui habia una lista del motor escrita a mano, repetida de la de
# `empaquetar.py`. Dos listas que tienen que decir lo mismo y ninguna que lo
# compruebe: el dia que el tutor cargara un modulo nuevo, el paquete lo
# llevaria y la instalacion no, y el tutor arrancaria en blanco en el
# computador del estudiante. Ahora la lista es una sola —la de
# `empaquetar.py`, que se comprueba contra `tutor.html`— y aqui se copia lo
# que llegue.
$contenido = @('curriculo.js','trabajos.js','apoyo.js','fichas.js')
# `instalador.sh` es el instalador de macOS y Linux: viaja en el paquete pero
# no se instala, igual que este .ps1 no se instala en Mac. Sin esta linea el
# estudiante de Windows acaba con un script de Unix en su carpeta — inofensivo
# y desconcertante, y ademas hacia que las dos instalaciones no coincidieran.
$aparte = @('instalar.ps1','instalador.sh','config.js') + $contenido
$motor = Get-ChildItem -LiteralPath $origen -File | Where-Object { $aparte -notcontains $_.Name }
foreach ($f in $motor) { Copy-Item -LiteralPath $f.FullName $destino -Force }
if (-not (Test-Path (Join-Path $destino 'tutor.html'))) {
    Mal "El paquete no trae tutor.html. Vuelve a generarlo con empaquetar.py."
    if (-not $SinPausa) { Read-Host "   Enter para cerrar" }
    exit 1
}

# LA MARCA DE VERSION SE PONE AL INSTALAR, NO SE ESCRIBE A MANO.
#
# `tutor.html` carga sus archivos con `?v=202609031115`, una marca fija.
# Mientras no cambie, el navegador sirve la copia vieja aunque el archivo del
# disco sea nuevo: se comprobo en la prueba — se actualizo `apoyo.js` y el
# tutor seguia ejecutando el anterior, con un error que ya estaba corregido.
#
# En una actualizacion futura eso significa que el estudiante instala lo nuevo
# y sigue usando lo viejo, sin enterarse. Con la marca puesta en cada
# instalacion, cada actualizacion trae archivos frescos.
$marca = Get-Date -Format 'yyyyMMddHHmmss'
$htmlDest = Join-Path $destino 'tutor.html'
$html = Get-Content $htmlDest -Raw -Encoding UTF8
$html = $html -replace '\?v=\d+', "?v=$marca"
Set-Content -Path $htmlDest -Value $html -Encoding UTF8

# El contenido va VACIO. Las lecciones de Nicolas son de su carrera y de su
# universidad: al estudiante no le sirven y no son suyas. Las suyas salen de
# sus propios PDF.
$plantillas = Join-Path $origen 'plantillas'
foreach ($f in $contenido) {
    $yaEsta = Join-Path $destino $f
    if ($reinstala -and (Test-Path $yaEsta)) { continue }   # no pisar lo suyo
    Copy-Item (Join-Path $plantillas $f) $destino -Force
}
Bien "$($motor.Count) archivos del motor + $($contenido.Count) de contenido"

# --- la huella --------------------------------------------------------------
Titulo "3. Identificando este computador"

$cfg = Join-Path $destino 'config.js'
if ($reinstala -and (Test-Path $cfg)) {
    Bien "Ya tenia huella. Se conserva para no gastar otro puesto de licencia."
} else {
    $huella = "eq-" + [guid]::NewGuid().ToString('N').Substring(0, 16)
    # -Encoding UTF8 AL LEER, NO SOLO AL ESCRIBIR.
    #
    # Sin eso, Windows PowerShell lee el archivo como ANSI: los acentos del
    # UTF-8 se interpretan como dos caracteres y al guardarlos vuelven
    # corruptos. Se vio en la primera prueba — «instalación» salió como
    # «instalaciÃ³n».
    #
    # Las constantes son ASCII y habrian funcionado igual, y por eso es
    # peligroso: el archivo queda ilegible para quien lo abra a mirar, y
    # nadie se entera hasta que alguien tiene que tocarlo.
    $plantillaCfg = Get-Content (Join-Path $origen 'config.js') -Raw -Encoding UTF8
    $plantillaCfg = $plantillaCfg -replace "const EQUIPO = '[^']*';",
                                           "const EQUIPO = '$huella';"
    Set-Content -Path $cfg -Value $plantillaCfg -Encoding UTF8
    Bien "Huella: $huella"
}

# --- que hay en el equipo ---------------------------------------------------
Titulo "4. Que hay instalado"

$lms = Join-Path $env:USERPROFILE '.lmstudio\bin\lms.exe'
if (Test-Path $lms) { Bien "LM Studio: si" }
else {
    Ojo "LM Studio: no"
    Ojo "  Es la IA gratuita que corre en este computador."
    Ojo "  Se baja de lmstudio.ai. Si prefieres poner tu propia clave"
    Ojo "  de API, no hace falta instalarlo."
}

$py = Get-Command python -ErrorAction SilentlyContinue
if ($py) { Bien "Python: si (no hace falta, pero sirve de respaldo)" }
else     { Bien "Python: no (no hace falta)" }

# --- acceso directo ---------------------------------------------------------
Titulo "5. Acceso directo"

if ($SinAcceso) {
    Ojo "Sin acceso directo (-SinAcceso): era una prueba."
} else {
    $escritorio = [Environment]::GetFolderPath('Desktop')
    $acceso = Join-Path $escritorio 'Tutor Okirys.lnk'
    $html = Join-Path $destino 'tutor.html'
    $ico  = Join-Path $destino 'tutor.ico'

    # SE ABRE EN SU PROPIA VENTANA, NO COMO UNA PESTANA MAS.
    #
    # Apuntando el acceso al .html, Windows lo abre en el navegador por
    # defecto: con su barra de direcciones, sus pestanas y el titulo de
    # la pagina. Se siente una pagina web, no un programa.
    #
    # Edge en modo aplicacion (--app=) le da ventana propia, su icono en
    # la barra de tareas y nada de cromo del navegador. Es el mismo motor
    # que ya usaba —el contenido del alumno sigue donde estaba— y no hay
    # nada que instalar: Edge viene con Windows.
    #
    # Si no se encuentra Edge se apunta al .html, como antes: perder la
    # ventana propia es mucho mejor que no poder abrir el tutor.
    $edge = $null
    $clave = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe'
    if (Test-Path $clave) { $edge = (Get-ItemProperty $clave).'(default)' }
    if (-not $edge -or -not (Test-Path $edge)) {
        foreach ($c in @(
            "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
            "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")) {
            if (Test-Path $c) { $edge = $c; break }
        }
    }

    $ws = New-Object -ComObject WScript.Shell
    $s = $ws.CreateShortcut($acceso)
    if ($edge -and (Test-Path $edge)) {
        $s.TargetPath = $edge
        # La ruta va como file:/// y con las barras al derecho: con las
        # invertidas, Edge se come el argumento y abre la pagina de inicio.
        # Se usa .Replace() y no -replace: el segundo trabaja con
        # expresiones regulares, donde una barra invertida sola no es un
        # patron valido y revienta la instalacion.
        $url = 'file:///' + $html.Replace('\', '/')
        $s.Arguments = '--app="' + $url + '"'
    } else {
        $s.TargetPath = $html
    }
    $s.WorkingDirectory = $destino
    if (Test-Path $ico) { $s.IconLocation = $ico }
    $s.Description = 'Tutor Okirys'
    $s.Save()

    if ($edge) { Bien "Puesto en el escritorio, en ventana propia" }
    else       { Ojo  "Puesto en el escritorio (sin Edge: se abrira en el navegador)" }
}

# --- listo ------------------------------------------------------------------
Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "   LISTO" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "   Instalado en: $destino"
Write-Host ""
Write-Host "   Abre 'Tutor Okirys' en el escritorio. La primera vez te pide:"
Write-Host "     1. tu licencia"
Write-Host "     2. como quieres la IA (LM Studio o tu propia clave)"
Write-Host "     3. los PDF de tus materias"
Write-Host ""
Write-Host "   Se hace una sola vez. Despues funciona sin internet."
Write-Host ""
if (-not $SinPausa) { Read-Host "   Enter para cerrar" }

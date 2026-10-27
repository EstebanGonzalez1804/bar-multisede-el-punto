# Plataforma Web de Gestión Operativa para Bar Multisede — El Punto

Implementación del proyecto descrito en la Propuesta Comercial de Solución
Tecnológica (v4) y en el Documento de Arquitectura de Software, desarrollado
por NOVATECH para El Punto.

Este repositorio se construye **sprint a sprint**, siguiendo exactamente el
Product Backlog acordado — sin funcionalidades adicionales a las definidas en
las Historias de Usuario de cada sprint.

## Stack técnico

| Capa            | Tecnología                                   |
|-----------------|-----------------------------------------------|
| Backend / API   | Node.js + Express + TypeScript                |
| Frontend        | React + Vite + TypeScript                     |
| Base de datos   | PostgreSQL                                    |
| Autenticación   | JWT + hashing de contraseñas con `scrypt`     |
| Contenedores    | Docker + Docker Compose                       |

## Cómo correr el proyecto localmente

### Opción A — Docker Compose (recomendada)

Requiere Docker y Docker Compose instalados.

```bash
docker compose up --build
```

Esto levanta tres servicios:

- **db** — PostgreSQL en `localhost:5432`. Al crear el volumen por primera vez
  aplica automáticamente, en orden, todos los scripts de
  `database/migrations/` (esquema + datos iniciales).
- **backend** — API en `http://localhost:4000`.
- **frontend** — interfaz en `http://localhost:5173`.

Usuario inicial para probar el login (ver `database/migrations/002_seed_inicial.sql`):

```
Código de usuario: GEN-ADM-001
Contraseña:        ElPunto#2026
```

**Cambia esa contraseña apenas entres** (pantalla "Mi contraseña", HU-002).

### Opción B — Entorno local sin Docker

1. Levanta un PostgreSQL local y crea la base de datos:
   ```bash
   createdb barmultisede
   psql barmultisede -f database/migrations/001_sprint1_fundaciones.sql
   psql barmultisede -f database/migrations/002_seed_inicial.sql
   psql barmultisede -f database/migrations/003_sprint2_administracion_catalogo.sql
   ```
   (Con Docker Compose esto no es necesario: el backend aplica automáticamente
   cualquier migración nueva al arrancar, cada vez — ver
   `backend/src/db/migrate.ts`.)
2. Backend:
   ```bash
   cd backend
   cp .env.example .env   # ajusta DATABASE_URL si hace falta
   npm install
   npm run dev
   ```
3. Frontend (en otra terminal):
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

## Integración continua

Cada `push` dispara `.github/workflows/ci.yml`, que:

1. Instala dependencias y compila el backend (`tsc`) y el frontend (`vite build`).
2. Aplica todas las migraciones SQL contra un PostgreSQL limpio, para detectar
   cualquier error de esquema antes de hacer merge.

Revisa la pestaña **Actions** del repositorio después de cada push.

> Nota sobre cómo se construyó este proyecto: el entorno donde Claude escribe
> el código no tiene salida a `npm`/Docker Hub, así que no puede ejecutar
> `npm install` ni `docker compose up` directamente. Por eso cada entrega se
> apoya en esta CI para la verificación de compilación — si un run falla,
> compártelo (o el mensaje de error de tu máquina) y se corrige en el
> siguiente commit.

## Decisiones técnicas relevantes (no cubiertas en detalle por la Propuesta)

Estas son decisiones de implementación tomadas durante la construcción, dentro
de los márgenes que la Propuesta y el Documento de Arquitectura dejan abiertos
a criterio técnico del proveedor:

- **Hashing de contraseñas con `crypto.scrypt` (nativo de Node) en vez de
  `bcrypt`.** Mismo nivel de seguridad (recomendado por OWASP), sin depender
  de un módulo nativo que haya que compilar en cada imagen Docker.
- **Cierre de sesión por inactividad (HU-006) implementado en el frontend.**
  El JWT es stateless (no se puede "expirar a la fuerza" del lado del
  servidor sin una lista de revocación); el frontend mide 3 minutos sin
  eventos de actividad del usuario (mouse, teclado, scroll) y dispara el
  cierre de sesión. Queda documentado por si en un sprint posterior se decide
  migrar a un esquema de refresh tokens de vida corta.
- **"Mesas en tiempo real" (HU-024, Sprint 3) se implementa con *polling*
  periódico**, no WebSockets — no hay ninguna infraestructura de tiempo real
  definida en la Propuesta ni en el Documento de Arquitectura, y el polling
  cumple el criterio de aceptación sin invertir en infraestructura adicional
  no acordada.
- **Reactivación de mesas (ajuste sobre HU-012, migración 004).** El
  documento aprobado solo definía "inactivar" una mesa, sin camino de
  vuelta — a diferencia de HU-008 (usuarios) y HU-016 (productos), que sí
  reactivan. El cliente pidió agregar "Activar" por consistencia operativa
  (una mesa inactivada por error quedaba inactivable para siempre); se
  agregó con el mismo control de acceso que exige CA-03 de HU-012 (solo
  Administrador). Reactivar siempre deja la mesa en estado LIBRE.
- **Código de producto autogenerado (ajuste sobre HU-014, migración 004).**
  El mockup aprobado listaba "código" como campo que digitaba el
  Administrador. El cliente pidió que se genere igual que el código de
  usuario (HU-007): `PDT-[abreviación del tipo de producto]-[consecutivo]`
  (ej. `PDT-AGU-001` para el tipo "Aguardiente"). La abreviación de 3 letras
  se deriva automáticamente del nombre del tipo al crearlo (sin tildes, con
  desambiguación por ventana deslizante si colisiona) y es inmutable: si el
  tipo se renombra después, la abreviación no cambia, para no alterar el
  significado de códigos ya generados. Los productos creados antes de este
  ajuste conservan su código original escrito a mano.
- **Identificador de pedido sin relleno de ceros (HU-025 CA-03).** A
  diferencia del código de usuario y de producto (que sí rellenan a 3
  dígitos), el documento aprobado es explícito en que el consecutivo del
  pedido no tiene longitud fija: `{código de sede}-{consecutivo}`, ej.
  `SE01-1`, `SE01-2`, ..., `SE01-137`. Usa el mismo contador atómico
  (`SECUENCIA_CODIGO`) que los demás códigos, con una clave propia por sede
  (`PEDIDO-{código de sede}`).
- **HU-025 y HU-026 (apertura de pedido y registro de productos) se
  restringen a Mesero exclusivamente.** Son las únicas dos historias de
  Sprint 3 cuyo documento aprobado no incluye ningún criterio de aceptación
  que otorgue la acción a otro perfil (a diferencia de HU-019/HU-020/HU-021/
  HU-022, que sí son explícitas sobre qué hace cada perfil). Se interpreta de
  forma literal: solo "Como Mesero" puede abrir pedidos o registrarles
  productos, igual que HU-023 y HU-024.
- **INVENTARIO no se pre-crea para todo el catálogo.** La fila
  producto+sede solo se crea la primera vez que recibe un movimiento
  (recepción, ajuste o venta); antes de eso, una consulta de existencia
  simplemente devuelve 0 (vía `LEFT JOIN` con `COALESCE`), sin necesidad de
  sembrar miles de filas en cero cada vez que se crea un producto o una sede
  nueva.
- **Todo movimiento de inventario pasa por una única función
  (`aplicarMovimientoInventario`)**, compartida entre recepciones, ajustes y
  el descuento por venta (HU-026). Bloquea la fila con `FOR UPDATE` antes de
  escribir, así que dos operaciones concurrentes sobre el mismo producto y
  sede (p. ej. dos Meseros vendiendo el último trago a la vez) nunca dejan el
  inventario en un valor negativo ni pierden una actualización.

- **Redirección post-login por rol (corrección sobre HU-001 CA-01).**
  El criterio de aceptación exige que, al iniciar sesión, "el sistema ... lo
  redirige a la vista correspondiente a su rol" — y la implementación
  original de Sprint 1 mandaba a los tres perfiles al mismo "Inicio"
  genérico. Se corrigió durante la validación de Sprint 3: Mesero aterriza
  en `Mesas` (donde abre pedidos) y Cajero en `Inventario` (su tarea más
  recurrente); Administrador se queda en `Inicio`, porque su rol es
  transversal y no tiene una única pantalla "principal". "Inicio" sigue
  existiendo y accesible desde el menú para los tres perfiles — esto solo
  cambia dónde aterrizas justo después de iniciar sesión.

- **Rediseño visual de la interfaz (pedido explícito del cliente, sin HU
  nueva — ninguna regla de negocio cambió).** El menú pasó de una barra
  superior a una barra lateral con iconos dibujados a mano (sin librería de
  iconos: el entorno donde se escribe este código no tiene salida a
  `npm install`, así que cualquier dependencia nueva no se puede validar
  hasta que el cliente corre `docker compose up --build`). La pantalla
  "Inicio" pasó de ser un saludo vacío a mostrar 3 indicadores reales (mesas
  ocupadas, productos agotados, recepciones del día) y 2 paneles (mesas
  ocupadas ahora, productos agotados) — todo con datos de los endpoints que
  ya existían, sin agregar ninguno nuevo. Deliberadamente **no** se agregó
  un panel de "actividad reciente" con los datos de trazabilidad (HU-041):
  esa tabla hoy no tiene ningún endpoint de lectura expuesto al frontend, y
  agregar uno solo para esta mejora visual se consideró fuera del alcance
  pedido — queda como posible ajuste futuro si se quiere ese panel con datos
  reales en vez de omitirlo o inventar datos. Mesas pasó de tabla a tarjetas
  visuales por mesa (mismo dato, mejor lectura de un vistazo); Inventario
  conserva exactamente la misma lógica binaria Agotado/Disponible que ya
  existía (CA de HU-020/HU-022) — no se inventó un tercer estado "stock
  bajo" con un umbral numérico que el documento aprobado no define.

  **Segunda iteración visual (sobre mockups aprobados por el cliente,
  guiados por el logo real de "El Punto").** La paleta azul corporativa
  original, y luego la paleta cálida ("de bar") de la primera iteración,
  se reemplazaron por los colores del logo real del cliente: verde botella
  (`#173A33`, marca/navegación/acción principal — también el tratamiento
  de una mesa `OCUPADA`, que es su estado normal de trabajo y ya no se
  pinta en rojo/peligro) y latón (`#C8962E`, reservado solo al logo y a la
  sección activa del menú — "un acento, un lugar"); el rojo/ladrillo queda
  reservado exclusivamente a agotado/bloqueado/errores. Fraunces + Inter se
  reemplazaron por una sola familia (Archivo, variable) para títulos y
  texto. El set de iconos pasó de trazo redondeado a trazo cuadrado/miter,
  y la marca de la barra lateral y de Login ahora es una versión vectorial
  simplificada del logo real (vaso con hielo y estrella, dentro de un
  anillo) en vez de un ícono genérico de vaso. Ningún dato, ruta ni regla de
  negocio cambió: es exclusivamente paleta, tipografía, iconografía y la
  marca.

- **Interfaz responsive (requerimiento del cliente desde el inicio del
  proyecto, implementado durante la validación de Sprint 3).** La barra
  lateral se vuelve un panel que entra/sale ("off-canvas") con botón de
  menú en pantallas angostas (celular/tablet, `max-width: 900px`), en vez
  de quedar fija y angosta encima del contenido. Las tablas de todos los
  listados (Usuarios, Productos, Tipos de producto, Sedes, Proveedores,
  Recepciones, Inventario, historial de precios, líneas de pedido) se
  envuelven en un contenedor con scroll horizontal propio en vez de
  reconstruir cada una como tarjetas — es el patrón estándar para datos
  tabulares densos en pantallas angostas, y evita reescribir siete páginas
  con el riesgo de regresión que eso implica para una mejora que no cambia
  ninguna regla de negocio. Los formularios en línea (`toolbar`,
  `inline-form`) y los encabezados de panel se apilan verticalmente en vez
  de desbordar o encimarse. El login pasa de dos columnas a una sola
  columna apilada por debajo de 820px. Las grillas de Mesas y del Dashboard
  ya eran fluidas (`grid-template-columns: repeat(auto-fit/auto-fill, ...)`)
  y no necesitaron cambios adicionales.

- **Cobro rediseñado (Oct 27, migración 007).**
  - *Pago completo* ahora es un único pago, con un solo método y el valor fijo
    en el saldo pendiente (ya no se puede editar ni combinar métodos).
  - *Abono por monto* mantiene el valor libre hasta el saldo (se pueden
    combinar métodos).
  - *Por productos:* el cajero elige producto y cantidad (por ejemplo 1 de
    2 botellas de ron); el valor se calcula con los precios congelados de la
    cuenta, se muestra el saldo resultante y al confirmar se descuenta. El
    servidor valida cantidades y valor, y cubre primero las líneas más
    antiguas. `pago_detalle_pedido` guarda ahora la cantidad por línea.

- **Ajustes tras la validación del avance (Oct 27).**
  - *Inactivar un tipo de producto* inactiva en la misma transacción todos
    sus productos activos (cada uno queda en trazabilidad). Reactivar el tipo
    **no** reactiva los productos: se activan uno a uno desde Productos.
  - *Trazabilidad más clara:* cada evento se muestra con una etiqueta de color
    y una frase en español (“Ana agregó 2 × Cerveza al pedido…”), nombres en
    vez de ids y los datos adicionales (precio anterior → nuevo, ajuste de
    inventario, valores de pago) en un desplegable “Ver datos”. Solo se
    consultan los **250** eventos más recientes (los filtros permiten
    llegar a lo anterior).
  - *Pedidos:* por defecto se listan los pedidos “en curso”; los ya pagados
    no se eliminan, quedan archivados y se consultan con el filtro
    “Pagados” o “Todos”.
  - *Excel de ventas:* título combinado, encabezado verde con filtros
    automáticos, bordes, fechas reales, ganancia por fórmula y fila TOTALES
    (SUBTOTAL/SUMPRODUCT) que se recalcula con las filas visibles al filtrar.
  - *Pedidos cerrados no se reabren:* se cobra la cuenta y se abre una cuenta
    nueva en la mesa (se retiró el endpoint y el botón de reapertura).
  - *Menú lateral fijo:* el panel izquierdo no se desplaza con la página.

- **Sprints 4 y 5 (HU-027 a HU-040), migración 006.**
  - *Pedidos:* un pedido ABIERTO se cierra con confirmación (HU-028): pasa a
    CERRADO, la cuenta queda PENDIENTE y la mesa sigue OCUPADA. Un pedido
    cerrado **no se reabre** (ajuste acordado tras la validación): si el
    cliente pide más, se cobra la cuenta y se abre una cuenta nueva en la
    mesa. Con pagos registrados (aunque sea parcial) tampoco se le agregan
    productos (HU-027 CA-03, HU-038). Nunca se editan ni eliminan líneas ya registradas.
  - *Cuenta (HU-031):* se genera al cerrar; vista previa en tirilla de 80 mm,
    impresión con `@media print` y PDF generado en el servidor (`pdfkit`).
    Se rotula "documento interno · no es factura electrónica".
  - *Pagos (HU-033 a 038):* un solo endpoint (`POST /api/pedidos/:id/pagos`)
    con tres modalidades — pago completo (uno o varios métodos que sumen el
    saldo exacto), abono por monto y pago por productos (se eligen líneas de
    la cuenta y el valor se calcula solo). Los importes se calculan en
    centavos enteros. Las vueltas en efectivo se muestran al cajero pero NO
    se almacenan (HU-033 CA-02). Al llegar el saldo a 0 el pedido pasa a
    PAGADO y la mesa a LIBRE en la misma transacción (HU-037). Los pagos son
    inmutables: no hay endpoint de edición/anulación y un trigger de
    PostgreSQL (`trg_pago_inmutable`) bloquea cualquier UPDATE/DELETE
    (HU-038 CA-03). El pago por productos opera por línea del pedido (cada
    registro de producto se asigna completo a un solo pago).
  - *Consultas:* `GET /api/pedidos` (HU-030, acotado por sede según perfil) y
    `GET /api/pedidos/pendientes-pago` (HU-032: incluye pagos parciales con su
    saldo). Cobros: Cajero y Administrador.
  - *Reporte de ventas (HU-039):* cuenta como venta cada producto de un pedido
    pagado por completo; la fecha es la del último pago (hora de Colombia) y
    la ganancia usa los precios congelados en cada línea del pedido. Exporta
    únicamente a `.xlsx` (`exceljs`). Administrador (todas las sedes o una) y
    Cajero (su sede); el Mesero no accede.
  - *Trazabilidad (HU-040):* pantalla exclusiva del Administrador con filtros
    por usuario, sede, tipo de evento y fechas. Los cambios de precio ahora
    registran el valor anterior y el nuevo (HU-040 CA-04); los ajustes de
    inventario ya los registraban.
  - *Inactivar todo (ajuste del cliente tras el primer avance):* sedes,
    proveedores y tipos de producto ahora también se inactivan/activan, igual
    que usuarios, productos y mesas; **reemplaza el CA-04 original de HU-010**
    ("no existe inactivación de sedes"). Nada se elimina. Una sede no se puede
    inactivar si tiene mesas ocupadas o pedidos sin pagar por completo; una
    sede inactiva no admite mesas, usuarios, recepciones ni pedidos nuevos.
    Un proveedor inactivo no aparece al registrar recepciones; un tipo de
    producto inactivo no se puede usar para crear productos nuevos (sus
    productos existentes siguen funcionando).
  - Nuevas dependencias del backend: `pdfkit`, `exceljs`, `@types/pdfkit`
    (se instalan con `docker compose up --build` o `npm install`).

## Estructura del repositorio

```
.
├── backend/              API Node/Express/TypeScript
├── frontend/              SPA React/Vite/TypeScript
├── database/
│   └── migrations/        Scripts SQL numerados, aplicados en orden
├── .github/workflows/      CI (build + typecheck + migraciones)
└── docker-compose.yml
```

## Estado por Sprint

| Sprint | Alcance | Estado |
|--------|---------|--------|
| 1 | Fundaciones de acceso y estructura (HU-001 a 006, 010, 041) | ✅ Completado |
| 2 | Usuarios, mesas y catálogo (HU-007 a 009, 011 a 017) | ✅ Completado |
| 3 | Proveedores, inventario y pedidos (HU-018 a 026) | ✅ Completado |
| 4 | Cierre de pedidos, cuenta y pagos (HU-027 a 034) | 🔧 Código completo — verificar con `docker compose up --build` |
| 5 | División de cuenta, irreversibilidad, reportes y trazabilidad (HU-035 a 040) | 🔧 Código completo — verificar con `docker compose up --build` |

Detalle completo de cada Historia de Usuario: ver `Historias_de_Usuario_Bar_Multisede.md`
y `Product_Backlog_Bar_Multisede.docx` en los entregables del proyecto.

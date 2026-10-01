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
  nueva — ninguna regla de negocio cambió).** La paleta azul corporativa del
  primer entregable se reemplazó por una paleta cálida ("de bar"): fondo
  tipo pergamino, barra lateral en espresso/carbón con acento ámbar, y
  tipografía Fraunces (títulos) + Inter (resto de la interfaz) en vez de un
  sans-serif genérico. El menú pasó de una barra superior a una barra
  lateral con iconos dibujados a mano (sin librería de iconos: el entorno
  donde se escribe este código no tiene salida a `npm install`, así que
  cualquier dependencia nueva no se puede validar hasta que el cliente corre
  `docker compose up --build`). La pantalla "Inicio" pasó de ser un saludo
  vacío a mostrar 3 indicadores reales (mesas ocupadas, productos agotados,
  recepciones del día) y 2 paneles (mesas ocupadas ahora, productos
  agotados) — todo con datos de los endpoints que ya existían, sin agregar
  ninguno nuevo. Deliberadamente **no** se agregó un panel de "actividad
  reciente" con los datos de trazabilidad (HU-041): esa tabla hoy no tiene
  ningún endpoint de lectura expuesto al frontend, y agregar uno solo para
  esta mejora visual se consideró fuera del alcance pedido — queda como
  posible ajuste futuro si se quiere ese panel con datos reales en vez de
  omitirlo o inventar datos. Mesas pasó de tabla a tarjetas visuales por
  mesa (mismo dato, mejor lectura de un vistazo); Inventario conserva
  exactamente la misma lógica binaria Agotado/Disponible que ya existía
  (CA de HU-020/HU-022) — no se inventó un tercer estado "stock bajo" con un
  umbral numérico que el documento aprobado no define.

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
| 3 | Proveedores, inventario y pedidos (HU-018 a 026) | 🔧 Código completo — verificar con `docker compose up --build` |

Detalle completo de cada Historia de Usuario: ver `Historias_de_Usuario_Bar_Multisede.md`
y `Product_Backlog_Bar_Multisede.docx` en los entregables del proyecto.

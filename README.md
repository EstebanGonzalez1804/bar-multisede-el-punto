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
| 2 | Usuarios, mesas y catálogo (HU-007 a 009, 011 a 017) | 🔧 Código completo — verificar con `docker compose up --build` |
| 3 | Proveedores, inventario e inicio de pedidos (HU-018 a 026) | ⏳ Pendiente |

Detalle completo de cada Historia de Usuario: ver `Historias_de_Usuario_Bar_Multisede.md`
y `Product_Backlog_Bar_Multisede.docx` en los entregables del proyecto.

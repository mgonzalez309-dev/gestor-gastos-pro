# GastosApp – Plataforma de Gestión de Gastos Personales

Sistema full-stack para el seguimiento inteligente de gastos personales, con escaneo de tickets por OCR, analíticas avanzadas y recomendaciones financieras. Incluye roles **USER** y **ADVISOR**.

---

## Tecnologías

| Capa | Stack |
|------|-------|
| Frontend | HTML5 · CSS3 · JavaScript (ES6) · Chart.js 4 |
| Backend | Node.js 18 · NestJS 10 · Prisma 5 |
| Base de datos | PostgreSQL |
| Autenticación | JWT – passport-jwt |
| OCR | tesseract.js 5 |

---

## Estructura del proyecto

```
Proyecto Ingenieria Web II/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Modelos: User, Expense, Ticket, Recommendation
│   ├── src/
│   │   ├── auth/                  # Módulo JWT (register, login, me)
│   │   ├── expenses/              # CRUD gastos + analíticas + patrones
│   │   ├── recommendations/       # Recomendaciones manuales y automáticas
│   │   ├── tickets/               # Subida de imágenes + OCR
│   │   ├── users/                 # Gestión de usuarios
│   │   ├── prisma/                # PrismaService global
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── uploads/                   # Imágenes subidas (git-ignorado)
│   ├── .env.example
│   ├── nest-cli.json
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── css/
    │   └── styles.css
    ├── js/
    │   ├── api.js                 # Capa HTTP compartida
    │   ├── auth.js                # Autenticación + layout
    │   ├── dashboard.js
    │   ├── expenses.js
    │   ├── tickets.js
    │   └── advisor.js
    ├── index.html                 # Login
    ├── register.html
    ├── dashboard.html
    ├── expenses.html
    ├── upload-ticket.html
    └── advisor.html               # Solo ADVISOR
```

---

## Configuración local

### Requisitos previos

- Node.js ≥ 18
- npm ≥ 9 (o pnpm / yarn)
- Docker Desktop (recomendado para levantar PostgreSQL automático)

> También puedes usar PostgreSQL local, pero con Docker no hace falta instalarlo manualmente.

### 1. Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo de entorno
cp .env.example .env
```

Editar `.env`:

```env
DATABASE_URL="postgresql://USUARIO:PASSWORD@localhost:5432/gastosapp"
JWT_SECRET="cambia-esto-por-un-secreto-seguro"
JWT_EXPIRATION="24h"
FRONTEND_URL="http://localhost:5500"
PORT=4500
```

> Reemplaza `USUARIO` y `PASSWORD` con las credenciales de tu PostgreSQL local.

```bash
# Iniciar en modo seguro (si falta .env lo crea, levanta PostgreSQL por Docker y aplica migraciones)
npm run start:dev:safe
```

Flujo automático de `start:dev:safe`:

- Crea `.env` desde `.env.example` si no existe.
- Ejecuta `docker compose up -d db` (servicio PostgreSQL local).
- Espera a que la base esté healthy.
- Corre `npx prisma migrate deploy`.
- Inicia NestJS en modo watch.

La API queda disponible en `http://localhost:4500/api`.  
Documentación Swagger: `http://localhost:4500/docs`

### Arranque full app (backend + frontend)

Desde la raíz del proyecto en PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\iniciar.ps1
```

Ese script inicia backend y frontend automáticamente.

### 2. Frontend

Abre `frontend/index.html` directamente desde VS Code usando la extensión **Live Server** (recomendado, da soporte a `http://` y evita problemas de CORS).

Si el backend no corre en `http://localhost:4500`, actualiza la variable `API_BASE_URL` al inicio de `frontend/js/api.js`:

```js
const API_BASE_URL = 'http://localhost:4500/api';  // ← cambia según tu entorno
```

---

## Crear usuario ADVISOR

La pantalla de registro crea usuarios normales (role = `USER`).  
Para promover un usuario a **ADVISOR** hay dos opciones:

**Opción A – Prisma Studio (interfaz visual):**
```bash
cd backend
npx prisma studio
```
Abre `http://localhost:5555`, selecciona la tabla `User`, edita el campo `role` y cambia su valor a `ADVISOR`.

**Opción B – SQL directo:**
```sql
UPDATE "User" SET role = 'ADVISOR' WHERE email = 'asesor@empresa.com';
```

---

## Resumen de endpoints API

| Método | Ruta | Descripción | Rol |
|--------|------|-------------|-----|
| POST | `/api/auth/register` | Registro | Público |
| POST | `/api/auth/login` | Login → token JWT | Público |
| GET | `/api/auth/me` | Perfil propio | USER / ADVISOR |
| GET | `/api/users` | Lista todos los usuarios | ADVISOR |
| GET | `/api/users/:id` | Detalle de usuario | Propio / ADVISOR |
| GET | `/api/users/:id/summary` | Resumen con totales | Propio / ADVISOR |
| GET | `/api/expenses` | Lista gastos (paginada + filtros) | USER / ADVISOR |
| POST | `/api/expenses` | Crear gasto | USER |
| PUT | `/api/expenses/:id` | Actualizar gasto | Dueño / ADVISOR |
| DELETE | `/api/expenses/:id` | Eliminar gasto | Dueño / ADVISOR |
| GET | `/api/expenses/analytics` | Analíticas propias | USER |
| GET | `/api/expenses/analytics/:userId` | Analíticas de usuario | ADVISOR |
| GET | `/api/expenses/patterns/:userId` | Patrones de gasto | ADVISOR |
| POST | `/api/tickets/upload` | Subir imagen + OCR | USER |
| POST | `/api/tickets/:id/parse` | Re-procesar OCR | USER |
| GET | `/api/tickets` | Historial de tickets | USER |
| GET | `/api/tickets/:id` | Detalle de ticket | Dueño / ADVISOR |
| POST | `/api/recommendations` | Crear recomendación manual | ADVISOR |
| POST | `/api/recommendations/auto-generate/:userId` | Auto-generar con IA | ADVISOR |
| GET | `/api/recommendations/my` | Recomendaciones propias | USER |
| GET | `/api/recommendations/:userId` | Recomendaciones de usuario | ADVISOR |

---

## Flujo OCR

1. El usuario arrastra una imagen de ticket a `upload-ticket.html`.
2. El frontend envía `POST /api/tickets/upload` con `multipart/form-data`.
3. El backend guarda el archivo en `backend/uploads/` y crea un registro `Ticket`.
4. En segundo plano (`async`) `tesseract.js` extrae el texto de la imagen.
5. El frontend interroga `GET /api/tickets/:id` cada 2 segundos hasta que `extractedText` esté disponible.
6. Al finalizar el OCR, el wizard avanza al **Paso 3**: pre-rellena el formulario con el importe, comercio y fecha detectados.
7. El usuario confirma y se crea el `Expense` vinculado al `Ticket`.

---

## Despliegue (gratuito)

### Base de datos → [Neon](https://neon.tech) o [Supabase](https://supabase.com)

1. Crea un proyecto y copia la cadena de conexión (`postgresql://...`).
2. Úsala como `DATABASE_URL` en las variables de entorno del backend.

### Backend → [Render](https://render.com)

1. Usa el archivo `render.yaml` de la raíz para crear el servicio automáticamente (Blueprint).
2. Si prefieres configuración manual: root `backend/`, build `npm install && npx prisma generate && npm run build`, start `npm run start:prod`.
3. Define variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`.
4. El backend ya publica imágenes de tickets en `/uploads/*` para que funcionen desde el dominio público.

### Frontend → [Netlify](https://netlify.com) o [Vercel](https://vercel.com)

1. Sube solo el directorio `frontend/` o configura el directorio raíz como `frontend`.
2. Configura la URL del backend en `frontend/js/runtime-config.js`.
3. El frontend ya incluye `frontend/netlify.toml` y `frontend/vercel.json` con rutas amigables (`/dashboard`, `/expenses`, etc).

```js
window.__GASTOSAPP_CONFIG__ = {
    apiBaseUrl: 'https://gastosapp-backend.onrender.com/api',
};
```

---

## Variables de entorno

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | cadena aleatoria larga | Secreto para firmar tokens |
| `JWT_EXPIRES_IN` | `24h` | Duración del token |
| `FRONTEND_URL` | `https://gastosapp.netlify.app` | Origen permitido por CORS |
| `PORT` | `3000` | Puerto del servidor (Render lo pone automáticamente) |

---

## Scripts disponibles (backend)

| Comando | Descripción |
|---------|-------------|
| `npm run start:dev` | Modo desarrollo con hot-reload |
| `npm run build` | Compila TypeScript → `dist/` |
| `npm run start:prod` | Inicia la versión compilada |
| `npx prisma migrate dev` | Aplica migraciones en desarrollo |
| `npx prisma studio` | Explorador visual de la base de datos |
| `npx prisma generate` | Regenera el cliente Prisma |

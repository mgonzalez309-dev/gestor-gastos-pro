# GastosApp – Plataforma Inteligente de Gestión de Gastos Personales

Sistema full-stack para el seguimiento inteligente de gastos personales: carga manual o por foto de tickets (interpretados con OCR + IA), analíticas financieras avanzadas, presupuestos, alertas automáticas y un panel de asesor financiero. Incluye roles **USER** y **ADVISOR**.

---

## Tecnologías

| Capa | Stack |
|------|-------|
| Frontend | HTML5 · CSS3 · JavaScript (ES6) vanilla · Chart.js 4 · ExcelJS · jsPDF + autoTable · Cropper.js |
| Backend | Node.js 18 · NestJS 10 · Prisma 5 |
| Base de datos | PostgreSQL (Neon en producción) |
| Autenticación | JWT (passport-jwt) + bcrypt |
| OCR | Tesseract.js 5 (local, español + inglés) |
| IA | OpenAI API (gpt-4o-mini) para extracción estructurada de tickets, con fallback heurístico local si no hay API key |
| Almacenamiento de imágenes | Filesystem local (`/uploads`) · Cloudinary opcional para avatares |
| Testing | Jest + ts-jest (unit) · Supertest (e2e) |
| Infraestructura | Railway (backend + frontend como servicios separados) |

---

## Estructura del proyecto

```
Proyecto Ingenieria Web II/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # Modelos: User, Expense, Ticket, Recommendation, Notification
│   │   └── migrations/             # Historial versionado de cambios de schema
│   ├── src/
│   │   ├── auth/                   # JWT: register, login, me, guards, estrategia passport
│   │   ├── users/                  # Perfil, avatar, presupuestos por categoría
│   │   ├── expenses/                # CRUD + analíticas + patrones + comparación entre meses
│   │   ├── tickets/                 # Subida de imágenes + OCR + extracción IA
│   │   ├── recommendations/         # Recomendaciones manuales y automáticas (asesor)
│   │   ├── notifications/           # Alertas automáticas del sistema
│   │   ├── shared/                  # FinancialRulesService (motor de reglas compartido)
│   │   ├── prisma/                  # PrismaService global
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/                        # Tests e2e (supertest)
│   ├── uploads/                     # Imágenes subidas (git-ignorado)
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── pages/                       # Las 8 páginas HTML de la app
    │   ├── landing.html             # Marketing público
    │   ├── index.html               # Login
    │   ├── register.html
    │   ├── dashboard.html
    │   ├── expenses.html
    │   ├── upload-ticket.html
    │   ├── profile.html
    │   └── advisor.html             # Solo ADVISOR
    ├── services/
    │   └── api.js                   # Cliente HTTP puro + sesión (token/usuario)
    ├── utils/
    │   ├── format.js                 # Moneda, fechas, categorías
    │   └── dom.js                    # Alertas, escape HTML, iniciales
    ├── js/                           # Un módulo de lógica por página + compartidos
    │   ├── auth.js                   # Layout común, sidebar, tema, sesión
    │   ├── dashboard.js
    │   ├── expenses.js
    │   ├── tickets.js
    │   ├── profile.js
    │   ├── advisor.js
    │   ├── notifications.js          # Campana, panel, browser push
    │   └── components.js             # Carga de fragmentos HTML reutilizables
    ├── components/                   # Fragmentos HTML reutilizables (sidebar, etc.)
    ├── css/
    ├── assets/
    └── server.js                     # Express: rutas limpias + runtime-config
```

---

## Decisiones de arquitectura

### ¿Por qué el frontend levanta un servidor Express?

El frontend es HTML/CSS/JS estático — no hay build step ni framework — pero **igual** corre detrás de un pequeño servidor Express (`frontend/server.js`). Esto no es accidental ni redundante: resuelve dos problemas concretos.

**1. Railway necesita un proceso vivo, no un directorio de archivos.**
La plataforma de despliegue elegida (Railway) factura y monitorea servicios en base a un *proceso* corriendo, no a un hosting de archivos estáticos puro. Sin un servidor propio, desplegar el frontend como "solo archivos" no es una opción directa en Railway sin contratar/configurar un servicio de static-site aparte.

**2. Una sola build sirve para todos los entornos.**
El backend puede vivir en `http://localhost:4500` en desarrollo y en `https://gastos-backend.up.railway.app` en producción. En vez de hardcodear esa URL en el JavaScript (lo que obligaría a tener un build distinto por entorno), `server.js` expone un endpoint propio:

```js
app.get('/js/runtime-config.js', (_req, res) => {
  const apiBaseUrl = (process.env.API_BASE_URL || '').trim();
  res.send(`window.__GASTOSAPP_CONFIG__ = { apiBaseUrl: ${JSON.stringify(apiBaseUrl)} };`);
});
```

El navegador carga `runtime-config.js` como cualquier script, pero su contenido se genera en el momento según la variable de entorno del servidor. El mismo código fuente funciona en local y en producción sin tocar una línea.

Adicionalmente, registra rutas con nombre (`/dashboard`, `/expenses`, etc.) **antes** del middleware estático, sirviendo los archivos físicos desde `frontend/pages/` sin que la URL pública lo refleje.

**Trade-offs honestos — esto no es gratis:**

| Ventaja | Costo |
|---------|-------|
| Mismo build para todos los entornos (config en runtime) | Un proceso de más corriendo para contenido 100% estático |
| Despliegue simétrico al backend (mismo patrón en Railway) | Sin compresión gzip, cache-control headers ni CDN — un hosting estático real (Vercel, Netlify, Cloudflare Pages) lo hace mejor de fábrica |
| Cero configuración adicional de infraestructura | El problema de "URL por entorno" también se resuelve con variables de entorno inyectadas en build-time en esos hostings, sin necesitar servidor propio |

**Conclusión:** es una decisión válida y deliberada para el contexto de este proyecto (deploy simple en Railway, sin pipeline de CI/CD), no una sobre-ingeniería accidental. Si el proyecto creciera o necesitara mejor rendimiento de entrega estática, migrar a un hosting estático con variables de entorno en build-time sería el siguiente paso natural.

---

## Modelo de datos

6 entidades relacionadas, todas con `userId` como FK hacia `User`:

```
User 1───* Expense       (gastos del usuario)
User 1───* Ticket         (tickets escaneados)
User 1───* Notification   (alertas automáticas)
User 1───* SavingsGoal     (metas de ahorro con objetivo y plazo)
User 1───* Recommendation (recibidas: userId)  ──┐
User 1───* Recommendation (emitidas: advisorId) ─┘ (un ADVISOR puede emitir; nullable si es autogenerada)
Ticket 1───* Expense      (opcional: un gasto puede originarse de un ticket)
```

| Entidad | Campos clave | Notas |
|---------|--------------|-------|
| **User** | `email`, `password` (bcrypt), `role` (USER\|ADVISOR), `currency`, `monthlyIncome`, `savingsGoal`, `categoryBudgets` (JSON), `avatarUrl` | `categoryBudgets` guarda `{"FOOD": 5000, "TRANSPORT": 2000, ...}`. `savingsGoal` es un monto simple mensual — distinto de `SavingsGoal` (entidad), que es una meta con objetivo y plazo |
| **Expense** | `merchant`, `amount`, `category` (enum 10 valores), `date`, `description`, `tags` (array de texto), `ticketId?` | Categorías: FOOD, TRANSPORT, ENTERTAINMENT, HEALTH, EDUCATION, CLOTHING, TECHNOLOGY, HOME, SERVICES, OTHER |
| **Ticket** | `imageUrl`, `extractedText`, `parsedAmount`, `parsedMerchant`, `parsedDate`, `parsedTax`, `parsedItems` (JSON) | Los campos `parsed*` quedan `null` hasta que el OCR+IA terminan de procesar (asíncrono) |
| **Recommendation** | `message`, `type` (GENERAL\|ALERT\|SAVING\|PATTERN), `advisorId?` | `advisorId` nulo = autogenerada por el sistema, no por un asesor humano |
| **Notification** | `type` (MONTHLY_GROWTH\|UNUSUAL_EXPENSE\|SAVINGS_RISK\|BUDGET_ALERT\|GENERAL), `title`, `message`, `isRead`, `metadata` (JSON) | Generadas on-demand al cargar el dashboard, con cooldown de 24h por tipo (no hay scheduler/cron) |
| **SavingsGoal** | `name`, `targetAmount`, `currentAmount` (default 0), `targetDate?` | Ej: "Vacaciones — $1.000.000 antes del 31/12". `progressPct`, `remaining`, `isCompleted` y `daysLeft` se calculan en el servicio, no se persisten |

---

## Configuración local

### Requisitos previos

- Node.js ≥ 18
- npm ≥ 9
- PostgreSQL (local vía Docker, o una cadena de conexión remota como Neon/Supabase)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Editar `.env` con tu `DATABASE_URL`, `JWT_SECRET` y el resto de variables (ver tabla más abajo).

```bash
# Modo seguro: si falta .env lo crea, levanta PostgreSQL por Docker (si está disponible)
# y aplica migraciones automáticamente antes de arrancar
npm run start:dev:safe

# O directo, si ya tenés la DB lista
npm run start:dev
```

La API queda en `http://localhost:4500/api` · Swagger en `http://localhost:4500/docs` · Prisma Studio con `npx prisma studio` en `http://localhost:5555`.

### 2. Frontend

El frontend **no se abre como archivo HTML suelto ni con Live Server** — corre con su propio servidor Express (necesario para las rutas limpias y la inyección de `API_BASE_URL` en runtime, ver "Decisiones de arquitectura" arriba):

```bash
cd frontend
npm install
npm start          # node server.js, sirve en http://localhost:3000
```

Si el backend no corre en `http://localhost:4500`, configurá la variable de entorno `API_BASE_URL` del proceso de `server.js` (en producción/Railway), o seteá `localStorage.setItem('api_base_url', 'http://tu-backend/api')` desde la consola del navegador en desarrollo.

### Arrancar todo junto (backend + frontend + Prisma Studio)

Desde la raíz del proyecto, en PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\iniciar.ps1
```

Levanta los tres procesos, espera a que el backend esté healthy, y abre el navegador en la landing.

---

## Crear usuario ADVISOR

El registro público (`/register`) siempre crea usuarios con `role = USER`. No existe un flujo de alta de asesores desde la UI — es una decisión deliberada (un asesor no debería poder auto-asignarse el rol). Para promover un usuario a **ADVISOR**:

**Opción A – Prisma Studio (interfaz visual):**
```bash
cd backend
npx prisma studio
```
Abrí `http://localhost:5555`, tabla `User`, editá el campo `role` a `ADVISOR`.

**Opción B – SQL directo** (la tabla real en Postgres se llama `users`, en minúscula — ver `@@map` en `schema.prisma`):
```sql
UPDATE users SET role = 'ADVISOR' WHERE email = 'asesor@empresa.com';
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
| PUT | `/api/users/:id` | Actualizar perfil | Propio / ADVISOR |
| GET | `/api/users/:id/budgets` | Presupuestos por categoría | Propio / ADVISOR |
| PUT | `/api/users/:id/budgets` | Guardar presupuestos por categoría | Propio / ADVISOR |
| DELETE | `/api/users/:id/budgets/:category` | Eliminar el presupuesto de una categoría puntual | Propio / ADVISOR |
| GET | `/api/expenses` | Lista gastos (paginada, filtros: comercio/categoría/etiqueta/fecha/monto) | USER / ADVISOR |
| POST | `/api/expenses` | Crear gasto | USER |
| GET | `/api/expenses/:id` | Detalle de gasto | Dueño / ADVISOR |
| PUT | `/api/expenses/:id` | Actualizar gasto | Dueño / ADVISOR |
| DELETE | `/api/expenses/:id` | Eliminar gasto | Dueño / ADVISOR |
| GET | `/api/expenses/tags` | Etiquetas únicas usadas por el usuario | USER |
| GET | `/api/expenses/analytics` | Analíticas propias (categoría, mes, comercios, anomalías, perfil financiero) | USER |
| GET | `/api/expenses/analytics/:userId` | Analíticas de un usuario | ADVISOR |
| GET | `/api/expenses/patterns/:userId` | Patrones y tendencias de gasto | ADVISOR |
| GET | `/api/expenses/compare` | Comparar dos meses (propio) | USER |
| GET | `/api/expenses/compare/:userId` | Comparar dos meses de un usuario | ADVISOR |
| POST | `/api/tickets/upload` | Subir imagen + disparar OCR/IA asíncrono | USER |
| POST | `/api/tickets/:id/parse` | Re-procesar OCR de un ticket existente | USER |
| GET | `/api/tickets` | Historial de tickets propios | USER |
| GET | `/api/tickets/:id` | Detalle de ticket (polling del frontend) | Dueño / ADVISOR |
| DELETE | `/api/tickets/:id` | Eliminar ticket + su imagen | Dueño |
| POST | `/api/recommendations` | Crear recomendación manual | ADVISOR |
| POST | `/api/recommendations/auto-generate/:userId` | Auto-generar con motor de reglas | ADVISOR |
| GET | `/api/recommendations/my` | Recomendaciones propias | USER |
| GET | `/api/recommendations/:userId` | Recomendaciones de un usuario | ADVISOR |
| POST | `/api/notifications/generate` | Generar alertas automáticas (cooldown 24h/tipo) | USER / ADVISOR |
| GET | `/api/notifications` | Listar notificaciones propias | USER / ADVISOR |
| GET | `/api/notifications/unread-count` | Cantidad sin leer (badge) | USER / ADVISOR |
| PUT | `/api/notifications/:id/read` | Marcar una como leída | USER / ADVISOR |
| PUT | `/api/notifications/read-all` | Marcar todas como leídas | USER / ADVISOR |
| DELETE | `/api/notifications/:id` | Eliminar una notificación | USER / ADVISOR |
| DELETE | `/api/notifications/clear-all` | Eliminar todas | USER / ADVISOR |
| POST | `/api/savings-goals` | Crear meta de ahorro (nombre, monto objetivo, fecha límite opcional) | USER |
| GET | `/api/savings-goals` | Listar metas propias (con progreso calculado) | USER |
| GET | `/api/savings-goals/:id` | Detalle de una meta | Dueño |
| PUT | `/api/savings-goals/:id` | Editar nombre/monto/fecha | Dueño |
| POST | `/api/savings-goals/:id/contribute` | Sumar un aporte al ahorro acumulado | Dueño |
| DELETE | `/api/savings-goals/:id` | Eliminar una meta | Dueño |

Documentación interactiva completa (probar requests en vivo): `http://localhost:4500/docs`

---

## Uso de IA: pipeline OCR + extracción estructurada

```
1. Usuario sube/arrastra una foto de ticket en /upload-ticket
2. POST /api/tickets/upload (multipart/form-data)
3. Backend guarda el archivo en backend/uploads/ con nombre UUID
   y crea el registro Ticket → responde de inmediato con { id, imageUrl }
4. (Asíncrono, no bloquea la respuesta)
   a. Tesseract.js extrae el texto crudo de la imagen (español + inglés)
   b. El texto se envía a OpenAI (gpt-4o-mini) con un prompt que pide
      JSON estructurado: { merchant, date, total, tax, items[] }
      - Instrucción explícita: usar el TOTAL FINAL pagado, nunca el
        subtotal ni montos pre-impuestos
   c. Si no hay RECEIPT_AI_API_KEY configurada, o la llamada a OpenAI
      falla, cae a un heurístico local de 4 niveles que busca patrones
      de texto típicos de tickets (TOTAL A PAGAR, IMPORTE TOTAL, etc.)
      y normaliza formatos numéricos (1.234,56 vs 1,234.56)
   d. El Ticket se actualiza con los campos parsed*
5. El frontend hace polling a GET /api/tickets/:id cada 2 segundos
   hasta que extractedText deja de ser null (máx. 20 intentos = 40s)
6. El wizard avanza al paso 3: formulario pre-completado y EDITABLE
   con lo que detectó la IA — el usuario corrige si hace falta
7. POST /api/expenses con ticketId → se crea el gasto vinculado
```

La carga múltiple de tickets repite este pipeline en cola, archivo por archivo, mostrando el estado de cada uno (Pendiente → Subiendo → Procesando OCR → Listo/Error).

---

## Flujo de usuario (demo)

1. **Registro** → `/register` → cuenta creada con rol USER, JWT guardado, redirige a dashboard
2. **Login** → `/login` → mismo JWT, mismo dashboard
3. **Carga de ticket** → `/upload-ticket` → foto o drag&drop de una imagen de ticket
4. **Procesamiento IA** → spinner de 2-10s mientras Tesseract.js + GPT-4o-mini extraen los datos
5. **Confirmación** → formulario pre-completado (comercio, monto, fecha, categoría sugerida) → usuario corrige y confirma
6. **Creación automática del gasto** → `POST /api/expenses` vinculado al ticket
7. **Dashboard actualizado** → gráficos de torta/barras, ranking de comercios, perfil financiero, alertas si corresponde
8. **Análisis financiero** → `/expenses` con filtros avanzados, comparación de meses en el dashboard
9. **Recomendaciones** → el usuario ve las recomendaciones que le dejó su asesor (o autogeneradas)
10. **Vista del asesor** → login con cuenta ADVISOR → `/advisor` → lista de usuarios → detalle con analytics, tendencias, generación de recomendaciones, exportación a PDF

---

## Despliegue (Railway)

### Base de datos → [Neon](https://neon.tech) o [Supabase](https://supabase.com)

1. Crea un proyecto y copia la cadena de conexión (`postgresql://...`).
2. Úsala como `DATABASE_URL` en las variables de entorno del backend.

### Backend → [Railway](https://railway.com)

1. Servicio desde GitHub con **Root Directory** = `backend`. Usa `backend/railway.toml` (build + start + healthcheck).
2. Variables requeridas: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`. Opcionales: `RECEIPT_AI_API_KEY` (sin ella, cae al heurístico local), `CLOUDINARY_*` (sin ellas, avatares se guardan en base64).
3. El backend publica imágenes de tickets en `/uploads/*` — **limitación conocida**: en Railway el filesystem es efímero, las imágenes se pierden en cada redeploy. Para producción real, migrar a S3/Cloudinary.

### Frontend → Railway (segundo servicio)

1. Servicio desde GitHub con **Root Directory** = `frontend`. Usa `frontend/railway.toml` + `frontend/server.js`.
2. Define `API_BASE_URL` con la URL pública del backend.

### Orden recomendado

1. Backend primero → copiar su URL pública.
2. Configurar `API_BASE_URL` en frontend → redeploy.
3. Actualizar `FRONTEND_URL` en backend con la URL pública del frontend → redeploy.

---

## Variables de entorno

| Variable | Ejemplo | Requerida | Descripción |
|----------|---------|-----------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Sí | Cadena de conexión PostgreSQL (usada por Prisma) |
| `JWT_SECRET` | cadena aleatoria larga | Sí | Secreto para firmar tokens |
| `JWT_EXPIRES_IN` | `24h` | No (default 7d) | Duración del token |
| `FRONTEND_URL` | `https://gastos-frontend.up.railway.app` | No | Origen permitido por CORS + redirect de `/` |
| `PORT` | `4500` | No (default 3000) | Puerto del servidor |
| `NODE_ENV` | `production` | No | Desactiva Swagger y endurece CORS en producción |
| `MAX_FILE_SIZE_MB` | `10` | No (default 10) | Límite de tamaño para subida de tickets |
| `RECEIPT_AI_API_KEY` | `sk-...` | No | API key de OpenAI. Sin ella, usa el heurístico local |
| `RECEIPT_AI_MODEL` | `gpt-4o-mini` | No | Modelo a usar |
| `RECEIPT_AI_API_URL` | `https://api.openai.com/v1/chat/completions` | No | Endpoint del proveedor de IA |
| `CLOUDINARY_CLOUD_NAME` | — | No | Sin configurar, avatares se guardan en base64 en la DB |
| `CLOUDINARY_API_KEY` | — | No | — |
| `CLOUDINARY_API_SECRET` | — | No | — |
| `API_BASE_URL` (frontend) | `https://gastos-backend.up.railway.app/api` | No | URL de backend inyectada en runtime al frontend desplegado |

---

## Testing

```bash
cd backend
npm run test        # unit tests (Jest + mocks de Prisma)
npm run test:e2e    # e2e contra la app real (Supertest)
npm run test:cov    # con reporte de cobertura
```

- **Unit** (19 tests): `expenses.service.spec.ts` cubre el cálculo de analíticas, el umbral de detección de gastos anómalos (5x el promedio) y la clasificación del perfil financiero. `savings-goals.service.spec.ts` cubre el CRUD completo, el cálculo de progreso (incluyendo el cap en 100% cuando un aporte supera el objetivo) y el control de ownership entre usuarios.
- **E2E** (7 tests): `auth.e2e-spec.ts` cubre registro, login, credenciales inválidas, y protección de rutas por JWT/rol. No hay base de datos de test separada — el usuario de prueba se crea con un email único por corrida y se borra automáticamente al finalizar.

---

## Scripts disponibles (backend)

| Comando | Descripción |
|---------|-------------|
| `npm run start:dev` | Modo desarrollo con hot-reload |
| `npm run start:dev:safe` | Igual, pero verifica `.env`, levanta Docker y aplica migraciones antes |
| `npm run build` | Compila TypeScript → `dist/` |
| `npm run start:prod` | Inicia la versión compilada |
| `npm run test` / `test:watch` / `test:cov` | Unit tests |
| `npm run test:e2e` | Tests end-to-end |
| `npx prisma migrate dev` | Aplica migraciones en desarrollo |
| `npx prisma studio` | Explorador visual de la base de datos |
| `npx prisma generate` | Regenera el cliente Prisma |

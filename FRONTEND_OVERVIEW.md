# GastosApp — Documentación del Frontend

## ¿Qué es GastosApp?

GastosApp es una aplicación web de gestión de finanzas personales con inteligencia artificial. Permite a los usuarios registrar gastos, escanear tickets físicos con OCR, visualizar estadísticas en tiempo real y recibir recomendaciones financieras de un asesor humano o de forma automática.

---

## Tecnologías utilizadas

| Tecnología | Uso |
|------------|-----|
| **HTML5 + CSS3** | Estructura y estilos de todas las páginas |
| **Vanilla JavaScript (ES2020)** | Toda la lógica del frontend, sin frameworks |
| **Chart.js 4.4.2** | Gráficos de torta, barras y evolución mensual |
| **Lucide Icons** | Iconografía SVG dinámica |
| **jsPDF + AutoTable** | Generación de reportes PDF en el navegador |
| **ExcelJS** | Exportación de gastos a `.xlsx` |
| **CropperJS** | Recorte de foto de perfil |
| **heic2any** | Conversión de fotos HEIC (iPhone) a JPEG |
| **Express.js** | Servidor estático que sirve los archivos HTML/CSS/JS |
| **Google Fonts (Figtree)** | Tipografía principal |

---

## Arquitectura general

El frontend es una **SPA sin framework** (Single Page Architecture con páginas separadas). Cada página HTML es autocontenida y carga los módulos JS que necesita.

### Patrón de módulos (IIFE)

Todo el JavaScript está organizado como **módulos IIFE** que exponen un objeto global:

```
const MiModulo = (() => {
  // lógica privada
  return { funcionPublica };
})();
window.MiModulo = MiModulo;
```

Esto evita contaminación del scope global y simula la encapsulación sin necesidad de un bundler.

### Flujo de una página protegida

```
HTML carga → runtime-config.js → api.js → auth.js → components.js
                                                          ↓
                                                   sidebar.html (fetch)
                                                          ↓
                                                   MiModulo.init()
```

1. `runtime-config.js` inyecta la URL del backend según el entorno
2. `api.js` se inicializa con esa URL
3. `auth.js` verifica el JWT en `localStorage`; si no existe, redirige a `index.html`
4. `components.js` carga el sidebar desde `components/sidebar.html` via fetch
5. El módulo de la página llama a `init()` para arrancar

---

## Estructura de archivos

```
frontend/
├── landing.html          ← Página de inicio pública (marketing)
├── index.html            ← Login
├── register.html         ← Registro de usuario
├── dashboard.html        ← Panel principal (requiere login)
├── expenses.html         ← Gestión de gastos
├── upload-ticket.html    ← Carga de tickets OCR
├── profile.html          ← Perfil de usuario
├── advisor.html          ← Panel del asesor (requiere rol ADVISOR)
├── server.js             ← Servidor Express para servir el frontend
├── js/
│   ├── runtime-config.js ← URL del backend según entorno
│   ├── api.js            ← Capa de comunicación con el backend
│   ├── auth.js           ← Autenticación, sidebar, tema, paleta de comandos
│   ├── components.js     ← Carga dinámica del sidebar
│   ├── dashboard.js      ← Lógica del panel principal
│   ├── expenses.js       ← CRUD de gastos + exportación
│   ├── tickets.js        ← Flujo de carga de tickets con OCR
│   ├── profile.js        ← Perfil, avatar, presupuesto
│   ├── advisor.js        ← Panel del asesor financiero
│   └── decrypted-text.js ← Animación de texto en la landing
├── css/
│   ├── design-tokens.css ← Variables CSS globales (colores, tipografía, temas)
│   ├── layout.css        ← Grid y estructura de la app
│   ├── components.css    ← Componentes reutilizables (cards, badges, modales)
│   ├── dashboard.css     ← Estilos específicos del dashboard
│   ├── auth.css          ← Estilos de login y registro
│   └── app.css           ← Estilos globales de la app
└── components/
    └── sidebar.html      ← Componente del sidebar (cargado dinámicamente)
```

---

## Módulos JavaScript — Detalle

### `api.js` — Capa de comunicación

Es el núcleo del frontend. Todos los demás módulos lo usan.

**Qué hace:**
- Resuelve la URL del backend (`localhost:4500` en dev, Railway en producción) usando `window.__GASTOSAPP_CONFIG__`
- Provee `get()`, `post()`, `put()`, `del()`, `upload()` como wrappers de `fetch`
- Agrega automáticamente el header `Authorization: Bearer <token>` en cada petición
- Si el servidor responde 401, redirige al login y limpia la sesión
- Gestiona el token JWT y los datos del usuario en `localStorage`

**Utilidades que exporta:**
| Función | Qué hace |
|---------|----------|
| `formatCurrency(amount)` | Formatea un número como moneda según la configuración del usuario (ARS, USD, EUR, etc.) |
| `formatDate(date)` | Formatea una fecha en español (dd/mm/yyyy) |
| `formatRelativeDate(date)` | "Hace 2 días", "Ayer", etc. |
| `categoryLabel(cat)` | Convierte `FOOD` → `🛒 Alimentación` |
| `categoryPill(cat)` | Genera HTML de un badge de categoría con color |
| `escapeHtml(str)` | Escapa caracteres HTML para prevenir XSS |
| `getInitials(name)` | `"Juan Pérez"` → `"JP"` |
| `showAlert(id, msg, tipo)` | Muestra un mensaje de error/éxito en un elemento del DOM |

---

### `auth.js` — Autenticación y layout compartido

Maneja todo lo relacionado con la sesión y la interfaz común a todas las páginas protegidas.

**Funciones principales:**

- **`requireAuth(role)`** — Verifica que haya un token válido. Si no, redirige a login. Si se pasa un rol (ej. `'ADVISOR'`), verifica que el usuario tenga ese rol. Luego llama a `initLayout()`.
- **`initLayout()`** — Inicializa el sidebar con nombre del usuario, avatar, botón de logout, toggle del sidebar en mobile, widget de presupuesto disponible y switcher de tema.
- **`login(email, password)`** — Llama a `POST /auth/login`, guarda el token y los datos del usuario, redirige al dashboard.
- **`register(data)`** — Llama a `POST /auth/register`, luego hace login automático.
- **`logout()`** — Limpia `localStorage` y redirige al login.

**Funcionalidades extra:**

- **Widget de presupuesto en sidebar** — Si el usuario configuró ingreso mensual, muestra el dinero disponible restante del mes (ingreso − gasto actual) con colores: verde (bien), amarillo (bajo), rojo (en negativo).
- **Cambio de tema** — Toggle claro/oscuro persistido en `localStorage`. Despacha un evento `app-theme-changed` para que los gráficos se re-rendericen con los colores correctos.
- **Paleta de comandos** — Tecla `/` o botón "Comando" en el topbar abre un buscador de navegación rápida entre páginas y acciones.

---

### `components.js` — Sidebar dinámico

Carga `components/sidebar.html` vía `fetch` e inyecta el HTML en el slot `#sidebar-slot` de cada página. Marca como activo el enlace que corresponde a la página actual usando el atributo `data-page`.

---

### `dashboard.js` — Panel principal

La página más compleja del frontend. Se ejecuta cuando el usuario ingresa al dashboard.

**Qué carga en paralelo al iniciar:**
1. `/expenses/analytics` → estadísticas, gráficos, ritmo de gasto, ahorro
2. `/expenses?limit=8` → últimos 8 gastos (tabla + sidebar de movimientos)
3. `/recommendations/my` → últimas recomendaciones del asesor
4. `/tickets` → últimos tickets escaneados

**Componentes que renderiza:**

| Componente | Descripción |
|-----------|-------------|
| **Stat cards** | Gasto del mes, cantidad de gastos, promedio, comercio top |
| **Gráfico de torta** | Distribución por categoría (filtrable por período: todo / mes / semana) |
| **Gráfico de barras** | Evolución mensual de gastos |
| **Pace card** | Velocímetro del ritmo de gasto vs. el esperado para la fecha del mes. Proyecta el total a fin de mes. |
| **Barra de ahorro** | Progreso hacia la meta de ahorro mensual configurada |
| **Top comercios** | Lista de los comercios donde más se gasta, con barras proporcionales |
| **Barras de categorías** | Top 6 categorías del mes con porcentaje visual |
| **Tabla de gastos recientes** | Últimos 8 movimientos |
| **Sidebar de movimientos** | Los 4 gastos más recientes con ícono de categoría y tiempo relativo |
| **Sidebar de insights** | Mensajes automáticos (ej: "Tu comercio top concentra el 40% del gasto") |
| **Tickets recientes** | Miniaturas de los últimos tickets OCR subidos |
| **Recomendaciones** | Últimas 5 recomendaciones del asesor |
| **Modal de gastos inusuales** | Aparece automáticamente si el backend detectó gastos anormalmente altos |

---

### `expenses.js` — Gestión de gastos

CRUD completo de gastos con tabla paginada, filtros avanzados y exportación.

**Funcionalidades:**

- **Tabla de gastos** con paginación y filtros por categoría, período (mes, semana, año, fecha específica, rango personalizado)
- **Modal de creación/edición** con validación de campos
- **Modal de confirmación de eliminación**
- **Exportación Excel (.xlsx)** con formato profesional: encabezados coloreados, columnas con ancho automático, formato de moneda por celda, filtros de Excel habilitados
- **Exportación PDF** con tabla, encabezado de marca y pie de página
- **Generador de reportes PDF** con métricas, gráficos de barras horizontales, insights automáticos y tabla detallada

---

### `tickets.js` — Escaneo de tickets OCR

Flujo paso a paso para subir una foto de un ticket físico y convertirlo en un gasto.

**Flujo en 3 pasos:**

```
Paso 1: Selección del archivo
        (drag & drop o selector de archivo — acepta imágenes y PDF)
            ↓
Paso 2: Procesamiento OCR
        (el backend analiza la imagen con Tesseract + IA)
        (el frontend hace polling cada 2 segundos hasta que el estado sea "processed")
            ↓
Paso 3: Confirmación
        (se muestran los datos extraídos: comercio, monto, fecha)
        (el usuario puede editarlos antes de guardar como gasto)
```

También muestra el **historial de tickets** subidos, con miniatura, estado de procesamiento, comercio extraído y monto. Permite eliminar tickets desde un modal de confirmación.

---

### `profile.js` — Perfil de usuario

Permite al usuario ver y editar su información personal y configuración financiera.

**Secciones:**

- **Datos personales** — nombre, edad, email, moneda preferida
- **Foto de perfil** — subida con previsualización, recorte interactivo (CropperJS), soporte HEIC. La foto se guarda en Cloudinary (vía backend) y se cachea en `localStorage` para carga instantánea.
- **Estadísticas rápidas** — cantidad de gastos, tickets y fecha de miembro
- **Resumen de presupuesto mensual** — configuración de ingreso mensual, meta de ahorro (con indicador de porcentaje), gasto actual del mes y dinero disponible restante

---

### `advisor.js` — Panel del asesor financiero

Solo accesible para usuarios con rol `ADVISOR`. Permite analizar los gastos de cualquier usuario registrado.

**Funcionalidades:**

- **Grilla de usuarios** con buscador en tiempo real (filtra por nombre o email)
- **Vista detallada de un usuario** con:
  - Stat cards (total del mes, cantidad, promedio, variación mensual)
  - Gráfico de torta por categoría
  - Gráfico de barras de evolución mensual
  - Lista de tendencias por categoría (sube/baja/estable con porcentaje)
  - Lista de recomendaciones existentes
- **Generar recomendaciones automáticas** — llama al endpoint de IA del backend
- **Enviar recomendación manual** — modal con tipo (consejo, alerta, info) y mensaje libre
- **Exportar reporte PDF** — documento de 2 páginas con métricas, tabla de categorías, evolución mensual, tendencias y recomendaciones
- **Copiar resumen al portapapeles** — texto formateado listo para enviar por WhatsApp o email

---

## Páginas y navegación

| Ruta | Página | Acceso |
|------|--------|--------|
| `/` | Landing pública con descripción del producto | Público |
| `/login` | Formulario de inicio de sesión | Público |
| `/register` | Formulario de registro | Público |
| `/dashboard` | Panel principal con estadísticas | Usuario / Asesor |
| `/expenses` | Gestión de gastos | Usuario / Asesor |
| `/upload-ticket` | Carga de ticket OCR | Usuario / Asesor |
| `/profile` | Perfil y configuración | Usuario / Asesor |
| `/advisor` | Panel del asesor | Solo Asesor |

La navegación entre páginas es estándar (redirección del navegador). La protección de rutas se implementa en el frontend: si no hay token en `localStorage`, `requireAuth()` redirige inmediatamente al login antes de renderizar cualquier contenido.

---

## Sistema de temas

La app soporta **modo claro y modo oscuro**. El tema se guarda en `localStorage` y se aplica como atributo `data-theme` en el `<body>`. Las variables CSS cambian automáticamente vía CSS custom properties definidas en `design-tokens.css`.

Cuando el usuario cambia el tema, se dispara el evento personalizado `app-theme-changed`, que los módulos de gráficos escuchan para re-renderizar con la paleta de colores correcta.

---

## Seguridad en el frontend

- **JWT en localStorage** — el token se envía en cada petición como `Authorization: Bearer`
- **Expiración de sesión** — si el backend devuelve 401, el frontend borra el token y redirige al login automáticamente
- **Escape de HTML** — todo texto dinámico que proviene del servidor se escapa con `Api.escapeHtml()` antes de insertarse en el DOM, previniendo ataques XSS
- **Sin eval ni innerHTML con datos sin escapar** — todo el contenido de usuario pasa por la función de escape

---

## Comunicación con el backend

El frontend consume una API REST en NestJS. La URL base se configura en `runtime-config.js` (generada por el servidor Express en cada request) y se resuelve automáticamente:

- En **desarrollo local** → `http://localhost:4500/api`
- En **Railway (producción)** → la variable de entorno `API_BASE_URL` del servidor Express

Todos los endpoints usan JSON. Las peticiones de subida de archivos usan `multipart/form-data`.

### Endpoints principales que consume el frontend

| Método | Endpoint | Usado en |
|--------|----------|----------|
| `POST` | `/auth/login` | Login |
| `POST` | `/auth/register` | Registro |
| `GET` | `/expenses` | Dashboard, Gastos |
| `POST/PUT/DELETE` | `/expenses/:id` | Gastos |
| `GET` | `/expenses/analytics` | Dashboard |
| `GET` | `/expenses/analytics/:userId` | Asesor |
| `GET` | `/expenses/patterns/:userId` | Asesor |
| `POST` | `/tickets/upload` | Tickets |
| `GET` | `/tickets/:id` | Tickets (polling OCR) |
| `GET` | `/recommendations/my` | Dashboard |
| `POST` | `/recommendations/auto-generate/:userId` | Asesor |
| `GET/POST` | `/recommendations` | Dashboard, Asesor |
| `GET/PUT` | `/users/:id` | Perfil, Asesor |
| `PUT` | `/users/:id/avatar` | Perfil |

---

## Despliegue

El frontend se despliega en **Railway** como una aplicación Node.js que ejecuta `server.js`. Este servidor Express sirve los archivos estáticos y expone rutas amigables (`/dashboard`, `/expenses`, etc.) que resuelven a los archivos HTML correspondientes.

La variable de entorno `API_BASE_URL` le indica al servidor Express cuál es la URL del backend en producción, y la inyecta dinámicamente en `runtime-config.js` para que el código JS del cliente la consuma.

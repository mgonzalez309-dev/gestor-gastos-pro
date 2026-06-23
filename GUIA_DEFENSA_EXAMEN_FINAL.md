# Guía de Defensa — Examen Final de Ingeniería Web II

**Proyecto:** GastosApp — Plataforma Inteligente de Gestión de Gastos Personales
**Rama de entrega:** `cambios-examen-final` (creada desde `2-parcial`)
**Repositorio:** `mgonzalez309-dev/gestor-gastos-pro`

Este documento es la guía de estudio para defender el proyecto. No reemplaza al `README.md` (instalación, deploy, variables de entorno) ni a `DEMO.md` (script de presentación corto) — los complementa con trazabilidad exacta de archivo:línea, inventario completo y preparación para preguntas.

---

# 1) Mapeo completo de funcionalidades implementadas

## 1. Categorización automática de gastos mediante IA

**Estado:** ✅ Implementado

**Frontend:**
- Archivo: `frontend/js/tickets.js`
- Función: `suggestCategory(merchantName)` — línea 363
- Se invoca dentro de `fillStep3Form(ticket)` — línea 221
- Página: `upload-ticket.html` (paso 3 del wizard)

**Backend:** No aplica — la categorización es heurística pura en el cliente, no hay endpoint dedicado.

**Qué hace:** Cuando la IA extrae el nombre del comercio de un ticket, un diccionario de keywords (ej. "carrefour", "coto" → FOOD; "ypf", "shell" → TRANSPORT; "netflix", "spotify" → ENTERTAINMENT) sugiere automáticamente la categoría en el `<select>` del formulario. El usuario puede cambiarla antes de confirmar.

**Datos que usa:** El string `parsedMerchant` que devolvió el OCR/IA del ticket.

---

## 2. Dashboard financiero avanzado

**Estado:** ✅ Implementado

**Frontend:**
- Página: `frontend/pages/dashboard.html`
- Archivo: `frontend/js/dashboard.js`
- Componentes: `renderCategoryChart()` (línea 270, gráfico de torta Chart.js), `renderMonthlyChart()` (línea 312, barras de 6 meses), `renderMerchantList()` (línea 364, ranking), `initMonthComparison()` / `loadMonthComparison()` (líneas 767/794, comparación entre meses)

**Backend:**
- Módulo: `expenses/`
- Controller: `ExpensesController.getMyAnalytics()` → `GET /api/expenses/analytics`
- Service: `ExpensesService.getAnalytics()` — línea 165

**Base de datos:** Tabla `expenses`, agregaciones `groupBy` por categoría y por comercio, `aggregate` por mes actual/anterior.

**Cómo funciona internamente:** El servicio corre 5 queries Prisma en paralelo (`Promise.all`): gastos agrupados por categoría, top 10 comercios, gastos de los últimos 6 meses, total del mes actual, total del mes anterior. Con eso calcula `monthGrowth` (% de variación), detecta `unusualExpenses` (>5x el promedio) y clasifica el `financialProfile` del usuario.

---

## 3. Presupuestos mensuales por categoría

**Estado:** ✅ Implementado (con CRUD completo, incluido DELETE agregado en esta rama)

**Frontend:**
- Página: `frontend/pages/profile.html`, sección `#category-budgets-card`
- Archivo: `frontend/js/profile.js` — `loadCategoryBudgets()` (línea 472), `removeCategoryBudget()` (línea 515)

**Backend:**
- Módulo: `users/`
- Controller: `UsersController` — `GET/PUT/DELETE /api/users/:id/budgets[/:category]`
- Service: `UsersService.getBudgets()`, `updateBudgets()`, `removeBudget()`

**Base de datos:** Campo `User.categoryBudgets` (tipo `Json`, ej. `{"FOOD": 5000, "TRANSPORT": 2000}`).

**Cómo funciona internamente:** No es una tabla relacional — es un objeto JSON guardado directo en la fila del usuario. `removeBudget()` reconstruye el objeto sin la clave de la categoría eliminada (no solo la pone en 0), usando destructuring (`const { [category]: _removed, ...rest } = current`).

---

## 4. Alertas de gasto excesivo

**Estado:** ✅ Implementado

**Backend:**
- Módulo: `notifications/` + `shared/`
- Service: `NotificationsService.generate()` (línea 68), que usa `FinancialRulesService.evaluateBudgetExceeded()` y `evaluateMonthGrowth()` (`backend/src/shared/financial-rules.service.ts`)
- Modelo: `Notification`

**Frontend:**
- Archivo: `frontend/js/notifications.js` — campana en el sidebar + panel dropdown + Browser Notifications API
- Se invoca desde `auth.js` al cargar cualquier página (`Notifications.init()`)

**Cómo funciona internamente:** Al cargar el dashboard, el frontend llama `POST /api/notifications/generate`. El backend evalúa 4 condiciones (crecimiento mensual >20%, gasto anómalo >5x promedio, riesgo de meta de ahorro, presupuesto de categoría excedido) y crea notificaciones nuevas solo si no existe una del mismo tipo en las últimas 24 horas (evita espamear).

---

## 5. Metas de ahorro (con objetivo y plazo)

**Estado:** ✅ Implementado completo en esta rama (antes era solo un campo simple `User.savingsGoal`)

**Frontend:**
- Página: `frontend/pages/profile.html`, sección `#savings-goals-card` + modales `#savings-goal-modal` y `#contribute-modal`
- Archivo: `frontend/js/profile.js` — `loadSavingsGoals()` (línea 614), `renderSavingsGoals()`, `saveSavingsGoal()`, `openContributeModal()`, `saveContribution()`

**Backend:**
- Módulo nuevo: `savings-goals/` (controller + service + 3 DTOs)
- Endpoints: `POST/GET /api/savings-goals`, `GET/PUT/DELETE /api/savings-goals/:id`, `POST /api/savings-goals/:id/contribute`
- Service: `SavingsGoalsService.create()` (línea 11), `findAllByUser()` (línea 25), `addContribution()` (línea 53), `withProgress()` (línea 84, privado)

**Base de datos:** Modelo nuevo `SavingsGoal` (`name`, `targetAmount`, `currentAmount`, `targetDate?`), relación 1-a-muchos con `User`, cascade delete. Migración: `20260619000000_add_savings_goals`.

**Cómo funciona internamente:** `withProgress()` es un método privado que NO persiste los campos derivados — los calcula al vuelo en cada respuesta: `progressPct` (capeado a 100% aunque el aporte real supere el objetivo), `remaining`, `isCompleted`, `daysLeft`. El endpoint `/contribute` suma un monto al `currentAmount` existente sin que el frontend tenga que leer-y-recalcular el total.

---

## 6. Comparación entre meses

**Estado:** ✅ Implementado

**Backend:**
- Controller: `ExpensesController.compareMyMonths()` / `compareUserMonths()` → `GET /api/expenses/compare[/:userId]`
- Service: `ExpensesService.compareMonths()` — línea 402

**Frontend:**
- `dashboard.html`, sección "Comparar meses" (selectores de mes + botón)
- `dashboard.js` — `initMonthComparison()`, `loadMonthComparison()`, `renderMonthComparison()`

**Cómo funciona internamente:** Sin parámetros, compara mes anterior vs mes actual por defecto. Devuelve total y desglose por categoría de ambos meses, más un array `diff.byCategory` ordenado por la diferencia absoluta más grande (para resaltar qué categoría cambió más).

---

## 7. Análisis de patrones de consumo

**Estado:** ✅ Implementado (completado en esta rama con día de la semana y categoría dominante explícitos)

**Backend:**
- Controller: `ExpensesController.getPatterns()` → `GET /api/expenses/patterns/:userId` (ADVISOR)
- Service: `ExpensesService.getPatterns()` — línea 320

**Frontend:**
- `advisor.html`, tarjeta "Tendencias de categorías" + `#patterns-summary`
- `advisor.js` — `loadUserPatterns()` (línea 212), `renderPatternsSummary()` (línea 242)

**Cómo funciona internamente:** Sobre los gastos de los últimos 3 meses calcula: `trends` (tendencia creciente/decreciente/estable por categoría, comparando el último mes contra el anterior), `topDayOfWeek` (suma gastos por día de la semana 0-6 y devuelve el de mayor monto), `dominantCategory` (categoría con mayor gasto acumulado en el período).

---

## 8. Ranking de comercios

**Estado:** ✅ Implementado

**Backend:** Incluido en `ExpensesService.getAnalytics()` — `groupBy(['merchant'])`, top 10 ordenado por monto.

**Frontend:** `dashboard.js` — `renderMerchantList()` (línea 364), sección `#merchant-list` en `dashboard.html`.

---

## 9. Búsqueda avanzada de gastos

**Estado:** ✅ Implementado (backend Y frontend)

**Backend:**
- `ExpensesController.findAll()` → `GET /api/expenses` con query params: `category`, `startDate`, `endDate`, `merchant` (contains, case-insensitive), `tag`, `minAmount`, `maxAmount`, `page`, `limit`

**Frontend:**
- `expenses.html` (barra de filtros completa)
- `expenses.js` — `applyFilters()` (línea 211), `bindFilters()`, `buildQueryParamsFromFilters()`

---

## 10. Exportación de datos

**Estado:** ✅ Implementado (Excel y PDF; no hay CSV puro, pero Excel cumple el mismo propósito)

**Frontend (100% client-side, sin endpoint backend dedicado):**
- `expenses.js` — `exportAsExcel()` (línea 409, librería ExcelJS), `exportAsPdf()` (línea 629, jsPDF + autoTable)
- Botones en `expenses.html`: "Exportar Excel", "Exportar PDF", "Generar reporte"

**Cómo funciona internamente:** Llama a `GET /api/expenses` con los filtros activos pero `limit` alto para traer todo el dataset filtrado, y construye el archivo en el navegador (no hay procesamiento de exportación en el servidor).

---

## 11. Modo oscuro

**Estado:** ✅ Implementado

**Frontend:** `frontend/js/auth.js` — `THEME_KEY`, `setTheme()`, `applyStoredTheme()`, `injectThemeSwitcher()`. Persistencia en `localStorage`, aplicado vía atributo `data-theme` en `<body>`.

---

## 12. Carga múltiple de tickets

**Estado:** ✅ Implementado

**Frontend:**
- `upload-ticket.html` — toggle "Carga múltiple" + `#multi-upload-mode`
- `tickets.js` — `bindMultiUpload()` (línea 401), `handleMultiFilesSelected()` (línea 447), `processMultiFiles()` (línea 485)

**Cómo funciona internamente:** Procesa los archivos secuencialmente (uno a la vez, no en paralelo), mostrando el estado de cada uno en una cola visual (Pendiente → Subiendo → Procesando OCR → Listo/Error).

---

## 13. Edición inteligente de tickets post-IA

**Estado:** ✅ Implementado

**Frontend:** `tickets.js` — `fillStep3Form(ticket)` (línea 221) pre-completa comercio/monto/fecha/categoría, pero todos los campos quedan editables antes de confirmar el gasto.

---

## 14. Etiquetas personalizadas

**Estado:** ✅ Implementado

**Backend:**
- Campo `Expense.tags` (`String[]`)
- `ExpensesService.sanitizeTags()` (línea 45, normaliza a lowercase, deduplica, máx. 10 etiquetas de 30 caracteres), `getUserTags()` (línea 54)
- `GET /api/expenses/tags`

**Frontend:** `expenses.js` — `bindTagInput()` (línea 1339, chip-input con autocompletado), filtro por tag en la barra de filtros.

---

## 15. Notificaciones automáticas

**Estado:** ✅ Implementado

**Backend:** Módulo `notifications/` completo + modelo `Notification`. Ver punto 4.

**Frontend:** `notifications.js` — campana con badge de no-leídas, panel dropdown, Browser Notifications API para alertas críticas (`BUDGET_ALERT`, `SAVINGS_RISK`).

---

## 16. Perfil financiero del usuario

**Estado:** ✅ Implementado

**Backend:** `ExpensesService.getAnalytics()` calcula `financialProfile` según `spendingRate = currentMonth.total / monthlyIncome`: >90% IMPULSIVO, >70% ACTIVO, >50% EQUILIBRADO, resto AHORRADOR.

**Frontend:** `profile.js` — `loadFinancialProfile()` (línea 562). `dashboard.js` — `renderFinancialProfileBadge()` (línea 708).

---

## 17. Recomendaciones personalizadas

**Estado:** ✅ Implementado

**Backend:**
- `RecommendationsService.autoGenerate()` (línea 59), usa `FinancialRulesService` (las mismas funciones `evaluateMonthGrowth`, `evaluateUnusualExpense`, `evaluateTopCategory`, `evaluateIncreasingTrends`, `evaluateAboveAverageSpending`)
- `POST /api/recommendations/auto-generate/:userId` (ADVISOR)

**Frontend:** `dashboard.js` (lista propia), `advisor.js` — `autoRecommend()` (línea 290).

---

## 18. Historial de recomendaciones

**Estado:** ✅ Implementado

**Backend:** Todas las recomendaciones quedan persistidas en la tabla `recommendations`. `GET /api/recommendations/my` (propio), `GET /api/recommendations/:userId` (ADVISOR).

---

## 19. Panel avanzado para asesores

**Estado:** ✅ Implementado

**Frontend:** `advisor.html` completo + `advisor.js` — `loadUsers()` (línea 30), `selectUser()` (línea 80), `generatePDF()` (línea 363, reporte PDF completo), `copySummaryToClipboard()`.

**Backend:** Endpoints `ADVISOR`-only en `users` (`GET /users`), `expenses` (`analytics/:userId`, `patterns/:userId`, `compare/:userId`), `recommendations` (`auto-generate/:userId`).

---

## 20. Detección de gastos anómalos

**Estado:** ✅ Implementado

**Backend:** `ExpensesService.getAnalytics()` — `unusualExpenses` con umbral `amount > avgAmount * 5` (5x el promedio de los últimos 6 meses, sobre gastos de los últimos 30 días). `FinancialRulesService.evaluateUnusualExpense()`.

**Frontend:** `dashboard.js` — `showUnusualModal()` (línea 532), modal automático si hay gastos anómalos al cargar el dashboard.

---

### Resumen de estado

| # | Funcionalidad | Estado |
|---|---|---|
| 1-4, 6-20 | (19 funcionalidades) | ✅ Implementadas |
| 5 | Metas de ahorro | ✅ Implementada completa (era parcial antes de esta rama) |

**No hay funcionalidades "No implementadas" del listado de 20.** Las únicas brechas que existían (presupuestos sin DELETE, metas de ahorro como campo simple) se cerraron en esta rama.

---

# 2) Guía de demostración para el examen

Las 20 funcionalidades, una por una, con la pantalla exacta a abrir, los pasos a seguir y qué decir. Numeración igual que en la Sección 1 para cruzar referencias fácil.

---

### 1. Categorización automática de gastos mediante IA
**Pantalla:** `/upload-ticket`
**Pasos:**
1. Subir una foto de un ticket de un comercio reconocible (ej. un supermercado o una estación de servicio).
2. Esperar a que el wizard avance al paso 3.
3. Señalar el campo "Categoría" — ya viene seleccionada sin que el usuario haga nada.
4. Abrir el `<select>` y mostrar que se puede cambiar libremente.

**Qué decir:** *"Cuando la IA detecta el nombre del comercio, un diccionario de palabras clave en el frontend lo cruza contra categorías típicas — 'carrefour' o 'coto' caen en Alimentación, 'ypf' o 'shell' en Transporte, 'netflix' en Entretenimiento. No es una llamada a IA para esto puntualmente, es una heurística rápida que corre en el cliente."*

---

### 2. Dashboard financiero avanzado
**Pantalla:** `/dashboard`
**Pasos:**
1. Iniciar sesión como usuario con datos cargados.
2. Señalar las 4 tarjetas de stats (gasto del mes, cantidad, promedio, comercio top).
3. Mostrar el gráfico de torta por categoría, cambiar el filtro Mes/Año/Siempre.
4. Mostrar el gráfico de barras de los últimos 6 meses.
5. Mostrar el ranking de comercios y la tarjeta de perfil financiero.

**Qué decir:** *"Todo esto se calcula en tiempo real desde el backend con agregaciones de Prisma sobre los gastos reales del usuario — no hay datos mockeados."*

---

### 3. Presupuestos mensuales
**Pantalla:** `/profile` → sección "Presupuestos por categoría"
**Pasos:**
1. Asignar un límite bajo a una categoría con gastos ya cargados (ej. $500 en Alimentación).
2. Guardar.
3. Mostrar el botón "×" que aparece junto a esa categoría.
4. Click en "×" → mostrar que el campo vuelve a quedar vacío (sin límite).

**Qué decir:** *"Eliminar un presupuesto no lo pone en cero — borra la clave completa del objeto JSON. Es la diferencia entre 'sin límite' y 'límite de cero', que para las alertas de gasto excesivo es una distinción real: un límite de cero dispararía alertas en cualquier gasto."*

---

### 4. Alertas de gasto excesivo
**Pantalla:** sidebar (campana de notificaciones, visible en cualquier página) + `/dashboard`
**Pasos:**
1. Con el presupuesto bajo del punto 3 ya configurado, recargar `/dashboard` (esto dispara `POST /notifications/generate`).
2. Abrir la campana en el sidebar — mostrar el badge con la cantidad de no-leídas.
3. Abrir el panel y mostrar la notificación de tipo "Presupuesto excedido".
4. (Si el usuario tiene `monthlyIncome` configurado) Mostrar también la alerta de "Meta de ahorro en riesgo" si corresponde.

**Qué decir:** *"Las notificaciones tienen un cooldown de 24 horas por tipo — si volvés a generar, no te va a duplicar la misma alerta. Esto evita spamear al usuario cada vez que carga el dashboard."*

---

### 5. Metas de ahorro
**Pantalla:** `/profile` → sección "Mis metas de ahorro"
**Pasos:**
1. Click en "+ Nueva meta" → crear "Vacaciones", monto $1.000.000, fecha a 6 meses.
2. Mostrar la barra de progreso en 0%.
3. Click en "Aportar" → ingresar $300.000 → mostrar que la barra sube a 30%.
4. (Opcional, para impacto) Aportar el resto y mostrar el mensaje de meta completada con la tarjeta cambiando de color.
5. Mostrar el botón de eliminar una meta.

**Qué decir:** *"Esto es distinto del campo simple de meta de ahorro mensual que ya existía en el perfil — esta es una entidad propia con objetivo, plazo y progreso acumulado, el caso de uso exacto del enunciado: 'ahorrar $1.000.000 en 6 meses'. El endpoint de aportar (`/contribute`) suma al monto actual sin que el frontend tenga que recalcular nada."*

---

### 6. Comparación entre meses
**Pantalla:** `/dashboard` → sección "Comparar meses"
**Pasos:**
1. Elegir un mes A y un mes B en los selectores (por defecto ya viene mes anterior vs mes actual).
2. Click en "Comparar".
3. Mostrar el total de cada mes y el % de diferencia.
4. Señalar la tabla de categorías ordenada por la diferencia más grande.

**Qué decir:** *"El backend trae los totales de ambos meses en paralelo y calcula la diferencia por categoría, ordenando por la magnitud del cambio — así se ve primero qué categoría es la que más varió, no solo la primera alfabéticamente."*

---

### 7. Análisis de patrones de consumo
**Pantalla:** `/advisor` (como asesor) → seleccionar un usuario
**Pasos:**
1. Loguearse como asesor.
2. Seleccionar un usuario con gastos variados.
3. Mostrar la tarjeta resumen con "Categoría dominante" y "Día con más gasto".
4. Bajar a "Tendencias de categorías" y señalar las flechas de creciente/decreciente/estable.

**Qué decir:** *"Esto analiza los últimos 3 meses de gastos: agrupa por día de la semana para encontrar el de mayor gasto acumulado, y compara el último mes contra el anterior por categoría para detectar tendencias."*

---

### 8. Ranking de comercios
**Pantalla:** `/dashboard` → sección "Top comercios"
**Pasos:**
1. Señalar la lista ordenada de comercios.
2. Mostrar que cada uno tiene el monto total y la cantidad de gastos asociados.

**Qué decir:** *"Es un `groupBy` por comercio sobre toda la tabla de gastos del usuario, ordenado de mayor a menor monto, top 10."*

---

### 9. Búsqueda avanzada de gastos
**Pantalla:** `/expenses`
**Pasos:**
1. Usar el filtro de comercio (texto parcial, ej. escribir "carre" y que encuentre "Carrefour").
2. Combinar con filtro de categoría.
3. Combinar con rango de monto mínimo/máximo.
4. Combinar con rango de fechas.
5. Mostrar que la tabla se actualiza con todos los filtros aplicados a la vez.

**Qué decir:** *"Todos los filtros se mandan como query params al mismo endpoint `GET /expenses` y se combinan con AND en el backend — no hay filtrado del lado del cliente, así que funciona igual aunque haya miles de gastos."*

---

### 10. Exportación de datos
**Pantalla:** `/expenses`
**Pasos:**
1. Aplicar algún filtro (opcional, para mostrar que exporta lo filtrado, no todo).
2. Click en "Exportar Excel" → abrir el archivo generado.
3. Click en "Generar reporte" PDF → abrir el PDF con gráficos.

**Qué decir:** *"Se genera 100% en el navegador con ExcelJS y jsPDF — el backend solo entrega los datos filtrados, el armado del archivo no pasa por el servidor."*

---

### 11. Modo oscuro
**Pantalla:** cualquier página (botón en el footer del sidebar)
**Pasos:**
1. Click en el toggle de tema.
2. Mostrar el cambio instantáneo de paleta de colores.
3. Recargar la página (F5) y mostrar que el tema persiste.

**Qué decir:** *"Se guarda en `localStorage` y se aplica con un atributo `data-theme` en el `<body>` — todo el CSS está escrito con variables que cambian según ese atributo, no hay que duplicar estilos."*

---

### 12. Carga múltiple de tickets
**Pantalla:** `/upload-ticket`
**Pasos:**
1. Activar el toggle "Carga múltiple".
2. Seleccionar 2 o 3 fotos de tickets a la vez.
3. Mostrar la cola visual con el estado de cada archivo (Pendiente → Subiendo → Procesando OCR → Listo).
4. Esperar a que termine y mostrar que se crearon varios tickets en el historial.

**Qué decir:** *"Se procesan secuencialmente, uno por uno, para no saturar el servicio de OCR — cada uno reporta su propio estado en la cola, y si uno falla, no frena a los demás."*

---

### 13. Edición inteligente de tickets post-IA
**Pantalla:** `/upload-ticket` (paso 3 del wizard)
**Pasos:**
1. Subir un ticket y dejar que la IA complete los campos.
2. Editar manualmente el monto o el comercio a propósito (simular una corrección).
3. Cambiar la categoría sugerida por otra.
4. Confirmar y mostrar que el gasto se creó con los valores corregidos, no con los originales de la IA.

**Qué decir:** *"La IA pre-completa, pero el usuario siempre tiene la última palabra antes de guardar — nada se persiste hasta que se confirma el formulario."*

---

### 14. Etiquetas personalizadas
**Pantalla:** `/expenses` → modal de crear/editar gasto
**Pasos:**
1. Abrir "+ Nuevo gasto" o editar uno existente.
2. En el campo de etiquetas, escribir una etiqueta nueva (ej. "vacaciones") y confirmar con Enter.
3. Mostrar que queda como chip removible.
4. Guardar y mostrar la etiqueta en la tabla de gastos.
5. Usar el filtro de etiquetas para buscar por esa misma tag.

**Qué decir:** *"Las etiquetas se guardan como array de texto en el gasto, se normalizan a minúscula y se deduplican — máximo 10 por gasto, 30 caracteres cada una."*

---

### 15. Notificaciones automáticas
**Pantalla:** sidebar (campana, visible en cualquier página)
**Pasos:**
1. Cargar el dashboard (dispara la generación automática).
2. Abrir la campana y mostrar el panel con las notificaciones.
3. Marcar una como leída (click) y mostrar que el badge baja.
4. (Si el navegador dio permiso) Mostrar que también aparece como notificación nativa del sistema operativo.

**Qué decir:** *"No hay un cron job corriendo en el servidor — se generan on-demand cuando el frontend pide el dashboard, evaluando reglas financieras con cooldown de 24 horas por tipo."*

---

### 16. Perfil financiero del usuario
**Pantalla:** `/profile` y `/dashboard` (badge)
**Pasos:**
1. En `/profile`, mostrar la tarjeta de perfil financiero con la etiqueta (Impulsivo/Activo/Equilibrado/Ahorrador).
2. Ir a `/dashboard` y señalar el mismo badge ahí.
3. (Opcional) Cambiar el ingreso mensual en el perfil y recargar el dashboard para mostrar que la clasificación puede cambiar.

**Qué decir:** *"Se calcula como el % del ingreso mensual que se gastó este mes: más de 90% es Impulsivo, entre 70 y 90% Activo, entre 50 y 70% Equilibrado, menos de 50% Ahorrador."*

---

### 17. Recomendaciones personalizadas
**Pantalla:** `/dashboard` (lista propia) y `/advisor` (generación)
**Pasos:**
1. En `/dashboard`, mostrar la sección "Recomendaciones" con lo que ya existe.
2. Loguearse como asesor, ir a `/advisor`, seleccionar el usuario.
3. Click en "Generar recomendaciones automáticas".
4. Volver a loguearse como ese usuario y mostrar que las recomendaciones nuevas aparecen en su dashboard.

**Qué decir:** *"El mismo motor de reglas que genera las notificaciones automáticas alimenta estas recomendaciones — la diferencia es el texto final y que las dispara el asesor, no el sistema solo."*

---

### 18. Historial de recomendaciones
**Pantalla:** `/dashboard` (como usuario)
**Pasos:**
1. Generar recomendaciones más de una vez (en distintos momentos, si el tiempo de la demo lo permite) o mostrar varias ya existentes.
2. Señalar que la lista no se borra — quedan todas persistidas con su fecha.

**Qué decir:** *"Todas las recomendaciones quedan guardadas en la tabla `recommendations`, nunca se sobrescriben — `GET /recommendations/my` siempre devuelve el historial completo, ordenado de más reciente a más vieja."*

---

### 19. Panel avanzado para asesores
**Pantalla:** `/advisor`
**Pasos:**
1. Loguearse como asesor (`asesor@gastosapp.com`).
2. Mostrar la grilla de usuarios con buscador.
3. Seleccionar un usuario → mostrar stats, gráficos, tendencias, categoría dominante y día con más gasto.
4. Generar el PDF del informe completo.
5. (Para mostrar la seguridad) Loguearse con un usuario normal e intentar entrar a `/advisor` — mostrar que redirige automáticamente al dashboard.

**Qué decir:** *"El control de acceso está en el backend, no es solo ocultar botones — si un usuario normal intenta pegarle directamente a estos endpoints con Postman o curl, el servidor responde 403 Forbidden, no solo el frontend lo esconde."*

---

### 20. Detección de gastos anómalos
**Pantalla:** `/dashboard`
**Pasos:**
1. Cargar un gasto manual con un monto mucho más alto que el promedio habitual del usuario (ej. si el promedio es $5.000, cargar uno de $50.000).
2. Recargar `/dashboard`.
3. Mostrar el modal automático "Detectamos un gasto inusual" que aparece solo.
4. Señalar también la alerta correspondiente en la campana de notificaciones.

**Qué decir:** *"El umbral es 5 veces el promedio de gasto de los últimos 6 meses, evaluado sobre gastos de los últimos 30 días — así no compara contra un solo mes que pudo haber sido atípico."*

---

# 3) Flujo completo de demo (recorrido recomendado)

| # | Paso | Pantalla |
|---|------|----------|
| 1 | Registro de usuario nuevo | `/register` |
| 2 | Login | `/login` |
| 3 | Completar perfil (ingreso mensual, moneda) | `/profile` |
| 4 | Carga manual de un gasto | `/expenses` (botón "+ Nuevo gasto") |
| 5 | Carga de ticket por foto | `/upload-ticket` |
| 6 | Procesamiento IA/OCR (mostrar el spinner) | `/upload-ticket` (paso 2) |
| 7 | Categorización automática (mostrar la sugerencia) | `/upload-ticket` (paso 3) |
| 8 | Dashboard con gráficos actualizados | `/dashboard` |
| 9 | Análisis de patrones (categoría dominante, día con más gasto) | `/advisor` (como asesor) o explicar que también alimenta recomendaciones |
| 10 | Presupuestos por categoría | `/profile` |
| 11 | Alertas (campana de notificaciones) | cualquier página (sidebar) |
| 12 | Metas de ahorro (crear + aportar) | `/profile` |
| 13 | Recomendaciones (propias + autogeneradas por asesor) | `/dashboard` y `/advisor` |
| 14 | Vista asesor completa | `/advisor` |

Este orden sigue exactamente la secuencia pedida en el enunciado del examen y es el mismo que documenté en `DEMO.md` con el guion de qué decir en cada paso.

---

# 4) Inventario de rutas del frontend

| Ruta | Archivo físico | Función |
|------|-----------------|---------|
| `/` | `frontend/pages/landing.html` | Landing pública de marketing |
| `/landing` | `frontend/pages/landing.html` | Alias explícito de la landing |
| `/login` | `frontend/pages/index.html` | Formulario de inicio de sesión |
| `/index` | `frontend/pages/index.html` | Alias de `/login` |
| `/register` | `frontend/pages/register.html` | Formulario de registro |
| `/dashboard` | `frontend/pages/dashboard.html` | Dashboard financiero (requiere sesión) |
| `/expenses` | `frontend/pages/expenses.html` | CRUD de gastos + filtros + exportación |
| `/profile` | `frontend/pages/profile.html` | Perfil, presupuestos, metas de ahorro |
| `/upload-ticket` | `frontend/pages/upload-ticket.html` | Wizard de carga de tickets con OCR/IA |
| `/advisor` | `frontend/pages/advisor.html` | Panel del asesor (requiere rol ADVISOR) |

**Nota técnica:** Las rutas las define `frontend/server.js` con un mapa `htmlRoutes`, registrado ANTES del middleware estático de Express. Los archivos físicos viven en `frontend/pages/` desde el refactor de esta rama anterior (`2-parcial`) — antes estaban todos sueltos en la raíz del proyecto frontend.

---

# 5) Inventario de endpoints backend

## auth/ (`backend/src/auth/auth.controller.ts`)

| Método | Endpoint | Función | Datos requeridos | Respuesta |
|--------|----------|---------|-------------------|-----------|
| POST | `/api/auth/register` | Crea usuario nuevo (rol USER) | `name, email, password` | `{ user, access_token }` |
| POST | `/api/auth/login` | Autentica y devuelve JWT | `email, password` | `{ user, access_token }` |
| GET | `/api/auth/me` | Perfil del usuario autenticado | Header `Authorization: Bearer` | Objeto `User` |

## users/ (`backend/src/users/users.controller.ts`)

| Método | Endpoint | Función | Rol |
|--------|----------|---------|-----|
| GET | `/api/users` | Lista todos los usuarios | ADVISOR |
| GET | `/api/users/:id` | Detalle de usuario | Propio/ADVISOR |
| GET | `/api/users/:id/summary` | Resumen con totales de gastos | Propio/ADVISOR |
| PUT | `/api/users/:id` | Actualizar perfil (nombre, email, password, avatar, ingreso) | Propio/ADVISOR |
| GET | `/api/users/:id/budgets` | Obtener presupuestos por categoría | Propio/ADVISOR |
| PUT | `/api/users/:id/budgets` | Guardar presupuestos por categoría | Propio/ADVISOR |
| DELETE | `/api/users/:id/budgets/:category` | Eliminar presupuesto de una categoría | Propio/ADVISOR |

## expenses/ (`backend/src/expenses/expenses.controller.ts`)

| Método | Endpoint | Función | Rol |
|--------|----------|---------|-----|
| POST | `/api/expenses` | Crear gasto | USER |
| GET | `/api/expenses` | Listar (paginado + filtros avanzados) | USER/ADVISOR |
| GET | `/api/expenses/tags` | Etiquetas únicas del usuario | USER |
| GET | `/api/expenses/analytics` | Analíticas propias | USER |
| GET | `/api/expenses/analytics/:userId` | Analíticas de un usuario | ADVISOR |
| GET | `/api/expenses/patterns/:userId` | Patrones de consumo | ADVISOR |
| GET | `/api/expenses/compare` | Comparar dos meses (propio) | USER |
| GET | `/api/expenses/compare/:userId` | Comparar dos meses de un usuario | ADVISOR |
| GET | `/api/expenses/:id` | Detalle de gasto | Dueño/ADVISOR |
| PUT | `/api/expenses/:id` | Actualizar gasto | Dueño/ADVISOR |
| DELETE | `/api/expenses/:id` | Eliminar gasto | Dueño/ADVISOR |

## tickets/ (`backend/src/tickets/tickets.controller.ts`)

| Método | Endpoint | Función | Rol |
|--------|----------|---------|-----|
| POST | `/api/tickets/upload` | Subir imagen, dispara OCR/IA asíncrono | USER |
| POST | `/api/tickets/:id/parse` | Re-procesar OCR de un ticket existente | USER |
| GET | `/api/tickets` | Historial de tickets propios | USER |
| GET | `/api/tickets/:id` | Detalle (usado para polling del frontend) | Dueño/ADVISOR |
| DELETE | `/api/tickets/:id` | Eliminar ticket + su imagen | Dueño |

## recommendations/ (`backend/src/recommendations/recommendations.controller.ts`)

| Método | Endpoint | Función | Rol |
|--------|----------|---------|-----|
| POST | `/api/recommendations` | Crear recomendación manual | ADVISOR |
| POST | `/api/recommendations/auto-generate/:userId` | Autogenerar con motor de reglas | ADVISOR |
| GET | `/api/recommendations/my` | Recomendaciones propias | USER |
| GET | `/api/recommendations/:userId` | Recomendaciones de un usuario | ADVISOR |

## notifications/ (`backend/src/notifications/notifications.controller.ts`)

| Método | Endpoint | Función | Rol |
|--------|----------|---------|-----|
| POST | `/api/notifications/generate` | Generar alertas (cooldown 24h/tipo) | USER/ADVISOR |
| GET | `/api/notifications` | Listar propias | USER/ADVISOR |
| GET | `/api/notifications/unread-count` | Cantidad sin leer | USER/ADVISOR |
| PUT | `/api/notifications/:id/read` | Marcar una como leída | USER/ADVISOR |
| PUT | `/api/notifications/read-all` | Marcar todas como leídas | USER/ADVISOR |
| DELETE | `/api/notifications/clear-all` | Eliminar todas | USER/ADVISOR |
| DELETE | `/api/notifications/:id` | Eliminar una | USER/ADVISOR |

## savings-goals/ (`backend/src/savings-goals/savings-goals.controller.ts`) — nuevo en esta rama

| Método | Endpoint | Función | Rol |
|--------|----------|---------|-----|
| POST | `/api/savings-goals` | Crear meta de ahorro | USER |
| GET | `/api/savings-goals` | Listar metas propias (con progreso) | USER |
| GET | `/api/savings-goals/:id` | Detalle de una meta | Dueño |
| PUT | `/api/savings-goals/:id` | Editar nombre/monto/fecha | Dueño |
| POST | `/api/savings-goals/:id/contribute` | Sumar un aporte | Dueño |
| DELETE | `/api/savings-goals/:id` | Eliminar meta | Dueño |

**Total: 36 endpoints REST.**

---

# 6) Cambios realizados por commits

## Rama `2-parcial` (sobre `main`) — 12 commits

| Commit | Archivos principales | Qué agregó |
|--------|------------------------|------------|
| `797d804` `c496c51` | Backend + frontend (tags, notifications, budgets) | Trabajo de cierre del 2do parcial: etiquetas, notificaciones, presupuestos, perfil financiero |
| `79afd4b` | Las 8 páginas HTML + `js/*.js` | Normalización de paths a rutas absolutas (preparación para mover archivos) |
| `888f10d` | `frontend/server.js` + 8 HTML | Movió las páginas a `frontend/pages/` (resuelve feedback del 1er parcial sobre estructura) |
| `036580b` `80fcd2c` | `api.js` → `services/api.js` + `utils/{dom,format}.js` | Separó el cliente HTTP de las utilidades de formato/DOM (single responsibility) |
| `d5cbc2d` | `README.md` | Documentó por qué el frontend usa un servidor Express (responde feedback del profesor) |
| `3bda51d` | `shared/financial-rules.service.ts`, `recommendations.service.ts`, `notifications.service.ts` | Extrajo el motor de reglas financieras compartido (eliminó duplicación de lógica) |
| `3fc2e30` | `expenses.controller/service.ts`, `dashboard.html/js` | Vista de comparación entre meses |
| `86557eb` | `expenses.service.spec.ts`, `auth.e2e-spec.ts`, config de Jest | Primeros tests automatizados del proyecto |
| `e554a80` `e7fa69d` | `README.md`, `DEMO.md` | Documentación final y guion de demo |

## Rama `cambios-examen-final` (sobre `2-parcial`) — 7 commits

| Commit | Archivos principales | Qué agregó |
|--------|------------------------|------------|
| `fea90a2` | `users.controller/service.ts`, `profile.js`, `app.css` | `DELETE /users/:id/budgets/:category` + botón de eliminar en el frontend |
| `b7ade93` | `schema.prisma`, migración `add_savings_goals` | Modelo de datos `SavingsGoal` |
| `876577e` | `savings-goals/` (7 archivos nuevos), `app.module.ts` | CRUD completo de metas de ahorro (controller, service, 3 DTOs, módulo) |
| `390c942` | `profile.html`, `profile.js`, `app.css` | UI de metas de ahorro: lista con progreso, modales de crear/editar/aportar |
| `cc280d6` | `expenses.service.ts`, `advisor.html/js`, `app.css` | `topDayOfWeek` y `dominantCategory` en `getPatterns()` + tarjeta resumen en el panel asesor |
| `47ada63` | `savings-goals.service.spec.ts` | 10 tests unitarios del módulo nuevo |
| `2e78459` | `README.md` | Documentación de los endpoints y modelo nuevos |

---

# 7) Funcionalidades que más conviene mostrar al profesor

Ordenadas de mayor a menor impacto en una demo de ~10-12 minutos:

### 1. Carga de ticket + OCR + IA (GPT-4o-mini)
**Por qué:** Es la única funcionalidad que demuestra integración con un servicio de IA externo real, con un pipeline completo (imagen → texto → JSON estructurado) y un fallback inteligente si la IA no está disponible. Es lo más "wow" visualmente porque el usuario ve datos aparecer solos.

### 2. Dashboard financiero con gráficos interactivos
**Por qué:** Demuestra que el proyecto no es un CRUD plano — hay agregación de datos real, cálculos de tendencias, y visualización con Chart.js. Es la funcionalidad más "vendible" en términos de UX.

### 3. Metas de ahorro con progreso
**Por qué:** Es la funcionalidad más nueva y completa de esta entrega, con una barra de progreso visual y un mensaje de "felicitaciones" al completar — genera una reacción positiva inmediata en quien mira.

### 4. Sistema de notificaciones automáticas
**Por qué:** Demuestra lógica de negocio no trivial (reglas financieras, cooldown de 24h, Browser Notifications API) sin necesitar un cron job — explica bien que entendieron el problema de "cuándo generar una alerta sin spamear".

### 5. Panel del asesor con control de roles real
**Por qué:** Demuestra arquitectura de permisos backend (no solo ocultar botones) y un caso de uso de negocio completo (un rol distinto viendo datos de otros usuarios).

### 6. Exportación a Excel/PDF
**Por qué:** Es funcionalmente sólida y fácil de demostrar (un click, un archivo real se abre), aunque conceptualmente es menos "inteligente" que las anteriores.

### 7. Búsqueda avanzada y etiquetas personalizadas
**Por qué:** Útiles pero menos vistosas — mejor mencionarlas de paso mientras se muestra `/expenses`, no dedicarles tiempo propio.

---

# 8) Posibles preguntas del profesor (con respuestas técnicas)

**P: ¿Por qué decidieron esta arquitectura (NestJS + vanilla JS sin framework de frontend)?**
R: El backend usa NestJS por su estructura modular obligatoria (controller/service/módulo), que fuerza separación de responsabilidades incluso en un equipo chico. El frontend es vanilla JS deliberadamente — no había necesidad de un framework para el alcance del proyecto, y permite entender exactamente qué hace cada línea sin abstracciones de por medio.

**P: ¿Por qué hay un servidor Express del lado del frontend si es solo HTML/CSS/JS estático?**
R: Railway (la plataforma de deploy) necesita un proceso vivo, no solo archivos estáticos. Además, el servidor expone un endpoint `runtime-config.js` que inyecta la URL del backend en tiempo de ejecución según el entorno, evitando tener un build distinto por ambiente. Está documentado en detalle en el README, sección "Decisiones de arquitectura".

**P: ¿Cómo funciona la integración con IA para los tickets?**
R: Tesseract.js extrae el texto crudo de la imagen localmente (OCR, sin servicio externo). Ese texto se manda a la API de OpenAI (gpt-4o-mini) con un prompt que exige JSON estructurado y aclara explícitamente que debe usar el total final pagado, no el subtotal. Si no hay API key configurada, o la llamada falla, cae a un heurístico local de 4 niveles que busca patrones de texto típicos de tickets en español.

**P: ¿Cómo calculan las recomendaciones automáticas?**
R: Un servicio compartido (`FinancialRulesService`) evalúa condiciones sobre los analytics del usuario: crecimiento mensual >20%, gasto anómalo detectado, categoría dominante, tendencias crecientes por categoría, gasto por encima del promedio histórico. Cada condición devuelve datos neutros (números), y dos consumidores distintos (recomendaciones del asesor, notificaciones automáticas) los traducen a su propio mensaje y categoría — la lógica de cálculo no está duplicada, solo el texto final.

**P: ¿Cómo detectan un gasto anómalo?**
R: Si el monto de un gasto individual supera 5 veces el promedio de gasto de los últimos 6 meses, y ocurrió en los últimos 30 días, se marca como anómalo.

**P: ¿Qué pasa si dos usuarios intentan ver los datos del otro?**
R: Cada endpoint valida ownership en el backend (no solo en el frontend). Si un USER intenta acceder a un recurso de otro usuario o a un endpoint exclusivo de ADVISOR, el servidor responde 403 Forbidden — está probado con tests automatizados (`auth.e2e-spec.ts`) y se verificó manualmente durante esta sesión con dos usuarios reales.

**P: ¿Tienen tests automatizados?**
R: Sí — 19 unit tests (mockeando Prisma) que cubren el cálculo de analíticas, el umbral de gastos anómalos, la clasificación del perfil financiero, y el CRUD de metas de ahorro; más 7 e2e tests contra la app real que cubren registro, login, y protección de rutas por rol. `npm run test` y `npm run test:e2e`.

**P: ¿Por qué la meta de ahorro es una entidad separada del campo `savingsGoal` que ya tenía el usuario?**
R: Son conceptos distintos: `User.savingsGoal` es "cuánto quiero reservar de mi sueldo cada mes" (un número simple usado para calcular presupuesto libre). `SavingsGoal` es un objetivo concreto con nombre, monto, fecha límite y progreso acumulado — "ahorrar $1.000.000 en 6 meses para vacaciones". Mantuvimos ambos porque resuelven necesidades diferentes y romper el campo existente hubiera afectado funcionalidad que ya estaba en producción.

**P: ¿Cómo persisten las imágenes de los tickets? ¿Qué pasa si despliegan en Railway?**
R: Se guardan en el filesystem local del backend (`/uploads`). Es una limitación conocida y documentada: en Railway el filesystem es efímero, así que las imágenes se perderían en cada redeploy. La solución correcta a futuro sería migrar a S3 o Cloudinary (que ya está parcialmente integrado para avatares).

**P: ¿Por qué todos los commits son de una sola persona?**
R: (Responder con honestidad según corresponda al equipo real — este es un punto de proceso, no técnico, que el profesor ya señaló en el feedback del primer parcial.)

---

# 9) Revisión final

### Funcionalidades del enunciado que quedaron completas
Las 20 funcionalidades extra listadas en el enunciado están implementadas end-to-end (backend + frontend conectados), verificado contra el código real, no contra documentación. Ver sección 1 de este documento para el detalle de cada una.

### Funcionalidades que quedaron parciales
Ninguna a nivel de "funcionalidad faltante". Las dos brechas que existían antes de esta rama (presupuestos sin DELETE explícito, metas de ahorro como campo simple) se cerraron en los 7 commits de `cambios-examen-final`.

### Qué conviene no mostrar o mencionar con cuidado
- **Recuperación de contraseña:** no existe. Si se pregunta, admitirlo directamente — no está en el enunciado, pero es una ausencia notable en cualquier sistema de auth.
- **Persistencia de imágenes en producción:** ya mencionado arriba — es una limitación real y documentada, no la oculten, pero tampoco la muestren como si funcionara perfecto en Railway sin aclarar la limitación.
- **Categorización por IA:** es heurística local (keywords), no una llamada a un modelo de IA para clasificar — si preguntan específicamente "¿la categoría también la decide la IA?", la respuesta honesta es que la IA extrae los datos del ticket (comercio, monto, fecha) pero la categoría se infiere con reglas simples en el cliente.
- **Exportación CSV:** el enunciado pedía CSV/Excel/PDF; se implementó Excel y PDF pero no un CSV plano separado. Si preguntan, aclarar que Excel cubre el mismo caso de uso (es CSV con formato).

### Puntos fuertes actuales del proyecto
1. **Arquitectura backend limpia y modular** — cada dominio (auth, users, expenses, tickets, recommendations, notifications, savings-goals) es un módulo NestJS independiente con su propio controller/service/DTO.
2. **Lógica de negocio no duplicada** — el motor de reglas financieras (`FinancialRulesService`) es usado por dos features distintas sin repetir cálculos.
3. **Seguridad real, no solo visual** — guards de JWT y roles en cada endpoint, verificado con tests automatizados.
4. **Pipeline de IA con fallback robusto** — nunca se rompe el flujo de carga de tickets aunque la IA externa falle.
5. **Cobertura de tests real** — 26 tests automatizados sobre la lógica más crítica (analíticas, anomalías, auth, metas de ahorro).
6. **Documentación completa y honesta** — README con arquitectura, modelo de datos, decisiones justificadas (incluyendo trade-offs), y este mismo documento de defensa.
7. **Trazabilidad de cambios** — 19 commits atómicos entre las dos ramas de cierre, cada uno con un propósito único y verificado antes del siguiente.

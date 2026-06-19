# Script de presentación final — GastosApp

Guía paso a paso para la demo en vivo. Pensada para ~10-12 minutos de exposición + preguntas.

---

## Antes de empezar (checklist)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\iniciar.ps1
```

- [ ] Backend respondiendo en `http://localhost:4500/api`
- [ ] Frontend respondiendo en `http://localhost:3000`
- [ ] Swagger abierto en una pestaña aparte: `http://localhost:4500/docs` (por si preguntan por un endpoint puntual)
- [ ] Tener a mano las credenciales de asesor: `asesor@gastosapp.com` / `Asesor123`
- [ ] Tener preparada una foto de ticket real (celular o archivo) para la carga OCR — un ticket de supermercado o restaurante con texto claro funciona mejor que uno de mala calidad
- [ ] Si hay `RECEIPT_AI_API_KEY` configurada: la extracción usa GPT-4o-mini. Si no: usa el heurístico local — **ambos casos son válidos para mostrar**, no hace falta disculparse por el fallback.

---

## 1. Registro (USER nuevo)

1. Ir a `/landing` → mostrar brevemente la página pública.
2. Clic en "Crear cuenta" → `/register`.
3. Completar nombre, email, contraseña (mostrar el indicador de fortaleza de contraseña en vivo).
4. Enviar → queda logueado automáticamente y redirige a `/dashboard`.

**Decí mientras lo hacés:** "El registro crea el usuario con rol USER por defecto. No hay forma de auto-asignarse el rol de asesor desde la UI — eso es una decisión de seguridad, se promueve manualmente en la base de datos."

---

## 2. Login

1. Cerrar sesión (botón "Salir" en el sidebar).
2. Volver a loguearse con el mismo usuario en `/login`.

**Decí:** "La sesión es JWT stateless — no hay sesión en el servidor. El token vive en localStorage y se manda en cada request como `Authorization: Bearer`."

---

## 3. Carga de ticket

1. Ir a `/upload-ticket`.
2. Arrastrar o seleccionar la foto del ticket preparada.
3. Clic en "Procesar con OCR".

**Decí:** "Tesseract.js corre localmente, sin depender de un servicio externo, para extraer el texto crudo de la imagen."

---

## 4. Procesamiento con IA

1. Mostrar el paso 2 del wizard (spinner "Procesando imagen...").
2. Mientras espera (unos segundos), explicar el pipeline:

**Decí:** "El texto que extrajo Tesseract se manda a GPT-4o-mini con instrucciones específicas: que tome el TOTAL final pagado, no el subtotal. Si no hay API key configurada o falla la llamada, cae automáticamente a un heurístico local que busca patrones de texto típicos de tickets — el flujo nunca se rompe por la IA externa."

---

## 5. Creación automática del gasto

1. El wizard avanza solo al paso 3 con el formulario **pre-completado**: comercio, monto, fecha.
2. Mostrar que la categoría también se sugirió automáticamente según el nombre del comercio (keywords).
3. Corregir algo a propósito (para mostrar que es editable, no una caja negra).
4. Confirmar → "Registrar gasto".

**Decí:** "La IA pre-completa, pero el usuario siempre tiene la última palabra antes de guardar."

---

## 6. Dashboard actualizado

1. Ir a `/dashboard`.
2. Recorrer en orden:
   - Tarjetas de stats (gasto del mes, cantidad, promedio, comercio top)
   - Badge de perfil financiero (IMPULSIVO/ACTIVO/EQUILIBRADO/AHORRADOR) — **si no aparece, es porque el usuario no configuró ingreso mensual; mencionarlo y opcionalmente ir a `/profile` a configurarlo en vivo**
   - Gráfico de torta por categoría (con filtro mes/año/siempre)
   - Gráfico de barras de 6 meses
   - Ranking de comercios
   - Sección "Comparar meses" → elegir dos meses y mostrar el resultado

**Decí:** "Todo esto se calcula en el backend a partir de los gastos reales — no hay datos mockeados en el dashboard."

---

## 7. Análisis financiero

1. Ir a `/expenses`.
2. Mostrar los filtros avanzados: comercio, categoría, etiqueta, rango de fechas, rango de monto.
3. Crear un gasto con un par de etiquetas personalizadas (mostrar el autocompletado).
4. Exportar a Excel o PDF (mostrar el archivo generado).

---

## 8. Recomendaciones y notificaciones

1. Volver a `/dashboard` → mostrar la sección "Recomendaciones".
2. Mostrar la campana de notificaciones en el sidebar (si hay alguna sin leer, el badge rojo es visible).
3. Abrir el panel y mostrar una notificación (ej. alerta de presupuesto excedido o crecimiento mensual).

**Decí:** "Las notificaciones se generan automáticamente al cargar el dashboard, evaluando reglas financieras — sin necesitar un cron job corriendo en el servidor."

---

## 9. Vista del asesor

1. Cerrar sesión.
2. Loguearse con `asesor@gastosapp.com` / `Asesor123`.
3. Ir a `/advisor` → mostrar la grilla de usuarios.
4. Seleccionar el usuario creado en el paso 1.
5. Mostrar: stats del mes, gráficos, tendencias por categoría, recomendaciones.
6. Clic en "Generar recomendaciones automáticas" → mostrar el resultado en vivo.
7. (Opcional) Generar el PDF del informe completo.

**Decí:** "El asesor ve los mismos datos que el usuario, pero de cualquier cuenta. El control de acceso por rol está en el backend, no es solo un ocultamiento visual — si un USER intenta pegarle directamente a estos endpoints, el servidor responde 403."

---

## Preguntas frecuentes (preparadas)

| Si preguntan... | Respondé... |
|---|---|
| ¿Por qué un servidor Express en el frontend si es solo HTML/CSS/JS? | Ver sección "Decisiones de arquitectura" del README — Railway necesita un proceso vivo, y permite inyectar la URL del backend en runtime sin rebuildear por entorno. |
| ¿Qué pasa si no hay API key de OpenAI? | Cae a un heurístico local de 4 niveles que sigue funcionando — está probado y documentado en el README ("Uso de IA"). |
| ¿Cómo protegen los endpoints del asesor? | `JwtAuthGuard` + `RolesGuard` + decorador `@Roles(Role.ADVISOR)` en el backend — no es un chequeo solo en el frontend. |
| ¿Tienen tests? | Sí: unit tests de analíticas (incluyendo el umbral de detección de gastos anómalos) y e2e de todo el flujo de auth. `npm run test` / `npm run test:e2e`. |
| ¿Qué pasa con las imágenes de tickets en producción? | Limitación conocida y documentada: se guardan en disco local, que en Railway es efímero. Está en el README como mejora pendiente (migrar a S3/Cloudinary). |

---

## Si algo falla en vivo

- **El OCR tarda más de lo esperado:** el polling tiene un máximo de 40 segundos (20 intentos x 2s); si se pasa, mostrar el ticket ya guardado en el historial y reintentar "Re-procesar OCR" desde ahí.
- **El backend no responde:** revisar la ventana de PowerShell del backend — probablemente sigue compilando (NestJS en modo watch tarda unos segundos al primer arranque).
- **Querés evitar usar datos reales en vivo:** la cuenta de asesor (`asesor@gastosapp.com`) ya tiene usuarios de prueba con gastos cargados de sesiones anteriores — se puede ir directo al paso 9 sin tener que crear todo desde cero.

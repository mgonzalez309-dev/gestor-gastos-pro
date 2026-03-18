## Requisitos previos
- Node.js v18 o superior
- npm v9 o superior
- PostgreSQL v14 o superior instalado y corriendo
- Git

## Pasos para correr el proyecto en localhost

### 1. Clonar el repositorio
git clone https://github.com/mgonzalez309-dev/gestor-gastos-pro.git
cd gestor-gastos-pro

### 2. Instalar dependencias del backend
cd backend
npm install

### 3. Configurar las variables de entorno
cp .env.example .env
Abrí el archivo .env y completá los datos con tu configuración local de PostgreSQL.

### 4. Crear la base de datos en PostgreSQL
psql -U tu_usuario -c "CREATE DATABASE gestor_gastos;"

### 5. Ejecutar el schema y las migraciones
psql -U tu_usuario -d gestor_gastos -f database/schema.sql

Si hay seeds para datos de prueba:
psql -U tu_usuario -d gestor_gastos -f database/seeds/seed.sql

Opcional: para ejecutar migraciones individuales en orden:
psql -U tu_usuario -d gestor_gastos -f database/migrations/001_init.sql
psql -U tu_usuario -d gestor_gastos -f database/migrations/002_add_currency_to_user.sql
psql -U tu_usuario -d gestor_gastos -f database/migrations/003_add_age_monthly_income.sql
psql -U tu_usuario -d gestor_gastos -f database/migrations/004_add_ticket_ai_fields.sql

### 6. Levantar el servidor backend
npm run start:dev
El servidor corre en: http://localhost:3000

Nota: en este proyecto el .env.example trae PORT=4500 por defecto. Si mantenés ese valor, la API quedará en http://localhost:4500

### 7. Abrir el frontend
Abrí el archivo index.html del frontend directamente en el navegador o usá Live Server si tenés VS Code.

## Notas importantes
- Si usás otro puerto de PostgreSQL que no sea el 5432, actualizá el .env accordingly.
- En caso de error de conexión a la BD, verificá que el servicio de PostgreSQL esté activo con: pg_ctl status

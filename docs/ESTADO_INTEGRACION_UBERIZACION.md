# Estado de Integración: Uberización Sprint 2 (Cupos y Reprogramación)

Fecha de corte: 2026-10-30 08:53 (UTC-5)
Rama activa: `preview` (sincronizada con `origin/preview`)
Último commit desplegado: `c0533b7` (`fix(reprogramacion): formatear fecha a YYYY-MM-DD para MySQL y verificar reprogramada por token encadenado`)

---

## 1. Arquitectura y Entornos Desplegados

| Componente | Servicio Azure | Versión / Imagen Docker | Recurso / URL |
| :--- | :--- | :--- | :--- |
| **Frontend** | Azure Static Web App (`webwin-frontend`) | Build Vite React (`preview` branch) | `https://lively-moss-05a36f910-preview.centralus.7.azurestaticapps.net` |
| **Backend API** | Azure App Service (`webwin-api-service-eus`) | `phxwinacr.azurecr.io/webwin-api:v19` | `https://webwin-api-service-eus.azurewebsites.net` |
| **Capa Intermedia** | Azure App Service (`webwin-capa-service-eus`) | `webwinacr.azurecr.io/webwin-capa:v9` | Interno en RG `traking-win` |
| **Base de Datos** | Azure Database for MySQL Flexible | `phx-win-mysql-9508` | BD `BD_Phoenix` (`VW_WinORdeTraba`, `REPROGRAMACIONES`, `Testmantra`) |
| **Kong API Gateway** | API externa CRM Experiencia | `https://uberizacion.win.pe/cloud` | Headers: `X-Application-Id: UBERIZACION-WEB`, apikey inyectada vía Key Vault |

---

## 2. Endpoints Implementados y Robustecidos

### A. Consulta de Cupos (Tiempo Real)
- **Frontend / Cliente**: `GET https://webwin-api-service-eus.azurewebsites.net/api/cupos/:token`
- **Soporte polimórfico de identificadores**:
  - `OrdenId` (ej. `3446646` o `3561769`)
  - `Token` de inicio (hex 32 caracteres, ej. `289764bbf041c03350c5709c163871`)
  - `CodiSegui` / Ticket (ej. `VTEXT-49233233`)
  - `CodiSeguiClien` / Pedido CRM (ej. `3164556`)
- **Clasificador Senior Averías vs Instalaciones**:
  - **Averías / Tickets**: Si `tipo_servicio = 'AVERIAS'`, `Producto` contiene `AVERIA`/`POSTVENTA`/`MOTOWIN`, `CodiSegui` o `CodiSeguiClien` inician con letras (`/^[A-Z]/` ej. `VTEXT-`, `AT-`, `POS-`), o `TipoTraba` no es `INSTALACION`.
    - Kong Endpoint: `/api/v1/scheduling/visits/availability`
    - Payload enviado: `{ "ticketNumber": crmCode }` (donde `crmCode` prioriza `CodiSegui`).
  - **Instalaciones**: `TipoTraba = 'INSTALACION'` y código numérico.
    - Kong Endpoint: `/api/v1/scheduling/installations/availability`
    - Payload enviado: `{ "orderCode": crmCode }` (donde `crmCode` prioriza `CodiSeguiClien` que contiene el número de pedido de CRM de 7 dígitos).

### B. Ejecución de Reprogramación (`POST /api/reprogramar`)
- **Validación de Seguridad**: Verificación estricta de PIN contra base de datos `BD_Phoenix`.
- **Mapeo Dinámico de Tramos por Tipo de Servicio**:
  - Para Averías (`/scheduling/visits/reschedule`): Se mapea a `08:00-11:59`, `12:00-15:59`, `16:00-20:00`.
  - Para Instalaciones (`/scheduling/installations/reschedule`): Se mapea a `08:00-12:00`, `12:00-16:00`, `16:00-20:00`.
- **Persistencia en MySQL (`BD_Phoenix.REPROGRAMACIONES`)**:
  - Se formatea la fecha a `YYYY-MM-DD` (`formatToYyyyMmDd`) antes de la inserción en MySQL para prevenir error `ER_TRUNCATED_WRONG_VALUE: Incorrect date value`.
  - Habilitada inserción redundante e inmediata en la API (`server/index.ts`) y replicación en Capa Intermedia (`capa_intermedia/index.ts`).

### C. Bloqueo Definitivo tras Reprogramación (`GET /api/instalaciones/:token`)
- **Comprobación en BD**:
  - Consulta `SELECT id FROM REPROGRAMACIONES WHERE token IN (?)` abarcando tanto el token actual como el `token_inicio` o tokens asociados a la orden.
  - Si existe registro, el backend retorna `reprogramada: true` y `estado: 'REPROGRAMADA'`.
- **Comportamiento Frontend (`Seguimiento.tsx`)**:
  - Al recibir `reprogramada: true`, activa inmediatamente `isReprogramCompletada = true`.
  - **Inviolable ante borrado de caché**: Aunque el usuario limpie localStorage o cookies, la consulta a BD bloquea la vista en el estado final "Visita reprogramada exitosamente" sin permitir volver a solicitar reprogramaciones.

---

## 3. Casos y Datos de Prueba Registrados

| Tipo | OrdenId | CodiSegui | CodiSeguiClien / CRM Code | Token | PIN | Estado CRM |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Avería** | `3561769` | `VTEXT-49233233` | - | `289764bbf041c03350c5709c163871` | `4221` | HTTP 200 OK probado |
| **Instalación** | `3446646` | `22860475` | `3164556` | `d2d22fce47e31bdbbb1ed980441390` | `4204` | HTTP 200 OK probado |
| **Avería QA** | `3562260` | `VTEXT-49240476` | - | `47605689` / Token | - | HTTP 200 OK probado |

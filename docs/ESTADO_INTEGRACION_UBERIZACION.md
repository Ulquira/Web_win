# Estado de Integración: Uberización Sprint 2 (Cupos y Reprogramación)

Fecha de corte: 2026-10-29 12:40 (UTC-5)
Rama activa: `preview` (sincronizada con `origin/preview`)
Último commit: `94ca123` (`feat(crm): clasificador senior averias vs instalaciones y mapeo crmCode dinamico`)

---

## 1. Arquitectura y Entornos Desplegados

| Componente | Servicio Azure | Versión / Imagen Docker | Recurso / URL |
| :--- | :--- | :--- | :--- |
| **Frontend** | Azure Static Web App (`webwin-frontend`) | Build Vite React (`preview` branch) | `https://lively-moss-05a36f910-preview.centralus.7.azurestaticapps.net` |
| **Backend API** | Azure App Service (`webwin-api-service-eus`) | `phxwinacr.azurecr.io/webwin-api:v18` | `https://webwin-api-service-eus.azurewebsites.net` |
| **Capa Intermedia** | Azure App Service (`webwin-capa-service-eus`) | `webwinacr.azurecr.io/webwin-capa:v6` | Interno en RG `traking-win` |
| **Base de Datos** | Azure Database for MySQL Flexible | `phx-win-mysql-9508` | BD `BD_Phoenix` (`VW_WinORdeTraba`, `Testmantra`) |
| **Kong API Gateway** | API externa CRM Experiencia | `https://uberizacion.win.pe/cloud` | Headers: `X-Application-Id: UBERIZACION-WEB`, apikey inyectada vía Key Vault |

---

## 2. Endpoints Implementados y Probados

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
- **Pruebas en vivo (HTTP 200 OK)**:
  - Instalación `orderCode: 3164556` / `OrdenId: 3446646` -> 200 OK con cupos dinámicos.
  - Avería `ticketNumber: VTEXT-49233233` / `token: 289764bbf041c03350c5709c163871` -> 200 OK con cupos dinámicos.

### B. Escritura de Reprogramación (Pendiente de Autorización / Casos de Prueba)
- **Endpoint**: `POST https://webwin-api-service-eus.azurewebsites.net/api/reprogramar`
- **Payload esperado**:
  ```json
  {
    "token": "289764bbf041c03350c5709c163871",
    "fecha": "30-10-2026",
    "turno": "08:00 - 12:00",
    "motivo": "Reprogramación - Solicitud del Cliente",
    "pin": "4221"
  }
  ```
- **Condición**: **NO EJECUTAR MUTACIONES** hasta que el usuario confirme la creación de sus casos de prueba en CRM.

---

## 3. Casos y Datos de Prueba Registrados

| Tipo | OrdenId | CodiSegui | CodiSeguiClien / CRM Code | Token | PIN | Estado CRM |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Avería** | `3561769` | `VTEXT-49233233` | - | `289764bbf041c03350c5709c163871` | `4221` | HTTP 200 OK probado |
| **Instalación** | `3446646` | `22860475` | `3164556` | `d2d22fce47e31bdbbb1ed980441390` | `4204` | HTTP 200 OK probado |

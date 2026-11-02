# Estado de Integración: Uberización Sprint 2 (Cupos y Reprogramación)

Fecha de corte: 2026-10-30 09:15 (UTC-5)
Rama activa: `preview` (sincronizada con `origin/preview`)
Último commit desplegado: `preview` branch

---

## 1. Arquitectura y Entornos Desplegados

| Componente | Servicio Azure | Versión / Imagen Docker | Recurso / URL |
| :--- | :--- | :--- | :--- |
| **Frontend** | Azure Static Web App (`webwin-frontend`) | Build Vite React (`preview` branch) | `https://lively-moss-05a36f910-preview.centralus.7.azurestaticapps.net` |
| **Backend API** | Azure App Service (`webwin-api-service-eus`) | `phxwinacr.azurecr.io/webwin-api:v19` | `https://webwin-api-service-eus.azurewebsites.net` |
| **Capa Intermedia** | Azure App Service (`webwin-capa-service-eus`) | `webwinacr.azurecr.io/webwin-capa:v10` | Interno en RG `traking-win` |
| **Base de Datos** | Azure Database for MySQL Flexible | `phx-win-mysql-9508` | BD `BD_Phoenix` (`VW_WinORdeTraba`, `REPROGRAMACIONES`, `Testmantra`) |
| **Kong API Gateway** | API externa CRM Experiencia | `https://uberizacion.win.pe/cloud` | Headers: `X-Application-Id: UBERIZACION-WEB`, apikey inyectada vía Key Vault |

---

## 2. Reglas de Negocio Implementadas

### A. Reprogramación Estrictamente a Partir de Mañana (+1 Día)
- **Restricción de Negocio**: No se permite reprogramar para el mismo día ni días pasados.
- **Backend (`capa_intermedia/index.ts`)**: Calcula la fecha actual en zona horaria Lima/Perú (`America/Lima`). Todo día devuelto por CRM con fecha menor o igual a hoy es automáticamente descartado.
- **Frontend (`Seguimiento.tsx`)**: Calcula `tomorrowIso` y filtra cualquier día anterior a mañana. El carrusel interactivo comienza siempre con `Mañana` (+1 día).

### B. Ocultamiento Total de Tramos y Días sin Cupo
- **Regla UI/UX**: Si un tramo horario no tiene capacidad disponible (`disponible: false`), no se muestra al usuario (se elimina el botón con badge "Sin cupo").
- **Backend (`capa_intermedia/index.ts`)**: Deduplica tramos por franja horaria y filtra descartando aquellos con `disponible === false`. Si un día se queda sin tramos disponibles, el día completo es excluido del listado.
- **Frontend (`Seguimiento.tsx`)**: Mapea exclusivamente los tramos disponibles. Si la fecha seleccionada no tiene cupos, muestra el mensaje amigable de disponibilidad.

### C. Persistencia y Bloqueo Inviolable
- **Persistencia en MySQL**: `REPROGRAMACIONES` almacena fecha en formato estándar `YYYY-MM-DD`.
- **Bloqueo Definitivo**: `GET /api/instalaciones/:token` valida si la orden ya fue reprogramada en base de datos. Si el cliente borra la caché o localStorage del navegador, la pantalla se mantiene cerrada en el estado final sin permitir nuevos intentos.

---

## 3. Casos y Datos de Prueba Registrados

| Tipo | OrdenId | CodiSegui | CodiSeguiClien / CRM Code | Token | PIN | Estado CRM |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Avería** | `3561769` | `VTEXT-49233233` | - | `289764bbf041c03350c5709c163871` | `4221` | HTTP 200 OK probado |
| **Instalación** | `3446646` | `22860475` | `3164556` | `d2d22fce47e31bdbbb1ed980441390` | `4204` | HTTP 200 OK probado |
| **Avería QA** | `3562260` | `VTEXT-49240476` | - | `47605689` / Token | - | HTTP 200 OK probado |
| **Avería AT** | `3563427` | `AT-49264239` | - | `14c7ac8820a89d4c500215205e8e42` | - | HTTP 200 OK probado |

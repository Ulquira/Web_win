# Estado de Integración: Uberización Sprint 2 (Cupos y Reprogramación)

Fecha de corte: 2026-10-29 11:00 (UTC-5)
Rama activa: `preview` (sincronizada con `origin/preview`)
Último commit: `1daf6ef` (`fix(reprogramacion): deduplicar tramos de cupos, normalizar rangos y soportar consulta por ticket`)

---

## 1. Arquitectura y Entornos Desplegados

| Componente | Servicio Azure | Versión / Imagen Docker | Recurso / URL |
| :--- | :--- | :--- | :--- |
| **Frontend** | Azure Static Web App (`webwin-frontend`) | Build Vite React (`preview` branch) | `https://lively-moss-05a36f910-preview.centralus.7.azurestaticapps.net` |
| **Backend API** | Azure App Service (`webwin-api-service-eus`) | `phxwinacr.azurecr.io/webwin-api:v18` | `https://webwin-api-service-eus.azurewebsites.net` |
| **Capa Intermedia** | Azure App Service (`webwin-capa-service-eus`) | `webwinacr.azurecr.io/webwin-capa:v4` | Interno en RG `traking-win` |
| **Base de Datos** | Azure Database for MySQL Flexible | `phx-win-mysql-9508` | BD `BD_Phoenix` (`VW_WinORdeTraba`, `Testmantra`) |
| **Kong API Gateway** | API externa CRM Experiencia | `https://uberizacion.win.pe/cloud` | Headers: `X-Application-Id: UBERIZACION-WEB`, apikey inyectada vía Key Vault |

---

## 2. Endpoints Implementados y Probados

### A. Consulta de Cupos (Tiempo Real)
- **Frontend / Cliente**: `GET https://webwin-api-service-eus.azurewebsites.net/api/cupos/:token`
- **Soporte de identificadores**:
  - Token de orden (hex 32 caracteres): ej. `289764bbf041c03350c5709c163871`
  - Código de Ticket / Avería directo: ej. `VTEXT-49233233`
  - CodiSeguiClien / OrdenId
- **Enrutamiento dinámico en Capa Intermedia**:
  - Si es Avería (`tipo_servicio = 'AVERIAS'` o `Producto LIKE '%AVERIA%'`): Enruta a `/api/v1/scheduling/visits/availability` con payload `{ "ticketNumber": "..." }`.
  - Si es Instalación: Enruta a `/api/v1/scheduling/installations/availability` con payload `{ "orderCode": "..." }`.
- **Estado de prueba**: Probado con éxito HTTP 200 OK en `VTEXT-49233233` devolviendo cupos de 16 días.

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

- **Ticket de prueba**: `VTEXT-49233233`
  - `OrdenId`: `3561769`
  - `token`: `289764bbf041c03350c5709c163871`
  - `Pin_token`: `4221`
  - `Producto`: `AVERIAS PREFERENTE`
  - `TipoTraba`: `LOS ROJO`
  - `CodiSeguiClien`: `1826122`
  - URL directa de seguimiento en preview: `https://lively-moss-05a36f910-preview.centralus.7.azurestaticapps.net/seguimiento/289764bbf041c03350c5709c163871`

---

## 4. Cambios Recientes en Frontend (`src/pages/Seguimiento.tsx`)

1. **Deduplicación de franjas horarias**:
   - La API de CRM devuelve múltiples slots por cuadrilla (`12:00-15:59` duplicado).
   - En la UI se unifican bajo tramos únicos normalizados (`08:00 - 12:00`, `12:00 - 16:00`, `16:00 - 20:00`).
2. **Normalización bidireccional de fechas**:
   - `normalizeDateStr` para compatibilizar `DD-MM-YYYY` y `YYYY-MM-DD`.
3. **Manejo de estados de error**:
   - Solo muestra cupos reales de la API; en caso de sin disponibilidad o error se notifica al usuario sin inyectar datos simulados aleatorios.

---

## 5. Próximos Pasos Inmediatos al Reanudar

1. Recibir confirmación de los casos de prueba creados en CRM Experiencia por el usuario.
2. Realizar prueba de escritura síncrona en `/api/reprogramar` con validación de PIN cliente.
3. Verificar la actualización en tiempo real del registro en `VW_WinORdeTraba` / CRM y respuesta HTTP 200 / 409 (en caso de conflicto de cupo).
4. Preparar merge controlado de `preview` hacia `main` una vez validado todo el flujo E2E.

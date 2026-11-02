-- ==============================================================================
-- SCRIPT DE INDEXACIÓN PARA PRODUCCIÓN (AZURE MYSQL / BD_Phoenix)
-- Fase 3: Optimización de Rendimiento e Indexación Compuesta
-- ==============================================================================

-- 1. Tabla de Logs de Seguimiento (Alto volumen de inserciones y lecturas rápidas por token)
-- Optimiza la verificación de primera_visita y carga de eventos en tracking
ALTER TABLE LOGS_TRAKING ADD INDEX idx_logs_token_evento (token, evento);
ALTER TABLE LOGS_TRAKING ADD INDEX idx_logs_created_at (created_at);

-- 2. Tabla de Reprogramaciones y Encuestas
-- Optimiza la verificación de estados antes de mostrar el mapa / tracking al cliente
ALTER TABLE REPROGRAMACIONES ADD INDEX idx_reprog_token (token);
ALTER TABLE REPROGRAMACIONES ADD INDEX idx_reprog_fecha_sol (fecha_solicitada);

ALTER TABLE Encuesta_app ADD INDEX idx_encuesta_app_token (token);
ALTER TABLE ENCUESTAS ADD INDEX idx_encuestas_token (token);

-- 3. Tabla de Historial Chats Mantra
-- Acelera los reportes analíticos del Dashboard Chat, filtros por fecha y agregaciones
ALTER TABLE historial_chats_mantra ADD INDEX idx_chats_fecha_grupo_estado (fecha_mensaje, grupo_servicio, estado_wsp);
ALTER TABLE historial_chats_mantra ADD INDEX idx_chats_orden_ticket (orden_id, ticket);
ALTER TABLE historial_chats_mantra ADD INDEX idx_chats_estado_chat (estado_chat);

-- 4. Tabla de Usuarios del Sistema (Login y unicidad)
ALTER TABLE user ADD UNIQUE INDEX uq_user_usuario (Usuario);
ALTER TABLE user ADD INDEX idx_user_area_rol (Area, Rol, Activo);

-- 5. Índices sobre las tablas base de Órdenes de Trabajo (subyacentes a vw_winordetraba)
-- Si la vista vw_winordetraba consulta una tabla física como `win_ordenes` o `ordenes_trabajo`:
-- (Ejecutar sobre la tabla física base correspondiente en el esquema de producción):
-- ALTER TABLE <tabla_ordenes_base> ADD INDEX idx_ordenes_token (token);
-- ALTER TABLE <tabla_ordenes_base> ADD INDEX idx_ordenes_fecha_visita (FechaVisita);
-- ALTER TABLE <tabla_ordenes_base> ADD INDEX idx_ordenes_doc (NumeroDocumento);
-- ALTER TABLE <tabla_ordenes_base> ADD INDEX idx_ordenes_prod_traba (Producto, TipoTraba);

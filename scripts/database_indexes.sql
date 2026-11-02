-- ==============================================================================
-- SCRIPT DE INDEXACIÓN PARA PRODUCCIÓN (AZURE MYSQL / BD_Phoenix)
-- Fase 3: Optimización de Rendimiento e Indexación Compuesta
-- Verificado y aplicado en Azure MySQL Flexible Server (phx-win-mysql-9508)
-- ==============================================================================

-- 1. Tabla de Órdenes de Trabajo (vw_winordetraba es tabla física con millones de registros)
-- Resuelve cuellos de botella críticos en filtros por Fecha de Visita y Tipo de Trabajo
ALTER TABLE `vw_winordetraba` ADD INDEX `idx_f_visita` (`F.Visita`);
ALTER TABLE `vw_winordetraba` ADD INDEX `idx_visita_prod_traba` (`F.Visita`, `Producto`, `TipoTraba`);

-- 2. Tabla de Logs de Tracking (logs_traking)
-- Acelera los subqueries de embudo y verificación de ingreso al mapa
ALTER TABLE `logs_traking` ADD INDEX `idx_logs_token_evento` (`token`, `evento`);
ALTER TABLE `logs_traking` ADD INDEX `idx_logs_ordenid` (`OrdenId`);

-- 3. Tabla de Reporte de Plantillas Mantra (reporte_plantillas_mantra)
-- Optimiza cruces por token y orden_id en la vista 360 y reportes
ALTER TABLE `reporte_plantillas_mantra` ADD INDEX `idx_rpm_token` (`token`);
ALTER TABLE `reporte_plantillas_mantra` ADD INDEX `idx_rpm_orden_id` (`orden_id`);

-- 4. Tablas de Reprogramaciones y Encuestas
-- Optimiza cruces de estado en el embudo operativo
ALTER TABLE `reprogramaciones` ADD INDEX `idx_reprog_token` (`token`);
ALTER TABLE `encuestas` ADD INDEX `idx_encuestas_token` (`token`);

-- 5. Tabla de Historial Chats Mantra (historial_chats_mantra)
-- Acelera el Dashboard de Chats por fecha de gestión y grupo de servicio
ALTER TABLE `historial_chats_mantra` ADD INDEX `idx_chats_fecha_grupo` (`fecha_gestion_dia`, `grupo_servicio`);

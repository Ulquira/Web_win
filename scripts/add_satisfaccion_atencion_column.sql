-- ==============================================================================
-- MIGRACIÓN: AGREGAR COLUMNA satisfaccion_atencion A Encuesta_app
-- Pregunta: "¿Qué tan satisfecho(a) estás con la atención recibida?" (1 al 5 estrellas)
-- ==============================================================================

ALTER TABLE `Encuesta_app`
ADD COLUMN `satisfaccion_atencion` TINYINT UNSIGNED NULL 
COMMENT 'Calificación de 1 a 5 estrellas para la atención recibida' 
AFTER `codisegui`;

import os
import time
import mysql.connector

def main():
    host = os.environ.get('DB_HOST', 'phx-win-mysql-9508.mysql.database.azure.com')
    user = os.environ.get('DB_USER', 'phxadmin')
    password = os.environ.get('DB_PASSWORD', 'WinTelecom@2026!')
    database = os.environ.get('DB_NAME', 'BD_Phoenix')

    print(f"Connecting to {host} / {database}...")
    conn = mysql.connector.connect(
        host=host,
        user=user,
        password=password,
        database=database,
        ssl_disabled=False
    )
    cursor = conn.cursor()

    indexes_to_apply = [
        ('vw_winordetraba', 'idx_f_visita', '`F.Visita`'),
        ('vw_winordetraba', 'idx_visita_prod_traba', '`F.Visita`, `Producto`, `TipoTraba`'),
        ('logs_traking', 'idx_logs_token_evento', '`token`, `evento`'),
        ('logs_traking', 'idx_logs_ordenid', '`OrdenId`'),
        ('reprogramaciones', 'idx_reprog_token', '`token`'),
        ('encuestas', 'idx_encuestas_token', '`token`'),
        ('reporte_plantillas_mantra', 'idx_rpm_token', '`token`'),
        ('reporte_plantillas_mantra', 'idx_rpm_orden_id', '`orden_id`'),
        ('historial_chats_mantra', 'idx_chats_fecha_grupo', '`fecha_gestion_dia`, `grupo_servicio`')
    ]

    for table, index_name, cols in indexes_to_apply:
        cursor.execute(f"""
            SELECT COUNT(1) FROM information_schema.statistics 
            WHERE table_schema = '{database}' AND table_name = '{table}' AND index_name = '{index_name}'
        """)
        exists = cursor.fetchone()[0] > 0
        if exists:
            print(f"[EXISTS] {table}.{index_name} already exists.")
            continue

        print(f"[CREATING] Index {index_name} on `{table}`({cols})...")
        t0 = time.time()
        try:
            sql = f"ALTER TABLE `{table}` ADD INDEX `{index_name}` ({cols})"
            cursor.execute(sql)
            conn.commit()
            elapsed = time.time() - t0
            print(f"  --> [OK] Done in {elapsed:.2f}s")
        except Exception as e:
            print(f"  --> [ERROR] Failed: {e}")

    cursor.close()
    conn.close()
    print("All index checks completed.")

if __name__ == '__main__':
    main()

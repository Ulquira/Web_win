const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: { rejectUnauthorized: false }
  });

  const [totalRows] = await pool.query('SELECT COUNT(*) AS total FROM Testmantra');
  console.log('Total rows in Testmantra:', totalRows[0].total);

  const [withToken] = await pool.query("SELECT token, OrdenId, Estado, link, Pin_token, `F.Soli` FROM Testmantra WHERE token IS NOT NULL AND token != '' ORDER BY `F.Soli` DESC LIMIT 5");
  console.log('Testmantra rows with token:', withToken);

  if (withToken.length > 0) {
    const testToken = withToken[0].token;
    console.log('\nTesting query for token:', testToken);
    try {
      const [res] = await pool.query(
        `SELECT 
           w.OrdenId AS idoperacion, 
           w.Estado, 
           w.\`Estado OT\` AS SubEstado, 
           w.Cuadrilla,
           w.Cuadrilla_nombre,
           vc.Nombre_Tecnico_Limpio AS nombre_tecnico_completo,
           vc.Documento AS dni_tecnico,
           vc.Img_mejorada AS foto_mejorada,
           vc.Foto_Img AS foto_original,
           vc.foto_aprobada AS foto_aprobada,
           w.Proveedeor, 
           w.Georeferencia AS coordenadas_direccion, 
           w.Georeferencia_tecnico AS Ubi_TEC, 
           w.TeleMovilNume AS telefono, 
           DATE(w.\`F.Soli\`) AS fecha_programacion, 
           TIME(w.\`F.Soli\`) AS Tramo_Atencio, 
           w.ClienteFinal AS nom_cliente, 
           w.Direccion AS direccion_cliente, 
           w.IdenServi AS Campaña, 
           w.token AS Token_inicio,
           w.Pin_token AS pin_token,
           w.link,
           w.CodiSegui AS codisegui,
           w.CodiSeguiClien AS codiseguiclien,
           w.Producto AS producto,
           ts.Tipo AS tipo_servicio
         FROM Testmantra w
         LEFT JOIN vw_info_cuadrillas vc ON w.Cuadrilla = vc.Cuadrilla
         LEFT JOIN tiposervicio ts ON UPPER(TRIM(w.Producto)) = UPPER(TRIM(ts.Servicio))
         WHERE w.token = ? 
         ORDER BY w.\`F.Soli\` DESC LIMIT 1`, 
        [testToken]
      );
      console.log('Query result count:', res.length);
      if (res.length > 0) {
        console.log('Query result sample:', res[0]);
      }
    } catch (err) {
      console.error('ERROR in Testmantra query:', err);
    }
  }

  // Also check if there are tokens in Testmantra that are NOT in VW_WinORdeTraba
  const [inBoth] = await pool.query(
    "SELECT t.token, t.OrdenId FROM Testmantra t INNER JOIN VW_WinORdeTraba v ON t.token = v.token WHERE t.token IS NOT NULL AND t.token != '' LIMIT 5"
  );
  console.log('\nTokens present in BOTH Testmantra and VW_WinORdeTraba:', inBoth);

  const [onlyTestmantra] = await pool.query(
    "SELECT t.token, t.OrdenId FROM Testmantra t LEFT JOIN VW_WinORdeTraba v ON t.token = v.token WHERE v.token IS NULL AND t.token IS NOT NULL AND t.token != '' LIMIT 5"
  );
  console.log('Tokens ONLY in Testmantra:', onlyTestmantra);

  await pool.end();
})().catch(console.error);

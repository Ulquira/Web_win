import { Router } from 'express';
import { 
  reprogramar, 
  guardarEncuesta, 
  verificarEncuesta, 
  guardarLog, 
  getInstalacion, 
  getRoute 
} from '../controllers/apiController.ts';

const router = Router();

router.post('/reprogramar', reprogramar);
router.post('/encuesta', guardarEncuesta);
router.get('/encuesta/verificar/:token', verificarEncuesta);
router.post('/log', guardarLog);
router.get('/instalaciones/:token', getInstalacion);
router.post('/route', getRoute);

export default router;

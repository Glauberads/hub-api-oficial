import { Router } from 'express';
import FloupController from './controller';
import isAuth from '../../middleware/isAuth';
import uploadConfig from '../../config/upload';
import multer from 'multer';

const upload = multer(uploadConfig);

const floupRoutes = Router();

floupRoutes.use(isAuth);

// Middleware para garantir que typeArch seja definido para uploads do Floup
const floupUploadMiddleware = (req: any, res: any, next: any) => {
  // Se typeArch não estiver no body, definir como 'floup' para uploads do Floup
  if (!req.body.typeArch && !req.query.typeArch) {
    req.body.typeArch = 'floup';
  }
  next();
};

floupRoutes.get('/dashboard', FloupController.dashboard);
floupRoutes.get('/dashboard/:floupId', FloupController.dashboardByFloup);
floupRoutes.get('/', FloupController.index);
floupRoutes.post('/', FloupController.store);
// Rota de upload deve vir antes das rotas com parâmetros para evitar conflitos
floupRoutes.post('/upload', floupUploadMiddleware, upload.single('file'), FloupController.uploadFile);
floupRoutes.delete('/upload', FloupController.deleteFile);
floupRoutes.post('/:id/duplicate', FloupController.duplicate);
floupRoutes.put('/:id', FloupController.update);
floupRoutes.delete('/:id', FloupController.destroy);
floupRoutes.post('/:id/schedule', FloupController.schedule);
floupRoutes.delete('/schedules/:scheduleId', FloupController.unschedule);
floupRoutes.get('/schedules', FloupController.listSchedules);
floupRoutes.get('/:id/schedules', FloupController.listSchedulesByFloup);
floupRoutes.post('/:id/assign', FloupController.assignToContact);
floupRoutes.post('/:id/stop', FloupController.stopForContact);
floupRoutes.get('/contact/:contactId/active', FloupController.getActiveFloup);

export default floupRoutes;



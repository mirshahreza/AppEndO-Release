import { Router, type Express } from 'express';
import { UsersController } from '../controllers/users.controller';
import { createBuiltInRouteGuard } from '../middleware/builtInFunctionAccess.middleware';
import { requireUsersListAccess } from '../middleware/usersListAccess.middleware';
import { UsersService } from '../services/users.service';

export const mountUsersRoutes = (app: Express): void => {
  const service = new UsersService();
  const controller = new UsersController(service);
  const routeGuard = createBuiltInRouteGuard('ADMIN');

  app.get('/api/users/:id/avatar-xs', requireUsersListAccess, controller.getUserAvatarXs);

  const usersRouter = Router();
  usersRouter.get('/', controller.listUsers);
  usersRouter.post('/', controller.createUser);
  usersRouter.post('/:id/change-password', controller.changePassword);
  usersRouter.post('/:id/reset-password', controller.resetPassword);
  usersRouter.put('/:id', controller.updateUser);
  usersRouter.put('/:id/profile', controller.updateUserProfile);
  usersRouter.put('/:id/roles', controller.updateUserRoles);
  usersRouter.get('/:id/attributes', controller.getUserAttributes);
  usersRouter.put('/:id/attributes', controller.updateUserAttributes);
  usersRouter.get('/:id/session-preview', controller.getUserSessionPreview);
  usersRouter.delete('/:id', controller.deleteUser);
  usersRouter.patch('/:id/lock', controller.lockUser);
  usersRouter.patch('/:id/unlock', controller.unlockUser);
  usersRouter.patch('/:id/locked', controller.setUserLocked);
  usersRouter.get('/:id/devices', controller.listDevices);

  app.use('/api/users', routeGuard, usersRouter);

  const rolesRouter = Router();
  rolesRouter.get('/', controller.listRoles);
  rolesRouter.post('/', controller.createRole);
  rolesRouter.put('/:id', controller.updateRole);
  rolesRouter.get('/:id/attributes', controller.getRoleAttributes);
  rolesRouter.put('/:id/attributes', controller.updateRoleAttributes);
  rolesRouter.delete('/:id', controller.deleteRole);

  app.use('/api/roles', routeGuard, rolesRouter);
};

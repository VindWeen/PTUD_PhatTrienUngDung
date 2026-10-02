import express from 'express';
import authenticate from '../../middlewares/authenticate.js';
import requireRoles from '../../middlewares/requireRoles.js';
import { hashPassword } from '../../utils/crypto.js';
import * as repo from './adminRepository.js';
import { assignmentSchema, representativeSchema, userSchema, userUpdateSchema, catalogDefinitions, parseId } from './adminSchemas.js';
const router = express.Router();
router.use(authenticate, requireRoles('ADMIN'));
const handle = fn => async (req,res,next) => { try { res.json({ success: true, data: await fn(req) }); } catch (e) { next(e); } };
for (const resource of ['users','roles','scopes','user-roles','representatives', ...Object.keys(catalogDefinitions)]) {
  router.get(`/${resource}`, handle(() => repo.list(resource)));
}
router.post('/users', handle(async r => { const v = userSchema.parse(r.body); return repo.createUser(r.user.userId,v,await hashPassword(v.password)); }));
router.patch('/users/:id', handle(r => repo.updateUser(r.user.userId,parseId(r.params.id),userUpdateSchema.parse(r.body))));
for (const resource of ['scopes','user-roles','representatives']) {
  router.post(`/${resource}`, handle(r => repo.assign(r.user.userId,resource,(resource === 'representatives' ? representativeSchema : assignmentSchema).parse(r.body))));
  router.delete(`/${resource}/:id`, handle(r => repo.revoke(r.user.userId,resource,parseId(r.params.id))));
}
for (const [resource,d] of Object.entries(catalogDefinitions)) {
  router.post(`/${resource}`, handle(r => repo.saveCatalog(r.user.userId,resource,null,d.schema.parse(r.body))));
  router.patch(`/${resource}/:id`, handle(r => repo.saveCatalog(r.user.userId,resource,parseId(r.params.id),d.schema.parse(r.body))));
  router.delete(`/${resource}/:id`, handle(r => repo.deactivateCatalog(r.user.userId,resource,parseId(r.params.id))));
}
export default router;

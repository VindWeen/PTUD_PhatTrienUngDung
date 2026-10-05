import { Router } from 'express';
import multer from 'multer';
import { pipeline } from 'node:stream';
import { authenticate } from '../../middlewares/authenticate.js';
import { ValidationError } from '../../utils/errors.js';
import service from './awardService.js';
const router = Router();
router.use(authenticate);
const handle = (fn,status=200) => async (req,res,next) => { try { res.status(status).json({success:true,data:await fn(req)}); } catch(e) { next(e); } };
router.post('/award-decisions',handle(r=>service.createDecision(r.body,r.user),201));
router.post('/award-records',handle(r=>service.createRecord(r.body,r.user),201));
router.get('/award-records',handle(r=>service.list(r.query,r.user)));
router.get('/award-records/:id',handle(r=>service.detail(r.params.id,r.user)));
router.post('/award-records/:id/record',handle(r=>service.transition(r.params.id,r.body,r.user,'RECORDED')));
router.post('/award-records/:id/revoke',handle(r=>service.transition(r.params.id,r.body,r.user,'REVOKED')));
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:10485760,files:1}}).single('file');
router.post('/award-decisions/:id/files',(req,res,next)=>upload(req,res,e=>next(e ? new ValidationError('File không hợp lệ hoặc vượt 10 MB') : undefined)),handle(r=>service.upload(r.params.id,r.file,r.user),201));
router.get('/award-decision-files/:id/download',async (req,res,next)=>{
 try { const {file,stream} = await service.download(req.params.id,req.user); res.setHeader('Content-Type',file.mime_type); res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(file.original_file_name)}`); pipeline(stream,res,e=>{if(e && !res.headersSent) next(e);}); } catch(e) {next(e);}
});
export default router;

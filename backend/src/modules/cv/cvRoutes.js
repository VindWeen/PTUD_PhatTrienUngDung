import express from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import cvService from './cvService.js';

const router = express.Router();

const handlePublicCv = async (req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'no-store');
  try {
    const slug = req.params.slug || req.params.id;
    const data = await cvService.getPublicCv(slug);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 404 || err.name === 'NotFoundError') {
      return res.status(404).json({ success: false, message: err.message || 'CV không tồn tại hoặc đã ngừng chia sẻ' });
    }
    next(err);
  }
};

// 1. Public CV routes (unauthenticated)
router.get('/public/cv/:slug', handlePublicCv);
router.get('/cv/:slug', handlePublicCv);

// 2. Authenticated CV routes
router.get('/me/cv/export-docx', authenticate, async (req, res, next) => {
  try {
    const { buffer, filename } = await cvService.exportCvDocx(req.user.userId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename || 'CV_Export.docx'}"`,
      'Content-Length': buffer.length,
    });
    res.status(200).send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/me/cv', authenticate, async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const data = await cvService.getOwnCv(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/me/cv/profile', authenticate, async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const data = await cvService.getOwnCv(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.put('/me/cv', authenticate, async (req, res, next) => {
  try {
    const data = await cvService.updateCv(req.user.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    if (err.name === 'ZodError' || err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

router.put('/me/cv/profile', authenticate, async (req, res, next) => {
  try {
    const data = await cvService.updateCv(req.user.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    if (err.name === 'ZodError' || err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

export default router;

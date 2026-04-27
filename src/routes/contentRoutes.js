const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { upload, handleUploadError } = require('../middlewares/upload');
const { broadcastLimiter } = require('../middlewares/rateLimiter');
const {
  upload: uploadContent,
  submitForReview,
  getMyContent,
  getOne,
  deleteContent,
  uploadValidation,
} = require('../controllers/contentController');
const {
  getAllContent,
  getPendingContent,
  getOneContent,
  approveContent,
  rejectContent,
  rejectValidation,
} = require('../controllers/approvalController');
const { getLiveContent, getAnalytics } = require('../controllers/broadcastController');

// ─── Public routes ───────────────────────────────────────────────────────────
// IMPORTANT: Specific paths must come before /:id to avoid route conflicts
router.get('/live/:teacherId/analytics', broadcastLimiter, getAnalytics);
router.get('/live/:teacherId', broadcastLimiter, getLiveContent);

// ─── Teacher routes ──────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('teacher'),
  upload.single('file'),
  handleUploadError,
  uploadValidation,
  uploadContent
);

router.get('/my', authenticate, authorize('teacher'), getMyContent);

router.put('/:id/submit', authenticate, authorize('teacher'), submitForReview);

router.delete('/:id', authenticate, authorize('teacher'), deleteContent);

// ─── Principal routes ────────────────────────────────────────────────────────
router.get('/all', authenticate, authorize('principal'), getAllContent);

router.get('/pending', authenticate, authorize('principal'), getPendingContent);

router.patch('/:id/approve', authenticate, authorize('principal'), approveContent);

router.patch('/:id/reject', authenticate, authorize('principal'), rejectValidation, rejectContent);

// ─── Shared (teacher sees own, principal sees any) ───────────────────────────
router.get('/:id', authenticate, getOneForRole);

function getOneForRole(req, res, next) {
  if (req.user.role === 'principal') return getOneContent(req, res, next);
  return getOne(req, res, next);
}

module.exports = router;

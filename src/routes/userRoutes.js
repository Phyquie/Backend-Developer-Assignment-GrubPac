const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/rbac');
const { getTeachers, getAllUsers } = require('../controllers/userController');

// Public — students need teacher IDs to hit the broadcast API
router.get('/teachers', getTeachers);

// Principal only
router.get('/', authenticate, authorize('principal'), getAllUsers);

module.exports = router;

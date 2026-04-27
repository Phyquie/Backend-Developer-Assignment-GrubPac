const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');
const {
  register,
  login,
  me,
  registerValidation,
  loginValidation,
} = require('../controllers/authController');

router.post('/register', authLimiter, registerValidation, register);
router.post('/login', authLimiter, loginValidation, login);
router.get('/me', authenticate, me);

module.exports = router;

const { body } = require('express-validator');
const authService = require('../services/authService');
const response = require('../utils/response');
const { validate } = require('../middlewares/validate');

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  validate,
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    return response.created(res, { message: 'Teacher registered successfully', data: user });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    return response.success(res, { message: 'Login successful', data: result });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res) => {
  return response.success(res, { data: req.user });
};

module.exports = { register, login, me, registerValidation, loginValidation };

const { body, param, query } = require('express-validator');
const contentService = require('../services/contentService');
const response = require('../utils/response');
const { validate } = require('../middlewares/validate');

const uploadValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('start_time').optional({ nullable: true }).isISO8601().withMessage('start_time must be a valid ISO 8601 date'),
  body('end_time').optional({ nullable: true }).isISO8601().withMessage('end_time must be a valid ISO 8601 date'),
  body('rotation_duration')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 1440 })
    .withMessage('rotation_duration must be an integer between 1 and 1440 minutes'),
  validate,
];

const upload = async (req, res, next) => {
  try {
    if (!req.file) {
      return response.badRequest(res, 'File is required');
    }

    const content = await contentService.createContent(req.user.id, req.body, req.file);
    return response.created(res, { message: 'Content uploaded successfully', data: content });
  } catch (err) {
    next(err);
  }
};

const submitForReview = async (req, res, next) => {
  try {
    const content = await contentService.submitForReview(req.params.id, req.user.id);
    return response.success(res, { message: 'Content submitted for review', data: content });
  } catch (err) {
    next(err);
  }
};

const getMyContent = async (req, res, next) => {
  try {
    const { status, subject, page, limit } = req.query;
    const result = await contentService.getTeacherContent(req.user.id, { status, subject, page, limit });
    return response.success(res, { data: result });
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const content = await contentService.getContentById(req.params.id, req.user.id);
    return response.success(res, { data: content });
  } catch (err) {
    next(err);
  }
};

const deleteContent = async (req, res, next) => {
  try {
    await contentService.deleteContent(req.params.id, req.user.id);
    return response.success(res, { message: 'Content deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { upload, submitForReview, getMyContent, getOne, deleteContent, uploadValidation };

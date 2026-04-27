const { body } = require('express-validator');
const approvalService = require('../services/approvalService');
const contentService = require('../services/contentService');
const response = require('../utils/response');
const { validate } = require('../middlewares/validate');

const rejectValidation = [
  body('rejection_reason')
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Rejection reason must be between 5 and 1000 characters'),
  validate,
];

const getAllContent = async (req, res, next) => {
  try {
    const { status, subject, teacherId, page, limit } = req.query;
    const result = await approvalService.getAllContent({ status, subject, teacherId, page, limit });
    return response.success(res, { data: result });
  } catch (err) {
    next(err);
  }
};

const getPendingContent = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await approvalService.getPendingContent({ page, limit });
    return response.success(res, { data: result });
  } catch (err) {
    next(err);
  }
};

const getOneContent = async (req, res, next) => {
  try {
    const content = await contentService.getContentById(req.params.id);
    return response.success(res, { data: content });
  } catch (err) {
    next(err);
  }
};

const approveContent = async (req, res, next) => {
  try {
    const content = await approvalService.approveContent(req.params.id, req.user.id);
    return response.success(res, { message: 'Content approved successfully', data: content });
  } catch (err) {
    next(err);
  }
};

const rejectContent = async (req, res, next) => {
  try {
    const { rejection_reason } = req.body;
    const content = await approvalService.rejectContent(req.params.id, req.user.id, rejection_reason);
    return response.success(res, { message: 'Content rejected', data: content });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllContent, getPendingContent, getOneContent, approveContent, rejectContent, rejectValidation };

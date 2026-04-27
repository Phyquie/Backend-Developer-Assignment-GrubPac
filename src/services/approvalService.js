const { Op } = require('sequelize');
const { Content, User, ContentSchedule } = require('../models');
const { invalidateTeacherCache } = require('./schedulingService');

const getAllContent = async ({ status, subject, teacherId, page = 1, limit = 20 } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (subject) where.subject = subject.toLowerCase().trim();
  if (teacherId) where.uploaded_by = teacherId;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const { count, rows } = await Content.findAndCountAll({
    where,
    include: [
      { model: User, as: 'uploader', attributes: ['id', 'name', 'email', 'role'] },
      { model: User, as: 'approver', attributes: ['id', 'name'], required: false },
      { model: ContentSchedule, as: 'schedule', required: false },
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit, 10),
    offset,
  });

  return {
    total: count,
    page: parseInt(page, 10),
    totalPages: Math.ceil(count / parseInt(limit, 10)),
    data: rows,
  };
};

const getPendingContent = async ({ page = 1, limit = 20 } = {}) => {
  return getAllContent({ status: 'pending', page, limit });
};

const approveContent = async (contentId, principalId) => {
  const content = await findContent(contentId);

  if (content.status !== 'pending') {
    const err = new Error(`Only pending content can be approved. Current status: '${content.status}'`);
    err.statusCode = 422;
    throw err;
  }

  await content.update({
    status: 'approved',
    approved_by: principalId,
    approved_at: new Date(),
    rejection_reason: null,
  });

  // Invalidate broadcast cache so the newly approved content is visible immediately
  await invalidateTeacherCache(content.uploaded_by);

  return findContentWithDetails(contentId);
};

const rejectContent = async (contentId, principalId, reason) => {
  if (!reason || reason.trim().length === 0) {
    const err = new Error('Rejection reason is required');
    err.statusCode = 400;
    throw err;
  }

  const content = await findContent(contentId);

  if (content.status !== 'pending') {
    const err = new Error(`Only pending content can be rejected. Current status: '${content.status}'`);
    err.statusCode = 422;
    throw err;
  }

  await content.update({
    status: 'rejected',
    rejection_reason: reason.trim(),
    approved_by: principalId,
    approved_at: new Date(),
  });

  // Invalidate in case the content was approved and is now being revoked via reject
  await invalidateTeacherCache(content.uploaded_by);

  return findContentWithDetails(contentId);
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const findContent = async (contentId) => {
  const content = await Content.findByPk(contentId);
  if (!content) {
    const err = new Error('Content not found');
    err.statusCode = 404;
    throw err;
  }
  return content;
};

const findContentWithDetails = async (contentId) => {
  return Content.findOne({
    where: { id: contentId },
    include: [
      { model: User, as: 'uploader', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'approver', attributes: ['id', 'name'], required: false },
      { model: ContentSchedule, as: 'schedule', required: false },
    ],
  });
};

module.exports = { getAllContent, getPendingContent, approveContent, rejectContent };

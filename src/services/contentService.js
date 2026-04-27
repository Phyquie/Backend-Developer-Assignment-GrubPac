const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Content, ContentSlot, ContentSchedule, User } = require('../models');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Create content entry after file upload.
 * Also creates/updates ContentSlot and ContentSchedule for the teacher/subject pair.
 */
const createContent = async (teacherId, body, file) => {
  const { title, description, subject, start_time, end_time, rotation_duration } = body;

  // Enforce: start_time and end_time must both be present or both absent
  if ((start_time && !end_time) || (!start_time && end_time)) {
    const err = new Error('Both start_time and end_time must be provided together');
    err.statusCode = 400;
    throw err;
  }

  if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
    const err = new Error('start_time must be before end_time');
    err.statusCode = 400;
    throw err;
  }

  // Normalise across storage backends:
  //   Disk → file.path  (local path)   file.filename (basename)
  //   S3   → file.location (full URL)  file.key      (S3 object key)
  const isS3File = !!file.location;
  const fileUrl = isS3File ? file.location : `${BASE_URL}/uploads/${path.basename(file.path)}`;
  const filePath = isS3File ? file.key : file.path;

  const content = await Content.create({
    title,
    description: description || null,
    subject: subject.toLowerCase().trim(),
    file_path: filePath,
    file_url: fileUrl,
    file_type: file.mimetype,
    file_size: file.size,
    uploaded_by: teacherId,
    status: 'uploaded',
    start_time: start_time || null,
    end_time: end_time || null,
  });

  // Create or find the subject slot for this teacher
  const [slot] = await ContentSlot.findOrCreate({
    where: { teacher_id: teacherId, subject: subject.toLowerCase().trim() },
    defaults: { teacher_id: teacherId, subject: subject.toLowerCase().trim() },
  });

  // Determine next rotation order for this slot
  const maxOrder = await ContentSchedule.max('rotation_order', {
    where: { slot_id: slot.id },
  });
  const nextOrder = (maxOrder === null || maxOrder === undefined ? -1 : maxOrder) + 1;

  await ContentSchedule.create({
    content_id: content.id,
    slot_id: slot.id,
    rotation_order: nextOrder,
    duration: parseInt(rotation_duration, 10) || 5,
  });

  return getContentById(content.id, teacherId);
};

const submitForReview = async (contentId, teacherId) => {
  const content = await findOwnedContent(contentId, teacherId);

  if (content.status !== 'uploaded') {
    const err = new Error(`Cannot submit content with status '${content.status}' for review`);
    err.statusCode = 422;
    throw err;
  }

  await content.update({ status: 'pending' });
  return getContentById(contentId, teacherId);
};

const getTeacherContent = async (teacherId, { status, subject, page = 1, limit = 20 } = {}) => {
  const where = { uploaded_by: teacherId };
  if (status) where.status = status;
  if (subject) where.subject = subject.toLowerCase().trim();

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const { count, rows } = await Content.findAndCountAll({
    where,
    include: [
      { model: ContentSchedule, as: 'schedule', required: false },
      { model: User, as: 'approver', attributes: ['id', 'name'], required: false },
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

const getContentById = async (contentId, userId = null) => {
  const where = { id: contentId };
  if (userId) where.uploaded_by = userId;

  const content = await Content.findOne({
    where,
    include: [
      { model: User, as: 'uploader', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'approver', attributes: ['id', 'name'], required: false },
      { model: ContentSchedule, as: 'schedule', required: false },
    ],
  });

  if (!content) {
    const err = new Error('Content not found');
    err.statusCode = 404;
    throw err;
  }

  return content;
};

const deleteContent = async (contentId, teacherId) => {
  const content = await findOwnedContent(contentId, teacherId);

  if (content.status === 'approved') {
    const err = new Error('Cannot delete approved content');
    err.statusCode = 422;
    throw err;
  }

  // Remove physical file — only for disk storage (S3 objects are not deleted here
  // to avoid needing AWS credentials in the delete flow; handle via S3 lifecycle rules)
  const { S3_ENABLED } = require('../middlewares/upload');
  if (!S3_ENABLED && content.file_path && fs.existsSync(content.file_path)) {
    fs.unlinkSync(content.file_path);
  }

  await content.destroy();
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const findOwnedContent = async (contentId, teacherId) => {
  const content = await Content.findOne({ where: { id: contentId, uploaded_by: teacherId } });
  if (!content) {
    const err = new Error('Content not found or you do not own it');
    err.statusCode = 404;
    throw err;
  }
  return content;
};

module.exports = { createContent, submitForReview, getTeacherContent, getContentById, deleteContent };

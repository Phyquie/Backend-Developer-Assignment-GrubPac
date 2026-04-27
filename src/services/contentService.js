const path = require('path');
const fs = require('fs');
const prisma = require('../config/database');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const createContent = async (teacherId, body, file) => {
  const { title, description, subject, start_time, end_time, rotation_duration } = body;

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

  const isS3File = !!file.location;
  const fileUrl = isS3File ? file.location : `${BASE_URL}/uploads/${path.basename(file.path)}`;
  const filePath = isS3File ? file.key : file.path;
  const normalizedSubject = subject.toLowerCase().trim();

  const content = await prisma.content.create({
    data: {
      title,
      description: description || null,
      subject: normalizedSubject,
      filePath,
      fileUrl,
      fileType: file.mimetype,
      fileSize: file.size,
      uploadedBy: teacherId,
      status: 'uploaded',
      startTime: start_time ? new Date(start_time) : null,
      endTime: end_time ? new Date(end_time) : null,
    },
  });

  const slot = await prisma.contentSlot.upsert({
    where: {
      unique_teacher_subject_slot: { teacherId, subject: normalizedSubject },
    },
    update: {},
    create: { teacherId, subject: normalizedSubject },
  });

  const agg = await prisma.contentSchedule.aggregate({
    _max: { rotationOrder: true },
    where: { slotId: slot.id },
  });
  const nextOrder = (agg._max.rotationOrder ?? -1) + 1;

  await prisma.contentSchedule.create({
    data: {
      contentId: content.id,
      slotId: slot.id,
      rotationOrder: nextOrder,
      duration: parseInt(rotation_duration, 10) || 5,
    },
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

  await prisma.content.update({ where: { id: contentId }, data: { status: 'pending' } });
  return getContentById(contentId, teacherId);
};

const getTeacherContent = async (teacherId, { status, subject, page = 1, limit = 20 } = {}) => {
  const where = { uploadedBy: teacherId };
  if (status) where.status = status;
  if (subject) where.subject = subject.toLowerCase().trim();

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [count, rows] = await Promise.all([
    prisma.content.count({ where }),
    prisma.content.findMany({
      where,
      include: {
        schedule: true,
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    total: count,
    page: parseInt(page, 10),
    totalPages: Math.ceil(count / take),
    data: rows,
  };
};

const getContentById = async (contentId, userId = null) => {
  const where = { id: contentId };
  if (userId) where.uploadedBy = userId;

  const content = await prisma.content.findFirst({
    where,
    include: {
      uploader: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true } },
      schedule: true,
    },
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

  const { S3_ENABLED } = require('../middlewares/upload');
  if (!S3_ENABLED && content.filePath && fs.existsSync(content.filePath)) {
    fs.unlinkSync(content.filePath);
  }

  await prisma.content.delete({ where: { id: contentId } });
};

const findOwnedContent = async (contentId, teacherId) => {
  const content = await prisma.content.findFirst({
    where: { id: contentId, uploadedBy: teacherId },
  });
  if (!content) {
    const err = new Error('Content not found or you do not own it');
    err.statusCode = 404;
    throw err;
  }
  return content;
};

module.exports = { createContent, submitForReview, getTeacherContent, getContentById, deleteContent };

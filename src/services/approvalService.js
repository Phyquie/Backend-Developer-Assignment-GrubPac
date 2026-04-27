const prisma = require('../config/database');
const { invalidateTeacherCache } = require('./schedulingService');

const getAllContent = async ({ status, subject, teacherId, page = 1, limit = 20 } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (subject) where.subject = subject.toLowerCase().trim();
  if (teacherId) where.uploadedBy = teacherId;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [count, rows] = await Promise.all([
    prisma.content.count({ where }),
    prisma.content.findMany({
      where,
      include: {
        uploader: { select: { id: true, name: true, email: true, role: true } },
        approver: { select: { id: true, name: true } },
        schedule: true,
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

  await prisma.content.update({
    where: { id: contentId },
    data: {
      status: 'approved',
      approvedBy: principalId,
      approvedAt: new Date(),
      rejectionReason: null,
    },
  });

  await invalidateTeacherCache(content.uploadedBy);

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

  await prisma.content.update({
    where: { id: contentId },
    data: {
      status: 'rejected',
      rejectionReason: reason.trim(),
      approvedBy: principalId,
      approvedAt: new Date(),
    },
  });

  await invalidateTeacherCache(content.uploadedBy);

  return findContentWithDetails(contentId);
};

const findContent = async (contentId) => {
  const content = await prisma.content.findUnique({ where: { id: contentId } });
  if (!content) {
    const err = new Error('Content not found');
    err.statusCode = 404;
    throw err;
  }
  return content;
};

const findContentWithDetails = async (contentId) => {
  return prisma.content.findUnique({
    where: { id: contentId },
    include: {
      uploader: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true } },
      schedule: true,
    },
  });
};

module.exports = { getAllContent, getPendingContent, approveContent, rejectContent };

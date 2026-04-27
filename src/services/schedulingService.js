const prisma = require('../config/database');
const cache = require('../utils/cache');

const computeTTL = (results) => {
  let min = Infinity;
  for (const r of results) {
    if (r.rotationInfo?.currentDurationMinutes) {
      min = Math.min(min, r.rotationInfo.currentDurationMinutes * 60);
    }
  }
  return Math.min(Math.max(min === Infinity ? 60 : min, 30), 300);
};

const cacheKey = (teacherId, subject) =>
  `broadcast:live:${teacherId}:${subject || 'all'}`;

const getActiveContent = async (teacherId, subject = null) => {
  const key = cacheKey(teacherId, subject);

  const cached = await cache.get(key);
  if (cached !== null) return cached;

  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true, name: true, role: true },
  });

  if (!teacher || teacher.role !== 'teacher') return null;

  const now = new Date();

  const where = {
    uploadedBy: teacherId,
    status: 'approved',
    startTime: { lte: now },
    endTime: { gte: now },
  };

  if (subject) {
    where.subject = subject.toLowerCase().trim();
  }

  const contents = await prisma.content.findMany({
    where,
    include: { schedule: true },
  });

  const scheduled = contents.filter((c) => c.schedule !== null);

  if (scheduled.length === 0) {
    await cache.set(key, [], 30);
    return [];
  }

  const grouped = scheduled.reduce((acc, item) => {
    if (!acc[item.subject]) acc[item.subject] = [];
    acc[item.subject].push(item);
    return acc;
  }, {});

  const nowMs = now.getTime();
  const result = [];

  for (const [subj, items] of Object.entries(grouped)) {
    const active = resolveRotation(items, nowMs);
    if (active) {
      result.push({
        subject: subj,
        activeContent: formatContent(active),
        rotationInfo: {
          totalItemsInRotation: items.length,
          currentDurationMinutes: active.schedule.duration,
        },
      });
    }
  }

  await cache.set(key, result, computeTTL(result));
  return result;
};

const invalidateTeacherCache = async (teacherId) => {
  await cache.delPattern(`broadcast:live:${teacherId}:*`);
};

const resolveRotation = (items, nowMs) => {
  const sorted = [...items].sort(
    (a, b) => a.schedule.rotationOrder - b.schedule.rotationOrder
  );

  const totalCycleMs = sorted.reduce(
    (sum, item) => sum + item.schedule.duration * 60 * 1000,
    0
  );

  if (totalCycleMs === 0) return sorted[0] || null;

  const position = nowMs % totalCycleMs;

  let accumulated = 0;
  for (const item of sorted) {
    accumulated += item.schedule.duration * 60 * 1000;
    if (position < accumulated) return item;
  }

  return sorted[0];
};

const formatContent = (content) => ({
  id: content.id,
  title: content.title,
  description: content.description,
  subject: content.subject,
  fileUrl: content.fileUrl,
  fileType: content.fileType,
  startTime: content.startTime,
  endTime: content.endTime,
});

const getSubjectAnalytics = async (teacherId) => {
  const rows = await prisma.$queryRaw`
    SELECT
      c.subject,
      COUNT(c.id)::int                                        AS total_content,
      COUNT(CASE WHEN c.status = 'approved'  THEN 1 END)::int AS approved_count,
      COUNT(CASE WHEN c.status = 'pending'   THEN 1 END)::int AS pending_count,
      COUNT(CASE WHEN c.status = 'rejected'  THEN 1 END)::int AS rejected_count,
      COALESCE(SUM(cs.duration), 0)::int                      AS total_rotation_minutes
    FROM content c
    LEFT JOIN content_schedules cs ON cs.content_id = c.id
    WHERE c.uploaded_by = ${teacherId}
    GROUP BY c.subject
    ORDER BY approved_count DESC, total_content DESC
  `;
  return rows;
};

module.exports = { getActiveContent, invalidateTeacherCache, getSubjectAnalytics };

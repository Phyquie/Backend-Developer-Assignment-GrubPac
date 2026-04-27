const { Op } = require('sequelize');
const { Content, ContentSchedule, User } = require('../models');
const cache = require('../utils/cache');

/**
 * Cache TTL strategy: use the minimum rotation duration across all active
 * content for this query (so the cache expires before the active item changes).
 * Floor at 30s, ceil at 300s (5 min).
 */
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

/**
 * Returns the currently active content for a given teacher.
 *
 * Algorithm:
 *  1. Check Redis cache — return immediately on hit.
 *  2. Validate teacher exists.
 *  3. Fetch all approved content within its teacher-defined time window.
 *  4. Group by subject.
 *  5. For each subject group, apply stateless wall-clock rotation to pick the
 *     single active item.
 *  6. Cache the serialised result for TTL = min(rotation_duration) seconds.
 *
 * Rotation logic (stateless & deterministic):
 *  position = Date.now() % totalCycleMs
 *  Walk sorted items, accumulate durations — first item whose cumulative
 *  duration exceeds `position` is the active item.
 *  Every client at the same instant sees the same content.
 */
const getActiveContent = async (teacherId, subject = null) => {
  const key = cacheKey(teacherId, subject);

  // ── Cache hit ────────────────────────────────────────────────────────────
  const cached = await cache.get(key);
  if (cached !== null) return cached;

  // ── Teacher validation ───────────────────────────────────────────────────
  const teacher = await User.findOne({
    where: { id: teacherId, role: 'teacher' },
    attributes: ['id', 'name'],
  });

  if (!teacher) return null; // caller treats null as 404

  const now = new Date();

  const contentWhere = {
    uploaded_by: teacherId,
    status: 'approved',
    start_time: { [Op.lte]: now },
    end_time: { [Op.gte]: now },
  };

  if (subject) {
    contentWhere.subject = subject.toLowerCase().trim();
  }

  const contents = await Content.findAll({
    where: contentWhere,
    include: [
      {
        model: ContentSchedule,
        as: 'schedule',
        required: true, // INNER JOIN — only scheduled content
      },
    ],
  });

  if (contents.length === 0) {
    await cache.set(key, [], 30); // short TTL — content may become active soon
    return [];
  }

  // ── Group by subject ─────────────────────────────────────────────────────
  const grouped = contents.reduce((acc, item) => {
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

  // ── Cache result ─────────────────────────────────────────────────────────
  await cache.set(key, result, computeTTL(result));

  return result;
};

/**
 * Invalidates all cached broadcast results for a given teacher.
 * Called whenever approval state changes for that teacher's content.
 */
const invalidateTeacherCache = async (teacherId) => {
  await cache.delPattern(`broadcast:live:${teacherId}:*`);
};

/**
 * Determines which content item is currently active using wall-clock rotation.
 */
const resolveRotation = (items, nowMs) => {
  const sorted = [...items].sort(
    (a, b) => a.schedule.rotation_order - b.schedule.rotation_order
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
  fileUrl: content.file_url,
  fileType: content.file_type,
  startTime: content.start_time,
  endTime: content.end_time,
});

/**
 * Subject-level analytics for a teacher (most active subject, usage stats).
 */
const getSubjectAnalytics = async (teacherId) => {
  const { sequelize } = require('../models');
  const { QueryTypes } = require('sequelize');

  const rows = await sequelize.query(
    `SELECT
       c.subject,
       COUNT(c.id)::int                                      AS total_content,
       COUNT(CASE WHEN c.status = 'approved'  THEN 1 END)::int AS approved_count,
       COUNT(CASE WHEN c.status = 'pending'   THEN 1 END)::int AS pending_count,
       COUNT(CASE WHEN c.status = 'rejected'  THEN 1 END)::int AS rejected_count,
       COALESCE(SUM(cs.duration), 0)::int                    AS total_rotation_minutes
     FROM content c
     LEFT JOIN content_schedules cs ON cs.content_id = c.id
     WHERE c.uploaded_by = :teacherId
     GROUP BY c.subject
     ORDER BY approved_count DESC, total_content DESC`,
    { replacements: { teacherId }, type: QueryTypes.SELECT }
  );

  return rows;
};

module.exports = { getActiveContent, invalidateTeacherCache, getSubjectAnalytics };

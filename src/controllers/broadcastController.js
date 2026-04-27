const schedulingService = require('../services/schedulingService');
const response = require('../utils/response');

/**
 * GET /api/v1/content/live/:teacherId?subject=maths
 *
 * Public endpoint — no authentication required.
 * Returns the currently active (live) content for the given teacher.
 * Applies subject filter when provided.
 *
 * Edge cases handled:
 *  - Teacher does not exist          → 404
 *  - No approved content             → empty response with message
 *  - Approved but outside time window → empty response with message
 *  - Invalid/unknown subject         → empty response (not an error)
 */
const getLiveContent = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const { subject } = req.query;

    const result = await schedulingService.getActiveContent(teacherId, subject || null);

    // null means teacher was not found
    if (result === null) {
      return response.notFound(res, 'Teacher not found');
    }

    if (result.length === 0) {
      return response.success(res, {
        message: 'No content available',
        data: [],
      });
    }

    return response.success(res, {
      message: 'Live content retrieved successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/content/live/:teacherId/analytics
 *
 * Subject-level analytics for a teacher's content.
 */
const getAnalytics = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const analytics = await schedulingService.getSubjectAnalytics(teacherId);
    return response.success(res, { data: analytics });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLiveContent, getAnalytics };

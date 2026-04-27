const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });

  // Prisma known request errors
  if (err.constructor?.name === 'PrismaClientKnownRequestError') {
    // Unique constraint violation (P2002)
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'field';
      return res.status(409).json({
        success: false,
        message: `Duplicate value for field: ${field}`,
        errors: null,
      });
    }

    // Foreign key constraint violation (P2003)
    if (err.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Referenced resource does not exist',
        errors: null,
      });
    }

    // Record not found (P2025)
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: err.meta?.cause || 'Record not found',
        errors: null,
      });
    }
  }

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return res.status(statusCode).json({ success: false, message, errors: null });
};

const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    data: null,
  });
};

module.exports = { errorHandler, notFoundHandler };

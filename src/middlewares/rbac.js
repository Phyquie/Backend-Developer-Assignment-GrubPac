const response = require('../utils/response');

/**
 * Returns middleware that allows only the specified roles.
 * Must be used after the `authenticate` middleware.
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return response.unauthorized(res, 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return response.forbidden(
        res,
        `Access denied. Required role(s): ${allowedRoles.join(', ')}`
      );
    }

    next();
  };
};

module.exports = { authorize };

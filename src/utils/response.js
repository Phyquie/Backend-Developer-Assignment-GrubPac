const success = (res, { message = 'Success', data = null, statusCode = 200 } = {}) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const created = (res, { message = 'Created successfully', data = null } = {}) => {
  return res.status(201).json({ success: true, message, data });
};

const error = (res, { message = 'An error occurred', statusCode = 500, errors = null } = {}) => {
  return res.status(statusCode).json({ success: false, message, errors });
};

const notFound = (res, message = 'Resource not found') => {
  return res.status(404).json({ success: false, message, data: null });
};

const unauthorized = (res, message = 'Unauthorized') => {
  return res.status(401).json({ success: false, message, data: null });
};

const forbidden = (res, message = 'Forbidden — insufficient permissions') => {
  return res.status(403).json({ success: false, message, data: null });
};

const badRequest = (res, message = 'Bad request', errors = null) => {
  return res.status(400).json({ success: false, message, errors });
};

module.exports = { success, created, error, notFound, unauthorized, forbidden, badRequest };

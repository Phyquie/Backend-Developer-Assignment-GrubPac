const jwt = require('jsonwebtoken');
const config = require('../config/config');
const response = require('../utils/response');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.unauthorized(res, 'Access token missing or malformed');
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return response.unauthorized(res, 'Access token has expired');
      }
      return response.unauthorized(res, 'Access token is invalid');
    }

    const user = await User.findOne({
      where: { id: decoded.id },
      attributes: ['id', 'name', 'email', 'role'],
    });

    if (!user) {
      return response.unauthorized(res, 'User associated with token no longer exists');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate };

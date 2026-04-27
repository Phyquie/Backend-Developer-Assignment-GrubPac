const userService = require('../services/userService');
const response = require('../utils/response');

const getTeachers = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await userService.getTeachers({ page, limit });
    return response.success(res, { data: result });
  } catch (err) {
    next(err);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await userService.getAllUsers({ page, limit });
    return response.success(res, { data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTeachers, getAllUsers };

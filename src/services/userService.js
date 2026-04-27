const { User } = require('../models');

const getTeachers = async ({ page = 1, limit = 50 } = {}) => {
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const { count, rows } = await User.findAndCountAll({
    where: { role: 'teacher' },
    attributes: ['id', 'name', 'email', 'created_at'],
    order: [['name', 'ASC']],
    limit: parseInt(limit, 10),
    offset,
  });

  return {
    total: count,
    page: parseInt(page, 10),
    totalPages: Math.ceil(count / parseInt(limit, 10)),
    data: rows,
  };
};

const getAllUsers = async ({ page = 1, limit = 50 } = {}) => {
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const { count, rows } = await User.findAndCountAll({
    attributes: ['id', 'name', 'email', 'role', 'created_at'],
    order: [['role', 'ASC'], ['name', 'ASC']],
    limit: parseInt(limit, 10),
    offset,
  });

  return {
    total: count,
    page: parseInt(page, 10),
    totalPages: Math.ceil(count / parseInt(limit, 10)),
    data: rows,
  };
};

module.exports = { getTeachers, getAllUsers };

const prisma = require('../config/database');

const getTeachers = async ({ page = 1, limit = 50 } = {}) => {
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [count, rows] = await Promise.all([
    prisma.user.count({ where: { role: 'teacher' } }),
    prisma.user.findMany({
      where: { role: 'teacher' },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { name: 'asc' },
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

const getAllUsers = async ({ page = 1, limit = 50 } = {}) => {
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const [count, rows] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
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

module.exports = { getTeachers, getAllUsers };

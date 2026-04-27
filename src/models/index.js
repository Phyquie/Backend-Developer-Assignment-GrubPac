const sequelize = require('../config/database');

const User = require('./User')(sequelize);
const Content = require('./Content')(sequelize);
const ContentSlot = require('./ContentSlot')(sequelize);
const ContentSchedule = require('./ContentSchedule')(sequelize);

const models = { User, Content, ContentSlot, ContentSchedule };

Object.values(models).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(models);
  }
});

module.exports = { sequelize, ...models };

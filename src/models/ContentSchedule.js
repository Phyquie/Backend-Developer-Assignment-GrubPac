const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const ContentSchedule = sequelize.define(
    'ContentSchedule',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      content_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'content', key: 'id' },
      },
      slot_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'content_slots', key: 'id' },
      },
      rotation_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Position in the rotation queue for this subject slot',
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
        comment: 'How many minutes this content is displayed per rotation cycle',
        validate: { min: 1 },
      },
    },
    {
      tableName: 'content_schedules',
      timestamps: true,
      underscored: true,
    }
  );

  ContentSchedule.associate = (models) => {
    ContentSchedule.belongsTo(models.Content, { foreignKey: 'content_id', as: 'content' });
    ContentSchedule.belongsTo(models.ContentSlot, { foreignKey: 'slot_id', as: 'slot' });
  };

  return ContentSchedule;
};

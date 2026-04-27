const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const ContentSlot = sequelize.define(
    'ContentSlot',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      teacher_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      subject: {
        type: DataTypes.STRING(100),
        allowNull: false,
        set(value) {
          this.setDataValue('subject', value ? value.toLowerCase().trim() : value);
        },
      },
    },
    {
      tableName: 'content_slots',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['teacher_id', 'subject'],
          name: 'unique_teacher_subject_slot',
        },
      ],
    }
  );

  ContentSlot.associate = (models) => {
    ContentSlot.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'teacher' });
    ContentSlot.hasMany(models.ContentSchedule, { foreignKey: 'slot_id', as: 'schedules' });
  };

  return ContentSlot;
};

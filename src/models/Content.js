const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Content = sequelize.define(
    'Content',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { notEmpty: true, len: [1, 255] },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      subject: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { notEmpty: true },
        set(value) {
          this.setDataValue('subject', value ? value.toLowerCase().trim() : value);
        },
      },
      file_path: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      file_url: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      file_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      file_size: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'File size in bytes',
      },
      uploaded_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      status: {
        type: DataTypes.ENUM('uploaded', 'pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'uploaded',
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      approved_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      start_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When this content becomes visible (teacher-defined)',
      },
      end_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When this content stops being visible (teacher-defined)',
      },
    },
    {
      tableName: 'content',
      timestamps: true,
      underscored: true,
    }
  );

  Content.associate = (models) => {
    Content.belongsTo(models.User, { foreignKey: 'uploaded_by', as: 'uploader' });
    Content.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
    Content.hasOne(models.ContentSchedule, { foreignKey: 'content_id', as: 'schedule' });
  };

  return Content;
};

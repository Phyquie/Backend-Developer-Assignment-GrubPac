const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { notEmpty: true, len: [2, 100] },
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('principal', 'teacher'),
        allowNull: false,
        defaultValue: 'teacher',
      },
    },
    {
      tableName: 'users',
      timestamps: true,
      underscored: true,
    }
  );

  User.associate = (models) => {
    User.hasMany(models.Content, { foreignKey: 'uploaded_by', as: 'uploadedContent' });
    User.hasMany(models.Content, { foreignKey: 'approved_by', as: 'approvedContent' });
    User.hasMany(models.ContentSlot, { foreignKey: 'teacher_id', as: 'contentSlots' });
  };

  return User;
};

const { sequelize } = require('./sequelize')
const { DataTypes } = require('sequelize')

const User = sequelize.define('User', {
  // Model attributes are defined here
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  verifiedEmail: {
    type: DataTypes.BOOLEAN
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
    // allowNull defaults to true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  locale: {
    type: DataTypes.STRING(2)
  },
  picture: {
    type: DataTypes.STRING,
    defaultValue: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png'
  }
}, {})

module.exports = { User }
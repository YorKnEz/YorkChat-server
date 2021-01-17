const { sequelize } = require('./sequelize')
const { DataTypes } = require('sequelize')

const Chatroom = sequelize.define('Chatroom', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  picture: {
    type: DataTypes.STRING,
    defaultValue: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png'
  },
  lastMessage: {
    type: DataTypes.STRING,
    defaultValue: null
  },
  userCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false
  }
}, {})

module.exports = { Chatroom }
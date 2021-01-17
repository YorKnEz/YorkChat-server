const { DataTypes } = require('sequelize')

const { sequelize } = require('./sequelize')
const { User } = require('./user')
const { Chatroom } = require('./chatroom')

const Message = sequelize.define('Message', {
  content: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mediaType: {
    type: DataTypes.STRING,
    defaultValue: null
  }
}, {})

Message.belongsTo(User)
Message.belongsTo(Chatroom)

module.exports = { Message }
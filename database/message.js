const { DataTypes } = require('sequelize')

const { sequelize } = require('./sequelize')
const { User } = require('./user')
const { Chatroom } = require('./chatroom')

const Message = sequelize.define('Message', {
  content: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {})

Message.belongsTo(User)
Message.belongsTo(Chatroom)

module.exports = { Message }
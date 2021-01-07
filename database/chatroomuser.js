const { DataTypes } = require('sequelize')

const { sequelize } = require('./sequelize')
const { User } = require('./user')
const { Chatroom } = require('./chatroom')

const ChatroomUser = sequelize.define('ChatroomUser', {}, {})

ChatroomUser.belongsTo(User)
ChatroomUser.belongsTo(Chatroom, { primaryKey: true })

module.exports = { ChatroomUser }
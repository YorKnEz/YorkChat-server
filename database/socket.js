const { DataTypes } = require('sequelize')

const { sequelize } = require('./sequelize')
const { User } = require('./user')

const Socket = sequelize.define('Socket', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  }
})

Socket.belongsTo(User)

module.exports = { Socket }
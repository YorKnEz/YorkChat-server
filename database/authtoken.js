const { DataTypes } = require('sequelize')

const { sequelize } = require('./sequelize')
const { User } = require('./user')

const AuthToken = sequelize.define('AuthToken', {
  token: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {})

AuthToken.belongsTo(User, { foreignKey: 'id', primaryKey: true })

module.exports = { AuthToken }
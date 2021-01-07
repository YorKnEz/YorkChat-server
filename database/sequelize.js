const { Sequelize } = require('sequelize')

const DB_USER = process.env.DB_USER
const DB_PASS = process.env.DB_PASS

const sequelize = new Sequelize(`postgres://${DB_USER}:${DB_PASS}@db:5432/yorkchat`)

async function testConnection() {
  try {
    await sequelize.authenticate()
    await sequelize.sync({ force: true })
    console.log('Connection has been established successfully.')
  } catch (error) {
    console.error('Unable to connect to the database:', error)
  }
}

module.exports = { sequelize, testConnection }
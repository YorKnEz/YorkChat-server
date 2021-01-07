const express = require('express')
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()
const app = express()
const server = require("http").createServer(app)
const io = require("socket.io")(server)
const port = 3000

const crypto = require('crypto')

// Database code

const { Op } = require('sequelize')

const { User } = require('./database/user')
const { Chatroom } = require('./database/chatroom')
const { Message } = require('./database/message')
const { ChatroomUser } = require('./database/chatroomuser')
const { AuthToken } = require('./database/authtoken')
const { sequelize, testConnection } = require('./database/sequelize')

testConnection()

// Database code

// function to check if a token is valid or not, if the token is valid then the
// it returns the id of the user with that token else it throws an error
async function checkToken(token) {
  const found = await AuthToken.findOne({
    where: {
      token
    }
  })

  if (!found) throw {
    status: '401',
    message: 'Invalid credentials.',
    extraData: null
  }
  else return found.id
}

// check the user that sends an api call

app.post('/login', jsonParser, async (req, res) => {
  try {
    const user = await User.upsert({
      email: req.body.email,
      verifiedEmail: req.body.verified_email,
      firstName: req.body.given_name,
      lastName: req.body.family_name,
      name: req.body.name,
      locale: req.body.locale,
      picture: req.body.picture,
    })

    const hash = crypto.createHash('sha256') // create a hash object using sha256 algorithm
    hash.update(String(user[0].id)) // update the hash content with the user id
    const token = hash.digest('hex') // generate a token by digesting the user id using hex encoding

    await AuthToken.upsert({
      token,
      id: user[0].id,
    })

    res.status(200).json({ message: 'User created successfully.', user: user[0], token })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`GET Chatroom by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`POST Chatroom Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.get('/chatrooms', jsonParser, async (req, res) => {
  try {
    const UserId = await checkToken(req.headers.authorization)

    // find the ids of all the chatrooms that the user is a part of
    const chatroomuserIds = await ChatroomUser.findAll({
      attributes: ['ChatroomId'],
      where: { UserId: UserId }
    })

    const chatroomIds = chatroomuserIds.map(el => el.ChatroomId)

    // find all chatroom instancess that are inside chatroomId array
    const chatrooms = await Chatroom.findAll({
      where: {
        id: {
          [Op.in]: chatroomIds
        }
      }
    })

    if (chatrooms === []) {
      throw {
        status: 404,
        message: 'Not found.',
        extraData: {
          chatrooms: []
        }
      }
    }

    res.status(200).json({
      message: 'Chatrooms fetched successfully.',
      chatrooms
    })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`GET Chatroom by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`POST Chatroom Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.post('/chatrooms', jsonParser, async (req, res) => {
  try {
    await checkToken(req.headers.authorization)

    // check if chatroom already exists
    let chatroom, foundChatroom = false
    if (req.body.usersIds.length == 2) {
      const query = await sequelize.query('SELECT a1."UserId" AS uid1, a2."UserId" AS uid2, table1.ChatroomId FROM "ChatroomUsers" a1, "ChatroomUsers" a2, (SELECT COUNT(cu."ChatroomId") AS users, cu."ChatroomId" AS ChatroomId FROM "ChatroomUsers" AS cu GROUP BY cu."ChatroomId") AS table1 WHERE table1.users = 2 AND a1."ChatroomId" = a2."ChatroomId" AND a1."ChatroomId" = table1.ChatroomId AND a1."UserId" < a2."UserId" AND ((a1."UserId" = :firstId AND a2."UserId" = :secondId) OR (a1."UserId" = :secondId AND a2."UserId" = :firstId)) ORDER BY table1.ChatroomId LIMIT 1', {
        replacements: {
          firstId: req.body.usersIds[0],
          secondId: req.body.usersIds[1]
        }
      })

      if (Array.isArray(query[0]) && query[0].length) {
        foundChatroom = true
        chatroom = await Chatroom.findOne({ where: { id: query[0][0].chatroomid }})
      }
    }

    if (!foundChatroom || req.body.usersIds.length > 2) {
      chatroom = await Chatroom.upsert({
        name: req.body.name,
        picture: req.body.picture,
        lastMessage: req.body.lastMessage
      })
      chatroom = chatroom[0]
  
      const users = await User.findAll({
        where: {
          id: { [Op.in]: req.body.usersIds }
        }
      })
  
      for (const user of users) {
        await ChatroomUser.create({
          UserId: user.id,
          ChatroomId: chatroom.id
        })
      }
    }

    res.status(200).json({ message: 'Chatroom created successfully.', chatroom: chatroom })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`GET Chatroom by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`POST Chatroom Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.get('/chatrooms/:chatroomId', jsonParser, async (req, res) => {
  try {
    await checkToken(req.headers.authorization)

    const chatroom = await Chatroom.findOne({ where: { id: req.params.chatroomId } })

    if (chatroom == null) {
      throw {
        status: 404,
        message: 'Not found.',
        extraData: {
          chatroom
        }
      }
    }

    res.status(200).json({
      message: 'Chatroom fetched successfully.',
      chatroom
    })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`GET Chatroom by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`POST Chatroom Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.get('/chatrooms/:chatroomId/messages', jsonParser, async (req, res) => {
  try {
    await checkToken(req.headers.authorization)

    let messages = await Message.findAll({
      order: [['createdAt', 'DESC']],
      limit: 100,
      where: { ChatroomId: req.params.chatroomId },
    })

    res.status(200).json({
      message: 'Messages fetched successfully.',
      messages
    })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`GET Chatroom by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`POST Chatroom Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.post('/chatrooms/:chatroomId/messages', jsonParser, async (req, res) => {
  try {
    const UserId = await checkToken(req.headers.authorization)

    const message = await Message.create({
      UserId,
      ChatroomId: req.params.chatroomId,
      content: req.body.content
    })

    await Chatroom.update({lastMessage: message.content}, {
      where: {
        id: req.params.chatroomId
      }
    })

    res.status(200).json({ message: 'Message created successfully.', message })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`GET Chatroom by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`POST Chatroom Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.delete('/chatrooms/:chatroomId/messages/:messageId', jsonParser, async (req, res) => {
  try {
    const UserId = await checkToken(req.headers.authorization)

    await Message.destroy({
      where : {
        id: req.params.messageId,
        UserId
      }
    })

    res.status(200).json({ message: 'Message deleted successfully' })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`GET Chatroom by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`POST Chatroom Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.get('/users', jsonParser, async (req, res) => {
  try {
    await checkToken(req.headers.authorization)

    const users = await User.findAll()

    if (users == []) {
      throw {
        status: 404,
        message: 'Not found.',
        extraData: {
          users
        }
      }
    }

    res.status(200).json({
      message: 'Users fetched successfully.',
      users
    })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`GET Chatroom by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`POST Chatroom Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

io.on('connection', socket => {
  console.log('a user connected :D')

  socket.on('disconnect', () => {
    console.log('user disconnected');
  })
})

server.listen(port, () => {
  console.log("server running on port:" + port)
})

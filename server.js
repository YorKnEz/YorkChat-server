const express = require('express')
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()
const multer = require('multer')
const upload = multer({ dest: 'public/' })
const uploadMessage = multer({ dest: 'images/' })
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
const { Socket } = require('./database/socket')
const { sequelize, testConnection } = require('./database/sequelize')
const { Console } = require('console')

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
    const user = await User.create({
      email: req.body.email,
      verifiedEmail: req.body.verified_email,
      firstName: req.body.given_name,
      lastName: req.body.family_name,
      name: req.body.name,
      locale: req.body.locale,
      picture: req.body.picture,
    })

    const hash = crypto.createHash('sha256') // create a hash object using sha256 algorithm
    hash.update(String(user.id)) // update the hash content with the user id
    const token = hash.digest('hex') // generate a token by digesting the user id using hex encoding

    await AuthToken.upsert({
      token,
      id: user.id,
    })

    res.status(200).json({ message: 'User created successfully.', user, token })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`Login Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else if (error = 'SequelizeUniqueConstraintError: Validation error') {
      const user = await User.findOne({
        where: {email: req.body.email}
      })

      const token = await AuthToken.findOne({
        where: {id: user.id}
      })

      res.status(200).json({ message: 'User created successfully.', user, token: token.token })
    }
    else {
      console.error(`Login Error: 400 ${error}`)

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
        },
        userCount: { [Op.gt]: 2 }
      }
    })

    let privateChatrooms = await sequelize.query(`
    SELECT "Chatrooms"."id", table3.name, table3.picture,"Chatrooms"."lastMessage", "Chatrooms"."userCount", "Chatrooms"."createdAt", "Chatrooms"."updatedAt"
    FROM "Chatrooms"
    JOIN (
      SELECT table2.chatroomId, table2.otherUserId, u."name" AS name, u."picture" AS picture
      FROM (
        SELECT table1.ChatroomId AS chatroomId, a2."UserId" AS otherUserId
        FROM "ChatroomUsers" a1, "ChatroomUsers" a2, (
          SELECT COUNT(cu."ChatroomId") AS users, cu."ChatroomId" AS ChatroomId
          FROM "ChatroomUsers" AS cu
          GROUP BY ChatroomId
        ) AS table1
        WHERE table1.users = 2
        AND a1."ChatroomId" = a2."ChatroomId"
        AND a1."ChatroomId" = table1.ChatroomId
        AND a1."UserId" != a2."UserId"
        AND a1."UserId" = :id
        ORDER BY table1.ChatroomId
      ) AS table2
      JOIN "Users" AS u ON u."id" = table2.otherUserId
    ) AS table3 ON "Chatrooms"."id" = table3.chatroomId
    `, {
      replacements: {
        id: UserId
      }
    })
    privateChatrooms = privateChatrooms[0]

    console.log(privateChatrooms)

    res.status(200).json({
      message: 'Chatrooms fetched successfully.',
      chatrooms: [...chatrooms, ...privateChatrooms]
    })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`GET Chatrooms Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`GET Chatrooms Error: 400 ${error}`)

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
        lastMessage: req.body.lastMessage,
        userCount: req.body.usersIds.length
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
      console.error(`POST Chatroom Error: ${error.status} ${error.message}`)

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
      console.error(`GET Chatroom by ID Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.get('/chatrooms/:chatroomId/messages', jsonParser, async (req, res) => {
  try {
    await checkToken(req.headers.authorization)

    const messages = await Message.findAll({
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
      console.error(`GET Messages Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`GET Messages Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.get('/chatrooms/:chatroomId/photos', jsonParser, async (req, res) => {
  try {
    await checkToken(req.headers.authorization)

    const photos = await Message.findAll({
      order: [['createdAt', 'DESC']],
      limit: 24,
      where: {
        mediaType: 'image',
        ChatroomId: req.params.chatroomId
      },
    })

    res.status(200).json({
      message: 'Photos fetched successfully.',
      photos
    })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`GET Photos Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`GET Photos Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.post('/chatrooms/:chatroomId/messages', jsonParser, async (req, res) => {
  try {
    const UserId = await checkToken(req.headers.authorization)

    // create the message instance
    const message = await Message.create({
      UserId,
      ChatroomId: req.params.chatroomId,
      content: req.body.content
    })

    // find the chatroom to send the message to
    let chatroom = await Chatroom.findOne({
      where: { id: req.params.chatroomId }
    })

    // update the chatroom's last message
    await Chatroom.update({lastMessage: message.content}, {
      where: {
        id: req.params.chatroomId
      }
    })

    /*
    // find the users in the chatroom
    const users = await ChatroomUser.findAll({
      where: { ChatroomId: req.params.chatroomId }
    })

    // check if the chatroom has only 2 users(private chatroom)
    if (users.length == 2) {
      // find the otehr user's id
      const otherUser = users.find(e => e.UserId != UserId)

      console.log(otherUser)

      // find the socket assigned to otherUser
      const socket = await Socket.findOne({
        where: { UserId: otherUser.UserId }
      })

      // emit the message to him
      io.to(socket.id).emit('NEW_MESSAGE', message)
    }
    */

    // find the users in the chatroom
    let users = await ChatroomUser.findAll({
      where: { ChatroomId: message.ChatroomId }
    })

    // map the user ids
    users = users.map(e => e.UserId)

    // find all the sockets assigned to each user
    let sockets = await Socket.findAll({
      where: {
        UserId: {
          [Op.and]: {
            [Op.in]: users,
            [Op.ne]: UserId
          }
        }
      }
    })

    // implement socket groups

    // create the data
    let data

    if (chatroom.lastMessage) data = {
      message,
      lastMessage: message.content
    }
    else {
      // get the user that sends the message
      const user = await User.findOne({
        where: { id: UserId }
      })
      
      data = {
        chatroom: {
          id: chatroom.id,
          name: user.name,
          picture: user.picture,
          lastMessage: chatroom.lastMessage,
          userCount: chatroom.userCount,
          createdAt: chatroom.createdAt,
          updatedAt: chatroom.updatedAt
        },
        message,
        lastMessage: message.content
      }
    }

    // send the message to all users that are part of the chatroom
    for (const socket of sockets) {
      io.to(socket.id).emit('NEW_MESSAGE', data)
    }

    res.status(200).json({ message: 'Message created successfully.', message })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`POST Message by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`POST Message Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.post('/chatrooms/:chatroomId/messages/image', uploadMessage.single('image'), jsonParser, async (req, res) => {
  try {
    const UserId = await checkToken(req.headers.authorization)

    // create the message instance
    const message = await Message.create({
      UserId,
      ChatroomId: req.params.chatroomId,
      content: req.file.filename,
      mediaType: 'image'
    })

    // find the chatroom to send the message to
    let chatroom = await Chatroom.findOne({
      where: { id: req.params.chatroomId }
    })

    // find the user that sent the photo
    const user = await User.findOne({
      where: { id: UserId }
    })

    // update the chatroom's last message
    await Chatroom.update({lastMessage: user.firstName + ' sent a photo.'}, {
      where: {
        id: req.params.chatroomId
      }
    })

    /*
    // find the users in the chatroom
    const users = await ChatroomUser.findAll({
      where: { ChatroomId: req.params.chatroomId }
    })

    // check if the chatroom has only 2 users(private chatroom)
    if (users.length == 2) {
      // find the otehr user's id
      const otherUser = users.find(e => e.UserId != UserId)

      console.log(otherUser)

      // find the socket assigned to otherUser
      const socket = await Socket.findOne({
        where: { UserId: otherUser.UserId }
      })

      // emit the message to him
      io.to(socket.id).emit('NEW_MESSAGE', message)
    }
    */

    // find the users in the chatroom
    let users = await ChatroomUser.findAll({
      where: { ChatroomId: message.ChatroomId }
    })

    // map the user ids
    users = users.map(e => e.UserId)

    // find all the sockets assigned to each user
    let sockets = await Socket.findAll({
      where: {
        UserId: {
          [Op.and]: {
            [Op.in]: users,
            [Op.ne]: UserId
          }
        }
      }
    })

    // implement socket groups

    // create the data
    let data
    if (chatroom.lastMessage) data = {
      message,
      lastMessage: user.firstName + ' sent a photo.'
    }
    else data = {
      chatroom, 
      message,
      lastMessage: user.firstName + ' sent a photo.'
    }

    // send the message to all users that are part of the chatroom
    for (const socket of sockets) {
      io.to(socket.id).emit('NEW_MESSAGE', data)
    }

    res.status(200).json({ message: 'Message created successfully.', message })
  }
  catch(error) {
    if (error.status && error.message) {
      console.error(`POST Image by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`POST Image Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.use(express.static('images'))

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
      console.error(`DELETE Message by ID Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`DELETE Message Error: 400 ${error}`)

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
      console.error(`GET Users Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`GET Users Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.put('/user/:id', jsonParser, async (req, res) => {
  try {
    await checkToken(req.headers.authorization)

    await User.update({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      name: req.body.name
    }, {
      where: { id: req.params.id }
    })

    res.status(200).json({
      message: 'User updated successfully',
      user: req.body
    })
  }
  catch (error) {
    if (error.status && error.message) {
      console.error(`PUT User Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`PUT User Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.put('/user/:id/avatar', upload.single('profile_image'), async (req, res) => {
  try {
    await checkToken(req.headers.authorization)

    await User.update({
      picture: 'http://192.168.100.13:3000/' + req.file.filename
    }, {
      where: {id: req.params.id}
    })

    res.status(200).json({
      message: 'Avatar updated successfully',
      filename: req.file.filename
    })
  }
  catch (error) {
    if (error.status && error.message) {
      console.error(`PUT Avatar Error: ${error.status} ${error.message}`)

      res.status(error.status).json({ error: error.message, extraData: error.extraData })
    }
    else {
      console.error(`PUT Avatar Error: 400 ${error}`)

      res.status(400).json({ error: 'Bad request.' })
    }
  }
})

app.use(express.static('public'))

io.on('connection', async (socket, data) => {
  console.log('a user connected :D')
  const token = socket.handshake.query.token

  try {
    const user = await AuthToken.findOne({
      where: { token }
    })

    await Socket.upsert({
      id: socket.id,
      UserId: user.id
    })
  }
  catch (error) {
    console.log('socket.js model error:' + error)
  }

  socket.on('disconnect', async () => {
    console.log('user disconnected')

    try {
      await Socket.destroy({
        where: { id: socket.id }
      })
    }
    catch (error) {
      console.log('socket.js model error:' + error)
    }
  })
})

server.listen(port, () => {
  console.log("server running on port:" + port)
})

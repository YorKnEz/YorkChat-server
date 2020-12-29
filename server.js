const express = require('express')
const app = express()
const server = require("http").createServer(app)
const io = require("socket.io")(server)
const port = 3000

const users = []
const socketArr = []

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

app.put('/users', (req, res) => {
  res.send('hello')
})

io.on('connection', socket => {
  console.log('a user connected :D')
  
  socket.on('log in', payload => {
    const found = users.find(user => user.id === payload.id)
    if (!found) {
      users.push(payload)

      app.get('/users', (req, res) => {
        res.send(users)
      })

      console.log('new user added: ' + payload.name + '!')
    } else {
      console.log('user logged in: ' + payload.name + '!')
    }

    const foundSocket = socketArr.find(e => e.userID == payload.id && e.socketID == socket.id)
    if (!foundSocket) {
      socketArr.push({ socketID: socket.id, userID: payload.id })
    }
  })

  // the event that catches the message sent by a user
  socket.on('send message', data => {
    // find the socket to send the message to and the user
    const socketToSend = socketArr.find(e => e.userID = data.otherUserID)

    console.log('Send message to: ' + socketToSend.socketID)
    console.log('Socket that sends: ' + socket.id)

    console.log(socketArr)

    // send the message to the user
    socket.broadcast.to(socketToSend.socketID).emit('new message', {
      user: data.message.sender,
      chatroomID: data.chatroomID,
      message: data.message
    })
  
    console.log('message sent: ' + data.message.content)
  })

  socket.on('log out', () => {
    console.log('user logged out')
  })

  socket.on('disconnect', () => {
    console.log('user disconnected');
  })
})

server.listen(port, () => {
  console.log("server running on port:" + port)
})

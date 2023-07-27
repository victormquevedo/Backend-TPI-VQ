import express from 'express'
import mongoose from 'mongoose'
import { Server } from 'socket.io'
import handlebars from 'express-handlebars'
import session from 'express-session'
import passport from 'passport'
import MongoStore from 'connect-mongo'

import __dirname from './utils.js'
import { initializePassport, initGithub } from './config/passport-config.js'

import productModel from './dao/mongodb/models/products-model.js'
import chatModel from './dao/mongodb/models/chat-model.js'
import productsRouterMongo from './routes/products-router-mongodb.js'
import cartsRouterMongo from './routes/carts-router-mongodb.js'
import viewsRouterMongo from './routes/views-router-mongodb.js'
import chatRouterMongo from './routes/chat-router-mongodb.js'
import sessionRouter from './routes/sessions-router.js'

const PORT = 8080;
const MONGO = `mongodb+srv://victor123:galaxy123@victor.fcbuhio.mongodb.net/?retryWrites=true&w=majority`

const app = express()
const conection = mongoose.connect(MONGO);

const httpServer = app.listen(PORT, () => {
    console.log(`
        The server is online on port: ${ PORT }
    `)
})

app.engine('handlebars', handlebars.engine());
app.set('views', __dirname + '/views');
app.set('view engine', 'handlebars');

app.use(express.static(__dirname + '/public'))
app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.use(session({
    store: new MongoStore({
        mongoUrl: MONGO,
        ttl: 3600
    }),
    secret: 'CoderSecret',
    resave: false,
    saveUninitialized: false
}))

initializePassport()
initGithub()
app.use(passport.initialize())
app.use(passport.session())


app.use('/', viewsRouterMongo);
app.use('/api/products', productsRouterMongo);
app.use('/api/carts', cartsRouterMongo);
app.use('/api/session', sessionRouter);
app.use('/chat', chatRouterMongo);

const io = new Server(httpServer)

let products = await productModel.find().lean()
let mongoDbMessages = await chatModel.find().lean()

io.on('connection', socket => {
    console.log('A user has been connected to the server');


    io.emit('productsList', products)

    socket.on('productToDelete', async productId => {
        await productModel.deleteOne({_id: productId})
        let products = await productModel.find().lean()
        io.emit('productsList', products)
    })
    socket.on('productToAdd', async product => {
        await productModel.create(product)
        let products = await productModel.find().lean()
        io.emit('productsList', products)
    })


    io.emit('updateMessages', mongoDbMessages)

    socket.on('authenticated', async userEmail => {
        io.emit('newUserConnected', userEmail)
    })

    socket.on('userMessage', async message => {
        await chatModel.create(message)
        let chatHistorial = await chatModel.find().lean()
        io.emit('updateMessages', chatHistorial)
    })
})



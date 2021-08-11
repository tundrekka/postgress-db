import 'reflect-metadata'
import express from 'express'
import Redis from 'ioredis'
import session from 'express-session'
import connectRedis from 'connect-redis'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'

import { ApolloServer } from 'apollo-server-express'
import { buildSchema } from 'type-graphql'
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core'
import { PostResolver } from './resolvers/post'
import { UserResolver } from './resolvers/user'
import { COOKIE_NAME, __prod__ } from './constants/constants'
import { createConnection } from 'typeorm'
import { Post } from './entities/Post'
import { User } from './entities/User'
import { Updoot } from './entities/Updoot'
import { createUserLoader } from './utils/createUserLoader'
dotenv.config()
const main = async() => {
   
   await createConnection({
      type: 'postgres',
      url: process.env.DB_URL,
      logging: true,
      synchronize: true,
      entities: [Post, User, Updoot],
      migrations: [path.join(__dirname, './migrations/*')]
   })

   
   const app = express()
   const RedisStore = connectRedis(session)
   const redis = new Redis()

   // app.set("proxy", 1);

   // CORS
   // TODO make origin a Env Variables
   app.use(cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true
   }))

   app.use(
      session({
         name: COOKIE_NAME,
         store: new RedisStore({
            client: redis,
            disableTouch: true,
            disableTTL: true
         }),
         cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 365 * 2,
            httpOnly: true,
            sameSite: 'lax',
            secure: __prod__,
         },
         saveUninitialized: false,
         secret: process.env.SESSION_SECRET,
         resave: false
      })
   )

   // context, schema, plugins
   const apolloServer = new ApolloServer({
      schema: await buildSchema({
         resolvers: [PostResolver, UserResolver],
         validate: false,
      }),
      context: async ({req, res}) => ({ req, res, redis, userLoader: createUserLoader() }), 
      plugins: [
         ApolloServerPluginLandingPageGraphQLPlayground()
      ]
   })

   await apolloServer.start()

   apolloServer.applyMiddleware({ app, cors: false })

   app.listen(process.env.PORT, () => {
      console.log(`server started at localhost: ${process.env.PORT}`)
   })
}  

main().catch(console.error)

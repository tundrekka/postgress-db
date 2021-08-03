import 'reflect-metadata'
import express from 'express'
import Redis from 'ioredis'
import session from 'express-session'
import connectRedis from 'connect-redis'
import cors from 'cors'
import path from 'path'
// import 'dotenv'

import { ApolloServer } from 'apollo-server-express'
import { buildSchema } from 'type-graphql'
import { HelloResolver } from './resolvers/hello'
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core'
import { PostResolver } from './resolvers/post'
import { UserResolver } from './resolvers/user'
import { COOKIE_NAME, __prod__ } from './constants/constants'
import { createConnection } from 'typeorm'
import { Post } from './entities/Post'
import { User } from './entities/User'
import { Updoot } from './entities/Updoot'
import { createUserLoader } from './utils/createUserLoader'
const main = async() => {
   await createConnection({
      type: 'postgres',
      database: 'lireddit2',
      username: 'gql-user',
      password: 'gql-user',
      logging: true,
      synchronize: true,
      entities: [Post, User, Updoot],
      migrations: [path.join(__dirname, './migrations/*')]
   })
   // await conn.runMigrations()
   
   const app = express()
   const RedisStore = connectRedis(session)
   const redis = new Redis()


   // cors
   // TODO make origin a Env Variables
   app.use(cors({
      origin: 'http://localhost:3000',
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
         secret: 'randomstringrandomstringsecretstring',
         resave: false
      })
   )

   // context, schema, plugins
   const apolloServer = new ApolloServer({
      schema: await buildSchema({
         resolvers: [HelloResolver, PostResolver, UserResolver],
         validate: false,
      }),
      context: async ({req, res}) => ({ req, res, redis, userLoader: createUserLoader() }), 
      plugins: [
         ApolloServerPluginLandingPageGraphQLPlayground()
      ]
   })

   await apolloServer.start()

   apolloServer.applyMiddleware({ app, cors: false })

   // TODO make port a Env Variables
   app.listen(4001, () => {
      console.log('server started at localhost: 4001')
   })
}  

main().catch(console.error)

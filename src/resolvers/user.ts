import argon2 from 'argon2'
import { User } from '../entities/User'
import { MyContext } from 'src/types'
import {
   Query,
   Resolver,
   Mutation,
   Field,
   Arg,
   Ctx,
   ObjectType,
   FieldResolver,
   Root,
} from 'type-graphql'
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from '../constants/constants'
import { UsernamePasswordInput } from './UsernamePasswordInput'
import { validateRegister } from '../utils/validateRegister'
import { sendEmail } from '../utils/sendEmail'
import { v4 } from 'uuid'
import { getConnection } from 'typeorm'

@ObjectType()
class FieldError {
   @Field()
   field: string
   @Field()
   message: string
}

@ObjectType()
class UserResponse {
   @Field(() => [FieldError], { nullable: true })
   errors?: FieldError[]

   @Field(() => User, { nullable: true })
   user?: User
}

@Resolver(User)
export class UserResolver {
   @FieldResolver(() => String)
   email(@Root() user: User, @Ctx() {req}: MyContext) {
      if(req.session.userId === user.id) {
         return user.email
      }
      return ""
   }

   // change password
   @Mutation(() => UserResponse)
   async changePassword(
      @Arg('token') token: string,
      @Arg('newPassword') newPassword: string,
      @Ctx() { redis, req }: MyContext
   ): Promise<UserResponse> {

      if (newPassword.length <= 6) {
         return {
            errors: [
               {
                  field: 'newPassword',
                  message: 'length must be greater than 6',
               },
            ]
         }
      }
      const key = FORGOT_PASSWORD_PREFIX + token
      const userId = await redis.get(key)
      if(!userId) {
         return {
            errors: [
               {
                  field: 'token',
                  message: 'token expired',
               },
            ]
         }
      }

      const userIdNum = parseInt(userId)
      const user = await User.findOne(userIdNum)
      if(!user) {
         return {
            errors: [
               {
                  field: 'token',
                  message: 'user no longer exists',
               },
            ]
         }
      }

      await User.update({id: userIdNum}, {password: await argon2.hash(newPassword)})
      await redis.del(key)
      req.session.userId = user.id
      return { user }
   }

   // forgot password
   @Mutation(() => Boolean)
   async forgotPassword(
      @Arg('email') email: string,
      @Ctx() { redis }: MyContext
   ) {
      const user = await User.findOne({ where: { email }})
      if (!user) {
         // the email does not exist in db
         return true
      }
      const token = v4()

      await redis.set(
         FORGOT_PASSWORD_PREFIX + token,
         user.id,
         'ex',
         1000 * 60 * 60 * 24 * 3
      ) // 3 days

      await sendEmail(
         email,
         `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
      )

      return true
   }

   //Me
   @Query(() => User, { nullable: true })
   me(@Ctx() { req }: MyContext) {
      if (!req.session.userId) {
         // not logged in
         return null
      }

      return User.findOne( req.session.userId )
   }

   // register user
   @Mutation(() => UserResponse)
   async register(
      @Arg('options', () => UsernamePasswordInput)
      options: UsernamePasswordInput,
      @Ctx() { req }: MyContext
   ): Promise<UserResponse> {
      // validating data
      const errors = validateRegister(options)
      if (errors) {
         return { errors }
      }

      const hashedPassword = await argon2.hash(options.password)

      let user
      try {
         const result = await getConnection()
            .createQueryBuilder()
            .insert()
            .into(User)
            .values({
               username: options.username,
               email: options.email,
               password: hashedPassword
            })
            .returning('*')
            .execute()
         user = result.raw[0]
      } catch (error) {
         if (error.code === '23505') {
            return {
               errors: [
                  {
                     field: 'username',
                     message: 'the username already exists',
                  },
               ],
            }
         }
      }

      // set a cookie to keep the user logged in
      req.session.userId = user.id

      return {
         user,
      }
   }

   // login user
   @Mutation(() => UserResponse)
   async login(
      @Arg('usernameOrEmail') usernameOrEmail: string,
      @Arg('password') password: string,
      @Ctx() { req }: MyContext
   ): Promise<UserResponse> {
      const user = await User.findOne(
         usernameOrEmail.includes('@')
            ? { where: { email: usernameOrEmail } }
            : { where: { username: usernameOrEmail } }
      )

      if (!user) {
         return {
            errors: [
               {
                  field: 'usernameOrEmail',
                  message: 'that user does not exist',
               },
            ],
         }
      }

      try {
         const valid = await argon2.verify(user.password, password)
         console.log(valid)
         if (!valid) {
            return {
               errors: [
                  {
                     field: 'password',
                     message: 'Invalid validation',
                  },
               ],
            }
         }
      } catch (error) {
         console.log(error.message)
      }

      req.session.userId = user.id
      return {
         user,
      }
   }

   // logout
   @Mutation(() => Boolean)
   logout(@Ctx() { req, res }: MyContext) {
      return new Promise((resolve) => {
         res.clearCookie(COOKIE_NAME)
         req.session.destroy((err) => {
            if (err) {
               console.log(err)
               resolve(false)
               return
            }
            resolve(true)
         })
      })
   }
}

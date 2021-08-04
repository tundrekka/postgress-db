import { Post } from '../entities/Post'
import {
   Resolver,
   Query,
   Arg,
   Int,
   Mutation,
   InputType,
   Field,
   Ctx,
   UseMiddleware,
   FieldResolver,
   Root,
   ObjectType,
} from 'type-graphql'
import { MyContext } from 'src/types'
import { isAuth } from '../middlewares/isAuth'
import { getConnection } from 'typeorm'
import { Updoot } from '../entities/Updoot'
import { User } from '../entities/User'

@InputType()
class PostInput {
   @Field()
   title: string
   @Field()
   text: string
}

@ObjectType()
class PaginatedPosts {
   @Field(() => [Post])
   posts: Post[]
   @Field()
   hasMore: boolean
}

@Resolver(Post)
export class PostResolver {
   // just load a part of the content, better perfomance
   // here we are slicing the text to dont load all the data
   @FieldResolver(() => String)
   textSnippet(@Root() root: Post) {
      return root.text.slice(0, 50)
   }

   @FieldResolver(() => User)
   creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
      return userLoader.load(post.creatorId)
   }

   @Mutation(() => Boolean)
   @UseMiddleware(isAuth)
   async vote(
      @Arg('postId', () => Int) postId: number,
      @Arg('value', () => Int) value: number,
      @Ctx() { req }: MyContext
   ) {
      const isUpdoot = value !== -1
      const realValue = isUpdoot ? 1 : -1
      const { userId } = req.session
      const updoot = await Updoot.findOne({ where: { postId, userId } })

      // the user has voted on the post before
      // and they are changing their vote
      if (updoot && updoot.value !== realValue) {
         await getConnection().transaction(async (tm) => {
            await tm.query(
               `
            update updoot
            set value = $1
            where "postId" = $2 and "userId" = $3
            `,
               [realValue, postId, userId]
            )
         })
         await getConnection().transaction(async (tm) => {
            await tm.query(
               `
            update post
            set points = points + $1
            where id = $2
            `,
               [2 * realValue, postId]
            )
         })
      } else if (!updoot) {
         // has never voted before
         await getConnection().transaction(async (tm) => {
            await tm.query(
               `
               insert into updoot ("userId", "postId", value)
               values ($1, $2, $3)
               `,
               [userId, postId, realValue]
            )
            await tm.query(
               `
               update post
               set points = points + $1
               where id = $2
               `,
               [realValue, postId]
            )
         })
      }

      return true
   }

   // get all posts
   @Query(() => PaginatedPosts)
   async posts(
      @Arg('limit', () => Int) limit: number,
      @Arg('cursor', () => String, { nullable: true }) cursor: string | null,
      @Ctx() { req }: MyContext
   ): Promise<PaginatedPosts> {
      const realLimit = Math.min(50, limit)
      const realLimitPlusOne = realLimit + 1
      const replacements: any[] = [realLimitPlusOne]
      if (req.session.userId) {
         replacements.push(req.session.userId)
      }
      let cursorIdx = 3
      if (cursor) {
         replacements.push(new Date(parseInt(cursor)))
         cursorIdx = replacements.length
      }

      const posts = await getConnection().query(
         `select p.*,
      ${
         req.session.userId
            ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"'
            : 'null as "voteStatus"'
      }
      from post p
      ${cursor ? `where p."createdAt" < $${cursorIdx}` : ''}
      order by p."createdAt" DESC 
      limit $1
      `,
         replacements
      )

      return {
         posts: posts.slice(0, realLimit),
         hasMore: posts.length === realLimitPlusOne,
      }
   }

   // get one user posts
   @Query(() => PaginatedPosts)
   async userPosts(
      @Arg('uid', () => Int) uid: number,
      @Arg('limit', () => Int) limit: number,
      @Arg('cursor', () => String, { nullable: true }) cursor: string | null,
      @Ctx() { req }: MyContext
   ): Promise<PaginatedPosts> {
      const realLimit = Math.min(50, limit)
      const realLimitPlusOne = realLimit + 1
      const replacements: any[] = [realLimitPlusOne]
      if (req.session.userId) {
         replacements.push(req.session.userId)
      }
      let cursorIdx = 3
      let uidIdx = cursorIdx
      if (cursor) {
         replacements.push(new Date(parseInt(cursor)))
         cursorIdx = replacements.length
         uidIdx = cursorIdx + 1
      } else if(!req.session.userId) {
         uidIdx = cursorIdx -1
      }
      replacements.push(uid)
      const posts = await getConnection().query(
         `select p.*,
      ${
         req.session.userId
            ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"'
            : 'null as "voteStatus"'
      }
      from post p
      ${cursor ? `where p."createdAt" < $${cursorIdx} and p."creatorId" = $${uidIdx}` : `where p."creatorId" = $${uidIdx}`}
      order by p."createdAt" DESC 
      limit $1
      `,
         replacements
      )

      return {
         posts: posts.slice(0, realLimit),
         hasMore: posts.length === realLimitPlusOne,
      }
   }

   // get a single post
   @Query(() => Post, { nullable: true }) // graphql return type
   post(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
      return Post.findOne(id)
   }

   // create a post
   @Mutation(() => Post) // graphql decorator
   @UseMiddleware(isAuth) // middleware
   async createPost(
      @Arg('input') input: PostInput,
      @Ctx() { req }: MyContext
   ): Promise<Post | undefined> {
      if(input.title.length < 2) {
         return
      }
      if (input.title.length > 70) {
         return
      }
      if(input.text.length < 25) {
         return
      }
      return Post.create({
         ...input,
         creatorId: req.session.userId,
      }).save()
   }

   // update post
   @Mutation(() => Post, { nullable: true }) // graphql decorator
   @UseMiddleware(isAuth)
   async updatePost(
      @Arg('id', () => Int) id: number,
      @Arg('title') title: string,
      @Arg('text') text: string,
      @Ctx() { req }: MyContext
   ): Promise<Post | null> {
      const result = await getConnection()
         .createQueryBuilder()
         .update(Post)
         .set({ title, text })
         .where('id = :id and "creatorId" = :creatorId', {
            id,
            creatorId: req.session.userId,
         })
         .returning('*')
         .execute()
      return result.raw[0]

      // await Post.update({ id, creatorId: req.session.userId }, { title, text })
   }

   // delete post
   @Mutation(() => Boolean) // graphql decorator
   @UseMiddleware(isAuth)
   async deletePost(
      @Arg('id', () => Int) id: number,
      @Ctx() { req }: MyContext
   ): Promise<boolean> {
      try {
         const post = await Post.findOne(id)
         if (!post) {
            return false
         }
         if (post.creatorId !== req.session.userId) {
            throw new Error('not authorized')
         }
         await Updoot.delete({ postId: id })
         await Post.delete({ id })
         return true
      } catch (error) {
         return false
      }
   }
}

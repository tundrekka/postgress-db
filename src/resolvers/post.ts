import { Post } from "../entities/Post";
import { Resolver, Query, Arg, Int, Mutation, InputType, Field, Ctx, UseMiddleware, FieldResolver, Root, ObjectType } from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "../middlewares/isAuth";
import { getConnection } from "typeorm";
import { Updoot } from "../entities/Updoot";

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

   @Mutation(() => Boolean)
   @UseMiddleware(isAuth)
   async vote(
      @Arg('postId', () => Int) postId: number,
      @Arg('value', () => Int) value: number,
      @Ctx() {req}: MyContext
   ) {
      const isUpdoot = value !== -1;
      const realValue = isUpdoot ? 1 : -1;
      const { userId } = req.session
      const updoot = await Updoot.findOne({where: {postId, userId}})

      // the user has voted on the post before
      // and they are changing their vote
      if(updoot && updoot.value !== realValue ) {
         await getConnection().transaction(async (tm) => {
            await tm.query(`
            update updoot
            set value = $1
            where "postId" = $2 and "userId" = $3
            `, [ realValue, postId, userId ])
         })
         await getConnection().transaction(async (tm) => {
            await tm.query(`
            update post
            set points = points + $1
            where id = $2
            `, [2 * realValue, postId ])
         })
      } else if(!updoot) {
         // has never voted before
         await getConnection().transaction(async (tm) => {
            await tm.query(
               `
               insert into updoot ("userId", "postId", value)
               values ($1, $2, $3)
               `,
               [ userId ,postId ,realValue ]
            )
            await tm.query(
               `
               update post
               set points = points + $1
               where id = $2
               `,
               [ realValue, postId ]
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
      @Ctx() {req} : MyContext
   ): Promise<PaginatedPosts> {
      const realLimit = Math.min(50, limit)
      const realLimitPlusOne = realLimit + 1
      const replacements: any[] = [realLimitPlusOne]
      if(req.session.userId) {
         replacements.push(req.session.userId)
      }  
      let cursorIdx = 3
      if(cursor) {
         replacements.push(new Date(parseInt(cursor)))
         cursorIdx = replacements.length
      }

      const posts = await getConnection().query(
      `select p.*,
      json_build_object(
         'id', u.id,
         'username', u.username,
         'email', u.email,
         'createdAt', u."createdAt",
         'updatedAt', u."updatedAt"
         ) creator,
         ${
            req.session.userId
            ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"'
            : 'null as "voteStatus"'
         }
      from post p
      inner join public.user u on u.id = p."creatorId"
      ${cursor ? `where p."createdAt" < $${cursorIdx}` : ""}
      order by p."createdAt" DESC 
      limit $1
      `, replacements)

      return {
         posts: posts.slice(0, realLimit),
         hasMore: posts.length === realLimitPlusOne
      }
   }

   // get a single pos
   @Query(() => Post, {nullable: true}) // graphql return type
   post(
      @Arg('id', () => Int) id: number,
   ): Promise<Post | undefined> {
      return Post.findOne(id);
   }

   // create a post
   @Mutation(() => Post) // graphql decorator
   @UseMiddleware(isAuth) // middleware
   async createPost(
      @Arg('input') input: PostInput,
      @Ctx() { req }: MyContext
   ): Promise<Post> {
      return Post.create({
         ...input,
         creatorId: req.session.userId
      }).save();
   }

   // update post
   @Mutation(() => Post, {nullable: true}) // graphql decorator
   async updatePost(
      @Arg('id') id: number,
      @Arg('title', () => String, {nullable: true}) title: string,
   ): Promise<Post | null> {
      const post = await Post.findOne(id)
      if(!post) {
         return null
      }
      if(typeof title !== 'undefined') {
         await Post.update({id}, {title})
      }
      return post;
   }

   // delete post
   @Mutation(() => Boolean) // graphql decorator
   async deletePost(
      @Arg('id') id: number,
   ): Promise< boolean > {
      try {
         await Post.delete(id)
         return true;
      } catch (error) {
         return false
      }
   }
}

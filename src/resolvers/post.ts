import { Post } from "../entities/Post";
import { Resolver, Query, Arg, Int, Mutation, InputType, Field, Ctx, UseMiddleware } from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "../middlewares/isAuth";
import { getConnection } from "typeorm";

@InputType()
class PostInput {
   @Field()
   title: string
   @Field()
   text: string
}

@Resolver()
export class PostResolver {
   
   // get all posts
   @Query(() => [Post])
   posts(
      @Arg('limit', () => Int) limit: number,
      @Arg('cursor', () => String, { nullable: true }) cursor: string | null
   ): Promise<Post[]> {
      const realLimit = Math.min(50, limit)
      const queryBuilder =  getConnection()
         .getRepository(Post)
         .createQueryBuilder('p')
         .orderBy('"createdAt"', 'DESC')
         .take(realLimit)
         
      if(cursor) {
         queryBuilder.where('"createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) })
      }
      return queryBuilder.getMany()
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

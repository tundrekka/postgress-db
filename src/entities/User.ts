import { Field, ObjectType } from "type-graphql";
import { BaseEntity, Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Post } from "./Post";
@ObjectType()
@Entity()
export class User extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @Column({type: 'text', unique: true})
  username!: string;

  @Field()
  @Column({type: 'text', unique: true})
  email!: string;

  @Column({type: 'text'})
  password!: string;

  @OneToMany(() => Post, post => post.creator)
  posts: Post[]

  @Field(() => String) // campo accesible para graphql
  @CreateDateColumn() // propiedad en la base de datos
  createdAt: Date

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;

}
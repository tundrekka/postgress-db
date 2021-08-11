# Tunder App Backend

Developed with:
- NodeJS
- Postgresql
- TypeORM
- Apollo, Express, Redis, Graphql, Type-graphql, Nodemailer, Typescript, and other libraries

### Some Features
- It has Register, login, and password recovery support.
- You can log in either with your username or your email
- The session is managed with redis and a cookie
- Protection for user's private data, like the email
- You can only Update or delete a post if you are the creator
- FieldResolver for big size data, to send back a lighter response to the client side, improving the performance


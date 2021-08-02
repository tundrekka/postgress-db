import { Request, Response } from "express";
import session from "express-session";
import { Redis } from "ioredis";
import { createUserLoader } from "./utils/createUserLoader";

type MySessionType = session.Session & {userId: number}

export type MyContext = {
   req: Request & {
      session: MySessionType
   },
   res: Response
   redis: Redis
   userLoader: ReturnType<typeof createUserLoader>
}
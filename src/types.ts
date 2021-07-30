import { Request, Response } from "express";
import session from "express-session";
import { Redis } from "ioredis";

type MySessionType = session.Session & {userId: number}

export type MyContext = {
   req: Request & {
      session: MySessionType
   },
   res: Response
   redis: Redis
}
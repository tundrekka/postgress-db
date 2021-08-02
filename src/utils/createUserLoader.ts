import DataLoader from "dataloader";
import { User } from "../entities/User";

export const createUserLoader = () => new DataLoader<number, User>(async (usersIds) => {
   const users = await User.findByIds(usersIds as number[]) 
   const userIdToUser: Record<number, User> = {}
   users.forEach((u) => {
      userIdToUser[u.id] = u
   })
   const sortedUsers = usersIds.map((userId) => userIdToUser[userId])
   // console.log('usersIds: ', usersIds)
   // console.log('map: ', userIdToUser)
   // console.log('sortedUsers: ', sortedUsers)
   return sortedUsers
})
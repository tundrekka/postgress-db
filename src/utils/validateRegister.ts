import { UsernamePasswordInput } from 'src/resolvers/UsernamePasswordInput'

export const validateRegister = (options: UsernamePasswordInput) => {
   if (options.username.length <= 2) {
      return [
         {
            field: 'username',
            message: 'length must be greater than 2',
         },
      ]
   }
   if (!options.email.includes('@')) {
      return [
         {
            field: 'email',
            message: 'Invalid Email',
         },
      ]
   }

   if (options.password.length <= 6) {
      return [
         {
            field: 'password',
            message: 'length must be greater than 6',
         },
      ]
   }

   if (options.username.includes('@')) {
      return [
         {
            field: 'username',
            message: 'username can not include an @',
         },
      ]
   }
   return null
}

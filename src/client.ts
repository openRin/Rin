// client.ts
import { treaty } from '@elysiajs/eden'
import type { App } from './server'

const client = treaty<App>('localhost:3001')

// response: Hi Elysia
// const { data } = await client.post.index.get()
// console.log(data)

const { data: user, error } = await client.user.profile.get({
    headers: {
        Cookie: 'token=eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.n8UqkUZP4MMkoJen-arZCjjYuVTJPHm34WniQzUjhRM'
    }
})
console.log(error?.value)
console.log(user) 
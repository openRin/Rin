import { treaty } from '@elysiajs/eden'
import { describe, expect, it } from 'bun:test'
import { app } from '../src/server'


const client = treaty(app)
describe('Post', () => {
    it('List all posts', async () => {
        const { data, error } = await client.post.index.get()
        expect(error).toBeNull()
        expect(data?.length).toBe(0)
    })
    it('Create new post', async () => {
        const { data, error } = await client.post.index.post({
            title: 'hi',
            content: 'hi',
            draft: false
        })
        expect(error).toBeNull()
        expect(data).toBe(1)
    })
    it('List all posts', async () => {
        const { data, error } = await client.post.index.get()
        expect(error).toBeNull()
        expect(data?.length).toBe(1)
        expect(data?.[0].title).toBe('hi')
    })
})

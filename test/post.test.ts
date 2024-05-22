import { treaty } from '@elysiajs/eden';
import { describe, expect, it } from 'bun:test';
import { app } from '../src/server';
import { Cookie } from 'elysia';

const client = treaty(app)
describe('Post', () => {
    it('List all posts', async () => {
        const { data, error } = await client.post.index.get()
        expect(error).toBeNull()
        expect(data?.length).toBe(0)
    })
    it('Create new post with admin', async () => {
        const admin = {
            uid: 1,
            admin: true
        }
        const { data, error } = await client.post.index.post({
            title: 'hi',
            content: 'hi',
            draft: false
        }, {
            headers: {
                Cookie: `token=${JSON.stringify(admin)}`
            }
        })
        expect(error).toBeNull()
        expect(data).toBe(1)
    })
    it('Create new post without admin', async () => {
        const user = {
            uid: 1,
            admin: false
        }
        const { data, error } = await client.post.index.post({
            title: 'hi',
            content: 'hi',
            draft: false
        }, {
            headers: {
                Cookie: `token=${JSON.stringify(user)}`
            }
        })
        expect(error?.status).toBe(403)
        expect(data).toBeNull()
    })
    it('List all posts', async () => {
        const { data, error } = await client.post.index.get()
        expect(error).toBeNull()
        expect(data?.length).toBe(1)
        expect(data?.[0].title).toBe('hi')
    })
})

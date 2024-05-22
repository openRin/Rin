import { treaty } from '@elysiajs/eden';
import { describe, expect, it } from 'bun:test';
import { app } from '../src/server';

const client = treaty(app)
describe('feed', () => {
    it('List all feeds', async () => {
        const { data, error } = await client.feed.index.get()
        expect(error).toBeNull()
        expect(data?.length).toBe(0)
    })
    it('Create new feed with admin', async () => {
        const admin = {
            uid: 1,
            admin: true
        }
        const { data, error } = await client.feed.index.post({
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
    it('Create new feed without admin', async () => {
        const user = {
            uid: 1,
            admin: false
        }
        const { data, error } = await client.feed.index.post({
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
    it('List all feeds', async () => {
        const { data, error } = await client.feed.index.get()
        expect(error).toBeNull()
        expect(data?.length).toBe(1)
        expect(data?.[0].title).toBe('hi')
    })
    it('Get feed by id', async () => {
        const { data, error } = await client.feed({ id: 1 }).get()
        expect(error).toBeNull()
        expect(data).not.toBeString()
        if (typeof data != 'string')
            expect(data?.title).toBe('hi')
    })
    it('Get feed by wrong id', async () => {
        const { data, error } = await client.feed({ id: 100 }).get()
        expect(error?.status).toBe(404)
        expect(data).toBeNull()
    })
})

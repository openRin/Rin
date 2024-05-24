import { treaty } from '@elysiajs/eden';
import { describe, expect, it } from 'bun:test';
import { app } from '../src/server';

const client = treaty(app)
describe('🐙 Feed', () => {
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
            draft: false,
            tags: ['test', 'test2']
        }, {
            headers: {
                Authorization: `Bearer ${JSON.stringify(admin)}`
            }
        })
        expect(error).toBeNull()
        expect(data).toEqual({ insertedId: 1 })
    })
    it('Create new feed without admin', async () => {
        const user = {
            uid: 1,
            admin: false
        }
        const { data, error } = await client.feed.index.post({
            title: 'hi',
            content: 'hi',
            draft: false,
            tags: ['test', 'test2']
        }, {
            headers: {
                Authorization: `Bearer ${JSON.stringify(user)}`
            }
        })
        expect(error?.value).toBe("Permission denied")
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

describe('🧼 Tag', () => {
    it('List all tags', async () => {
        const { data, error } = await client.tag.index.get()
        expect(error).toBeNull()
        expect(data?.length).toBe(2)
    })

    it('Get tag by name', async () => {
        const { data, error } = await client.tag({ name: 'test' }).get()
        expect(error).toBeNull()
        expect(data).not.toBeString()
        if (typeof data != 'string')
            expect(data?.name).toBe('test')
    })
    it('Get tag by non-exist name', async () => {
        const { data, error } = await client.tag({ name: 'nop' }).get()
        expect(error?.status).toBe(404)
        expect(data).toBeNull()
    })
})
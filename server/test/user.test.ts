import { treaty } from '@elysiajs/eden';
import jwt from '@elysiajs/jwt';
import { describe, expect, it } from 'bun:test';
import { t } from 'elysia';
import db from '../src/db/db';
import { users } from '../src/db/schema';
import { app } from '../src/server';

const client = treaty(app)
describe('😋 UserService', () => {
    it('OAuth', async () => {
        const { headers, error } = await client.user.github.get()
        expect(error?.status).toBe(302)
        if (headers instanceof Headers) {
            headers.forEach((value, key) => {
                if (key !== 'location') return
                expect(value).toStartWith('https://github.com/login/oauth/authorize')
            })
        }
    })
    it('OAuth Callback', async () => {
        const { headers, error } = await client.user.github.callback.get({
            headers: {
                Cookie: 'token=test'
            }
        })
        expect(error?.status).toBe(500)
    })
    it('Test Derive in prod mode', async () => {
        process.env.NODE_ENV = 'production'
        const admin = {
            uid: 1,
            admin: true
        }
        const { error } = await client.feed.index.post({
            title: 'hi',
            content: 'hi',
            draft: false,
            tags: ['test', 'test2']
        }, {
            headers: {
                Authorization: `Bearer ${JSON.stringify(admin)}`
            }
        })
        expect(error?.status).toBe(403)
    })
    it('Test Derive in prod mode & exist user', async () => {
        process.env.NODE_ENV = 'production'
        const _jwt = await jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET ?? '',
            schema: t.Object({
                id: t.Integer(),
            })
        }).decorator.jwt
        let token = await _jwt.sign({ id: 1 })
        const { error } = await client.feed.index.post({
            title: 'hi',
            content: 'hi',
            draft: false,
            tags: ['test', 'test2']
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
        expect(error?.status).toBe(403)
        const result = await db.insert(users).values({
            openid: "001",
            username: 'test',
            avatar: 'test',
            permission: 1
        }).returning({ insertedId: users.id })
        expect(result.length).toBe(1)
        if (result.length === 1) {
            token = await _jwt.sign({ id: result[0].insertedId })
            const { error } = await client.feed.index.post({
                title: 'hi',
                content: 'hi',
                draft: false,
                tags: ['test', 'test3']
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
            expect(error?.status).toBe(400)
            expect(error?.value).toBe('Content already exists')
        }
    })
});
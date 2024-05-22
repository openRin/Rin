import { edenFetch } from '@elysiajs/eden';
import { describe, expect, it } from 'bun:test';
import { app, type App } from '../src/server';

const client = edenFetch<App>('http://localhost:3001/')
describe('server', () => {
    it('Not found', async () => {
        const response = await app
            .handle(new Request('http://localhost/not-found'))
        expect(response.status).toBe(404)
    })
    it('Vite', async () => {
        const response = await app
            .handle(new Request('http://localhost/app/'))
        expect(response.status).toBe(200)
    })
})
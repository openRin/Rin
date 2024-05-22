import { describe, expect, it } from 'bun:test';
import { app } from '../src/server';

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
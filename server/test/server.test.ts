import { describe, expect, it } from 'bun:test';
import { app } from '../src/server';

describe('🐻 Server', () => {
    it('Not found', async () => {
        const response = await app
            .handle(new Request('http://localhost/not-found'))
        expect(response.status).toBe(404)
    })
})
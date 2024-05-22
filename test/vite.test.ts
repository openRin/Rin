import { describe, expect, it } from 'bun:test';
import { elysiaVite } from '../src/static/vite';

describe('vite', () => {
    it('Bad Vite Config', async () => {
        const viteApp = elysiaVite({
            base: '/app',
            viteConfigFile: `${import.meta.dir}/vite.config.ts`,
            entryHtmlFile: `${import.meta.dir}/client/index.html`,
            entryClientFile: `${import.meta.dir}/client/main.tsx`,
        })
        const response = await viteApp.handle(new Request('http://localhost/app/'))
        expect(response.status).toBe(404)
    })
    it('Vite Config', async () => {
        const app_dir = import.meta.dir.substring(0, import.meta.dir.lastIndexOf('/'))
        const viteApp = elysiaVite({
            base: '/app',
            viteConfigFilePath: `${app_dir}/vite.config.ts`,
            entryHtmlFile: `${app_dir}/src/client/index.html`,
            entryClientFile: `${app_dir}/src/client/main.tsx`,
        })
        const response = await viteApp.handle(new Request('http://localhost/app/'))
        expect(response.status).toBe(200)
    })
})
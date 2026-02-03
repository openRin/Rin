import cors from "@elysiajs/cors";
import serverTiming from "@elysiajs/server-timing";
import Elysia from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { createSetupPlugin } from "./setup";
import { env } from 'cloudflare:workers'

const basePlugin = new Elysia({
    name: "base-plugin",
    adapter: CloudflareAdapter
})
    .use(cors({
        aot: false,
        origin: '*',
        methods: '*',
        allowedHeaders: [
            'authorization',
            'content-type'
        ],
        maxAge: 600,
        credentials: true,
        preflight: true
    }))
    .use(serverTiming({
        enabled: true,
    }))
    .use(createSetupPlugin(env))

export default () => new Elysia({
    adapter: CloudflareAdapter
})
    .use(basePlugin)
import cors from "@elysiajs/cors";
import serverTiming from "@elysiajs/server-timing";
import { env } from 'cloudflare:workers';
import Elysia from "elysia";
import { createSetupPlugin } from "./setup";

const basePlugin = () => new Elysia({
    name: "base-plugin",
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

export default () => new Elysia({
    aot: false
})
    .use(basePlugin())
    .use(createSetupPlugin(env))
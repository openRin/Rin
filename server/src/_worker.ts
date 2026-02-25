import { handleFetch } from "./runtime/fetch-handler";
import { handleScheduled } from "./runtime/scheduled-handler";

export default {
    async fetch(
        request: Request,
        env: Env,
    ): Promise<Response> {
        return handleFetch(request, env);
    },

    async scheduled(
        _controller: ScheduledController | null,
        env: Env,
        ctx: ExecutionContext
    ) {
        return handleScheduled(_controller, env, ctx);
    },
}

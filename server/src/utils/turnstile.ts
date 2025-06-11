import { getEnv } from './di';

export async function verifyTurnstile(token: string) {
    const env = getEnv();
    if (!env.TURNSTILE_SECRET) {
        console.warn('TURNSTILE_SECRET not set');
        return true;
    }
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', token);
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: form
    });
    try {
        const data = await resp.json<any>();
        return !!data.success;
    } catch {
        return false;
    }
}

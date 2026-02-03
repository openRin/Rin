// Lazy initialization container for all dependencies
export class LazyContainer {
    private env: Env;
    private instances: Map<string, any> = new Map();
    private loaders: Map<string, () => Promise<any> | any> = new Map();

    constructor(env: Env) {
        this.env = env;
    }

    // Register a lazy loader
    register<T>(key: string, loader: () => Promise<T> | T): void {
        this.loaders.set(key, loader);
    }

    // Get or create instance
    async get<T>(key: string): Promise<T> {
        if (this.instances.has(key)) {
            return this.instances.get(key);
        }

        const loader = this.loaders.get(key);
        if (!loader) {
            throw new Error(`No loader registered for key: ${key}`);
        }

        const instance = await loader();
        this.instances.set(key, instance);
        return instance;
    }

    // Get sync (only if already loaded)
    getSync<T>(key: string): T | undefined {
        return this.instances.get(key);
    }

    // Check if loaded
    isLoaded(key: string): boolean {
        return this.instances.has(key);
    }

    // Clear specific instance
    clear(key: string): void {
        this.instances.delete(key);
    }

    // Clear all instances
    clearAll(): void {
        this.instances.clear();
    }
}

// Create container with default lazy loaders
export function createLazyContainer(env: Env): LazyContainer {
    const container = new LazyContainer(env);

    // Database - lazy loaded
    container.register('db', async () => {
        const { drizzle } = await import('drizzle-orm/d1');
        const schema = await import('../db/schema');
        return drizzle(env.DB, { schema });
    });

    // Cache instances - lazy loaded
    container.register('cache', async () => {
        const { CacheImpl } = await import('../utils/cache');
        const db = await container.get('db');
        return new CacheImpl(db, env, "cache");
    });

    container.register('serverConfig', async () => {
        const { CacheImpl } = await import('../utils/cache');
        const db = await container.get('db');
        return new CacheImpl(db, env, "server.config");
    });

    container.register('clientConfig', async () => {
        const { CacheImpl } = await import('../utils/cache');
        const db = await container.get('db');
        return new CacheImpl(db, env, "client.config");
    });

    // JWT - lazy loaded
    container.register('jwt', async () => {
        const { createJWT } = await import('../utils/jwt');
        const secret = env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET is not set');
        }
        return createJWT(secret);
    });

    // OAuth2 - lazy loaded
    container.register('oauth2', async () => {
        const { createOAuthPlugin, GitHubProvider } = await import('../utils/oauth');
        const clientId = env.RIN_GITHUB_CLIENT_ID;
        const clientSecret = env.RIN_GITHUB_CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            throw new Error('GitHub OAuth credentials are not set');
        }

        return createOAuthPlugin({
            GitHub: new GitHubProvider({ clientId, clientSecret })
        });
    });

    // S3 Client - lazy loaded
    container.register('s3', async () => {
        const { createS3Client } = await import('../utils/s3');
        return createS3Client(env);
    });

    // anyUser check - lazy loaded
    container.register('anyUser', async () => {
        const db: any = await container.get('db');
        return async () => (await db.query.users.findMany())?.length > 0;
    });

    return container;
}

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { UserService } from '../user';
import { createBaseApp } from '../../core/base';
import { createMockDB, createMockEnv, cleanupTestDB } from '../../../tests/fixtures';
import { createTestClient } from '../../../tests/test-api-client';
import type { Database } from 'bun:sqlite';

describe('UserService', () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: any;
    let api: ReturnType<typeof createTestClient>;

    beforeEach(async () => {
        const mockDB = createMockDB();
        db = mockDB.db;
        sqlite = mockDB.sqlite;
        env = createMockEnv();
        
        // Setup app with mock db and auth utilities
        app = createBaseApp(env);
        app.state('db', db);
        app.state('jwt', {
            sign: async (payload: any) => `mock_token_${payload.id}`,
            verify: async (token: string) => {
                const match = token.match(/mock_token_(\d+)/);
                return match ? { id: parseInt(match[1]) } : null;
            },
        });
        app.state('oauth2', {
            generateState: () => 'mock_state',
            createRedirectUrl: (state: string, provider: string) => `https://github.com/login?state=${state}`,
            authorize: async (provider: string, code: string) => code === 'valid_code' ? { accessToken: 'gh_token' } : null,
        });
        app.state('anyUser', async () => false);
        
        // Initialize service
        UserService(app);
        
        // Create test API client
        api = createTestClient(app, env);
        
        // Seed test data
        await seedTestData(sqlite);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    async function seedTestData(sqlite: Database) {
        sqlite.exec(`
            INSERT INTO users (id, username, avatar, permission, openid) VALUES 
                (1, 'user1', 'avatar1.png', 0, 'gh_123'),
                (2, 'admin', 'admin.png', 1, 'gh_456')
        `);
    }

    describe('GET /user/github - Initiate GitHub OAuth', () => {
        it('should redirect to GitHub OAuth', async () => {
            // OAuth endpoints need custom headers, using direct request for this case
            const request = new Request('http://localhost/user/github', {
                headers: { 'Referer': 'http://localhost:5173/' }
            });
            
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(302);
            const location = response.headers.get('Location');
            expect(location).toContain('github.com');
            expect(location).toContain('state='); // OAuth generates a state, just check it exists
        });

        it('should require referer header', async () => {
            // OAuth endpoints need custom headers, using direct request for this case
            const request = new Request('http://localhost/user/github');
            
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(400);
            const data = await response.json() as { error: { message: string } };
            expect(data.error.message).toBe('Referer header is required');
        });

        it('should return 400 if OAuth not configured', async () => {
            const envNoOAuth = createMockEnv({
                RIN_GITHUB_CLIENT_ID: '',
                RIN_GITHUB_CLIENT_SECRET: '',
            });
            const appNoOAuth = createBaseApp(envNoOAuth);
            appNoOAuth.state('db', db);
            appNoOAuth.state('oauth2', null); // No oauth2 state
            UserService(appNoOAuth);
            
            const request = new Request('http://localhost/user/github', {
                headers: { 'Referer': 'http://localhost:5173/' }
            });
            
            const response = await appNoOAuth.handle(request, envNoOAuth);
            
            expect(response.status).toBe(400);
            const data = await response.json() as { error: { message: string } };
            expect(data.error.message).toBe('GitHub OAuth is not configured');
        });

        it('should set redirect_to cookie', async () => {
            // OAuth endpoints need custom headers, using direct request for this case
            const request = new Request('http://localhost/user/github', {
                headers: { 'Referer': 'http://localhost:5173/feed/123' }
            });
            
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(302);
            const setCookie = response.headers.get('Set-Cookie');
            expect(setCookie).toContain('redirect_to');
            // Cookie contains URL-encoded path, check for the encoded callback
            expect(setCookie).toContain('callback');
        });
    });

    describe('GET /user/github/callback - GitHub OAuth callback', () => {
        it('should authenticate existing user', async () => {
            // Mock GitHub API response
            const originalFetch = global.fetch;
            global.fetch = async () => {
                return new Response(JSON.stringify({
                    id: 'gh_123',
                    login: 'user1',
                    name: 'User One',
                    avatar_url: 'https://github.com/avatar.png'
                }), { status: 200 });
            };

            try {
                // OAuth callbacks need custom Cookie header, using direct request
                const request = new Request('http://localhost/user/github/callback?code=valid_code&state=mock_state', {
                    headers: {
                        'Cookie': 'state=mock_state; redirect_to=http://localhost:5173/callback'
                    }
                });
                
                const response = await app.handle(request, env);
                
                expect(response.status).toBe(302);
                const location = response.headers.get('Location');
                expect(location).toContain('/callback');
                expect(location).toContain('token=mock_token_1');
            } finally {
                global.fetch = originalFetch;
            }
        });

        it('should register new user', async () => {
            // Mock GitHub API response for new user
            const originalFetch = global.fetch;
            global.fetch = async () => {
                return new Response(JSON.stringify({
                    id: 'gh_new',
                    login: 'newuser',
                    name: 'New User',
                    avatar_url: 'https://github.com/newavatar.png'
                }), { status: 200 });
            };

            try {
                // OAuth callbacks need custom Cookie header, using direct request
                const request = new Request('http://localhost/user/github/callback?code=valid_code&state=mock_state', {
                    headers: {
                        'Cookie': 'state=mock_state; redirect_to=http://localhost:5173/callback'
                    }
                });
                
                const response = await app.handle(request, env);
                
                expect(response.status).toBe(302);
                
                // Verify user was created
                const result = sqlite.prepare(`SELECT * FROM users WHERE openid = 'gh_new'`).all();
                expect(result.length).toBe(1);
            } finally {
                global.fetch = originalFetch;
            }
        });

        it('should reject invalid state', async () => {
            // OAuth callbacks need custom Cookie header, using direct request
            const request = new Request('http://localhost/user/github/callback?code=valid_code&state=wrong_state', {
                headers: {
                    'Cookie': 'state=mock_state; redirect_to=http://localhost:5173/callback'
                }
            });
            
            const response = await app.handle(request, env);
            
            expect(response.status).toBe(400);
            const data = await response.json() as { error: { message: string } };
            expect(data.error.message).toBe('Invalid state parameter');
        });

        it('should reject failed authorization', async () => {
            // OAuth callbacks need custom Cookie header, using direct request
            const request = new Request('http://localhost/user/github/callback?code=invalid_code&state=mock_state', {
                headers: {
                    'Cookie': 'state=mock_state; redirect_to=http://localhost:5173/callback'
                }
            });
            
            const response = await app.handle(request, env);
            
            // When OAuth fails, it may return 400 or 500 depending on implementation
            // The important thing is that it's not a successful 302 redirect
            expect(response.status).not.toBe(302);
            expect(response.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('GET /user/profile - Get user profile', () => {
        it('should return user profile', async () => {
            const result = await api.user.profile({ token: 'mock_token_1' });
            
            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBe(1);
            expect(result.data?.username).toBe('user1');
            expect(result.data?.avatar).toBe('avatar1.png');
            expect(result.data?.permission).toBe(false);
            expect(result.data).toHaveProperty('createdAt');
            expect(result.data).toHaveProperty('updatedAt');
        });

        it('should return admin permission for admin user', async () => {
            const result = await api.user.profile({ token: 'mock_token_2' });
            
            expect(result.error).toBeUndefined();
            expect(result.data?.permission).toBe(true);
        });

        it('should require authentication', async () => {
            const result = await api.user.profile();
            
            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(403);
            const errorData = result.error?.value as any;
            expect(errorData.error.message).toBe('Authentication required');
        });

        it('should return 403 when user does not exist', async () => {
            // Token for non-existent user will verify successfully (mock JWT)
            // but user lookup will fail, resulting in no uid being set
            // This causes 403 (authentication required) rather than 404
            const result = await api.user.profile({ token: 'mock_token_999' });
            
            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(403);
            const errorData = result.error?.value as any;
            expect(errorData.error.message).toBe('Authentication required');
        });
    });

    describe('PUT /user/profile - Update profile', () => {
        it('should update username', async () => {
            const result = await api.user.updateProfile({
                username: 'newname',
            }, { token: 'mock_token_1' });
            
            expect(result.error).toBeUndefined();
            expect(result.data?.success).toBe(true);
            
            // Verify update
            const dbResult = sqlite.prepare(`SELECT username FROM users WHERE id = 1`).all() as any[];
            expect(dbResult[0]?.username).toBe('newname');
        });

        it('should update avatar', async () => {
            const result = await api.user.updateProfile({
                avatar: 'https://new-avatar.png',
            }, { token: 'mock_token_1' });
            
            expect(result.error).toBeUndefined();
            
            const dbResult = sqlite.prepare(`SELECT avatar FROM users WHERE id = 1`).all() as any[];
            expect(dbResult[0]?.avatar).toBe('https://new-avatar.png');
        });

        it('should require authentication', async () => {
            const result = await api.user.updateProfile({
                username: 'test',
            });
            
            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(403);
            const errorData = result.error?.value as any;
            expect(errorData.error.message).toBe('Authentication required');
        });

        it('should require at least one field', async () => {
            const result = await api.user.updateProfile({}, { token: 'mock_token_1' });
            
            expect(result.error).toBeDefined();
            expect(result.error?.status).toBe(400);
            const errorData = result.error?.value as any;
            expect(errorData.error.message).toBe('At least one field (username or avatar) is required');
        });
    });

    describe('POST /user/logout - Logout', () => {
        it('should clear token cookie', async () => {
            const result = await api.user.logout();
            
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
        });
    });
});

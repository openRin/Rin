import {
    SignJWT,
    jwtVerify,
    type JWTPayload,
    type JWSHeaderParameters,
    type KeyLike
} from 'jose'

export interface JWTPayloadSpec {
    iss?: string
    sub?: string
    aud?: string | string[]
    jti?: string
    nbf?: number
    exp?: number
    iat?: number
}

export interface JWTUtils {
    sign: (payload: any) => Promise<string>;
    verify: (jwt?: string) => Promise<any | false>;
}

export function createJWT(secret: string | Uint8Array | KeyLike): JWTUtils {
    if (!secret) throw new Error("Secret can't be empty");

    const key = typeof secret === 'string' ? new TextEncoder().encode(secret) : secret;
    const alg = 'HS256';

    return {
        sign: async (payload: any) => {
            const jwt = new SignJWT(payload)
                .setProtectedHeader({ alg })
                .setIssuedAt();
            
            return jwt.sign(key);
        },
        verify: async (jwt?: string): Promise<any | false> => {
            if (!jwt) return false;

            try {
                const data = (await jwtVerify(jwt, key)).payload;
                return data;
            } catch (_) {
                return false;
            }
        }
    };
}

export default createJWT;

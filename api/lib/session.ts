import type { IronSessionOptions } from 'iron-session';

// ─── Session User Shape ────────────────────────────────────────────────────────
export interface SessionUser {
    id: string;
    name: string;
    email: string;
    picture: string;
    access_token: string;
}

export interface SessionData {
    user?: SessionUser;
    next_url?: string;
}

// ─── Iron-Session Options ──────────────────────────────────────────────────────
// SESSION_SECRET must be at least 32 characters (AES-256).
export const sessionOptions: IronSessionOptions = {
    password: process.env.SESSION_SECRET as string,
    cookieName: 'runningly-session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 86400, // 24 hours
        httpOnly: true,
        sameSite: 'lax',
    },
};

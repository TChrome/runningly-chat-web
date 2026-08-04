import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '../lib/session.js';

// GET /api/auth/login
// Redirects the browser to Google's OAuth 2.0 authorization URL.
// Stores the intended destination in the session so callback can redirect back.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const session = await getIronSession<SessionData>(req as any, res as any, sessionOptions);

    const nextUrl = (req.query.next as string) || '/';
    session.next_url = nextUrl;
    await session.save();

    // Build dynamic callback URL from actual request host (handles preview + custom domains)
    const protocol = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host = req.headers.host;
    const callbackUrl = `${protocol}://${host}/api/auth/callback`;

    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        access_type: 'offline',
    });

    res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

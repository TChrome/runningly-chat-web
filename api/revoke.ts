import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from './lib/session.js';

// GET /api/revoke
// Revokes the Google OAuth access token, destroys the session, and redirects.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const session = await getIronSession<SessionData>(req as any, res as any, sessionOptions);
    const nextUrl = (req.query.next as string) || '/';

    if (session.user?.access_token) {
        try {
            await fetch(
                `https://accounts.google.com/o/oauth2/revoke?token=${session.user.access_token}`
            );
        } catch (err) {
            console.warn('Google token revocation failed (may already be expired):', err);
        }
    }

    session.destroy();
    res.setHeader('Set-Cookie', 'runningly-session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    res.redirect(302, nextUrl);
}

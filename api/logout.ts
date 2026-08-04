import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from './lib/session.js';

// GET /api/logout
// Destroys the session cookie and redirects to login.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const session = await getIronSession<SessionData>(req as any, res as any, sessionOptions);

    const nextUrl = (req.query.next as string) || '/';

    session.destroy();
    // Expire the cookie explicitly in the response
    res.setHeader('Set-Cookie', 'runningly-session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
    res.redirect(302, nextUrl);
}

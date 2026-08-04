import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from './lib/session.js';

// GET /api/current-user
// Returns the authenticated user from the session cookie, or 401.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const session = await getIronSession<SessionData>(req as any, res as any, sessionOptions);

    if (!session.user) {
        res.status(401).json({ error: 'Not logged in' });
        return;
    }

    res.status(200).json({
        name: session.user.name,
        email: session.user.email,
        picture: session.user.picture,
    });
}

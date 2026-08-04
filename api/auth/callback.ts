import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData, type SessionUser } from '../lib/session.js';

// GET /api/auth/callback
// Handles the Google OAuth redirect, exchanges the code for tokens,
// fetches the user profile, stores it in the encrypted session cookie,
// then redirects to the originally intended URL.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const session = await getIronSession<SessionData>(req as any, res as any, sessionOptions);

    const code = req.query.code as string;
    const errorParam = req.query.error as string;

    if (errorParam || !code) {
        console.error('OAuth error:', errorParam);
        res.redirect(302, '/api/auth/login');
        return;
    }

    try {
        // ── Step 1: Exchange auth code for tokens ─────────────────────────────────
        const protocol = (req.headers['x-forwarded-proto'] as string) || 'https';
        const host = req.headers.host;
        const callbackUrl = `${protocol}://${host}/api/auth/callback`;

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: callbackUrl,
                grant_type: 'authorization_code',
            }).toString(),
        });

        if (!tokenRes.ok) {
            console.error('Token exchange failed:', await tokenRes.text());
            res.redirect(302, '/api/auth/login');
            return;
        }

        const tokenData = await tokenRes.json() as { access_token: string; id_token?: string };

        // ── Step 2: Fetch user profile from Google ────────────────────────────────
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!profileRes.ok) {
            console.error('Profile fetch failed:', await profileRes.text());
            res.redirect(302, '/api/auth/login');
            return;
        }

        const profile = await profileRes.json() as {
            sub: string;
            name: string;
            email: string;
            picture: string;
        };

        // ── Step 3: Store user in encrypted session cookie ────────────────────────
        const user: SessionUser = {
            id: profile.sub,
            name: profile.name,
            email: profile.email,
            picture: profile.picture,
            access_token: tokenData.access_token,
        };

        session.user = user;
        const nextUrl = session.next_url || '/';
        session.next_url = undefined;
        await session.save();

        console.log(`User logged in: ${user.email}`);
        res.redirect(302, nextUrl);

    } catch (err) {
        console.error('OAuth callback error:', err);
        res.redirect(302, '/api/auth/login');
    }
}

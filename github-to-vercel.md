# GitHub to Vercel Integration Guide (Runningly Chat)

This guide provides step-by-step instructions on how to connect the `runningly-chat-web` repository to Vercel for automated deployments.

---

## 1. Prepare Your GitHub Repository
Ensure all your latest changes are pushed to your GitHub repository.
```bash
git add .
git commit -m "feat: Vercel deployment setup"
git push origin main
```

## 2. Connect to Vercel
1.  **Login to Vercel**: Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2.  **Import Project**:
    *   Click **"Add New..."** and select **"Project"**.
    *   Find your `runningly-chat-web` repository from the list and click **"Import"**.
    *   Set the **Project Name** to `runningly-chat`.

## 3. Deployment Configuration
In the **"Configure Project"** screen, set the following:

### Build & Output Settings
*   **Framework Preset**: Select **Vite**.
*   **Build Command**: `npm run build` (This runs `tsc -p tsconfig.api.json --noEmit && vite build`).

### Environment Variables
Add the following variables in the **Environment Variables** section:
*   `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
*   `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret.
*   `SESSION_SECRET`: A 32+ character random string (used for AES-256 encryption of session cookies).

## 4. Set Up Vercel Postgres
1.  Once the project is created, navigate to the **"Storage"** tab in your Vercel Dashboard.
2.  Click **"Create Database"** and select **"Postgres"** (Standard Serverless, powered by **Neon**).
3.  **Region Selection**: Choose a region closest to your main user base (e.g., **Washington, D.C. (us-east-1)**).
4.  **Connect to Project**: Click the **"Connect"** button and select your `runningly-chat` project.
    *   *This automatically adds `POSTGRES_URL` and other DB variables to your environment.*

## 5. Set Up Vercel Blob (For Video Storage)
1.  Go to the **"Storage"** tab again.
2.  Click **"Create Store"** and select **"Blob"**.
3.  **Connect to Project**: Click the **"Connect"** button and select your `runningly-chat` project.
    *   *This automatically adds `BLOB_READ_WRITE_TOKEN` to your environment.*

## 6. Update Google OAuth Authorized Redirect URIs
1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Navigate to **APIs & Services** > **Credentials**.
3. Edit your OAuth 2.0 Client ID.
4. Under **Authorized redirect URIs**, add your Vercel production URL:
   * `https://runningly-chat.t-chrome.com/api/auth/callback`
   * (Optional) Add your Vercel preview URL pattern if you want preview deployments to work.

## 7. Custom Domain
1. Go to your Vercel Project Settings > **Domains**.
2. Add `runningly-chat.t-chrome.com`.
3. Follow the instructions to configure the CNAME record in your DNS provider (Cloudflare).

---

## 🛠️ Troubleshooting
*   **Database Errors**: Ensure `POSTGRES_URL` is set and the database is connected. The tables will be created automatically on the first API request.
*   **Video Upload Errors**: Ensure `BLOB_READ_WRITE_TOKEN` is set and the Blob store is connected.
*   **OAuth Errors**: Double-check the Authorized Redirect URIs in Google Cloud Console.

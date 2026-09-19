# GitHub to Vercel Integration Guide (Runningly Chat)

This guide provides step-by-step instructions on how to connect the `runningly-chat-web` repository to Vercel for automated deployments.

---

## 1. Install and Login to Vercel CLI
Because Vercel's free tier does not support GitHub Organization repositories, we deploy directly from the terminal using the Vercel CLI.

1. Install the CLI globally:
   ```bash
   npm i -g vercel
   ```
2. Log in to your Vercel account:
   ```bash
   vercel login
   ```

## 2. First Deployment
Run the following command in the root of your `runningly-chat-web` folder:
```bash
npm run build:secure && vercel --prod vercel-ship
or 
npm run build
vercel --prod --force
or 
vercel --prod
```
Answer the prompts as follows:
* Set up and deploy? **Y**
* Which scope? **(Select your personal account)**
* Link to existing project? **N**
* What's your project's name? **runningly-chat**
* In which directory is your code located? **./**
* Want to modify these settings? **N**

*Note: The first deployment might show errors on the live site because the database and environment variables aren't set up yet. Proceed to step 3.*

## 3. Environment Variables
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click on the newly created `runningly-chat` project.
2. Go to **Settings** > **Environment Variables**.
3. Add the following variables:
   * `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
   * `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret.
   * `SESSION_SECRET`: A 32+ character random string (used for AES-256 encryption of session cookies).

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

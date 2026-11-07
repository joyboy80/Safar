# SAFAR Deployment & Local Running Guide

This guide ensures you can deploy your **Backend to Render** and your **Frontend to Vercel** in **one attempt**, while also running the entire platform locally with a single command.

---

## 🏗️ Architecture Overview

| Component | Platform | Configuration File |
|---|---|---|
| **Backend** (Node.js/Express) | **Render** | `render.yaml` or Root Directory: `backend` |
| **Frontend** (React/Vite) | **Vercel** | `Frontend/vercel.json` or Root Directory: `Frontend` |
| **Database & Auth** | **Supabase** | Managed PostgreSQL & Auth |
| **Media (Profiles & Buses)**| **Cloudinary** | `dfurmdxbg` (Configured in `.env`) |

---

## 💻 1. Running Locally

From the root directory (`f:\Safar`), you can run both services together or separately:

### Start Both Backend and Frontend:
```bash
npm run dev
```
* **Backend**: `http://localhost:5000`
* **Frontend**: `http://localhost:5173`

### Or Run Them Individually:
```bash
# Run only Backend (watches src/ for changes)
npm run dev:backend

# Run only Frontend (Vite with hot reload)
npm run dev:frontend
```

---

## 🚀 2. Deploying Backend to Render

### Option A: Automatic via Render Blueprint (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Blueprint**.
2. Connect your GitHub repository (`Safar`).
3. Render will automatically read `render.yaml` from the root of your repository and configure the Web Service with `rootDir: backend`, build command `npm install`, and start command `npm start`.
4. Fill in the prompted secret environment variables (listed below) and click **Apply**.

---

### Option B: Manual Web Service
If creating a standard Web Service manually on Render:
1. Click **New +** → **Web Service** and connect your GitHub repository.
2. Configure these settings:
   * **Name**: `safar-backend`
   * **Region**: Oregon (or nearest)
   * **Branch**: `main` (or your active branch)
   * **Root Directory**: `backend`
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
   * **Health Check Path**: `/api/health`

3. Add these **Environment Variables** in Render's **Environment** tab:

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables secure production mode |
| `PORT` | `10000` | Render default port |
| `CLIENT_ORIGINS` | `https://<YOUR-VERCEL-APP>.vercel.app` | Your Vercel frontend URL (comma-separated if multiple) |
| `SUPABASE_URL` | *Copy from your local `backend/.env`* | Your Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | *Copy from your local `backend/.env`* | Anon / publishable key |
| `SUPABASE_SECRET_KEY` | *Copy from your local `backend/.env`* | Service role secret key |
| `OTP_HASH_SECRET` | *Copy from your local `backend/.env`* | Random string >= 32 characters |
| `CLOUDINARY_CLOUD_NAME` | `dfurmdxbg` | Your Cloudinary Cloud Name |
| `CLOUDINARY_API_KEY` | *Copy from your local `backend/.env`* | Your Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | *Copy from your local `backend/.env`* | Your Cloudinary API Secret |
| `SMTP_HOST` | `smtp.gmail.com` | Email host |
| `SMTP_PORT` | `587` | Email port |
| `SMTP_SECURE` | `false` | TLS |
| `SMTP_USER` | *Copy from your local `backend/.env`* | Sender email |
| `SMTP_PASSWORD` | *Copy from your local `backend/.env`* | Google App Password |
| `SMTP_FROM` | *Copy from your local `backend/.env`* | Sender display |
| `GEMINI_API_KEY` | *Copy from your local `backend/.env`* | Gemini AI key |

4. Click **Deploy Web Service**.
5. Once deployed, test the health check in your browser:  
   `https://<your-render-service>.onrender.com/api/health`  
   *(Expected response: `{"success":true,"data":{"status":"ok","database":"connected"}}`)*

---

## 🌐 3. Deploying Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/) and click **Add New...** → **Project**.
2. Import your GitHub repository (`Safar`).
3. In the **Configure Project** screen:
   * **Project Name**: `safar` (or your choice)
   * **Framework Preset**: `Vite`
   * **Root Directory**: Click **Edit** and select `Frontend`
   * **Build Command**: `npm run build` (or leave default `vite build`)
   * **Output Directory**: `dist` (default)
4. Open the **Environment Variables** section and add:

| Variable | Value | Description |
|---|---|---|
| `VITE_API_URL` | `https://<YOUR-RENDER-BACKEND>.onrender.com/api` | Point to your deployed Render backend |
| `VITE_MAPBOX_ACCESS_TOKEN` | *Copy from your local `Frontend/.env`* | Mapbox public token |
| `VITE_GOOGLE_MAPS_API_KEY` | *Copy from your local `backend/.env`* | Google Maps browser key |

5. Click **Deploy**.
6. When Vercel finishes building, you will receive a URL like `https://safar-xxx.vercel.app`.

---

## 🔄 4. Final Connection (20-Second Step)

Once Vercel gives you your live URL (e.g. `https://safar.vercel.app`):
1. Go back to your **Render Dashboard** → **safar-backend** → **Environment**.
2. Update `CLIENT_ORIGINS` to match your Vercel URL:
   ```
   CLIENT_ORIGINS=https://safar.vercel.app
   ```
   *(The backend automatically accepts all Vercel preview domains `*.vercel.app` as well)*
3. Render will redeploy automatically.

**Everything is now live and working in production!**


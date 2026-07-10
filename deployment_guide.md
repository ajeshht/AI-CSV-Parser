# 🌐 Deployment Guide - GrowEasy CSV Importer

This guide outlines step-by-step instructions to host the frontend (Next.js) and backend (Express) for free using **Vercel** and **Render** (or Railway) directly from your monorepo repository.

---

## 🛠️ Step 1: Push Project to GitHub

Before deploying, initialize a Git repository, commit the files, and push them to a public or private GitHub repository.

1. Open your terminal at the root directory `C:\Users\AJESH T\.gemini\antigravity\scratch\ai-csv-importer`.
2. Run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: AI-powered CSV lead importer"
   ```
3. Create a new repository on GitHub and link it:
   ```bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   ```

---

## 💻 Step 2: Deploy Backend to Render (or Railway)

**Render** is an excellent and free platform to host Node.js Express APIs.

1. Go to [Render](https://render.com/) and create a free account.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service settings:
   * **Name**: `groweasy-csv-importer-backend` (or similar)
   * **Language**: `Node`
   * **Root Directory**: `backend` *(CRITICAL: Tell Render to run from the backend subfolder)*
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `npm start`
5. Click **Advanced** to add **Environment Variables**:
   * `PORT` = `5000`
   * `GEMINI_API_KEY` = `your_actual_gemini_api_key`
   * `LLM_PROVIDER` = `gemini` (or `openai`)
   * `OPENAI_API_KEY` = `your_openai_api_key` (if using OpenAI)
6. Click **Create Web Service**.

Once deployed, Render will provide a public URL (e.g. `https://groweasy-csv-importer-backend.onrender.com`). **Copy this URL.**

---

## 🎨 Step 3: Deploy Frontend to Vercel

**Vercel** is the native hosting platform for Next.js and hosts it with maximum performance for free.

1. Go to [Vercel](https://vercel.com/) and log in with your GitHub account.
2. Click **Add New** > **Project**.
3. Import your GitHub repository.
4. Configure the Project settings:
   * **Framework Preset**: `Next.js`
   * **Root Directory**: Click *Edit* and select the `frontend` folder.
   * **Build & Development Settings**: Keep defaults (Vercel automatically detects Next.js build scripts).
5. Open the **Environment Variables** dropdown and add:
   * **Key**: `NEXT_PUBLIC_API_URL`
   * **Value**: Paste the URL of your deployed Render backend (e.g. `https://groweasy-csv-importer-backend.onrender.com`)
6. Click **Deploy**.

Vercel will build your Next.js application and provide you with a live URL (e.g., `https://groweasy-csv-importer.vercel.app`).

---

## 🔗 Step 4: Verification

1. Open your live Vercel URL.
2. Upload a sample CSV (e.g., `samples/messy_leads.csv`).
3. Press **Confirm Import**.
4. Check that progress and AI logs stream successfully from the Render server.

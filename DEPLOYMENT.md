# Deploying Watch Together to Render.com 🚀

Follow these steps to deploy your application for free.

## 1. Setup on Render
1.  **Register/Login**: Go to [dashboard.render.com](https://dashboard.render.com/).
2.  **Create Service**: Click the **"New +"** button in the top right.
3.  Select **"Web Service"**.
4.  **Connect GitHub**:
    -   Click "Build and deploy from a Git repository".
    -   Connect your GitHub account if asked.
    -   Select your repository: **`watch-together`**.

## 2. Configuration (`Settings`)
Fill in the form with these exact values:

| Field | Value |
| :--- | :--- |
| **Name** | `watch-together-app` (or any unique name) |
| **Region** | Singapore (or closest to you) |
| **Branch** | `main` |
| **Root Directory** | *(Leave Empty)* |
| **Runtime** | **Node** |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** |

## 3. Deploy
1.  Click **"Create Web Service"**.
2.  Render will start the build process.
3.  You will see logs:
    -   `Running build command 'npm install'...`
    -   `Running start command 'npm start'...`
    -   `Connected to SQLite database.`
    -   `Server running on http://localhost:10000` (Port may vary, that's fine).
4.  Wait for the green **"Live"** badge.

## 4. Play!
Click the URL provided (e.g., `https://watch-together-app.onrender.com`).
## 5. Persistence (Recommended) 🐘
To stop data from vanishing on restart, enable **PostgreSQL**:

1.  **Create Database**:
    -   Click **"New +"** -> **"PostgreSQL"**.
    -   Name: `watch-together-db`.
    -   Plan: **Free**.
    -   Click **"Create Database"**.

2.  **Get Connection String**:
    -   Wait for it to become "Available".
    -   Find **"Internal Database URL"** and copy it.

3.  **Link to App**:
    -   Go to your **Web Service** (`watch-together-app`).
    -   Click **"Environment"** -> **"Add Environment Variable"**.
    -   Key: `DATABASE_URL`
    -   Value: `(Paste the Internal Database URL from step 2)`
    -   Click **"Save Changes"**.

4.  **Redeploy**: Render will automatically restart. Now your users and rooms are saved forever!


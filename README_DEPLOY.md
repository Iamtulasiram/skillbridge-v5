# SkillBridge V5 - Public Deployment

## Render
1. Put this folder in a GitHub repository.
2. In Render, create a new Web Service and connect the repository.
3. Root Directory: leave blank if this folder is the repository root.
4. Build Command: `npm install --omit=dev`
5. Start Command: `npm start`
6. Deploy.
7. Share the generated `https://...onrender.com` URL.

The server binds to `0.0.0.0` and uses Render's `PORT` automatically.

## Important prototype limitation
User data is stored in `data.json`. On free/ephemeral hosting, local file storage is not durable across every restart/redeploy. For a permanent multi-user deployment, replace `data.json` with a managed database such as PostgreSQL.

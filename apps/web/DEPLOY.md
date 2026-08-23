# BE'EMUNA Deployment Guide

## 🚀 Quick Deploy to Vercel

### Prerequisites
- Vercel account (free tier works)
- Backend deployed and accessible via public URL
- Code pushed to GitHub/GitLab/Bitbucket

### Step 1: Deploy Backend First

Choose one of these options:

#### Option A: Railway (Recommended - Easiest)
```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Navigate to backend
cd "F:\My Project\beemuna\apps\api"

# 3. Login and deploy
railway login
railway init
railway up
```

#### Option B: Render
1. Go to render.com
2. New → Web Service
3. Connect your repo
4. Root directory: `apps/api`
5. Build command: `pip install -r requirements.txt`
6. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
7. Add environment variables from `.env`

#### Option C: Fly.io
```bash
fly launch
fly deploy
```

### Step 2: Deploy Frontend to Vercel

#### Option A: Vercel CLI (Fastest)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Navigate to web directory
cd "F:\My Project\beemuna\apps\web"

# 3. Deploy
vercel

# 4. Follow prompts:
#    - Link to Git repo? Yes
#    - Project name? beemuna-web
#    - Which directory? ./
#    - Override settings? No
#    - Deploy? Yes

# 5. Set environment variable:
vercel env add NEXT_PUBLIC_API_URL
# Enter your backend URL: https://your-backend.railway.app/api/v1

# 6. Redeploy with env var
vercel --prod
```

#### Option B: GitHub Integration (Recommended for CI/CD)
1. Push code to GitHub:
```bash
cd "F:\My Project\beemuna"
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

2. Go to vercel.com/new
3. Import your repository
4. Root directory: `apps/web`
5. Framework preset: Next.js
6. Environment variables:
   - `NEXT_PUBLIC_API_URL` = `https://your-backend-url.com/api/v1`
7. Click Deploy

### Step 3: Post-Deployment

1. **Test the deployment:**
   - Visit your Vercel URL
   - Try logging in
   - Test API calls

2. **Update CORS on backend:**
   Add your Vercel domain to backend CORS origins:
   ```python
   # In apps/api/app/core/config.py
   cors_origins = [
       "https://your-app.vercel.app",
       "https://your-custom-domain.com",
   ]
   ```

3. **Set up custom domain (optional):**
   - Vercel → Settings → Domains
   - Add your custom domain
   - Update DNS records

## 🔧 Configuration Files

### `.env` (Create this in `apps/web/`)
```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api/v1
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_NAME=BE'EMUNA
```

### `.env.production` (Optional)
```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api/v1
```

## 📋 Pre-Deployment Checklist

- [ ] Backend is deployed and accessible
- [ ] Backend CORS includes your Vercel domain
- [ ] Frontend environment variables set in Vercel
- [ ] All hardcoded localhost URLs removed
- [ ] Build passes locally (`npm run build`)
- [ ] Tests pass (if any)

## 🐛 Troubleshooting

### Build Fails
```bash
# Check for TypeScript errors
cd "F:\My Project\beemuna\apps\web"
npx tsc --noEmit

# Fix any errors before deploying
```

### API Calls Fail After Deployment
1. Check `NEXT_PUBLIC_API_URL` is set correctly in Vercel
2. Verify backend CORS allows your Vercel domain
3. Check backend is running and accessible
4. Verify API URL in browser console

### Authentication Issues
- Ensure cookies are working (check browser dev tools)
- Verify token is being sent in requests
- Check backend auth endpoints are accessible

## 📱 Next Steps

After web deployment:
1. Test all features thoroughly
2. Set up monitoring (Vercel Analytics)
3. Configure error tracking (Sentry)
4. Plan mobile app (Expo/React Native)

## 🔗 Useful Links

- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/app/building-your-application/deploying)
- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)

# Deployment Guide

## Vercel Deployment (Frontend)

### 1. Prerequisites
- Vercel account (vercel.com)
- Backend deployed and accessible via public URL
- Git repository connected to Vercel

### 2. Environment Variables
In Vercel dashboard, set:
```
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api/v1
```

### 3. Deploy Steps
1. Push code to GitHub/GitLab/Bitbucket
2. Import project in Vercel
3. Select `apps/web` as root directory
4. Add environment variable `NEXT_PUBLIC_API_URL`
5. Deploy

### 4. Backend Deployment Options
- Railway (railway.app) - easiest for FastAPI
- Render (render.com)
- Fly.io
- DigitalOcean App Platform
- AWS/GCP/Azure

## Mobile App Options

### Option A: React Native + Expo (Recommended)
- Share TypeScript/React knowledge
- Same backend API
- Best performance and UX
- Cost: ~$99/month for Expo

### Option B: PWA (Progressive Web App)
- Wrap existing Next.js app
- Cheapest/fastest option
- Limited native features

### Option C: Flutter
- Best performance
- Dart language
- Steeper learning curve

## Next Steps
1. Deploy backend first
2. Deploy frontend to Vercel
3. Choose mobile app approach
4. Set up CI/CD pipelines
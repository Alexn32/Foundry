#!/bin/bash

# Deploy script for Foundry
# Run this after setting up Railway project

echo "🚀 Deploying Foundry..."

# Push to GitHub first
echo "📤 Pushing to GitHub..."
git push origin main

# Deploy to Railway
echo "🚂 Deploying to Railway..."
railway up

# Run database migrations
echo "🗄️ Running database migrations..."
railway run npx prisma db push

echo "✅ Deployment complete!"
echo "Check Railway dashboard for URL"

# MongoDB Atlas Setup Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Create MongoDB Atlas Account

1. Go to [https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
2. Sign up with Google/GitHub or email
3. Choose **FREE** tier (M0 Sandbox)

### Step 2: Create a Cluster

1. Click "Build a Database"
2. Choose **FREE** shared cluster
3. Select a cloud provider (AWS recommended)
4. Choose a region closest to you
5. Name your cluster (e.g., "ChatApp")
6. Click "Create"

### Step 3: Create Database User

1. In Security → Database Access
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Username: `chatapp`
5. Password: Click "Autogenerate Secure Password" (SAVE THIS!)
6. Database User Privileges: "Read and write to any database"
7. Click "Add User"

### Step 4: Whitelist IP Address

1. In Security → Network Access
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
   - This is fine for development
   - For production, use specific IPs
4. Click "Confirm"

### Step 5: Get Connection String

1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Driver: Node.js, Version: 5.5 or later
4. Copy the connection string

It looks like:
```
mongodb+srv://chatapp:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

5. Replace `<password>` with the password you saved in Step 3
6. Add database name after `.net/`: `chatapp`

Final string:
```
mongodb+srv://chatapp:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/chatapp?retryWrites=true&w=majority
```

### Step 6: Add to Render Environment Variables

1. Go to your Render dashboard
2. Click on your service
3. Go to "Environment" tab
4. Add new environment variable:
   - Key: `MONGODB_URI`
   - Value: (paste your connection string from Step 5)
5. Click "Save Changes"

Render will automatically redeploy!

## 🔄 Migrate Your Existing Data

### Option 1: Run Migration Locally (RECOMMENDED)

1. Create `.env` file in backend folder:
```bash
cd backend
echo "MONGODB_URI=your_connection_string_here" > .env
```

2. Run migration:
```bash
npm run migrate
```

This will transfer all your users, messages, and friends from JSON files to MongoDB!

### Option 2: Let MongoDB Start Fresh

Just deploy! The app will create default users (Ani & Maddy) automatically.

## ✅ Verification

After deployment, your data will:
- ✅ Persist across restarts
- ✅ Survive deployments
- ✅ Be backed up automatically
- ✅ Load in <100ms

## 🎯 MongoDB Features You Get

- **Automatic Backups**: Daily snapshots (on paid tiers)
- **Scalability**: Upgrade when you need more storage
- **Performance**: Indexed queries for fast searches
- **Security**: Encrypted connections
- **Free Tier**: 512MB storage (enough for thousands of messages!)

## 📊 Monitor Your Database

1. Go to MongoDB Atlas dashboard
2. Click on your cluster
3. Click "Collections" to see your data
4. You'll see 3 collections:
   - `users` - All user accounts
   - `messages` - All chat messages
   - `friends` - Friend relationships

## 🔧 Troubleshooting

### Connection timeout
- Check your IP is whitelisted (0.0.0.0/0 for all)
- Verify connection string has correct password

### Authentication failed
- Password might have special characters that need URL encoding
- Regenerate password and use only alphanumeric

### Database not found
- Make sure you added `/chatapp` to the connection string

## 🚀 Ready to Deploy!

Once you've added `MONGODB_URI` to Render, just push to GitHub:

```bash
git add .
git commit -m "Add MongoDB support"
git push
```

Render will automatically deploy with MongoDB! 🎉

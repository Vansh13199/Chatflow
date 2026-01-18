# 🚀 ChatFlow VPS Deployment Guide

This guide will walk you through hosting ChatFlow on a Virtual Private Server (VPS) like DigitalOcean, AWS, or Linode using Docker.

## ✅ Prerequisites
1.  **A VPS** (Ubuntu 20.04/22.04 recommended) with at least 1GB RAM.
2.  **Domain Name** (optional but recommended, e.g., `chatflow.site`).
3.  **SSH Access** to your VPS.

---

## 🛠️ Step 1: Install Docker on VPS
Connect to your VPS via SSH and run:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install -y docker-compose-plugin
```

---

## 📂 Step 2: Deploy the Code
You can either clone your repo (if pushed to GitHub) or copy files manually.

### Option A: Clone from GitHub (Recommended)
```bash
git clone https://github.com/your-username/chatflow.git
cd chatflow
```

### Option B: Copy Files via SCP
If your code is local only:
```bash
# Run this from your LOCAL machine
scp -r ./chatflow root@YOUR_VPS_IP:/root/
```

---

## 🚀 Step 3: Start the Application
Navigate to the project directory on your VPS and run:

```bash
sudo docker compose up -d --build
```

**What happens next?**
- 🐳 **Docker** builds the Frontend & Backend images.
- 🍃 **MongoDB** starts up.
- 🌐 **Nginx** starts serving on **Port 80**.

---

## 🌐 Step 4: Access Your App
Open your browser and visit:
`http://YOUR_VPS_IP`

You should see ChatFlow running!

---

## 🔒 Optional: Add SSL (HTTPS)
For production, you should use HTTPS. The easiest way is using **Certbot** with Nginx on the host, or extending the Docker setup with **Caddy** or **Traefik**.

### Quickest Nginx Proxy Manager method:
1. Stop port 80 binding in `docker-compose.yml` (change `"80:80"` to `"8080:80"`).
2. Install Nginx Proxy Manager or Caddy on the host.
3. Proxy domain -> `localhost:8080`.

---

## 📝 Troubleshooting
**View Logs:**
```bash
sudo docker compose logs -f
```

**Restart containers:**
```bash
sudo docker compose restart
```

**Rebuild after code changes:**
```bash
# Pull new changes
git pull
# Rebuild
sudo docker compose up -d --build
```

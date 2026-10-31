# AWS EC2 Centralized Deployment Guide
## MindMePredict — Nifty StrangleCopilot Options Terminal

This guide walks you through deploying **MindMePredict** inside a Docker container on an **AWS EC2** instance so your trading team can access the terminal centralized 24/7 with live 1-minute auto-syncing, Greeks radar, and AI execution protocols.

---

## 1. Recommended EC2 Instance Specs

| Specification | Minimum | Recommended |
| :--- | :--- | :--- |
| **Instance Type** | `t3.small` (2 vCPU, 2 GB RAM) | `t3.medium` (2 vCPU, 4 GB RAM) or `t4g.small` (Graviton ARM) |
| **Operating System** | Ubuntu 24.04 LTS / 22.04 LTS | Ubuntu 24.04 LTS (x86_64 or arm64) |
| **Storage** | 15 GB gp3 SSD | 25 GB gp3 SSD |
| **Network** | Up to 5 Gbps | Up to 5 Gbps |

---

## 2. AWS Security Group Configuration

In the AWS EC2 Console, navigate to **Security Groups** and attach an Inbound Rule to your instance:

| Type | Protocol | Port Range | Source | Description |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | `My IP` | Secure administrative shell access |
| **Custom TCP** | TCP | `8000` | `0.0.0.0/0` (or your desk IP) | MindMePredict Web Terminal |
| **HTTP** (Optional) | TCP | `80` | `0.0.0.0/0` | Direct web access (if `HOST_PORT=80`) |
| **HTTPS** (Optional) | TCP | `443` | `0.0.0.0/0` | Secure SSL (if using Nginx/Certbot) |

> [!IMPORTANT]
> Ensure **Outbound Rules** allow **All Traffic (0.0.0.0/0)** so the background worker can fetch live quotes from Yahoo Finance and RSS feeds from Reuters, Bloomberg, Mint, and Economic Times.

---

## 3. Step-by-Step EC2 Deployment

### Step 1: Connect to your EC2 Instance
```bash
ssh -i /path/to/your-key.pem ubuntu@<EC2_PUBLIC_IP_OR_DNS>
```

### Step 2: Install Docker & Docker Compose
Run the official automated installation:

```bash
# Update package lists
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker & Docker Compose plugin
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow running docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

Verify installation:
```bash
docker --version && docker compose version
```

---

### Step 3: Transfer or Clone the Codebase to EC2
You can either clone your Git repository or transfer files using `rsync` / `scp`:

```bash
# Option A: Git Clone
git clone <YOUR_GIT_REPO_URL> Mindmepredict
cd Mindmepredict

# Option B: From local machine via rsync
# rsync -avz -e "ssh -i your-key.pem" --exclude '.venv' --exclude '__pycache__' ./ ubuntu@<EC2_IP>:~/Mindmepredict/
```

---

### Step 4: Configure Environment & Credentials
Copy the `.env.example` template:

```bash
cp .env.example .env
nano .env
```

Customize the configuration:
```ini
# Port exposed to browser (e.g. 8000 or 80)
HOST_PORT=8000

# Set your institutional desk credentials
DESK_USERNAME=trader
DESK_PASSWORD=YourStrongSecretKey2026!
DESK_FULLNAME=Lead Risk Officer

# Generate a 256-bit encryption key with: openssl rand -hex 32
TERMINAL_SECRET_KEY=94f83b276a71e84a2d81395b00c2847a98b502ffce551ad6302eef71b084931a
```

---

### Step 5: Build and Launch Container
Run Docker Compose in detached mode:

```bash
docker compose up -d --build
```

Docker will:
1. Build the lightweight Python 3.11 container.
2. Install dependencies with pre-compiled wheels.
3. Create the persistent `mindme_terminal_data` volume for keys and broker tokens.
4. Launch the application and the 1-minute background auto-sync worker under a non-root `trader` user.

---

### Step 6: Verify Deployment

Check container status and health:
```bash
docker compose ps
```
You should see:
```
NAME            IMAGE                      COMMAND                  SERVICE         STATUS                    PORTS
mindmepredict   mindmepredict-mindmepredict   "uvicorn main:app --…"   mindmepredict   Up (healthy)              0.0.0.0:8000->8000/tcp
```

Inspect live container logs:
```bash
docker compose logs -f
```
You should see the 1-minute background worker running:
```text
[MINDMEPREDICT] Starting 1-minute background news & market synchronization worker...
[LIVE SYNC - 1m] Synced 12 news items across 17 sources. Threat: 47/100 (MODERATE)...
```

---

## 4. Accessing Your Centralized Terminal

Open your browser and navigate to:
```
http://<YOUR_EC2_PUBLIC_IP>:8000
```
*(Or `http://<YOUR_EC2_PUBLIC_IP>` if you configured `HOST_PORT=80`)*

Log in using the credentials you configured in `.env` (or default `admin` / `nifty2026`).

---

## 5. Helpful Operational Commands

| Action | Command |
| :--- | :--- |
| **View Live Logs** | `docker compose logs -f mindmepredict` |
| **Restart Terminal** | `docker compose restart mindmepredict` |
| **Stop Terminal** | `docker compose down` |
| **Update / Rebuild** | `git pull && docker compose up -d --build` |
| **Shell into Container** | `docker compose exec mindmepredict /bin/bash` |
| **Inspect Volume** | `docker volume inspect mindme_terminal_data` |

---

## 6. Optional: HTTPS / Free SSL with Domain

If you have a domain (e.g. `desk.yourcompany.com`) pointing to your EC2 IP and want HTTPS:

1. Install Nginx and Certbot on the EC2 host:
   ```bash
   sudo apt-get install -y nginx certbot python3-certbot-nginx
   ```
2. Configure `/etc/nginx/sites-available/mindme`:
   ```nginx
   server {
       server_name desk.yourcompany.com;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;

           # SSE Keepalive buffer configuration
           proxy_buffering off;
           proxy_cache off;
           proxy_read_timeout 86400s;
       }
   }
   ```
3. Enable site and issue free SSL:
   ```bash
   sudo ln -s /etc/nginx/sites-available/mindme /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d desk.yourcompany.com
   ```
Your institutional terminal is now accessible via secure **`https://desk.yourcompany.com`**!


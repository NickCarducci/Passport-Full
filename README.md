# Monmouth University Passport

A multi-platform ecosystem designed to track student engagement and facilitate event attendance at Monmouth University.

## Project Structure

| Component   | Platform          | Description                                                       |
| :---------- | :---------------- | :---------------------------------------------------------------- |
| **iOS**     | iOS (SwiftUI)     | Primary mobile app featuring Focal Navigation and QR scanning.    |
| **Android** | Android (Kotlin)  | Android equivalent for student engagement.                        |
| **TV**      | ReactJS (Vite)    | Web-based dashboard for displaying the leaderboard on campus TVs. |
| **Root**    | Node.js (Express) | Backend service and host for the TV dashboard.                    |

github.com/nickcarducci/Passport-Full combines all

- node.js + ReactJS (TV/)
- github.com/nickcarducci/Passport
- github.com/nickcarducci/Passport-Android

However, the last two need to **retain their own .git files + repositories**

## CI/CD (GitHub Actions)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which rsyncs the backend + TV source to your server, runs `npm install` (which builds the TV dashboard via `postinstall`), and restarts PM2.

### GitHub Secrets

Set these in **Settings > Secrets and variables > Actions** on the root repo (Passport-Full):

| Secret                  | Value                                                                     |
| :---------------------- | :------------------------------------------------------------------------ |
| `SSH_PRIVATE_KEY`       | Private key whose public half is in the server's `~/.ssh/authorized_keys` |
| `SERVER_HOST`           | Server IP (e.g. `178.156.240.36`, `pass.contact`)                         |
| `FIREBASE_SERVICE_JSON` | Full contents of `passport-service.json`                                  |

### Adapting for another server

The workflow is provider-agnostic — it only needs SSH + rsync. To deploy on a non-Hetzner server:

1. Provision any Ubuntu VPS (DigitalOcean, Linode, AWS EC2, etc.) running Ubuntu 24.04
2. SSH into the server and run the one-time setup:

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g npm@latest

# PM2
sudo npm install -g pm2

# SSH permissions
chmod 750 /root
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys

# First deploy: create the microservice directory and start PM2
mkdir -p ~/microservice
# (push to main or run the workflow manually to rsync code)
cd ~/microservice
npm install
pm2 start index.js --name "microservice-process"
pm2 save

# Caddy (reverse proxy + auto HTTPS)
apt update && apt install caddy -y
sudo mkdir -p /var/www/webapp
sudo chown -R root:caddy /var/www/webapp
sudo chmod -R 755 /var/www/webapp

# Firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

3. Write your Caddyfile (`nano /etc/caddy/Caddyfile`):

```
yourdomain.com {
    handle /api/* {
        reverse_proxy localhost:8080
    }
    handle /webhook/* {
        reverse_proxy localhost:8080
    }
    handle /health {
        reverse_proxy localhost:8080
    }
    handle {
        root * /var/www/webapp
        file_server
        try_files {path} /index.html
    }
}
```

Then `sudo systemctl reload caddy`. Point your domain's A record to the server IP (no proxy).

4. Add your SSH key and server IP/domain as GitHub Secrets
5. Push to `main` — the workflow handles the rest

### Mobile repos

iOS and Android live in separate repos for their respective build systems:

| Repo                            | Build System                    | Workflow                                                          |
| :------------------------------ | :------------------------------ | :---------------------------------------------------------------- |
| `NickCarducci/Passport`         | Xcode Cloud (App Store Connect) | Configured in App Store Connect, not via yml                      |
| `NickCarducci/Passport-Android` | Play Store Console              | `Android/.github/workflows/build.yml` — builds signed APK on push |

## Server Provisioning (one-time)

I suggest hetzner because you get a static IP - even though only MongoDB really needs that - firebase-admin seems like it doesn't. Neither does Azure SQL, ... cockroachDB SQL might...

| Platform                   | Feature / Cost | Infrastructure Type |
| :------------------------- | :------------- | :------------------ |
| **console.hetzner.com**    | Static IP      | IaaS                |
| Digital Ocean App Platform | +$25/mo        | PaaS                |

Hetzner instructions:

1. Create account
2. Create project
3. Create server
   a. Regular Performance skew in Shared Resources category
   b. AMD x86-CPX11 CPU ($4.99/mo; 2 GB RAM; 40 GB SSD; 1 TB "Traffic")
   c. us-east server location (Ashburn, VA)
   d. Ubuntu (24.04)
   e. Public IPv4 ✅ + IPv6 ✅

You can enter these two scripts for pm2 (`ssh root@178.156.240.36`) then duplicating + moving your code (`scp -r ./backend root@178.156.240.36:~/`).

```
ssh root@178.156.240.36 # replace with your own

# root@ubuntu-2gb-populist:~#
# Update the source to v23
# curl -fsSL https://deb.nodesource.com | bash -
# curl -fsSL https://deb.nodesource.com/setup_current.x | sudo -E bash -
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Update npm to the latest major version
npm install -g npm@latest

# Verify (should be Node v23.x and npm v11.x)
node -v
npm -v

```

> open another cli window and cd into **your project** (i.e. index.js) with backend folder inside it, then:

```
# scp -r ./TV root@178.156.240.36:~/
# ~~Move into the folder that just arrived~~
# cd ~/TV
# scp -r . root@178.156.240.36:~/
# rsync -avz --exclude='Android' --exclude='iOS' . root@178.156.240.36:~/
# mkdir -p microservice && mv firestore.rules index.js package.json passport-service.json README.md TV microservice/
# rsync -avz --exclude='Android' --exclude='iOS' . root@178.156.240.36:~/microservice/

chmod 750 /root
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys

sudo npm install -g pm2
pm2 -v
```

> switch back to local cli window

```
rm -rf node_modules & rm -rf TV/node_modules

rsync -avz -e "ssh -i ~/.ssh/id_ed25519.pub" --exclude='Android' --exclude='iOS' . root@178.156.240.36:~/microservice/
```

> switch back to remote-server cli window

```
cd microservice

# Install the engines; if you use TypeScript/NestJS, rebuild: npm run build
npm install

# Start the fire
pm2 start index.js --name "microservice-process"
pm2 save

# Tell PM2 to kill the old process and start the new one
pm2 restart microservice-process --update-env

pm2 logs microservice-process
# [TAILING] Tailing last 15 lines for [microservice-process] process (change the value with --lines option)
# /root/.pm2/logs/microservice-process-error.log last 15 lines:
# /root/.pm2/logs/microservice-process-out.log last 15 lines:
# 0|TV  | 💚 Health check: http://localhost:8080/health

# Diagnose
pm2 logs microservice-process --lines 100

cat ~/.pm2/logs/microservice-process-error.log

pm2 status

curl -I http://localhost:8080
# HTTP/1.1 200 OK
# X-Powered-By: Express
# Content-Type: text/html; charset=utf-8
# Content-Length: 9
# ETag: W/"9-+ADclISKd7HhhWl3Max2maeEh3c"
# Date: Mon, 09 Feb 2026 20:33:26 GMT
# Connection: keep-alive
# Keep-Alive: timeout=5

apt update && apt install caddy -y

ls /etc/caddy/Caddyfile
# /etc/caddy/Caddyfile

systemctl reload caddy

ufw allow 80
ufw allow 443
ufw allow 22
ufw enable

# Edit /etc/caddy/Caddyfile with routing from :80 or the custom domain for proper SSL
sudo chown -R root:caddy /var/www/webapp
sudo chmod -R 755 /var/www/webapp

# If you need to reload caddy
sudo systemctl reload caddy
nano /etc/caddy/Caddyfile

# The Caddyfile is an easy way to configure your Caddy web server.
# Unless the file starts with a global options block, the first uncommented line is always the address of your site.

:80 {
    # 1. API & Backend Routes (Traffic goes to Node.js)
    handle /api/* {
        reverse_proxy localhost:8080
    }
    handle /webhook/* {
        reverse_proxy localhost:8080
    }
    handle /health {
        reverse_proxy localhost:8080
    }

    # 2. React Frontend (Traffic goes to your static files)
    handle {
        root * /var/www/webapp
        file_server
        try_files {path} /index.html
    }
    # Or serve a PHP site through php-fpm:
    # php_fastcgi localhost:9000
}

# Refer to the Caddy docs for more information:
# https://caddyserver.com/docs/caddyfile
```

> To use your own domain name (with automatic HTTPS), first (1) make sure your domain's A/AAAA DNS records are properly pointed to this machine's public IP (e.g. cloudflare A record NO PROXY)

Then, (2) replace ":80" below with your domain name.

```
sudo systemctl reload caddy
nano /etc/caddy/Caddyfile

# change :80 to your domain
pass.contact {
    ...
}
```

Now, (3) turn on proxy.

## Key Features

- **Microsoft Authentication**: Secure sign-in using Monmouth University credentials via Firebase Auth.
- **Focal Navigation**: A gesture-driven UI (iOS) that centers on the Event List with underlays for Profile, Leaderboard, and Camera.
- **QR Attendance**: Students scan event-specific QR codes to log attendance instantly.
- **Identity-Verified One-Time Codes**: A two-step attendance protocol that prevents identity spoofing and code reuse (see below).

## Attendance Security: One-Time Code Protocol

Most event attendance apps trust the client to report who is attending — a student could modify the request to check in a friend, or share a magic link that marks attendance for whoever opens it. Passport eliminates both vectors with a two-step, identity-bound attendance flow:

### How it works

```
Student scans QR ──► App extracts eventId
                         │
                         ▼
                   POST /api/code
                   Authorization: Bearer <Firebase ID token>
                   Body: { eventId }
                         │
                         ▼
              Server verifies token, extracts studentId
              from the verified email (not the request body).
              Checks: event exists? already attended? code exists?
                         │
                         ▼
              Generates one-time code, stores in Firestore as
              attendanceCodes/{studentId}_{eventId} ──► { code, studentId, eventId }
              Returns { code } to client
                         │
                         ▼
                   POST /api/attend
                   Authorization: Bearer <Firebase ID token>
                   Body: { eventId, code }
                         │
                         ▼
              Server re-verifies token, confirms code matches
              the stored code for this student+event.
              Records attendance, deletes code.
```

### What this prevents

| Attack | Why it fails |
|:-------|:-------------|
| **Spoofing a friend's ID** | `studentId` comes from the server-verified Firebase ID token, not the request body. You can only attend as yourself. |
| **Reusing a code** | The code is deleted after successful attendance. The `/api/code` endpoint won't generate a new one once the student is in the attendees list. |
| **Sharing a code** | The code is keyed to `{studentId}_{eventId}`. Even if shared, the server checks that the authenticated user's studentId matches the code's owner. |
| **Attending without a code** | `/api/attend` rejects requests where the code doesn't match or doesn't exist. |
| **Generating codes while logged out** | `/api/code` requires a valid Firebase ID token. No token, no code. |

### What this does NOT prevent

A student physically at the event could video-call the QR code to a friend who scans it on their own authenticated device. This is inherent to static QR codes — the image is the same for everyone. Mitigations like rotating QR codes (live display only, not printable) or geofencing exist but add operational complexity. For Passport's use case, the auth-bound one-time code strikes the right balance: it stops all technical exploits while keeping the UX frictionless.

## Technical Overview

### Authentication & Security

The system uses **Sign In with Microsoft** integrated with Firebase. The backend verifies Firebase ID tokens on every API call using `firebase-admin`, ensuring that the server — not the client — determines the student's identity. Access is restricted to `@monmouth.edu` accounts.

### Data Flow

1. **Mobile Apps (iOS/Android)**: Scan QR, extract eventId, call `/api/code` with Firebase ID token to get a one-time code, then call `/api/attend` with the code. All natively — no browser involved.
2. **Web App (TV/)**: Same two-step flow via the in-browser QR scanner, or auto-attend when visiting `/event/{eventId}?attend={code}`.
3. **API**: Verifies identity from the auth token, validates the one-time code, then updates the `events` and `leaders` collections in Firestore.
4. **TV/Web Leaderboard**: Listens to real-time Firestore snapshots to display a live leaderboard on campus displays.

### Infrastructure

- **Bmicroservice-process**: Node.js API hosted on Hetzner Cloud.
- **Database**: Google Firestore (Firebase).
- **Web**: Hosted at passport.monmouth.edu.
- **iOS**: Built with SwiftUI using a Focal Point Architecture for high-performance gesture navigation.

```

```

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
# scp -r . root@178.156.240.36:~/
# rsync -avz --exclude='Android' --exclude='iOS' . root@178.156.240.36:~/

# ~~Move into the folder that just arrived~~
# cd ~/TV
# mkdir -p passport && mv firestore.rules index.js package.json passport-service.json README.md TV passport/

rsync -avz --exclude='Android' --exclude='iOS' . root@178.156.240.36:~/passport/

# Install the engines
npm install

# Start the fire
pm2 start index.js --name "TV"
pm2 save

pm2 logs TV
# [TAILING] Tailing last 15 lines for [TV] process (change the value with --lines option)
# /root/.pm2/logs/TV-error.log last 15 lines:
# /root/.pm2/logs/TV-out.log last 15 lines:
# 0|TV  | 🚀 IDWise Webhook Handler running on port 8080
# 0|TV  | 📍 Webhook endpoint: http://localhost:8080/webhook
# 0|TV  | 💚 Health check: http://localhost:8080/health
# 0|TV  | ✅ MongoDB connected successfully

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

# If you added new npm packages to your package.json, run this:
npm install

# If you use TypeScript/NestJS, rebuild:
npm run build

# Tell PM2 to kill the old process and start the new one
pm2 restart backend --update-env

# Diagnose
pm2 logs backend --lines 100

cat ~/.pm2/logs/backend-error.log

# If you need to reload caddy
sudo systemctl reload caddy
nano /etc/caddy/Caddyfile

# The Caddyfile is an easy way to configure your Caddy web server.
# Unless the file starts with a global options block, the first uncommented line is always the address of your site.
# To use your own domain name (with automatic HTTPS), first make sure your domain's A/AAAA DNS records are properly pointed to this machine's public IP

:80 {
    # 1. API & Backend Routes (Traffic goes to Node.js)
    handle /admin/* {
        reverse_proxy localhost:8080
    }
    handle /api/* {
        reverse_proxy localhost:8080
    }
    handle /webhook/* {
        reverse_proxy localhost:8080
    }
    handle /health {
        reverse_proxy localhost:8080
    }
    handle /apple {
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

then replace ":80" below with your domain name.

```
pass.contact {
    ...
}
```

## Key Features

- **Microsoft Authentication**: Secure sign-in using Monmouth University credentials via Firebase Auth.
- **Focal Navigation**: A gesture-driven UI (iOS) that centers on the Event List with underlays for Profile, Leaderboard, and Camera.
- **QR Attendance**: Students scan event-specific QR codes to log attendance instantly.
- **Identity Management**: Student IDs are automatically derived from email slugs (e.g., `s1234567`) to ensure data integrity and prevent spoofing.

## Technical Overview

### Authentication & Security

The system uses **Sign In with Microsoft** integrated with Firebase. The backend (at the root) utilizes `firebase-admin` to ensure that attendance records are checked and updated privately. Access is restricted to `@monmouth.edu` accounts.

### Data Flow

1. **Mobile Apps**: Capture QR data and send a POST request to the Node.js API with the student's identity and event ID.
2. **API**: Validates the event existence and student eligibility, then updates the `leaders` and `events` collections in Firestore.
3. **TV/Web**: The ReactJS frontend (served by the root API) listens to real-time Firestore snapshots to display a live leaderboard.

### Infrastructure

- **Backend**: Node.js API hosted on Hetzner Cloud.
- **Database**: Google Firestore (Firebase).
- **Web**: Hosted at passport.monmouth.edu.
- **iOS**: Built with SwiftUI using a Focal Point Architecture for high-performance gesture navigation.

```

```

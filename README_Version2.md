Discord Server Management Panel — MVP

Overview
- Backend (Express + discord.js) + Frontend (static files)
- OAuth2 for login (identify + guilds)
- Bot client performs guild actions (roles/channels)
- Minimal onboarding bot script included

Quick Setup (local)
1) Create a Discord application & bot at https://discord.com/developers/applications
   - Add a bot, copy BOT TOKEN (keep secret)
   - Under OAuth2 -> Redirects add: https://yourpanel.example.com/auth/callback
   - Copy client ID and client secret into backend/.env locally

2) Fill envs (locally):
   - backend/.env (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, BOT_TOKEN, BASE_URL, SESSION_SECRET)
   - bot/.env (BOT_TOKEN, PANEL_URL)

3) Install & run:
   - cd backend && npm install && npm start
   - cd ../bot && npm install && npm start

Security
- NEVER commit .env or tokens to GitHub. Use .env.example in the repo and add .env to .gitignore.
- Use HTTPS for BASE_URL in production.

Bot invite URL (replace CLIENT_ID):
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=268509824
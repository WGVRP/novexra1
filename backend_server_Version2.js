/**
 * Backend: OAuth2 + bot client for managing servers
 * - Fill backend/.env locally with your DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, BOT_TOKEN, BASE_URL, SESSION_SECRET
 * - Run: npm install && node server.js
 *
 * Keep .env private.
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  BOT_TOKEN,
  BASE_URL,
  SESSION_SECRET,
  PORT = 3000,
} = process.env;

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !BOT_TOKEN || !BASE_URL || !SESSION_SECRET) {
  console.error('Missing required env vars. See backend/.env.example');
  process.exit(1);
}

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cookieSession({
  name: 'session',
  keys: [SESSION_SECRET],
  maxAge: 24 * 60 * 60 * 1000,
}));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

client.once('ready', () => console.log(`Bot client ready as ${client.user.tag}`));
client.login(BOT_TOKEN).catch(err => { console.error('Bot login failed', err); process.exit(1); });

const DISCORD_OAUTH_AUTHORIZE = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${BASE_URL}/auth/callback`)}&response_type=code&scope=identify%20guilds`;

app.get('/auth/login', (req, res) => res.redirect(DISCORD_OAUTH_AUTHORIZE));

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code provided');
  try {
    const params = new URLSearchParams();
    params.append('client_id', DISCORD_CLIENT_ID);
    params.append('client_secret', DISCORD_CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', `${BASE_URL}/auth/callback`);

    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token, token_type } = tokenRes.data;
    const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `${token_type} ${access_token}` },
    });

    req.session.discord = { access_token, token_type, guilds: guildsRes.data };
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error', err.response?.data || err.message);
    res.status(500).send('OAuth error');
  }
});

function requireAuth(req, res, next) {
  if (req.session && req.session.discord && req.session.discord.access_token) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

function hasManageGuild(permInt) {
  const ADMIN = 0x8;
  const MANAGE_GUILD = 0x20;
  return (permInt & ADMIN) === ADMIN || (permInt & MANAGE_GUILD) === MANAGE_GUILD;
}

app.get('/api/guilds', requireAuth, (req, res) => {
  const guilds = req.session.discord.guilds || [];
  const manageable = guilds.filter(g => hasManageGuild(Number(g.permissions)));
  res.json({ guilds: manageable });
});

app.get('/api/guilds/:id/info', requireAuth, async (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Bot not in guild' });
  try {
    const roles = guild.roles.cache.map(r => ({ id: r.id, name: r.name, position: r.position })).sort((a,b)=>b.position-a.position);
    const channels = guild.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type }));
    res.json({ id: guild.id, name: guild.name, roles, channels });
  } catch (err) {
    console.error('Error fetching guild info', err);
    res.status(500).json({ error: 'Failed to fetch guild info' });
  }
});

app.post('/api/guilds/:id/roles', requireAuth, async (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Bot not in guild' });
  const { name, color = '#000000', hoist = false } = req.body;
  try {
    const role = await guild.roles.create({ name, color, hoist, reason: 'Created via web panel' });
    res.json({ role: { id: role.id, name: role.name } });
  } catch (err) {
    console.error('Create role failed', err);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

app.delete('/api/guilds/:id/roles/:roleId', requireAuth, async (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Bot not in guild' });
  try {
    const role = guild.roles.cache.get(req.params.roleId);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    await role.delete('Deleted via web panel');
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete role failed', err);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

app.post('/api/guilds/:id/channels', requireAuth, async (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Bot not in guild' });
  const { name, type = 'GUILD_TEXT', parentId } = req.body;
  try {
    const channel = await guild.channels.create({ name, type, parent: parentId || null, reason: 'Created via web panel' });
    res.json({ channel: { id: channel.id, name: channel.name } });
  } catch (err) {
    console.error('Create channel failed', err);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

app.delete('/api/guilds/:id/channels/:channelId', requireAuth, async (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Bot not in guild' });
  try {
    const channel = guild.channels.cache.get(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    await channel.delete('Deleted via web panel');
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete channel failed', err);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

app.post('/api/guilds/:id/members/:memberId/roles/:roleId', requireAuth, async (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Bot not in guild' });
  try {
    const member = await guild.members.fetch(req.params.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    await member.roles.add(req.params.roleId, 'Assigned via web panel');
    res.json({ ok: true });
  } catch (err) {
    console.error('Assign role failed', err);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

app.delete('/api/guilds/:id/members/:memberId/roles/:roleId', requireAuth, async (req, res) => {
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Bot not in guild' });
  try {
    const member = await guild.members.fetch(req.params.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    await member.roles.remove(req.params.roleId, 'Removed via web panel');
    res.json({ ok: true });
  } catch (err) {
    console.error('Remove role failed', err);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

app.get('/api/guilds/:id/check', requireAuth, (req, res) => {
  const guildId = req.params.id;
  const present = !!client.guilds.cache.get(guildId);
  const invite = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=268509824`;
  res.json({ bot_present: present, invite_link: invite });
});

app.post('/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}. Visit ${BASE_URL}/auth/login to sign in`));
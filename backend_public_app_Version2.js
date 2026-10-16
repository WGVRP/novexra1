// Minimal frontend for the panel

const loginBtn = document.getElementById('login');
const logoutBtn = document.getElementById('logout');
const guildList = document.getElementById('guildList');
const serversSection = document.getElementById('servers');
const guildView = document.getElementById('guildView');
const guildTitle = document.getElementById('guildTitle');
const roleList = document.getElementById('roleList');
const channelList = document.getElementById('channelList');
const createRoleBtn = document.getElementById('createRoleBtn');
const newRoleName = document.getElementById('newRoleName');
const createChannelBtn = document.getElementById('createChannelBtn');
const newChannelName = document.getElementById('newChannelName');

loginBtn.onclick = () => { window.location = '/auth/login'; };
logoutBtn.onclick = () => { fetch('/auth/logout', { method: 'POST' }).then(()=>location.reload()); };

async function fetchGuilds() {
  const res = await fetch('/api/guilds');
  if (res.status === 401) {
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    serversSection.style.display = 'none';
    return;
  }
  const data = await res.json();
  loginBtn.style.display = 'none';
  logoutBtn.style.display = 'inline-block';
  serversSection.style.display = 'block';
  guildList.innerHTML = '';
  data.guilds.forEach(g => {
    const li = document.createElement('li');
    li.textContent = g.name;
    li.style.cursor = 'pointer';
    li.onclick = () => openGuild(g.id, g.name);
    guildList.appendChild(li);
  });
}

async function openGuild(id, name) {
  guildView.style.display = 'block';
  guildTitle.textContent = name;
  const chk = await fetch(`/api/guilds/${id}/check`).then(r=>r.json());
  if (!chk.bot_present) {
    if (chk.invite_link) window.open(chk.invite_link, '_blank');
    return alert('Bot is not present in this server. Invite the bot using the link opened.');
  }

  const info = await fetch(`/api/guilds/${id}/info`).then(r=>r.json());
  roleList.innerHTML = '';
  info.roles.forEach(r => {
    const li = document.createElement('li');
    li.textContent = r.name;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => {
      if (!confirm(`Delete role ${r.name}?`)) return;
      await fetch(`/api/guilds/${id}/roles/${r.id}`, { method: 'DELETE' });
      openGuild(id, name);
    };
    li.appendChild(del);
    roleList.appendChild(li);
  });

  channelList.innerHTML = '';
  info.channels.forEach(c => {
    const li = document.createElement('li');
    li.textContent = `${c.name} (${c.type})`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => {
      if (!confirm(`Delete channel ${c.name}?`)) return;
      await fetch(`/api/guilds/${id}/channels/${c.id}`, { method: 'DELETE' });
      openGuild(id, name);
    };
    li.appendChild(del);
    channelList.appendChild(li);
  });

  createRoleBtn.onclick = async () => {
    const n = newRoleName.value.trim();
    if (!n) return alert('Enter role name');
    await fetch(`/api/guilds/${id}/roles`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: n }) });
    newRoleName.value = '';
    openGuild(id, name);
  };

  createChannelBtn.onclick = async () => {
    const n = newChannelName.value.trim();
    if (!n) return alert('Enter channel name');
    await fetch(`/api/guilds/${id}/channels`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: n, type: 'GUILD_TEXT' }) });
    newChannelName.value = '';
    openGuild(id, name);
  };
}

fetchGuilds();
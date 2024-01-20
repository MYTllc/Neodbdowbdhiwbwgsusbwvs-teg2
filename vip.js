const { Client, Intents } = require('discord.js');

const client = new Client({ 
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS
  ]
});

const { token } = require('./config.js');

// Your prefix
const prefix = '+vip';
const ownerID = '851426275464577045'; // Your custom owner ID

client.on('message', async message => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (message.author.id !== ownerID) return message.reply('انت لست مالك البوت.');

  if (command === 'avatar') {
    const avatarURL = args[0]; // URL of the image
    await client.user.setAvatar(avatarURL);

    const msg = await message.channel.send('🌄 UPLOADING IMAGE < CHANGING...');
    setTimeout(async () => {
      await msg.edit('✅ AVATAR CHANGED. 𖡼');
    }, 3000);
  } else if (command === 'username') {
    const newUsername = args.join(' '); // New username
    await client.user.setUsername(newUsername);

    const msg = await message.channel.send('🔧 CHANGING USERNAME... 𖡲');
    setTimeout(async () => {
      await msg.edit('✅ USERNAME CHANGED. 𖠿');
    }, 3000);
  }
});

// Log in to Discord
client.login(token);
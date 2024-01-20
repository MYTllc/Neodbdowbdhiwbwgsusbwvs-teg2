const express = require('express');
const app = express();
const config = require('./config');
const { token, prefix, logChannelId, dbFilePath, requiredRoleId, yourImageURL, voiceChannelId } = config; //To config every thing in code easily 
const port = process.env.PORT || 3000; // Port for the web server
const vip = require('./vip.js');

const fs = require('fs');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

const Discord = require('discord.js');
const { Client, Intents } = Discord;

const sqlite3 = require('sqlite3').verbose();

const { MongoClient } = require('mongodb');
const mongoURI = 'YOUR_MONGODB_URI';

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
  ],
});

const ms = require('ms');
const moment = require('moment');

// Initialize the SQLite database
const db = new sqlite3.Database(dbFilePath);

const giveaways = new Map();

// Create the giveaways table in the database if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS giveaways (
    message_id TEXT PRIMARY KEY,
    time TEXT,
    winners INTEGER,
    prize TEXT,
    host TEXT,
    channel TEXT,
    participants TEXT,
    guild TEXT
  )
`);

// Initialize giveaways from the database
async function initializeGiveaways() {
  db.all('SELECT * FROM giveaways', (err, rows) => {
    if (err) {
      console.error('Error loading giveaways from the database:', err);
      return;
    }

    for (const row of rows) {
      const giveawayData = {
        time: moment(row.time),
        winners: row.winners,
        prize: row.prize,
        host: row.host,
        channel: row.channel,
        participants: JSON.parse(row.participants),
        messageId: row.message_id,
        guild: row.guild,
      };
      giveaways.set(row.message_id, giveawayData);
    }
  });
}

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await initializeGiveaways();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).split(' ');
    const command = args[0];

    if (command === 'start') {
      // Parse command arguments
      const time = ms(args[1]);
      const winners = parseInt(args[2]);
      const prize = args.slice(3).join(' ');

      if (!time || isNaN(winners) || winners < 1 || !prize) {
        message.channel.send('<a:914975243167236186:1164306872753463447> الـرجـاء كـتـابـة الامـر بـالـطريـقة الـصـحـيـحـة');
        return;
      }

      // Check if the user has the required role
      const requiredRole = message.guild.roles.cache.get(requiredRoleId);
      if (requiredRole && !message.member.roles.cache.has(requiredRole.id)) {
        message.channel.send("<a:arab12:1164306871516139590> لا بـوجـد لـديـك الـصلاحـيـات الـكـافيـة يـرجـى الـتـواصـل مـع الادارة");
        return;
      }

      // Calculate the end time
      const endTime = moment().add(time, 'ms');

      // Store the giveaway data in the database
      const giveawayData = {
        time: endTime,
        winners,
        prize,
        host: message.author.tag,
        channel: message.channel.id,
        participants: [],
        messageId: null,
        guild: message.guild.id,
      };

      const stmt = db.prepare('INSERT INTO giveaways VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      stmt.run(
        message.id,
        giveawayData.time.toISOString(),
        giveawayData.winners,
        giveawayData.prize,
        giveawayData.host,
        giveawayData.channel,
        JSON.stringify(giveawayData.participants),
        giveawayData.guild
      );
      stmt.finalize();

      // Create the giveaway message
      const embed = new Discord.MessageEmbed()
        .setTitle(prize)
        .setDescription('<a:arab12:1164306871516139590> لـلـمـشـاركـة أضـغـط عـلـى: ( <a:teemojigold:1182419102028017807> ) <a:arab12:1164306871516139590>')
        .addFields(
          { name: 'من قبل <a:tecrowngold:1182419006930559068>', value: message.author.tag },
          { name: 'عدد الفائزين <a:testarssgold:1182418931860901928>:', value: winners.toString() } // Added Winners field
        )
        .setFooter(`Ends at ${endTime.format('HH:mm')}`, client.user.displayAvatarURL()) // Formatted the footer
        .setColor('#e2bc60')
        .setImage(yourImageURL)
        .setThumbnail("https://cdn.discordapp.com/emojis/1182419163784957954.gif?size=96&quality=lossless");

      const giveawayMessage = await message.channel.send({ embeds: [embed] });
      giveawayMessage.react('<a:teemojigold:1182419102028017807>');
      giveawayData.messageId = giveawayMessage.id;

      // Set a timer to end the giveaway
      setTimeout(endGiveaway, time, giveawayMessage, giveawayData);
    } else if (command === 'ping') {
      message.reply(`<a:914975243167236186:1164306872753463447> بوينج , النبض هو ${Date.now() - message.createdTimestamp}ms.`);
    }
  }
});

// Function to send a DM embed to the winners
function sendWinnerDM(winner, giveawayData) {
  const dmEmbed = new Discord.MessageEmbed()
    .setTitle(giveawayData.prize)
    .addFields(
      { name: '<a:teemojivenom:1182419139541880862> ***Server*** :', value: winner.client.guilds.cache.get(giveawayData.guild).name },
      { name: 'من قبل <a:tecrownvenom:1182419042095595594>', value: giveawayData.host },
      { name: 'Giveaway Link', value: `[Click Here](https://discord.com/channels/${giveawayData.guild}/${giveawayData.channel}/${giveawayData.messageId})` },
      { name: '<a:testarsvenom:1182418961611096075> ***Prize*** :', value: giveawayData.prize }
    )
    .setFooter(`Bot created by: 'its zoro'`)
    .setColor('#bf00ff');

  winner.send({ embeds: [dmEmbed] }).catch(console.error);
}

// Function to log the giveaway in a custom channel
function logGiveaway(giveawayData, winners) {
  const logChannel = client.channels.cache.get(logChannelId);

  if (logChannel) {
    const giveawayLink = `https://discord.com/channels/${giveawayData.guild}/${giveawayData.channel}/${giveawayData.messageId}`;

    const logEmbed = new Discord.MessageEmbed()
      .setTitle('***TE Giveaway Bot Log***')
      .setDescription(`<a:teemojired:1182419129169362954> ***Prize*** : ${giveawayData.prize}`)
      .addFields(
        { name: 'من قبل <a:tecrownred:1182419029336543343>', value: giveawayData.host },
        { name: 'الفائز <a:testarsred:1182418900709806231>:', value: winners.map(winner => winner.tag).join(', ') },
        { name: '<a:914975243167236186:1164306872753463447> مـوقـع الـجـيـف:', value: giveawayLink },
        { name: '<a:914975243167236186:1164306872753463447> تـاريـخ صـنـع الـجـيـف:', value: moment().format('DD/MM/YYYY, h:mm:ss a') }
      )
      .setColor('#ff0000');

    logChannel.send({ embeds: [logEmbed] });
  }
}

// Function to send an announcement message in the same channel
function announceWinners(channel, winners, giveawayData) {
  const winnerMentions = winners.map((winner) => winner.toString()).join(', ');
  channel.send(`<a:teemojigold:1182419102028017807>  ✦ ${winnerMentions} →   : ${giveawayData.prize}  ✦ <a:testarssgold:1182418931860901928>`);
}

// Function to end the giveaway
async function endGiveaway(giveawayMessage, giveawayData) {
  const messageId = giveawayData.messageId;
  const reaction = giveawayMessage.reactions.cache.get('1182419102028017807');

  if (!reaction) {
    giveawayMessage.edit('لم يتم العثور على ايموجي المشاركة!!');
    return;
  }

  const users = await reaction.users.fetch();
  const participants = users.filter((user) => !user.bot && user.id !== client.user.id);

  // Ensure that the number of winners is not greater than the number of participants
  const numWinners = Math.min(giveawayData.winners, participants.size);

  if (numWinners < giveawayData.winners) {
    giveawayMessage.edit(`<a:arab12:1164306871516139590>   تم الغاء الجيف اوي بسبب عدد المشاركين غير كافي 
<a:914975243167236186:1164306872753463447>`);
  }

  // Randomly select winners from participants
  const winners = [];
  const participantArray = Array.from(participants.values());
  for (let i = 0; i < numWinners; i++) {
    const randomIndex = Math.floor(Math.random() * participantArray.length);
    winners.push(participantArray.splice(randomIndex, 1)[0]);
  }

  giveawayData.participants = winners;

  // Create the winners list
  const winnerList = winners.map((winner) => winner.toString()).join(', ');

  // Edit the giveaway message to show winners
  giveawayMessage.edit({
    content: '<a:teemojigold:1182419102028017807> لـقـد انـتهـى الجـيـف اوي',
    embeds: [
      new Discord.MessageEmbed()
        .setTitle(giveawayData.prize)
        .setDescription(`الفائز <a:testarssgold:1182418931860901928>: ${winnerList}`)
        .addFields(
          { name: 'من قبل <a:tecrowngold:1182419006930559068>:', value: giveawayData.host },
        )
    ]
  });

  // Send a DM to each winner
  winners.forEach((winner) => {
    sendWinnerDM(winner, giveawayData);
  });

  // Log the giveaway in the custom log channel
  logGiveaway(giveawayData, winners);

  // Call the announceWinners function to send an announcement in the same channel
  announceWinners(giveawayMessage.channel, winners, giveawayData);

  // Remove the giveaway from the map
  giveaways.delete(messageId);
}

// Define a simple route for the web server
app.get('/', (req, res) => {
  res.send('Bot was devloped by : Its.zoro , status : 🟢');
});

// Start the Express web server
app.listen(port, () => {
  console.log(`Web server is running on port ${port}`);
});

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await initializeGiveaways();

  // Join the custom voice channel
  const voiceChannel = client.channels.cache.get(voiceChannelId);
  if (voiceChannel && voiceChannel.type === 'GUILD_VOICE') {
  voiceChannel.join();
} else {
  console.error('Invalid voice channel ID or channel type.');
  }

  // Set the presence status to idle and the custom state message
  client.user.setPresence({
    status: 'idle',
    activities: [
      {
        name: 'Dev : Its Zoro $',
        type: 'STREAMING',
        url: 'https://twitch.tv/amlabbas'
      }
    ]
  });
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return; // Ignore messages from bots

  if (message.content.toLowerCase() === `${prefix}help`) {
    const owner = '851426275464577045';
    const thumbnailUrl = 'https://cdn.discordapp.com/emojis/1135199647175016518.gif?size=80&quality=lossless';

    const embed = new Discord.MessageEmbed()
      .setTitle('**TE Giveaway Bot Help**')
      .setDescription('*جميع اوامر البوت مع شرح مبسط* <a:18:1077550372895338519>:')
      .addField(`${prefix}start (time) (winners) (prize)`, '*لصنع جيف اوي * <a:18:1077550372895338519>')
      .addField(`${prefix}ping`, '*لمعرفة بنج البوت* <a:18:1077550372895338519>')
      .addField(`${prefix}help`, '*لعرض قائمة الاوامر والمساعدة* <a:18:1077550372895338519>')
      .setThumbnail(thumbnailUrl)
      .setColor('#ae711f')
      .setFooter(`Bot Owner ID : ${owner}`, client.user.displayAvatarURL());

    message.channel.send({ embeds: [embed] });
  } else if (message.content.toLowerCase() === `${prefix}cmd`) {
    const latency = Date.now() - message.createdTimestamp;
    message.channel.send(`+start (time) (winners) (prize)`);
  }
  // Add more commands and their handling here
});


vip
client.login(token);

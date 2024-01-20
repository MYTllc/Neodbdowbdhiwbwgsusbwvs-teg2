const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000; // Use the provided port or a default one

// Define a simple route
app.get('/', (req, res) => {
  res.send('Bot is online.');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Your bot logic and other code can go here

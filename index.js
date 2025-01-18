const TelegramBot = require('node-telegram-bot-api');
const connectDB = require('./config/database');

// Connect to MongoDB
connectDB();

// Initialize bot
const bot = new TelegramBot('6748384489:AAGV42T0PoOel_1519X5ot_rLLnpQqqDTdA', { polling: true });

// Load handlers
require('./handlers/gameHandler')(bot);
require('./handlers/plantingHandler')(bot);
require('./handlers/shopHandler')(bot);
require('./handlers/animalHandler')(bot);
require('./handlers/myAsset')(bot);
require('./handlers/taixiu')(bot);

console.log('Farm game bot is running...');
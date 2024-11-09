const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const crc = require('crc'); // Cần cài đặt thư viện `crc`: npm install crc
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const keep_alive = require('./keep_alive.js');





mongoose.connect('mongodb+srv://duchieufaryoung0:80E9gUahdOXmGKuy@cluster0.6nlv1cv.mongodb.net/telegram_bot_db?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });

// Schema Definition
const accountSchema = new mongoose.Schema({
  // Existing basic user info
  userId: { type: Number, required: true, unique: true },
  username: String,

  // Currency and resources
  gold: { type: Number, default: 0 },
  vndc: { type: Number, default: 1000000 },
  vnd: { type: Number, default: 1000000000 },

  //hoạt động
  lastActive: { type: Date, default: Date.now },
  referralCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },

  // Mining related
  miningRate: { type: Number, default: 5 }, // VNDC/hour
  lastMiningUpdate: { type: Date, default: Date.now },
  miningEndTime: { type: Date, default: Date.now() },
  isMining: { type: Boolean, default: true },

  // Game items
  specialGemCount: { type: Number, default: 0 },
  spinCount: { type: Number, default: 0 },
  robberyCount: { type: Number, default: 0 },

  // Level system
  level: { type: Number, default: 1 },
  subLevel: { type: Number, default: 0 },
  exp: { type: Number, default: 0 },
  vipLevel: { type: Number, default: 0 },

  // Island related
  islandImage: { type: String, default: 'default-island-image-url' },
  islandUpgradeCount: { type: Number, default: 0 },
  currentIslandImageUrl: { type: String, default: 'default-island-url' },

  // điểm danh
    dailyCheckin: {
    lastCheckin: { type: Date, default: null },
    streak: { type: Number, default: 0 },
    totalCheckins: { type: Number, default: 0 }
      },

  // Gift box system
  giftBoxCount: { type: Number, default: 0 },
  currentGiftBoxMilestone: { type: Number, default: 0 },
  lastMilestoneResetTime: { type: Date, default: Date.now },

  // Spin related
  multiplier: { type: Number, default: 1 },
  lastSpinTime: { type: Date, default: null },
  lastRewardTime: { type: Date, default: null },
  lastSpecialSpinTime: { type: Date, default: null },
  spinMessageId: { type: Number, default: null },
  lastSpinRewardTime: { type: Date, default: Date.now },
  isSpinning: { type: Boolean, default: false },

  // Robbery related
  lastRobberyTime: { type: Date, default: null },

  // Achievement system
  achievements: [{ type: String }],
  totalUpgrades: { type: Number, default: 0 },
  consecutiveLogins: { type: Number, default: 0 },

  // Milestone rewards history
  milestoneRewards: [{
    milestone: Number,
    rewardType: String,
    amount: Number,
    dateAwarded: { type: Date, default: Date.now }
  }],

  // Last milestone reset tracking
  lastMilestoneReset: { type: Date, default: Date.now },

  // Referral system
  referralCode: { type: String, unique: true },
  referredBy: { type: Number },
  referralRewardClaimed: { type: Boolean, default: false },
  totalReferrals: { type: Number, default: 0 },
  referralList: [{
    userId: Number,
    username: String,
    joinedAt: Date,
    lastTotalVndc: { type: Number, default: 0 }, // Đổi tên và mục đích field này
    lastClaimTime: { type: Date }  // Thêm trường này
  }],
  referralId: { type: String, default: null },
  totalVndcEarned: { type: Number, default: 0 },
  pendingReferralVndc: { type: Number, default: 0 },
  lastClaimTime: { type: Date },
  totalReferralVndc: { type: Number, default: 0 },

  // Banking information
    bankInfo: {
      bankCode: String,
      accountNumber: String,
      accountName: String,
      isVerified: { type: Boolean, default: false }
    },

    // Withdrawal history
    withdrawalHistory: [{
      amount: Number,
      bankInfo: {
        bankCode: String,
        accountNumber: String,
        accountName: String
      },
      status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
      requestDate: { type: Date, default: Date.now },
      processDate: Date,
      transactionId: String,
      reason: String // For rejected withdrawals
    }],

    // User state management
    userState: {
      currentState: String,
      bankCode: String,
      tempWithdrawalAmount: Number,
      lastMessageId: Number
    },

  // Add quests field with default values
  quests: {
    type: {
      joinGroup: { type: Boolean, default: false },
      changeUsername: { type: Boolean, default: false },
      lastCheckTime: { type: Date, default: null },
      rewards: {
        joinGroupClaimed: { type: Boolean, default: false },
        changeUsernameClaimed: { type: Boolean, default: false }
      }
    },
    default: {
      joinGroup: false,
      changeUsername: false,
      lastCheckTime: null,
      rewards: {
        joinGroupClaimed: false,
        changeUsernameClaimed: false
      }
    }
  }
 
});

// Generate referral code method
accountSchema.methods.generateReferralCode = function() {
  return crypto.randomBytes(4).toString('hex');
};



const WithdrawalSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  bankInfo: {
    bankCode: String,
    accountNumber: String,
    accountName: String
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);




// Add indexes for frequently queried fields
accountSchema.index({ userId: 1 });
accountSchema.index({ username: 1 });

const Account = mongoose.model('Account', accountSchema);


const bot = new TelegramBot('7753869579:AAHzngwsjPkK_q5W4g3vGVMSb4HwEbtxChY', {
  polling: true,
  request: {
    prefer_authorize: 'never',
    preferred_language: 'vi',
  },
});





// Thêm lệnh /themvndc
bot.onText(/\/themvndc/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Tìm tài khoản người chơi
    const account = await Account.findOne({ chatId });
    if (!account) {
      await bot.sendMessage(chatId, '❌ Không tìm thấy tài khoản của bạn.');
      return;
    }

    // Cộng thêm 1.000.000 VNDC
    const amount = 1000000;
    account.vndc += amount;

    // Lưu vào database
    await account.save();

    // Gửi thông báo thành công
    await bot.sendMessage(chatId, 
      `✅ Đã cộng thêm ${amount.toLocaleString('vi-VN')} VNDC vào tài khoản của bạn.\n` +
      `Số dư hiện tại: ${account.vndc.toLocaleString('vi-VN')} VNDC`
    );

  } catch (error) {
    console.error('Lỗi khi thêm VNDC:', error);
    await bot.sendMessage(chatId, '❌ Đã có lỗi xảy ra. Vui lòng thử lại sau.');
  }
});

// Updated gift box milestones with fixed rewards per milestone
const giftBoxMilestones = [
  { max: 10, rewards: generateFixedMilestoneReward(10000, 20000) },
  { max: 25, rewards: generateFixedMilestoneReward(25000, 50000) },
  { max: 50, rewards: generateFixedMilestoneReward(50000, 100000) },
  { max: 100, rewards: generateFixedMilestoneReward(100000, 200000) },
  { max: 200, rewards: generateFixedMilestoneReward(200000, 400000) },
  { max: 500, rewards: generateFixedMilestoneReward(500000, 1000000) },
  { max: 1000, rewards: generateFixedMilestoneReward(1000000, 2000000) },
  { max: 2000, rewards: generateFixedMilestoneReward(2000000, 4000000) },
  { max: 3000, rewards: generateFixedMilestoneReward(3000000, 5500000) },
  { max: 5000, rewards: generateFixedMilestoneReward(5000000, 8000000) },
  { max: 10000, rewards: generateFixedMilestoneReward(8000000, 12000000) },
  { max: 500000, rewards: generateFixedMilestoneReward(30000000, 50000000) }
];

// Function to generate fixed milestone reward once
function generateFixedMilestoneReward(minReward, maxReward) {
  const rewardType = Math.random();
  if (rewardType < 0.4) { // 40% chance for gold
    return {
      type: 'gold',
      amount: Math.floor(Math.random() * (maxReward - minReward + 1) + minReward)
    };
  } else if (rewardType < 0.7) { // 30% chance for spins
    return {
      type: 'spins',
      amount: Math.floor(Math.random() * (maxReward/10000 - minReward/10000 + 1) + minReward/10000)
    };
  } else { // 30% chance for VNDC
    return {
      type: 'vndc',
      amount: Math.floor(Math.random() * (maxReward/1000 - minReward/1000 + 1) + minReward/1000)
    };
  }
}

// Updated keyboard for spin multipliers
function getSpinKeyboard() {
  return {
    keyboard: [
      ['x1', 'x2', 'x3'],
      ['x5', 'x10', 'x20'],
      ['🔙 Quay lại']
    ],
    resize_keyboard: true
  };
}

function getMainKeyboard() {
  return {
    keyboard: [['🎰 Vòng quay']],
    resize_keyboard: true
  };
}



// Time calculation function remains the same
function getTimeUntilNextReward(lastRewardTime) {
  const REWARD_INTERVAL = 30 * 60 * 1000;
  const now = Date.now();
  const timeSinceLastReward = now - lastRewardTime;
  const timeRemaining = REWARD_INTERVAL - (timeSinceLastReward % REWARD_INTERVAL);
  return Math.ceil(timeRemaining / 60000);
}

async function updateAutoSpins(account) {
  const REWARD_INTERVAL = 30 * 60 * 1000;
  const SPINS_PER_REWARD = 5;

  const now = Date.now();
  const timeSinceLastReward = now - account.lastSpinRewardTime.getTime();
  const rewardCycles = Math.floor(timeSinceLastReward / REWARD_INTERVAL);

  if (rewardCycles > 0) {
    account.spinCount += rewardCycles * SPINS_PER_REWARD;
    account.lastSpinRewardTime = new Date(
      account.lastSpinRewardTime.getTime() + (rewardCycles * REWARD_INTERVAL)
    );
    await account.save();
  }
}

// Update generateSpinResults to include VNDC
function generateSpinResults(multiplier) {
  const items = ['🏅 Vàng', '🏆 Hũ vàng', '🎁 Hộp quà', '🎫 Lượt quay thưởng', '⚔️ Lượt cướp đảo', '💎 VNDC'];
  let matchProbabilities;

  if (multiplier <= 3) {
    matchProbabilities = [0.5, 0.4, 0.1];
  } else if (multiplier <= 10) {
    matchProbabilities = [0.4, 0.4, 0.2];
  } else {
    matchProbabilities = [0.3, 0.4, 0.3];
  }

  const results = [];
  const random = Math.random();
  let numMatching;

  if (random < matchProbabilities[0]) {
    numMatching = 1;
  } else if (random < matchProbabilities[0] + matchProbabilities[1]) {
    numMatching = 2;
  } else {
    numMatching = 3;
  }

  if (numMatching === 3) {
    const selectedItem = items[Math.floor(Math.random() * items.length)];
    results.push(selectedItem, selectedItem, selectedItem);
  } else if (numMatching === 2) {
    const selectedItem = items[Math.floor(Math.random() * items.length)];
    const remainingItems = items.filter(item => item !== selectedItem);
    const differentItem = remainingItems[Math.floor(Math.random() * remainingItems.length)];
    results.push(selectedItem, selectedItem, differentItem);
  } else {
    const shuffledItems = items.sort(() => 0.5 - Math.random());
    results.push(shuffledItems[0], shuffledItems[1], shuffledItems[2]);
  }

  return results.sort(() => 0.5 - Math.random());
}

// Function to generate random VNDC amount based on probabilities
function generateVNDCReward() {
  const random = Math.random();

  if (random < 0.70) { // 70% chance
    return Math.floor(Math.random() * 11) + 10; // 10-20 VNDC
  } else if (random < 0.90) { // 20% chance
    return Math.floor(Math.random() * 11) + 30; // 30-40 VNDC
  } else if (random < 0.97) { // 7% chance
    return Math.floor(Math.random() * 51) + 50; // 50-100 VNDC
  } else { // 3% chance
    return Math.floor(Math.random() * 201) + 200; // 200-400 VNDC
  }
}

// Update calculateRewards to include VNDC rewards
function calculateRewards(spinResults, multiplier) {
  const counts = spinResults.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {});

  let rewards = {
    gold: 0,
    spinCount: 0,
    giftBox: 0,
    robberyCount: 0,
    vndc: 0,
    showRaidButton: false
  };

  const uniqueItems = new Set(spinResults);
  let bonusMultiplier = 1;

  if (multiplier <= 3) bonusMultiplier = 1.2;
  else if (multiplier <= 10) bonusMultiplier = 1.5;
  else bonusMultiplier = 2.0;

  if (uniqueItems.size === 3) {
    if (counts['🏅 Vàng']) rewards.gold += 2500 * multiplier;
    if (counts['🏆 Hũ vàng']) rewards.gold += 6000 * multiplier;
    if (counts['🎫 Lượt quay thưởng']) {
    rewards.spinCount += 1 * multiplier;
    if (rewards.spinCount > 100) {
      rewards.spinCount = 100; // Cap at 100 spins
    }
  }
    if (counts['🎁 Hộp quà']) rewards.giftBox += Math.floor(Math.random() * 2 + 1) * multiplier;
    if (counts['💎 VNDC']) rewards.vndc += generateVNDCReward();
  }
  else if (uniqueItems.size === 2) {
    if (counts['🏅 Vàng'] === 2) rewards.gold += Math.floor(6000 * multiplier * bonusMultiplier);
    if (counts['🏆 Hũ vàng'] === 2) rewards.gold += Math.floor(34000 * multiplier * bonusMultiplier);
    if (counts['🎫 Lượt quay thưởng'] === 2) rewards.spinCount += Math.floor(2 * multiplier * bonusMultiplier);
    if (counts['🎁 Hộp quà'] === 2) rewards.giftBox += Math.floor(2 * multiplier * bonusMultiplier);
    if (counts['💎 VNDC'] === 2) rewards.vndc += Math.floor(generateVNDCReward() * 1);
  }
  else if (uniqueItems.size === 1) {
    if (counts['🏅 Vàng'] === 3) rewards.gold += Math.floor(15000 * multiplier * bonusMultiplier);
    if (counts['🏆 Hũ vàng'] === 3) rewards.gold += Math.floor(30000 * multiplier * bonusMultiplier);
    if (counts['🎫 Lượt quay thưởng'] === 3) rewards.spinCount += Math.floor(4 * multiplier * bonusMultiplier);
    if (counts['🎁 Hộp quà'] === 3) rewards.giftBox += Math.floor(5 * multiplier * bonusMultiplier);
    if (counts['💎 VNDC'] === 3) rewards.vndc += Math.floor(generateVNDCReward() * 2);
    if (counts['⚔️ Lượt cướp đảo'] === 3) {
      rewards.robberyCount = 1;
      rewards.showRaidButton = true;
    }
  }

// Ensure VNDC rewards are properly calculated as integers
  rewards.vndc = Math.floor(rewards.vndc);

  return rewards;
}
// Function to generate random milestone reward
function generateMilestoneReward(minReward, maxReward) {
  const rewardType = Math.random();
  if (rewardType < 0.4) { // 40% chance for gold
    return {
      type: 'gold',
      amount: Math.floor(Math.random() * (maxReward - minReward + 1) + minReward)
    };
  } else if (rewardType < 0.7) { // 30% chance for spins
    return {
      type: 'spins',
      amount: Math.floor(Math.random() * (maxReward/10000 - minReward/10000 + 1) + minReward/10000)
    };
  } else { // 30% chance for VNDC
    return {
      type: 'vndc',
      amount: Math.floor(Math.random() * (maxReward/1000 - minReward/1000 + 1) + minReward/1000)
    };
  }
}

// Add function to handle referral bonus
async function handleReferralBonus(userId, vndcAmount) {
  try {
    const account = await Account.findOne({ userId: userId });
    if (!account || !account.referralId) return;

    const referrer = await Account.findOne({ userId: account.referralId });
    if (!referrer) return;

    // Calculate 10% bonus
    const bonusAmount = Math.floor(vndcAmount * 0.1);

    // Add bonus to referrer's account
    referrer.vndc += bonusAmount;
    referrer.totalVndcEarned += bonusAmount;
    await referrer.save();

    // Optionally notify the referrer
    bot.sendMessage(referrer.userId, 
      `💎 Bạn nhận được ${formatNumber(bonusAmount)} VNDC từ người được giới thiệu!`
    );
  } catch (error) {
    console.error('Error handling referral bonus:', error);
  }
}

// Function to get next milestone preview
function getNextMilestonePreview(currentMilestone) {
  const milestone = giftBoxMilestones[currentMilestone];
  if (!milestone) return 'Đã đạt tất cả các mốc!';

  const reward = generateMilestoneReward(milestone.minReward, milestone.maxReward);
  let rewardText = '';
  switch (reward.type) {
    case 'gold':
      rewardText = `${reward.amount} vàng 💰`;
      break;
    case 'spins':
      rewardText = `${reward.amount} lượt quay 🎫`;
      break;
    case 'vndc':
      rewardText = `${reward.amount} VNDC 💎`;
      break;
  }
  return `Mốc ${milestone.max} hộp quà: ${rewardText}`;
}


// Updated checkMilestoneReward function
async function checkMilestoneReward(account) {
  const currentMilestone = giftBoxMilestones[account.currentGiftBoxMilestone];
  if (!currentMilestone) return null;

  // Check if milestone reset is needed (2 days = 172800000 ms)
  if (Date.now() - account.lastMilestoneResetTime.getTime() > 172800000) {
    account.currentGiftBoxMilestone = 0;
    account.giftBoxCount = 0;
    account.lastMilestoneResetTime = new Date();
    await account.save();
    return { type: 'reset' };
  }

  if (account.giftBoxCount >= currentMilestone.max) {
    const reward = currentMilestone.rewards;
    switch (reward.type) {
      case 'gold':
        account.gold += reward.amount;
        break;
      case 'spins':
        account.spinCount += reward.amount;
        break;
      case 'vndc':
        account.vndc += reward.amount;
        break;
    }
    account.currentGiftBoxMilestone += 1;
    return reward;
  }
  return null;
}


// Helper function to format numbers
function formatNumber2(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Get progress bar
function getProgressBar(current, max, length = 10) {
  const progress = Math.floor((current / max) * length);
  const filled = '█'.repeat(progress);
  const empty = '░'.repeat(length - progress);
  return filled + empty;
}

// Format milestone reward text
function formatMilestoneReward(reward) {
  switch (reward.type) {
    case 'gold':
      return `${formatNumber2(reward.amount)} vàng 💰`;
    case 'spins':
      return `${reward.amount} lượt quay 🎫`;
    case 'vndc':
      return `${formatNumber2(reward.amount)} VNDC 💎`;
  }
}

// Get next milestone preview with progress
function getNextMilestonePreview(account) {
  const milestone = giftBoxMilestones[account.currentGiftBoxMilestone];
  if (!milestone) return '🏆 Chúc mừng! Bạn đã đạt tất cả các mốc!';

  const progress = `${formatNumber2(account.giftBoxCount)}/${formatNumber2(milestone.max)}`;
  const progressBar = getProgressBar(account.giftBoxCount, milestone.max);
  const reward = formatMilestoneReward(milestone.rewards);

  return `📦 Mốc hộp quà: ${progress}\n${progressBar}\n🎁 Phần thưởng: ${reward}`;
}

// Function to get keyboard with raid button
function getKeyboardWithRaid() {
  return {
    keyboard: [
      ['⚔️ Đi cướp biển'],
     
    ],
    resize_keyboard: true
  };
}


// Updated command handlers
bot.onText(/Vòng quay/, async (msg) => {
  try {
    const account = await Account.findOne({ userId: msg.from.id });
    if (!account) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản, vui lòng /start để tạo tài khoản mới.');
    }

    const remainingSpin = account.spinCount;
    if (remainingSpin <= 0) {
      return bot.sendMessage(msg.chat.id, '❌ Bạn đã hết lượt quay, vui lòng quay lại sau.');
    }

    bot.sendMessage(msg.chat.id, 
      `🎰 Chọn mức quay:\n\n` +
      `Lượt quay hiện có: ${remainingSpin} 🎫\n` +
      `Vàng hiện có: ${account.gold} 💰\n` +
      `Hộp quà: ${account.giftBoxCount}/${giftBoxMilestones[account.currentGiftBoxMilestone].max} 🎁\n` +
      `Lượt cướp đảo: ${account.robberyCount} ⚔️`,
      { reply_markup: getSpinKeyboard() }
    );
  } catch (error) {
    console.error('Error in Vòng quay:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

bot.onText(/🔙 Quay lại/, (msg) => {
  bot.sendMessage(msg.chat.id, '📱 Menu chính', {
    reply_markup: getMainKeyboard()
  });
});

// Handle multiplier selections
bot.onText(/^x(\d+)$/, async (msg, match) => {
  try {
    const multiplier = parseInt(match[1]);
    const account = await Account.findOne({ userId: msg.from.id });

    if (!account) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản!');
    }

    if (account.isSpinning) {
      return bot.sendMessage(msg.chat.id, '⏳ Đang trong quá trình quay, vui lòng đợi!');
    }

    await updateAutoSpins(account);

    if (account.spinCount < multiplier) {
      return bot.sendMessage(msg.chat.id, '❌ Không đủ lượt quay!');
    }

    account.isSpinning = true;
    account.spinCount -= multiplier;
    account.multiplier = multiplier;
    await account.save();

    const minutesUntilNextReward = getTimeUntilNextReward(account.lastSpinRewardTime);

    const spinningMessage = await bot.sendAnimation(msg.chat.id, 
      'https://i.pinimg.com/originals/15/f5/55/15f5550699b5a60e1194f6b76bceca9e.gif',
      {
        caption: '🎰 Đang quay...\n\n' +
          `━━━━━━━━━━━━━━━\n` +
            `⚡ Năng lượng: ${account.spinCount - multiplier}/${account.spinCount} lượt quay\n` +
            `💰 Vàng: ${formatNumber(account.gold)}\n` +
            
            `━━━━━━━━━━━━━━━\n` +
          `⚔️ Lượt cướp đảo: ${account.robberyCount}\n` +
          `\n⏳ Nhận thêm 5 lượt quay sau: ${minutesUntilNextReward} phút`
      }
    );

          setTimeout(async () => {
            try {
              const spinResults = generateSpinResults(multiplier);
              const rewards = calculateRewards(spinResults, multiplier);
              const uniqueItems = new Set(spinResults);

              // Update account values
              account.gold += rewards.gold;
              account.spinCount += rewards.spinCount;
              account.giftBoxCount += rewards.giftBox;
              account.robberyCount += rewards.robberyCount;
              account.vndc += rewards.vndc;
              account.totalVndcEarned += rewards.vndc;
              account.isSpinning = false;

              let referralBonus = 0;

             // Handle referral bonus if VNDC was won
              if (rewards.vndc > 0) {
                await handleReferralBonus(msg.from.id, rewards.vndc);
              }

              const milestoneReward = await checkMilestoneReward(account);
              await account.save();

              const updatedMinutesUntilNextReward = getTimeUntilNextReward(account.lastSpinRewardTime);

              // Build result message with improved formatting
              let resultMessage = `🎰 KẾT QUẢ QUAY (x${multiplier})\n`;
              resultMessage += `━━━━━━━━━━━━━━━\n`;
              resultMessage += `${spinResults.join(' ')} ${uniqueItems.size === 1 ? '🌟' : ''}\n`;
              resultMessage += `━━━━━━━━━━━━━━━\n\n`;

              // Rewards section
              if (Object.values(rewards).some(r => r > 0)) {
                resultMessage += `🎁 PHẦN THƯỞNG NHẬN ĐƯỢC\n`;
                resultMessage += `━━━━━━━━━━━━━━━\n`;
                if (rewards.gold > 0) resultMessage += `💰 Vàng      +${formatNumber(rewards.gold)}\n`;
                if (rewards.spinCount > 0) resultMessage += `🎫 Lượt quay  +${rewards.spinCount}\n`;
                if (rewards.giftBox > 0) resultMessage += `📦 Hộp quà    +${rewards.giftBox}\n`;
                if (rewards.vndc > 0) {
                  resultMessage += `💎 VNDC       +${formatNumber(rewards.vndc)}\n`;
                  if (referralBonus > 0) {
                    resultMessage += `👥 Hoa hồng    +${formatNumber(referralBonus)} (Người giới thiệu)\n`;
                  }
                }
                if (rewards.robberyCount > 0) resultMessage += `⚔️ Lượt cướp  +${rewards.robberyCount}\n`;
                resultMessage += `━━━━━━━━━━━━━━━\n\n`;
              }

          // Account status section
              // Update the account status section to properly format VNDC
              resultMessage += `📊 THÔNG TIN TÀI KHOẢN\n`;
              resultMessage += `━━━━━━━━━━━━━━━\n`;
              resultMessage += `👑 Cấp độ: ${account.level} (${account.exp}/100 EXP)\n`;
              resultMessage += `💰 Vàng: ${formatNumber(account.gold)}\n`;
              resultMessage += `💎 VNDC: ${formatNumber(account.vndc)}\n`;

              if (rewards.vndc > 0) {
                resultMessage += `💎 VNDC nhận được: +${formatNumber(rewards.vndc)}\n`;
              }
          // Milestone section
          resultMessage += `${getNextMilestonePreview(account)}\n`;

          // Free spin timer
          resultMessage += `\n⏰ Lượt quay miễn phí sau: ${updatedMinutesUntilNextReward} phút`;

          // Milestone reward notification
          if (milestoneReward) {
            if (milestoneReward.type === 'reset') {
              resultMessage += '\n\n🔄 Đã reset mốc quà do quá 2 ngày!';
            } else {
              resultMessage += `\n\n🎊 CHÚC MỪNG ĐẠT MỐC! 🎊\n`;
              resultMessage += `━━━━━━━━━━━━━━━\n`;
              resultMessage += `Bạn đã nhận: ${formatMilestoneReward(milestoneReward)}`;
            }
          }

          // Send result with appropriate GIF
          let gifUrl;
          if (uniqueItems.size === 1) {
            gifUrl = 'https://i.pinimg.com/originals/ea/cf/bd/eacfbdcefeed9f3d1a6f18b0a220a97f.gif';
          } else if (uniqueItems.size === 3) {
            gifUrl = 'https://i.pinimg.com/originals/60/3d/cb/603dcb41a39ab9fb7b1a59b06d3c4a50.gif';
          } else {
            gifUrl = 'https://i.pinimg.com/originals/fa/32/33/fa3233aa3d5898692edbb2199757032d.gif';
          }

          await bot.deleteMessage(msg.chat.id, spinningMessage.message_id);
          await bot.sendAnimation(msg.chat.id, gifUrl, {
            caption: resultMessage,
            reply_markup: rewards.robberyCount > 0 ? getKeyboardWithRaid() : getSpinKeyboard()
          });

        } catch (error) {
          console.error('Error in spin result processing:', error);
          account.isSpinning = false;
          await account.save();
          await bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra trong quá trình quay, vui lòng thử lại sau.');
        }
      }, 3000);
  
   

  } catch (error) {
    console.error('Error in multiplier handling:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau!');
  }
});




// Xử lý lệnh /321 để reset isSpinning về false
bot.onText(/\/321/, async (msg) => {
  const userId = msg.from.id;

  try {
    // Tìm kiếm tài khoản của người dùng
    const account = await Account.findOne({ userId });

    if (account) {
      // Reset trạng thái isSpinning về false
      account.isSpinning = false;
      await account.save();

      // Thông báo cho người dùng
      bot.sendMessage(msg.chat.id, '✅ Trạng thái quay đã được reset về false.');
    } else {
      bot.sendMessage(msg.chat.id, '🚫 Tài khoản không tồn tại.');
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(msg.chat.id, '❌ Đã có lỗi xảy ra trong quá trình xử lý.');
  }
});



// Xử lý khi nhấn vào nút reply keyboard Quản lý người dùng
bot.onText(/Quản lý người dùng/, async (msg) => {
  const adminUsername = 'duchieu287'; // Replace with the actual admin username

  if (msg.from.username === adminUsername) {
    const totalAccounts = await Account.countDocuments();
    const totalSpecialGems = await Account.aggregate([{ $group: { _id: null, total: { $sum: "$specialGemCount" } } }]);

    const replyMessage = `
      Tổng số tài khoản hiện tại: ${totalAccounts}
      Tổng số Ngọc Biển Huyền Bí: ${totalSpecialGems.length > 0 ? totalSpecialGems[0].total : 0}
    `;

    bot.sendMessage(msg.chat.id, replyMessage);
  } else {
    bot.sendMessage(msg.chat.id, 'Bạn không có quyền truy cập vào quản lý người dùng.');
  }
});




// Thêm biến global để lưu trữ thông tin người bị cướp
let robberyTargets = new Map();

bot.onText(/⚔️ Đi cướp biển/, async (msg) => {
  try {
    const userId = msg.from.id;

    // Kiểm tra tài khoản người chơi
    const playerAccount = await Account.findOne({ userId: userId });
    if (!playerAccount) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản của bạn!');
    }

    // Kiểm tra số lượt cướp đảo
    if (playerAccount.robberyCount <= 0) {
      return bot.sendMessage(msg.chat.id, '❌ Bạn không có đủ lượt cướp đảo!');
    }

    // Kiểm tra thời gian chờ giữa các lần cướp
    const cooldownTime = 5 * 60 * 1000; // 5 phút
    if (playerAccount.lastRobberyTime && Date.now() - playerAccount.lastRobberyTime < cooldownTime) {
      const remainingTime = Math.ceil((cooldownTime - (Date.now() - playerAccount.lastRobberyTime)) / 1000 / 60);
      return bot.sendMessage(msg.chat.id, `⏳ Vui lòng đợi ${remainingTime} phút nữa để có thể cướp tiếp!`);
    }

    // Tìm một tài khoản ngẫu nhiên có gold > 0 và không phải người chơi hiện tại
    const randomAccount = await Account.aggregate([
      {
        $match: {
          userId: { $ne: userId },
          gold: { $gt: 1000 } // Chỉ cướp được những người có trên 1000 vàng
        }
      },
      { $sample: { size: 1 } }
    ]);

    if (randomAccount.length === 0) {
      return bot.sendMessage(msg.chat.id, '🏝️ Không tìm thấy hòn đảo nào phù hợp để cướp!');
    }

    const target = randomAccount[0];
    robberyTargets.set(userId, target);

    // Tạo keyboard với nút cướp đảo
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: `⚔️ Tấn công đảo của ${target.username || 'Đảo giấu tên'}`,
              callback_data: `rob_${target.userId}`
            }
          ],
          [
            {
              text: '🔙 Quay về',
              callback_data: 'return_main'
            }
          ]
        ]
      }
    };

    // Tạo caption cho hình ảnh đảo
    const caption = `🏴‍☠️ Đã tìm thấy một hòn đảo để cướp!\n\n` +
                   `👤 Chủ đảo: ${target.username || 'Đảo giấu tên'}\n` +
                   `💰 Số vàng ước tính: ${Math.floor(target.gold * 0.8)} - ${target.gold}\n` +
                   `🏰 Cấp độ đảo: ${target.level}\n\n` +
                   `⚠️ Bạn có cơ hội cướp được 20-30% số vàng của hòn đảo này!`;

    // Gửi hình ảnh đảo kèm thông tin
    if (target.islandImage && target.islandImage !== 'default-island-image-url') {
      // Nếu có hình ảnh đảo
      await bot.sendPhoto(msg.chat.id, target.islandImage, {
        caption: caption,
        reply_markup: keyboard.reply_markup
      });
    } else {
      // Nếu không có hình ảnh đảo, gửi text message
      await bot.sendMessage(msg.chat.id, 
        `${caption}\n\n⚠️ Hình ảnh đảo không khả dụng`, 
        keyboard
      );
    }

  } catch (error) {
    console.error('Error in robbery command:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau!');
  }
});

// Xử lý callback khi nhấn nút cướp
bot.on('callback_query', async (callbackQuery) => {
  
  try {
    const data = callbackQuery.data;
    if (!data.startsWith('rob_')) return;

    const userId = callbackQuery.from.id;
    const targetUserId = parseInt(data.split('_')[1]);

    // Kiểm tra tài khoản người chơi
    const playerAccount = await Account.findOne({ userId: userId });
    if (!playerAccount || playerAccount.robberyCount <= 0) {
      return bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Bạn không có đủ lượt cướp đảo!',
        show_alert: true
      });
    }

    // Kiểm tra tài khoản mục tiêu
    const targetAccount = await Account.findOne({ userId: targetUserId });
    if (!targetAccount) {
      return bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Không tìm thấy hòn đảo mục tiêu!',
        show_alert: true
      });
    }

    // Tính toán số vàng cướp được (20-30% số vàng của mục tiêu)
    const robberyPercentage = Math.random() * 0.1 + 0.2; // 20-30%
    const stolenGold = Math.floor(targetAccount.gold * robberyPercentage);

    // Cập nhật tài khoản
    playerAccount.gold += stolenGold;
    playerAccount.robberyCount--;
    playerAccount.lastRobberyTime = new Date();
    targetAccount.gold -= stolenGold;

    await playerAccount.save();
    await targetAccount.save();

    // Gửi thông báo kết quả
    const resultMessage = `🏴‍☠️ Cướp đảo thành công!\n\n` +
                         `💰 Số vàng cướp được: ${stolenGold}\n` +
                         `🎫 Lượt cướp còn lại: ${playerAccount.robberyCount}\n\n` +
                         `📊 Số dư hiện tại: ${playerAccount.gold} vàng`;

    // Nếu tin nhắn gốc là hình ảnh
    if (callbackQuery.message.photo) {
      await bot.editMessageCaption(resultMessage, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔙 Quay về',
                callback_data: 'return_main'
              }
            ]
          ]
        }
      });
    } else {
      // Nếu tin nhắn gốc là text
      await bot.editMessageText(resultMessage, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔙 Quay về',
                callback_data: 'return_main'
              }
            ]
          ]
        }
      });
    }

    // Gửi thông báo cho người bị cướp
    if (targetAccount.username) {
      bot.sendMessage(targetUserId, 
        `⚠️ Đảo của bạn vừa bị @${playerAccount.username || 'Một cướp biển'} tấn công!\n` +
        `💰 Số vàng bị mất: ${stolenGold}\n` +
        `📊 Số vàng còn lại: ${targetAccount.gold}`
      );
    }

  } catch (error) {
    console.error('Error in robbery callback:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Có lỗi xảy ra, vui lòng thử lại sau!',
      show_alert: true
    });
  }
});


// Xử lý nút quay về
bot.on('callback_query', async (callbackQuery) => {
  if (callbackQuery.data === 'return_main') {
    // Xóa tin nhắn hiện tại
    await bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);

    // Gọi hàm showMainMenu để gửi menu chính
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;

    await showMainMenu(chatId, userId);
  }
});




// Kiểm tra lệnh nhập vào
bot.onText(/\/(\d+)/, async (msg, match) => {
  const userId = msg.from.id;
  const account = await Account.findOne({ userId });

  if (!account) {
    bot.sendMessage(msg.chat.id, 'Tài khoản không tồn tại.');
    return;
  }

  const commandNumber = parseInt(match[1], 10);

  // Nếu lệnh là 123 thì cộng thêm 100 lượt quay thưởng
  if (commandNumber === 123) {
    account.spinCount += 100; // Cộng thêm 100 lượt quay thưởng
    await account.save();
    bot.sendMessage(msg.chat.id, '✅ Bạn đã nhận được thêm 100 lượt quay thưởng!');
  } else {
    bot.sendMessage(msg.chat.id, '🚫 Lệnh không hợp lệ.');
  }
});






// Xử lý khi nhấn vào nút Quay Lại
bot.onText(/Quay về/, async (msg) => {
  const currentTime = new Date();
  const currentHour = currentTime.getHours() + 7;
  let greetingMessage;

  let imageUrl;

  if (currentHour >= 6 && currentHour < 18) {
    const morningGreetings = [
      'Ban ngày là lúc tốt nhất để khai thác tài nguyên trên hòn đảo. Hãy kiểm tra mỏ và bạn sẽ tìm thấy nhiều điều bất ngờ!',
      'Mỗi buổi sáng, tôi tìm kiếm cảm hứng từ bức tranh tuyệt vời của biển cả và bắt đầu một ngày mới tràn đầy năng lượng',
      'Ban ngày là thời điểm chúng ta cần tăng cường an ninh. Ai cũng phải bảo vệ hòn đảo của mình!',
      'Cửa hàng của tôi đang mở cửa, hãy ghé nếu bạn muốn nâng cấp hòn đảo của mình.',
      'Nhìn xa ra biển cả buổi sáng làm bạn cảm thấy như đang đối diện với những cuộc phiêu lưu mới.',
      // Thêm các lời chào buổi sáng khác vào đây
    ];
    greetingMessage = morningGreetings[Math.floor(Math.random() * morningGreetings.length)];
    // Nếu là giờ từ 6h đến 18h, sử dụng hàm sendPhoto để hiển thị hình ảnh url 1
    imageUrl = 'https://img.upanh.tv/2023/11/25/Ngay1.gif'; // Thay thế bằng URL thực tế của hình ảnh
    bot.sendDocument(msg.chat.id, imageUrl, { caption: 'Chào buổi sáng, thủy thủ! Bạn đã kiểm tra kho báu của mình chưa?' });
  } else {

    const eveningGreetings = [
      'Dưới ánh đèn trăng, hãy ngồi lại và kể cho tôi nghe những câu chuyện về những thời kỳ huyền bí của biển cả.',
      'Buổi tối là lúc cá biển trở nên tĩnh lặng và nguy hiểm hơn', 'Khi bóng đêm bao trùm, tôi tiếp tục công việc mỏ của mình. Càng tối, càng ít người để quấy rối.', 'Buổi tối là thời gian tuyệt vời để mua sắm. Cửa hàng của ta đang có những ưu đãi đặc biệt đó', 'Dưới bóng tối, hãy cẩn thận, những câu chuyện về hồn ma trên biển cả có thể là có thật',
      // Thêm các lời chào buổi tối khác vào đây
    ];
    greetingMessage = eveningGreetings[Math.floor(Math.random() * eveningGreetings.length)];
    // Nếu không phải giờ từ 6h đến 18h, sử dụng hàm sendDocument để hiển thị hình ảnh gif từ URL khác
    imageUrl = 'https://img.upanh.tv/2023/11/24/dem.gif'; // Thay thế bằng URL thực tế của hình ảnh gif
    bot.sendDocument(msg.chat.id, imageUrl, { caption: 'Dưới ánh trăng, biển cả trở nên yên bình, nhưng có những bí mật đen tối...' });
  }
  // Gửi lời chào tương ứng

});

function calculateIslandUpgradeCost(upgradeCount) {
  const initialCost = 120000;
  const additionalCostPercentage = 0.18;
  return Math.floor(initialCost * Math.pow(1 + additionalCostPercentage, upgradeCount));
}





// Mining rate increase per sublevel
const miningRateIncrease = {
  1: [1, 1.5, 2, 2.5],
  2: [3, 4, 5, 6],
  3: [7, 9, 11, 13],
  4: [15, 18, 21, 24],
  5: [28, 32, 36, 40],
  6: [45, 50, 55, 60],
  7: [66, 72, 78, 84],
  8: [91, 98, 105, 112],
  9: [120, 128, 136, 144],
  10: [153, 162, 171, 180],
  11: [190, 200, 210, 220],
  12: [231, 242, 253, 264],
  13: [276, 288, 300, 312],
  14: [325, 338, 351, 364],
  15: [378, 392, 406, 420],
  16: [435, 450, 465, 480],
  17: [496, 512, 528, 544],
  18: [561, 578, 595, 612],
  19: [630, 648, 666, 684],
  20: [703, 722, 741, 760]
};

const subLevelUpgradeCosts = {
  1: [1000, 2000, 3000, 4000],
  2: [10000, 20000, 30000, 40000],
  3: [50000, 100000, 150000, 200000],
  4: [150000, 300000, 450000, 600000],
  5: [500000, 1000000, 1500000, 2000000],
  6: [2000000, 4000000, 6000000, 8000000],
  7: [8000000, 16000000, 24000000, 32000000],
  8: [30000000, 60000000, 90000000, 120000000],
  9: [100000000, 200000000, 300000000, 400000000],
  10: [200000000, 300000000, 400000000, 500000000],
  11: [300000000, 400000000, 500000000, 600000000],
  12: [400000000, 500000000, 600000000, 700000000],
  13: [500000000, 600000000, 700000000, 800000000],
  14: [600000000, 700000000, 800000000, 900000000],
  15: [700000000, 800000000, 900000000, 1000000000],
  16: [800000000, 850000000, 900000000, 950000000],
  17: [850000000, 900000000, 950000000, 980000000],
  18: [900000000, 930000000, 960000000, 990000000],
  19: [920000000, 940000000, 970000000, 990000000],
  20: [940000000, 960000000, 980000000, 1000000000]
};


console.log(miningRateIncrease);
console.log(subLevelUpgradeCosts);


function getRankInfo(level, subLevel) {
  const ranks = {
    1: "🥉 Sắt",
    2: "🥉 Đồng",
    3: "🥈 Bạc",
    4: "🥇 Vàng",
    5: "💫 Bạch Kim",
    6: "💎 Kim Cương",
    7: "👑 Cao Thủ",
    8: "🏆 Đại Cao Thủ",
    9: "⚜️ Thách Đấu",
    10: "🔥 Huyền Thoại",
    11: "🌌 Siêu Huyền Thoại",
    12: "🌠 Huyền Thoại Cấp Cao",
    13: "✨ Thần Thoại",
    14: "🌟 Thần Thoại Cấp Cao",
    15: "🌈 Siêu Thần Thoại",
    16: "⚡ Vô Địch",
    17: "💥 Siêu Vô Địch",
    18: "🌍 Huyền Thoại Thế Giới",
    19: "☄️ Siêu Huyền Thoại Vũ Trụ",
    20: "🚀 Vô Địch Thiên Hà",
  };

  


    const subRanks = ["IV", "III", "II", "I"];
    return `${ranks[level] || '🔱 Cao Thủ'} ${subRanks[subLevel]}`;
}

function createUpgradeKeyboard(account) {
    return {
        reply_markup: {
            keyboard: [
                [{text: '⬆️ Xác nhận nâng cấp', callback_data: 'upgrade'}],
                [{text: '📊 Xem thông tin đảo', callback_data: 'info'}],
                [{text: '🏠 Quay về', callback_data: 'home'}]
            ],
            resize_keyboard: true
        }
    };
}

// Update VNDC balance
async function updateVNDC(account) {
    const now = new Date();
    const timeDiff = (now - account.lastMiningUpdate) / 1000 / 3600; // Convert to hours
    const newVNDC = account.vndc + (timeDiff * account.miningRate);

    account.vndc = newVNDC;
    account.lastMiningUpdate = now;
    await account.save();

    return newVNDC;
}

// Format VNDC display
function formatVNDC(vndc, miningRate) {
    return `${vndc.toFixed(4)} VNDC (+${miningRate.toFixed(1)} VNDC/h)`;
}

bot.onText(/Nâng Cấp Hòn Đảo|📊 Xem thông tin đảo/, async (msg) => {
    const userId = msg.from.id;
    const account = await Account.findOne({ userId });

    if (!account) {
        return bot.sendMessage(msg.chat.id, '❌ Tài khoản không tồn tại.');
    }

    await updateVNDC(account);

    const currentRank = getRankInfo(account.level, account.subLevel);
    const nextSubLevel = (account.subLevel + 1) % 4;
    const nextLevel = nextSubLevel === 0 ? account.level + 1 : account.level;
    const nextRank = getRankInfo(nextLevel, nextSubLevel);
    const upgradeCost = subLevelUpgradeCosts[account.level][account.subLevel];

    const infoMessage = `
🏝 *THÔNG TIN HÒN ĐẢO*
━━━━━━━━━━━━━━━━━
👤 *Chủ sở hữu:* ${account.username}
💰 *Số vàng:* ${account.gold.toLocaleString()} 
💎 *VNDC:* ${formatVNDC(account.vndc, account.miningRate)}
━━━━━━━━━━━━━━━━━
🏆 *Cấp độ hiện tại:* ${currentRank}
⭐️ *Cấp độ tiếp theo:* ${nextRank}
💫 *Chi phí nâng cấp:* ${upgradeCost.toLocaleString()} vàng
━━━━━━━━━━━━━━━━━
`;

    await bot.sendPhoto(msg.chat.id, account.islandImage, {
        caption: infoMessage,
        parse_mode: 'Markdown',
        ...createUpgradeKeyboard(account)
    });
});

// Add mining rate update logic to upgrade handler
bot.onText(/⬆️ Xác nhận nâng cấp/, async (msg) => {
    const userId = msg.from.id;
    const account = await Account.findOne({ userId });

    if (!account) {
        return bot.sendMessage(msg.chat.id, '❌ Tài khoản không tồn tại.');
    }

    const upgradeCost = subLevelUpgradeCosts[account.level][account.subLevel];

    if (account.gold < upgradeCost) {
        return bot.sendMessage(msg.chat.id, `❌ Bạn cần thêm ${(upgradeCost - account.gold).toLocaleString()} vàng để nâng cấp.`);
    }

    // Update mining rate
    const newMiningRate = miningRateIncrease[account.level][account.subLevel];
    if (newMiningRate) {
        account.miningRate = newMiningRate;
    }

    account.gold -= upgradeCost;
    account.subLevel = (account.subLevel + 1) % 4;

   if (account.subLevel === 0) {
     account.level++;
     account.islandUpgradeCount++;

     // Cập nhật hình ảnh đảo khi lên cấp chính
     const islandImages = {
       1: 'https://img.upanh.tv/2023/11/23/Cap1.jpg',
       2: 'https://img.upanh.tv/2023/11/23/Cap2.jpg',
       3: 'https://img.upanh.tv/2023/11/23/Cap3.jpg',
       4: 'https://img.upanh.tv/2023/11/23/Cap4.jpg',
       5: 'https://img.upanh.tv/2023/11/23/Cap5.jpg',
       6: 'https://img.upanh.tv/2023/11/23/Cap6.jpg',
       7: 'https://img.upanh.tv/2023/11/23/Cap7.jpg',
       8: 'https://img.upanh.tv/2023/11/23/Cap8.jpg',
       9: 'https://img.upanh.tv/2023/11/23/Cap9.jpg',
       10: 'https://img.upanh.tv/2023/11/23/Cap10.jpg',
       11: 'https://img.upanh.tv/2023/11/23/Cap11.jpg',
       12: 'https://img.upanh.tv/2023/11/23/Cap12.jpg',
       13: 'https://img.upanh.tv/2023/11/23/Cap13.jpg',
       14: 'https://img.upanh.tv/2023/11/23/Cap14.jpg',
       15: 'https://img.upanh.tv/2023/11/23/Cap15.jpg',
       16: 'https://img.upanh.tv/2023/11/23/Cap19.jpg',
       19: 'https://img.upanh.tv/2023/11/23/Cap19.jpg',
       20: 'https://example.com/your-island-image-url-2.jpg'
     };

     if (islandImages[account.level]) {
       account.islandImage = islandImages[account.level];
     }
   }

    await account.save();

    const newRank = getRankInfo(account.level, account.subLevel);
    const successMessage = `
🎉 *NÂNG CẤP THÀNH CÔNG*
━━━━━━━━━━━━━━━━━
${account.subLevel === 0 
    ? `🏆 Chúc mừng bạn đã thăng cấp lên ${newRank}!\n🏝 Hòn đảo đã được nâng cấp!`
    : `⭐️ Chúc mừng bạn đã thăng hạng lên ${newRank}!`}
📈 Tốc độ đào VNDC mới: ${account.miningRate.toFixed(1)} VNDC/h
━━━━━━━━━━━━━━━━━
`;

    await bot.sendPhoto(msg.chat.id, account.islandImage, {
        caption: successMessage,
        parse_mode: 'Markdown',
        ...createUpgradeKeyboard(account)
    });
});

// Add auto-update timer for VNDC display
setInterval(async () => {
    const accounts = await Account.find({});
    for (const account of accounts) {
        await updateVNDC(account);
    }
}, 10000); // Update every 10 seconds







// Định nghĩa các gói shop
const SHOP_PACKAGES = {
  gold: [
    { price: 10000, amount: 3600000 },
    { price: 50000, amount: 12600000 },
    { price: 140000, amount: 63000000 },
    { price: 400000, amount: 144000000 },
    { price: 990000, amount: 468000000 },
    { price: 2000000, amount: 1110000000 }
  ],
  spins: [
    { price: 10000, amount: 90 },
    { price: 50000, amount: 300 },
    { price: 140000, amount: 1620 },
    { price: 400000, amount: 3900 },
    { price: 990000, amount: 12300 },
    { price: 2000000, amount: 25800 }
  ]
};

// Xử lý lệnh shop
bot.onText(/Cửa Hàng/, async (msg) => {
  try {
    const account = await Account.findOne({ userId: msg.from.id });
    if (!account) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản, vui lòng /start để tạo tài khoản mới.');
    }

    // Hiển thị menu chọn loại vật phẩm
    await bot.sendMessage(msg.chat.id, '📌 Chọn loại vật phẩm:', {
      reply_markup: {
        keyboard: [
          ['💰 Mua Vàng', '🎫 Mua Lượt Quay'],
          ['↩️ Quay Lại']
        ],
        resize_keyboard: true
      }
    });

  } catch (error) {
    console.error('Error in shop command:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Xử lý chọn mua vàng
bot.onText(/💰 Mua Vàng/, async (msg) => {
  try {
    const account = await Account.findOne({ userId: msg.from.id });
    if (!account) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản!');
    }

    await bot.sendPhoto(msg.chat.id, 'https://i.upanh.org/2024/11/03/shopvangb1e38c7e99637364.png', {
      caption: `🏅 BẢNG GIÁ VÀNG\n\n` +
        `💵 Số dư VNĐ: ${account.vnd.toLocaleString('vi-VN')}đ\n` +
        `🏅 Vàng hiện có: ${account.gold.toLocaleString('vi-VN')}\n\n` +
        `Chọn gói để mua:`,
      reply_markup: getShopKeyboard('gold')
    });
  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Xử lý chọn mua lượt quay
bot.onText(/🎫 Mua Lượt Quay/, async (msg) => {
  try {
    const account = await Account.findOne({ userId: msg.from.id });
    if (!account) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản!');
    }

    await bot.sendPhoto(msg.chat.id, 'https://i.upanh.org/2024/11/03/shopluotquay00d563d84ef0f2c7.png', {
      caption: `🎫 BẢNG GIÁ LƯỢT QUAY\n\n` +
        `💵 Số dư VNĐ: ${account.vnd.toLocaleString('vi-VN')}đ\n` +
        `🎫 Lượt quay hiện có: ${account.spinCount}\n\n` +
        `Chọn gói để mua:`,
      reply_markup: getShopKeyboard('spins')
    });
  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Hàm tạo bàn phím shop
function getShopKeyboard(type) {
  const keyboard = [];
  SHOP_PACKAGES[type].forEach(pkg => {
    keyboard.push([{
      text: `💰 ${pkg.price.toLocaleString('vi-VN')}đ (+200% Bonus)`,
      callback_data: `shop_${type}_${pkg.price}`
    }]);
  });
  return {
    inline_keyboard: keyboard
  };
}

// Xử lý callback mua hàng
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  if (data.startsWith('shop_')) {
    try {
      const [_, type, priceStr] = data.split('_');
      const price = parseInt(priceStr);
      const package = SHOP_PACKAGES[type].find(pkg => pkg.price === price);

      if (!package) return;

      const account = await Account.findOne({ userId: callbackQuery.from.id });
      if (!account) {
        return bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Không tìm thấy tài khoản!',
          show_alert: true
        });
      }

      if (account.vnd < price) {
        return bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Số dư VNĐ không đủ để mua gói này!',
          show_alert: true
        });
      }

      // Xử lý giao dịch
      account.vnd -= price;
      if (type === 'gold') {
        account.gold += package.amount;
      } else {
        account.spinCount += package.amount;
      }
      await account.save();

      const itemName = type === 'gold' ? 'Vàng' : 'Lượt quay';
      const successMessage = 
        `✅ Giao dịch thành công!\n\n` +
        `💵 -${price.toLocaleString('vi-VN')}đ\n` +
        `${type === 'gold' ? '🏅' : '🎫'} +${package.amount.toLocaleString('vi-VN')} ${itemName}\n\n` +
        `Số dư hiện tại:\n` +
        `💵 VNĐ: ${account.vnd.toLocaleString('vi-VN')}đ\n` +
        `${type === 'gold' ? 
          `🏅 Vàng: ${account.gold.toLocaleString('vi-VN')}` : 
          `🎫 Lượt quay: ${account.spinCount}`}`;

      await bot.sendMessage(callbackQuery.message.chat.id, successMessage);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '✅ Mua thành công! Kiểm tra số dư của bạn.',
        show_alert: true
      });

    } catch (error) {
      console.error('Error in shop purchase:', error);
      bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Có lỗi xảy ra, vui lòng thử lại sau.',
        show_alert: true
      });
    }
  }
});

// Xử lý nút Quay Lại
bot.onText(/↩️ Quay Lại/, async (msg) => {
  // Gửi menu chính
  await bot.sendMessage(msg.chat.id, '📌 Menu chính:', {
    reply_markup: {
      keyboard: [
        ['💰 Số Dư', '🎲 Mini Game'],
        ['🎫 Lượt Quay', '🏆 TOP'],
        ['Cửa Hàng 🏪', '📝 Hướng Dẫn']
      ],
      resize_keyboard: true
    }
  });
});









// Hàm tính level dựa trên exp
function calculateLevel(exp) {
  return Math.floor(Math.sqrt(exp / 100)) + 1;
}

// Hàm tính exp cần cho level tiếp theo
function expNeededForNextLevel(currentLevel) {
  return Math.pow(currentLevel, 2) * 100;
}

// Hàm lấy thông tin rank
function getRankInfo(level, subLevel) {
  const ranks = {
      0: ['🌱 Tân Thủ', '🌿 Nghiệp Dư', '🎋 Thạo Game'],
      1: ['🥉 Đồng III', '🥉 Đồng II', '🥉 Đồng I'],
      2: ['🥈 Bạc III', '🥈 Bạc II', '🥈 Bạc I'],
      3: ['🥇 Vàng III', '🥇 Vàng II', '🥇 Vàng I'],
      4: ['💎 Kim Cương III', '💎 Kim Cương II', '💎 Kim Cương I'],
      5: ['👑 Cao Thủ III', '👑 Cao Thủ II', '👑 Cao Thủ I'],
      6: ['🏆 Đại Cao Thủ III', '🏆 Đại Cao Thủ II', '🏆 Đại Cao Thủ I'],
      7: ['⚜️ Thách Đấu III', '⚜️ Thách Đấu II', '⚜️ Thách Đấu I'],
      8: ['🔥 Huyền Thoại III', '🔥 Huyền Thoại II', '🔥 Huyền Thoại I'],
      9: ['🌌 Siêu Huyền Thoại III', '🌌 Siêu Huyền Thoại II', '🌌 Siêu Huyền Thoại I'],
      10: ['🌠 Huyền Thoại Cấp Cao III', '🌠 Huyền Thoại Cấp Cao II', '🌠 Huyền Thoại Cấp Cao I'],
      11: ['✨ Thần Thoại III', '✨ Thần Thoại II', '✨ Thần Thoại I'],
      12: ['🌟 Thần Thoại Cấp Cao III', '🌟 Thần Thoại Cấp Cao II', '🌟 Thần Thoại Cấp Cao I'],
      13: ['🌈 Siêu Thần Thoại III', '🌈 Siêu Thần Thoại II', '🌈 Siêu Thần Thoại I'],
      14: ['⚡ Vô Địch III', '⚡ Vô Địch II', '⚡ Vô Địch I'],
      15: ['💥 Siêu Vô Địch III', '💥 Siêu Vô Địch II', '💥 Siêu Vô Địch I'],
      16: ['🌍 Huyền Thoại Thế Giới III', '🌍 Huyền Thoại Thế Giới II', '🌍 Huyền Thoại Thế Giới I'],
      17: ['☄️ Siêu Huyền Thoại Vũ Trụ III', '☄️ Siêu Huyền Thoại Vũ Trụ II', '☄️ Siêu Huyền Thoại Vũ Trụ I'],
      18: ['🚀 Vô Địch Thiên Hà III', '🚀 Vô Địch Thiên Hà II', '🚀 Vô Địch Thiên Hà I'],
      19: ['🌟 Đỉnh Cao III', '🌟 Đỉnh Cao II', '🌟 Đỉnh Cao I'],
      20: ['✨ Vĩnh Cửu III', '✨ Vĩnh Cửu II', '✨ Vĩnh Cửu I']
  };
  return ranks[level][subLevel] || '👑 Thách Đấu';
}

// Hàm tạo progress bar với màu sắc
function createColorProgressBar(current, max, length = 10) {
  const percentage = (current / max);
  const filled = Math.round(percentage * length);
  const empty = length - filled;

  let color;
  if (percentage > 0.7) color = '🟩';
  else if (percentage > 0.3) color = '🟨';
  else color = '🟥';

  return color.repeat(filled) + '⬜️'.repeat(empty);
}

// Hàm tính thời gian còn lại
function getTimeRemaining(endTime) {
  const total = Date.parse(endTime) - Date.parse(new Date());
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);

  return {
    total,
    hours,
    minutes,
    seconds
  };
}

// Hàm format thời gian
function formatTimeRemaining(endTime) {
  const time = getTimeRemaining(endTime);
  if (time.total <= 0) return '00:00:00';
  return `${time.hours.toString().padStart(2, '0')}:${time.minutes.toString().padStart(2, '0')}:${time.seconds.toString().padStart(2, '0')}`;
}

// Hàm cập nhật VNDC mới
async function updateVNDC(account) {
  const now = new Date();
  const miningEndTime = new Date(account.miningEndTime);

  // Kiểm tra xem có đang trong thời gian đào không
  if (!account.isMining || now > miningEndTime) {
    account.isMining = false;
    await account.save();
    return account.vndc;
  }

  const timeDiff = (now - account.lastMiningUpdate) / 1000 / 3600; // Convert to hours
  const newVNDC = account.vndc + (timeDiff * account.miningRate);

  account.vndc = newVNDC;
  account.lastMiningUpdate = now;
  await account.save();

  return newVNDC;
}

// Hàm format số
function formatNumber(number) {
  if (number >= 1e9) return (number / 1e9).toFixed(1) + 'B';
  if (number >= 1e6) return (number / 1e6).toFixed(1) + 'M';
  if (number >= 1e3) return (number / 1e3).toFixed(1) + 'K';
  return number.toString();
}

// Command xem tài khoản
bot.onText(/Xem tài khoản|\/profile/, async (msg) => {
  try {
    const account = await Account.findOne({ userId: msg.from.id });
    if (!account) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản!');
    }

    // Cập nhật VNDC
    const updatedVNDC = await updateVNDC(account);

    // Tính các tiến độ
    const currentLevel = calculateLevel(account.exp);
    const nextLevelExp = expNeededForNextLevel(currentLevel);
    const currentLevelExp = expNeededForNextLevel(currentLevel - 1);
    const expProgress = account.exp - currentLevelExp;
    const expNeeded = nextLevelExp - currentLevelExp;

    // Tính thời gian đào còn lại
    const miningTimeLeft = getTimeRemaining(account.miningEndTime);
    const miningProgress = miningTimeLeft.total > 0 ? 1 - (miningTimeLeft.total / (4 * 60 * 60 * 1000)) : 0;

    // Tạo các progress bar
    const expProgressBar = createColorProgressBar(expProgress, expNeeded);
    const miningProgressBar = createColorProgressBar(miningProgress, 1);
    const vipProgressBar = createColorProgressBar(account.vipLevel, 10);

    // Tạo tin nhắn profile với VNDC được làm nổi bật
    const profileMessage = `
🌟 *THÔNG TIN TÀI KHOẢN*
━━━━━━━━━━━━━━━━━━━━
👤 *${account.username}* | Cấp ${currentLevel} ${getRankInfo(account.level, account.subLevel)}

💎 *VNDC: ${updatedVNDC.toFixed(4)}*
└ 💵 VNĐ: ${formatNumber(account.vnd)}
└ 🏅 Vàng: ${formatNumber(account.gold)}

⚡️ *Đào VNDC:* ${account.isMining ? '🟢 Hoạt động' : '🔴 Dừng'}
└ ⏳ ${formatTimeRemaining(account.miningEndTime)}
└ ${miningProgressBar} ${Math.max(0, (miningProgress * 100)).toFixed(1)}%
└ 📈 ${account.miningRate.toFixed(1)} VNDC/h

📊 *Tiến Độ:*
└ 📚 EXP: ${expProgressBar} ${((expProgress/expNeeded) * 100).toFixed(1)}%
└ 👑 VIP ${account.vipLevel}: ${vipProgressBar}

🎮 *Tài sản khác:*
└ 🎫 LƯợt Quay: ${account.spinCount} | 🎁 Hộp Quà: ${account.giftBoxCount}
└ 📅 Đăng nhập: ${account.consecutiveLogins} ngày`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '🔄 Làm mới', callback_data: 'refresh_profile' },
          { text: '📊 Chi tiết', callback_data: 'profile_details' }
        ],
        [
          account.isMining 
            ? { text: '⏸ Dừng đào', callback_data: 'stop_mining' }
            : { text: '▶️ Bắt đầu đào', callback_data: 'start_mining' }
        ]
      ]
    };

    // Cache để kiểm tra thay đổi
    let lastMessage = profileMessage;
    let lastVNDC = updatedVNDC;

    const sentMsg = await bot.sendPhoto(msg.chat.id, account.islandImage, {
      caption: profileMessage,
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });

    // Cập nhật realtime
    const updateInterval = setInterval(async () => {
      try {
        const updatedVNDC = await updateVNDC(account);
        if (Math.abs(updatedVNDC - lastVNDC) < 0.0001) return;

        const newMiningTimeLeft = getTimeRemaining(account.miningEndTime);
        const newMiningProgress = newMiningTimeLeft.total > 0 ? 1 - (newMiningTimeLeft.total / (4 * 60 * 60 * 1000)) : 0;

        const updatedMessage = profileMessage
          .replace(/💎 \*VNDC: [\d.]+\*/, `💎 *VNDC: ${updatedVNDC.toFixed(4)}*`)
          .replace(/⏳ [\d:]+/, `⏳ ${formatTimeRemaining(account.miningEndTime)}`);

        if (updatedMessage !== lastMessage) {
          await bot.editMessageCaption(updatedMessage, {
            chat_id: msg.chat.id,
            message_id: sentMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard
          });
          lastMessage = updatedMessage;
          lastVNDC = updatedVNDC;
        }
      } catch (err) {
        if (!err.message.includes('message is not modified')) {
          console.error('Error updating display:', err);
          clearInterval(updateInterval);
        }
      }
    }, 10000);

    // Dừng cập nhật sau 1 phút
    setTimeout(() => clearInterval(updateInterval), 60000);

  } catch (error) {
    console.error('Error in profile command:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Xử lý các callback
bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const userId = callbackQuery.from.id;

  try {
    const account = await Account.findOne({ userId });
    if (!account) {
      return bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Không tìm thấy tài khoản!',
        show_alert: true
      });
    }

    switch (action) {
      case 'start_mining':
        if (account.isMining) {
          return bot.answerCallbackQuery(callbackQuery.id, {
            text: '⚠️ Bạn đang trong quá trình đào!',
            show_alert: true
          });
        }
        account.isMining = true;
        account.miningEndTime = new Date(Date.now() + 4 * 60 * 60 * 1000);
        account.lastMiningUpdate = new Date();
        await account.save();
        bot.answerCallbackQuery(callbackQuery.id, {
          text: '✅ Đã bắt đầu đào VNDC!'
        });
        break;

      case 'stop_mining':
        if (!account.isMining) {
          return bot.answerCallbackQuery(callbackQuery.id, {
            text: '⚠️ Bạn chưa bắt đầu đào!',
            show_alert: true
          });
        }
        account.isMining = false;
        await account.save();
        bot.answerCallbackQuery(callbackQuery.id, {
          text: '🛑 Đã dừng đào VNDC!'
        });
        break;

      case 'refresh_profile':
        bot.answerCallbackQuery(callbackQuery.id, {
          text: '🔄 Đang làm mới...'
        });
        break;

      case 'profile_details':
        // Xử lý hiển thị chi tiết profile
        const detailsMessage = `
📊 *CHI TIẾT TÀI KHOẢN*
━━━━━━━━━━━━━━━━━━━━
🏆 *Thành tích:*
└ 🎯 Độ chính xác: ${account.accuracy}%
└ 🎮 Tổng ván: ${account.totalGames}
└ ✨ Exp/ngày: ${account.dailyExp}

💰 *Giao dịch:*
└ 💳 Nạp: ${formatNumber(account.totalDeposit)}
└ 💸 Rút: ${formatNumber(account.totalWithdraw)}
└ 🔄 Giao dịch: ${account.transactions}

🎮 *Hoạt động chi tiết:*
└ 🎲 Minigame: ${account.minigamesPlayed}
└ 🎁 Quà đã mở: ${account.giftsOpened}
└ 🏆 Giải thưởng: ${account.rewards}
`;

        await bot.editMessageCaption(detailsMessage, {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '◀️ Quay lại', callback_data: 'refresh_profile' }
            ]]
          }
        });
        break;
    }

    // Cập nhật hiển thị profile sau mỗi action
    if (['start_mining', 'stop_mining', 'refresh_profile'].includes(action)) {
      bot.emit('message', { ...msg, text: '/profile', from: { id: userId } });
    }

  } catch (error) {
    console.error('Error in callback query:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Có lỗi xảy ra, vui lòng thử lại!',
      show_alert: true
    });
  }
});






// Constants
const MINING_DURATION = 4 * 60 * 60 * 1000; // 4 hours
const MINING_GIF = 'https://media1.tenor.com/m/Isec7K5eGFMAAAAC/mine-mining.gif';
const IDLE_GIF = 'https://loading.io/assets/mod/spinner/coin/sample.gif';

// Mining-specific callback data prefixes
const MINING_ACTIONS = {
  START: 'mining_start',
  STOP: 'mining_stop',
  UPGRADE: 'mining_upgrade',
  REFRESH: 'mining_refresh'
};

// Helper function to calculate mined VNDC
async function calculateMinedVNDC(account) {
  if (!account.isMining) return 0;

  const now = new Date();
  const lastUpdate = new Date(account.lastMiningUpdate);
  const timeDiff = (now - lastUpdate) / (60 * 60 * 1000);

  const minedAmount = timeDiff * account.miningRate;
  return Math.max(0, minedAmount);
}

// Mining command handler
bot.onText(/Đào VNDC|\/mining/, async (msg) => {
  try {
    const account = await Account.findOne({ userId: msg.from.id });
    if (!account) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản!');
    }

    const gifUrl = account.isMining ? MINING_GIF : IDLE_GIF;
    await bot.sendPhoto(msg.chat.id, gifUrl);
    await sendMiningStatus(msg.chat.id, account);

  } catch (error) {
    console.error('Error in mining command:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

async function sendMiningStatus(chatId, account, messageId = null) {
  const minedVNDC = await calculateMinedVNDC(account);
  account.vndc = (parseFloat(account.vndc) || 0) + minedVNDC;
  account.lastMiningUpdate = new Date();
  await account.save();

  const timeLeft = getTimeRemaining(account.miningEndTime);
  const miningProgress = timeLeft.total > 0 ? 1 - (timeLeft.total / MINING_DURATION) : 0;
  const progressBar = createColorProgressBar(miningProgress, 1);

  const baseMiningRate = 0.5;
  const baseUpgradeCost = 1000;
  const levelMultiplier = 1.5;

  const currentLevel = account.islandLevel || 1;
  const nextLevelCost = Math.ceil(baseUpgradeCost * Math.pow(levelMultiplier, currentLevel - 1));
  const currentMiningRate = baseMiningRate * Math.pow(1.2, currentLevel - 1);
  const nextLevelRate = currentMiningRate * 1.2;
  const upgradeCost = subLevelUpgradeCosts[account.level][account.subLevel];
  const nextSubLevel = (account.subLevel + 1) % 4;
  const nextLevel = nextSubLevel === 0 ? account.level + 1 : account.level;
  const nextRank = getRankInfo(nextLevel, nextSubLevel);
  const newMiningRate = miningRateIncrease[account.level][account.subLevel];
  




  const miningMessage = `
⛏ *KHAI THÁC VNDC*
━━━━━━━━━━━━━━━━━━━━
💎 Số dư: *${account.vndc.toFixed(4)} VNDC*

⚡️ *Trạng thái:* ${account.isMining ? '🟢 Đang đào' : '🔴 Đang Dừng'}
└ ⏳ ${formatTimeRemaining(account.miningEndTime)}
└ ${progressBar} ${Math.max(0, (miningProgress * 100)).toFixed(1)}%
└ 📈 Tốc độ đào VNDC: ${account.miningRate.toFixed(1)} VNDC/h

🏝 *Đảo cấp độ tiếp theo:*
└ ⭐️ *Cấp độ tiếp theo:* ${nextRank}
└ 💫 *Chi phí nâng cấp:* ${upgradeCost.toLocaleString()} vàng
└ ⚡️ Tốc độ mới: +${newMiningRate.toFixed(2)} VNDC/h

💡 *Mẹo tăng tốc độ đào vndc:*
• Nâng cấp đảo để tăng tốc độ đào
• Duy trì đăng nhập để nhận thưởng
• Mời bạn bè để nhận bonus`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: '🔄 Làm mới', callback_data: MINING_ACTIONS.REFRESH }
        
      ],
      [
        account.isMining 
          ? { text: '⏸ Dừng đào', callback_data: MINING_ACTIONS.STOP }
          : { text: '▶️ Bắt đầu đào', callback_data: MINING_ACTIONS.START }
      ]
    ]
  };

  try {
    if (messageId) {
      const gifUrl = account.isMining ? MINING_GIF : IDLE_GIF;
      await bot.editMessageMedia(
        {
          type: 'photo',
          media: gifUrl
        },
        {
          chat_id: chatId,
          message_id: messageId
        }
      );

      await bot.editMessageCaption(miningMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard
      });
    } else {
      await bot.sendMessage(chatId, miningMessage, {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard
      });
    }
  } catch (error) {
    console.error('Error sending mining status:', error);
    await bot.sendMessage(chatId, miningMessage, {
      parse_mode: 'Markdown', 
      reply_markup: inlineKeyboard
    });
  }
}

// Mining-specific callback handler
bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data;

  // Only handle mining-related callbacks
  if (!Object.values(MINING_ACTIONS).includes(action)) {
    return;
  }

  const msg = callbackQuery.message;
  const userId = callbackQuery.from.id;

  try {
    const account = await Account.findOne({ userId });
    if (!account) {
      return bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Không tìm thấy tài khoản!',
        show_alert: true
      });
    }

    const minedVNDC = await calculateMinedVNDC(account);
    account.vndc = (parseFloat(account.vndc) || 0) + minedVNDC;
    account.lastMiningUpdate = new Date();

    switch (action) {
      case MINING_ACTIONS.START:
        if (account.isMining) {
          return bot.answerCallbackQuery(callbackQuery.id, {
            text: '⚠️ Bạn đang trong quá trình đào!',
            show_alert: true
          });
        }
        account.isMining = true;
        account.miningEndTime = new Date(Date.now() + MINING_DURATION);
        await account.save();

        bot.answerCallbackQuery(callbackQuery.id, {
          text: '✅ Đã bắt đầu đào VNDC!'
        });
        break;

      case MINING_ACTIONS.STOP:
        if (!account.isMining) {
          return bot.answerCallbackQuery(callbackQuery.id, {
            text: '⚠️ Bạn chưa bắt đầu đào!',
            show_alert: true
          });
        }
        account.isMining = false;
        await account.save();

        bot.answerCallbackQuery(callbackQuery.id, {
          text: '🛑 Đã dừng đào VNDC!'
        });
        break;

      case MINING_ACTIONS.UPGRADE:
        const currentLevel = account.islandLevel || 1;
        const upgradeCost = Math.ceil(1000 * Math.pow(1.5, currentLevel - 1));

        if (account.vndc < upgradeCost) {
          return bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Không đủ VNDC để nâng cấp!',
            show_alert: true
          });
        }

        account.vndc -= upgradeCost;
        account.islandLevel = currentLevel + 1;
        account.miningRate = 0.5 * Math.pow(1.2, account.islandLevel - 1);
        await account.save();

        bot.answerCallbackQuery(callbackQuery.id, {
          text: '🎉 Nâng cấp đảo thành công!'
        });
        break;

      case MINING_ACTIONS.REFRESH:
        await account.save();
        bot.answerCallbackQuery(callbackQuery.id, {
          text: '🔄 Đã làm mới thông tin!'
        });
        break;
    }

    await sendMiningStatus(msg.chat.id, account, msg.message_id);

  } catch (error) {
    console.error('Error in mining callback:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Có lỗi xảy ra, vui lòng thử lại!',
      show_alert: true
    });
  }
});





// Thêm các hằng số mới
const DEPOSIT_IMAGE = 'https://iili.io/2IofhyN.png'; // Thay bằng 
const BANK_NAME = 'BIDV';
const BANK_ACCOUNT = '1160454275';
const BANK_OWNER = 'CAN DUC HIEU';
// Object để lưu trạng thái người dùng đang chờ nhập số tiền tùy chọn
const userStates = {};

// Command xử lý nạp tiền
bot.onText(/Nạp tiền|\/deposit/, async (msg) => {
  try {
    const caption = `
🏦 *HƯỚNG DẪN NẠP TIỀN*
━━━━━━━━━━━━━━━━━━━━
💎 *Ưu đãi người mới:*
• Nạp lần đầu: Tặng thêm 20% số tiền nạp
💰 *Quy đổi:*
• 1 VNĐ = 1 VNDC

📌 *Lưu ý:*
• Nạp tối thiểu: 10,000 VNĐ
• Ghi đúng nội dung chuyển khoản
• Tiền sẽ được cộng tự động sau 3-5 phút
`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '10,000đ', callback_data: 'deposit:10000' },
          { text: '20,000đ', callback_data: 'deposit:20000' },
          { text: '50,000đ', callback_data: 'deposit:50000' }
        ],
        [
          { text: '100,000đ', callback_data: 'deposit:100000' },
          { text: '200,000đ', callback_data: 'deposit:200000' },
          { text: '500,000đ', callback_data: 'deposit:500000' }
        ],
        [
          { text: '💰 Tùy chọn mức nạp', callback_data: 'deposit:custom' }
        ]
      ]
    };

    await bot.sendPhoto(msg.chat.id, DEPOSIT_IMAGE, {
      caption: caption,
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });

  } catch (error) {
    console.error('Error in deposit command:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Xử lý callback cho nạp tiền
bot.on('callback_query', async (callbackQuery) => {
  try {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;
    const chatId = msg.chat.id;

    // Chỉ xử lý các callback liên quan đến nạp tiền
    if (!action.startsWith('deposit:')) return;

    const [command, value] = action.split(':');

    if (value === 'custom') {
      // Lưu trạng thái người dùng đang chờ nhập số tiền
      userStates[userId] = {
        action: 'waiting_amount',
        chatId: chatId
      };

      await bot.sendMessage(chatId, '💰 Vui lòng nhập số tiền muốn nạp (VNĐ):');
      // Answer callback query để loại bỏ loading state
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Xử lý các mức nạp cố định
    const amount = parseInt(value);
    await generateAndSendQR(chatId, userId, amount);
    await bot.answerCallbackQuery(callbackQuery.id);

  } catch (error) {
    console.error('Error in callback query:', error);
    bot.sendMessage(callbackQuery.message.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Xử lý tin nhắn để bắt số tiền tùy chọn
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  // Kiểm tra xem người dùng có đang trong trạng thái chờ nhập số tiền không
  if (userStates[userId] && userStates[userId].action === 'waiting_amount') {
    const amount = parseInt(msg.text.replace(/[^0-9]/g, ''));

    if (isNaN(amount) || amount < 10000) {
      await bot.sendMessage(chatId, '❌ Vui lòng nhập số tiền hợp lệ (tối thiểu 10,000 VNĐ)');
      return;
    }

    await generateAndSendQR(chatId, userId, amount);

    // Xóa trạng thái chờ của người dùng
    delete userStates[userId];
  }
});

function calculateChecksum(data) {
  // Loại bỏ 4 ký tự cuối cùng là '6304' trước khi tính CRC-16
  const dataWithout6304 = data.slice(0);

  // Tính CRC-16 CCITT và lấy giá trị hex
  const checksum = crc.crc16ccitt(dataWithout6304).toString(16).toUpperCase();
  return checksum.padStart(4, '0'); // Đảm bảo có 4 ký tự
}

// Hàm tạo và gửi mã QR
async function generateAndSendQR(chatId, userId, amount) {
  try {
    const content = `naptien${userId}`; // Nội dung giao dịch

    // Tạo QR code với thông tin ngân hàng
    const qrData = `00020101021238540010A00000072701240006970418011011604542750208QRIBFTTA53037045405${amount}5802VN62${calculateContentLength(content)}${content}6304`;
    const checksum = calculateChecksum(qrData);
    const qrFullData = `${qrData}${checksum}`;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrFullData)}`;

    const response = await axios.get(qrUrl, { responseType: 'arraybuffer' });
    const qrImage = Buffer.from(response.data, 'binary');

    const transferInfo = `
💳 *THÔNG TIN CHUYỂN KHOẢN*
━━━━━━━━━━━━━━━━━━━━
🏦 *Ngân hàng:* ${BANK_NAME}
👤 *Chủ TK:* ${BANK_OWNER}
📱 *Số TK:* \`${BANK_ACCOUNT}\`
💰 *Số tiền:* ${formatNumber(amount)}đ
📝 *Nội dung CK:* \`${content}\`

⚠️ *Lưu ý:*
• Vui lòng chuyển đúng số tiền
• Không thay đổi nội dung CK
• Giao dịch tự động 24/7
`;

    await bot.sendPhoto(chatId, qrImage, {
      caption: transferInfo,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Tạo giao dịch mới', callback_data: 'deposit:new' }]
        ]
      }
    });

  } catch (error) {
    console.error('Error generating QR:', error);
    bot.sendMessage(chatId, '❌ Lỗi tạo mã QR, vui lòng thử lại.');
  }
}

// Helper functions giữ nguyên
function calculateContentLength(content) {
  const contentLength = content.length;
  const firstNumber = (contentLength + 4).toString().padStart(2, '0');
  const lastNumber = contentLength.toString().padStart(2, '0');
  return `${firstNumber}08${lastNumber}`;
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}



// Hàm để thoát các ký tự đặc biệt cho Markdown
function escapeMarkdown(text) {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

// Hàm hiển thị menu chính với ảnh và caption
async function showMainMenu(chatId, userId) {
  try {
    const account = await Account.findOne({ userId });
    if (!account) {
      return bot.sendMessage(chatId, '❌ Không tìm thấy tài khoản, vui lòng /start để tạo tài khoản mới.');
    }



    // Thoát ký tự đặc biệt cho các trường có thể chứa ký tự đặc biệt
    const username = escapeMarkdown(account.username || 'Không có tên');
    const gold = account.gold.toLocaleString();
    const vndc = account.vndc.toLocaleString();
    const vnd = account.vnd.toLocaleString();
    const islandRank = escapeMarkdown(getRankInfo(account.level, account.subLevel));

    // Chuẩn bị nội dung menu
    const menuMessage = 
      '🏝️ *ISLOOTY VƯƠNG QUỐC HIẾU GÀ - XỨ SỞ TÀI PHÚ*\n' +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      `👤 *Người chơi*: ${username}\n` +
      `💰 *Vàng*: ${gold}\n` +
      `💎 *VNDC*: ${vndc} VNDC\n` +
      `💵 *VNĐ*: ${vnd} VNĐ\n` +
      `🏆 *Cấp độ đảo*: ${islandRank}\n` +
      '━━━━━━━━━━━━━━━━━━━━\n' +
      '_Chọn một hành động bên dưới để tiếp tục cuộc phiêu lưu của bạn để có thể kiếm tiền từ trò chơi!_';

    // Tạo bàn phím chính với các hành động
    const mainMenuKeyboard = {
      keyboard: [
        [{ text: 'Xem tài khoản 🏝️' }],
        [{ text: 'Vòng quay 🎰' }, { text: 'Đào VNDC ⛏️' }],
        [{ text: 'Nâng Cấp Hòn Đảo 🚀' }, { text: 'Bảng xếp hạng 🥇' }],
        [{ text: 'Điểm Danh Hàng Ngày 🏴‍☠️' }, { text: 'Cửa Hàng 🏪' }],
        [{ text: 'Nạp tiền 💵' }, { text: 'Rút tiền 💸' }],
        [{ text: 'Mời bạn bè 📨' }, { text: 'Nhiệm vụ 🎯' }]
      ],
      resize_keyboard: true
    };

    // Gửi ảnh kèm nội dung menu và bàn phím
    await bot.sendPhoto(chatId, 'https://iili.io/2zbgDf2.png', {
      caption: menuMessage,
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard
    });

  } catch (error) {
    console.error('Error in showMainMenu:', error);
    return bot.sendMessage(chatId, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
}






// Message handler to check and update fullName - using memory cache
const checkedUsers = new Set(); // Cache to store users that have been checked

// Message handler to check and update fullName
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  
  // Skip if user has been checked before
  if (checkedUsers.has(userId)) return;
  
  try {
    let account = await Account.findOne({ userId });
    
    if (account) {
      // If account has fullName, add to checked list and skip
      if (account.fullName) {
        checkedUsers.add(userId);
        return;
      }
      
      // Update fullName if missing
      const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
      if (fullName) {
        await Account.updateOne(
          { userId },
          { $set: { fullName } }
        );
      }
      // Add to checked list after updating
      checkedUsers.add(userId);
    }
  } catch (error) {
    console.error('Error updating fullName:', error);
  }
});

// Modify the start command to use the main menu function
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  try {
    let account = await Account.findOne({ userId });

    if (!account) {
      // Create new account for new player
      const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
      account = new Account({
        userId,
        username: msg.from.username,
        fullName: fullName || '',
        gold: 100000,
        specialGemCount: 0,
        vndc: 1000000,
        spinCount: 10,
        robberyCount: 5,
        level: 1,
        exp: 0,
        islandImage: 'https://img.upanh.tv/2023/11/23/Cap0.jpg',
      });
      await account.save();
      
      // Add new user to checked list since they have fullName
      checkedUsers.add(userId);
      
      // Notify about new player
      await notifyNewPlayer(account);
    }

    await showMainMenu(msg.chat.id, userId);
  } catch (error) {
    console.error('Error in /start:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Add handler for return to main menu
bot.onText(/quay lại|trở về|menu|về menu|Quay về|quay về|back|return/i, async (msg) => {
  await showMainMenu(msg.chat.id, msg.from.id);
});




// Cập nhật hàm updatePendingReferralVndc
async function updatePendingReferralVndc() {
  try {
    const accounts = await Account.find({ 
      'referralList.0': { $exists: true } 
    });

    for (const account of accounts) {
      let totalPendingVndc = 0;

      for (const referral of account.referralList) {
        const referredAccount = await Account.findOne({ userId: referral.userId });
        if (referredAccount) {
          const currentTotalVndc = referredAccount.vndc;
          const lastTotalVndc = referral.lastTotalVndc || 0;

          // Tính toán phần tăng thêm dựa trên tổng VNDC
          const vndcIncrease = Math.max(0, currentTotalVndc - lastTotalVndc);
          if (vndcIncrease > 0) {
            const commission = vndcIncrease * 0.1;
            totalPendingVndc += commission;
          }
        }
      }

      account.pendingReferralVndc = totalPendingVndc;
      await account.save();
    }
  } catch (error) {
    console.error('Error updating pending referral VNDC:', error);
  }
}

// Set interval for automatic updates
setInterval(updatePendingReferralVndc, 60000);

// Function to update referral VNDC
async function updateReferralVndc(userId, vndcAmount) {
  try {
    const account = await Account.findOne({ referredBy: userId });
    if (account) {
      const referrer = await Account.findOne({ userId: userId });
      if (referrer) {
        const referralIndex = referrer.referralList.findIndex(
          ref => ref.userId === account.userId
        );

        if (referralIndex !== -1) {
          referrer.referralList[referralIndex].totalVndcMined = account.vndc;

          let totalPendingVndc = 0;
          for (const ref of referrer.referralList) {
            const referredAccount = await Account.findOne({ userId: ref.userId });
            if (referredAccount) {
              totalPendingVndc += referredAccount.vndc * 0.1;
            }
          }

          referrer.pendingReferralVndc = totalPendingVndc;
          await referrer.save();
        }
      }
    }
  } catch (error) {
    console.error('Error updating referral VNDC:', error);
  }
}






// Invite command handler
bot.onText(/\/invite|Mời bạn/, async (msg) => {
  try {
    const account = await Account.findOne({ userId: msg.from.id });
    if (!account) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản!');
    }

    if (!account.referralCode) {
      account.referralCode = account.generateReferralCode();
      await account.save();
    }

    const botUsername = (await bot.getMe()).username;
    const inviteLink = `https://t.me/${botUsername}?start=ref_${account.referralCode}`;

    const totalVndcEarned = account.referralList.reduce((sum, ref) => {
  const mined = ref.totalVndcMined || 0;
  return sum + (mined * 0.1);
}, 0);

    let referralListText = '';
    const pageSize = 10;
    const totalPages = Math.ceil(account.referralList.length / pageSize);

    // Update the formatReferralPage function
const formatReferralPage = (page) => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageReferrals = account.referralList.slice(start, end);

  return pageReferrals.map((ref, idx) => {
    const mined = ref.totalVndcMined || 0;
    return `${start + idx + 1}. ${ref.username || `User${ref.userId}`}\n└ 💎 VNDC: ${(mined * 0.1).toFixed(4)}`;
  }).join('\n\n');
};

    const mainText = `
🤝 *HỆ THỐNG GIỚI THIỆU*
━━━━━━━━━━━━━━━━━━━━
📎 Link giới thiệu của bạn (hãy coppy):
\`${inviteLink}\`

📊 *Thống kê:*
└ 👥 Đã giới thiệu: ${account.totalReferrals} người
└ 💎 Tổng VNDC nhận được: ${totalVndcEarned.toFixed(4)}
└ 💰 VNDC chưa claim: ${account.pendingReferralVndc.toFixed(4)}

🎁 *Phần thưởng giới thiệu:*
Người giới thiệu:
└ 💰 10,000 Vàng, 🎫 5 Lượt quay, 💎 10% hoa hồng VNDC từ người bạn giới thiệu nhận được

Người được giới thiệu:
└ 💰 50,000 Vàng, 🎫 5 Lượt quay

📋 *DANH SÁCH ĐÃ GIỚI THIỆU*
━━━━━━━━━━━━━━━━━━━━
${formatReferralPage(1)}`;

    const getKeyboard = (currentPage) => {
      const keyboard = [];

      if (account.pendingReferralVndc > 0) {
        keyboard.push([{ text: `💎 Nhận ${account.pendingReferralVndc.toFixed(4)} VNDC`, callback_data: 'claim_referral_vndc' }]);
      }

      if (totalPages > 1) {
        const navButtons = [];
        if (currentPage > 1) {
          navButtons.push({ text: '◀️', callback_data: `ref_page_${currentPage-1}` });
        }
        navButtons.push({ text: `${currentPage}/${totalPages}`, callback_data: 'noop' });
        if (currentPage < totalPages) {
          navButtons.push({ text: '▶️', callback_data: `ref_page_${currentPage+1}` });
        }
        keyboard.push(navButtons);
      }

      keyboard.push([{ text: '🔄 Làm mới', callback_data: 'refresh_referral' }]);

      return {
        inline_keyboard: keyboard
      };
    };

    await bot.sendPhoto(msg.chat.id, 'https://iili.io/2IoaRsf.png', {
      caption: mainText,
      parse_mode: 'Markdown',
      reply_markup: getKeyboard(1)
    });

  } catch (error) {
    console.error('Error in invite command:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Referral link handler
bot.onText(/\/start ref_(.+)/, async (msg, match) => {
  try {
    const referralCode = match[1];
    const newUserId = msg.from.id;

    const referrer = await Account.findOne({ referralCode });
    if (!referrer) {
      return bot.sendMessage(msg.chat.id, '❌ Mã giới thiệu không hợp lệ!');
    }

    if (referrer.userId === newUserId) {
      return bot.sendMessage(msg.chat.id, '❌ Bạn không thể sử dụng link giới thiệu của chính mình!');
    }

    const existingAccount = await Account.findOne({ userId: newUserId });

    if (existingAccount && existingAccount.referredBy) {
      return bot.sendMessage(msg.chat.id, '❌ Bạn đã được giới thiệu trước đó!');
    }

    if (existingAccount) {
      existingAccount.referredBy = referrer.userId;
      existingAccount.gold += 50000;
      existingAccount.spinCount += 5;
      await existingAccount.save();

      referrer.totalReferrals += 1;
      referrer.gold += 5000;
      referrer.spinCount += 5;
      referrer.referralList.push({
        userId: newUserId,
        username: msg.from.username || `User${newUserId}`,
        joinedAt: new Date(),
        totalVndcMined: 0
      });
      await referrer.save();

      return bot.sendMessage(msg.chat.id, `
🎉 *CHÚC MỪNG BẠN*
━━━━━━━━━━━━━━━
🤝 Bạn đã được giới thiệu bởi: \`${referrer.username}\`

🎁 *Phần thưởng của bạn:*
└ 💰 +50,000 Vàng
└ 🎫 +5 Lượt quay

Chúc bạn chơi game vui vẻ! 🌟
`, { parse_mode: 'Markdown' });
    }

  } catch (error) {
    console.error('Error in referral process:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Cập nhật phần xử lý callback claim_referral_vndc
bot.on('callback_query', async (callbackQuery) => {
  try {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;

   if (action === 'claim_referral_vndc') {
  const account = await Account.findOne({ userId });
  if (!account) return;

  let totalPendingVndc = 0;
  const updatedReferrals = [];

  // Tính toán hoa hồng cho từng người được giới thiệu
  for (const ref of account.referralList) {
    const referredAccount = await Account.findOne({ userId: ref.userId });
    if (referredAccount) {
      const currentTotalVndc = referredAccount.vndc || 0;
      const lastTotalVndc = ref.lastTotalVndc || 0;

      // Tính toán phần tăng thêm dựa trên tổng VNDC
      const vndcIncrease = Math.max(0, currentTotalVndc - lastTotalVndc);
      if (vndcIncrease > 0) {
        const commission = vndcIncrease * 0.1;
        totalPendingVndc += commission;

        // Cập nhật số liệu mới
        ref.lastTotalVndc = currentTotalVndc;
        ref.totalVndcMined = currentTotalVndc; // Cập nhật tổng VNDC đã mine
        ref.lastClaimTime = new Date();
        updatedReferrals.push({
          username: ref.username || `User${ref.userId}`,
          increase: vndcIncrease,
          commission: commission
        });
      }
    }
  }

  if (totalPendingVndc > 0) {
    // Cập nhật tài khoản người giới thiệu
    account.vndc = (account.vndc || 0) + totalPendingVndc;
    account.totalReferralVndc = (account.totalReferralVndc || 0) + totalPendingVndc;
    account.pendingReferralVndc = 0;
    account.lastClaimTime = new Date();
    await account.save();

    // Tạo thông báo chi tiết
    let message = `✅ Đã nhận ${totalPendingVndc.toFixed(4)} VNDC!\n\nChi tiết:\n`;
    updatedReferrals.forEach(ref => {
      message += `${ref.username}: +${ref.commission.toFixed(4)} VNDC (10% của ${ref.increase.toFixed(4)})\n`;
    });

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: message,
      show_alert: true
    });

    // Refresh màn hình
    bot.emit('message', { ...msg, text: '/invite', from: { id: userId } });
  } else {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Không có VNDC mới để claim!',
      show_alert: true
    });
  }
}
    else if (action.startsWith('ref_page_')) {
      const page = parseInt(action.split('_')[2]);
      const account = await Account.findOne({ userId });
      if (!account) return;

      const pageSize = 10;
      const totalPages = Math.ceil(account.referralList.length / pageSize);

      const totalVndcEarned = account.referralList.reduce((sum, ref) => 
        sum + (ref.totalVndcMined * 0.1), 0);

      const botUsername = (await bot.getMe()).username;
      const inviteLink = `https://t.me/${botUsername}?start=ref_${account.referralCode}`;

      const formatReferralPage = (page) => {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageReferrals = account.referralList.slice(start, end);

        return pageReferrals.map((ref, idx) => 
          `${start + idx + 1}. ${ref.username}\n└ 💎 VNDC: ${(ref.totalVndcMined * 0.1).toFixed(4)}`
        ).join('\n\n');
      };

      const mainText = `
🤝 *HỆ THỐNG GIỚI THIỆU*
━━━━━━━━━━━━━━━━━━━━
📎 Link giới thiệu của bạn:
\`${inviteLink}\`

📊 *Thống kê:*
└ 👥 Đã giới thiệu: ${account.totalReferrals} người
└ 💎 Tổng VNDC nhận được: ${totalVndcEarned.toFixed(4)}
└ 💰 VNDC chưa claim: ${account.pendingReferralVndc.toFixed(4)}

🎁 *Phần thưởng giới thiệu:*
Người giới thiệu:
└ 💰 5,000 Vàng
└ 🎫 5 Lượt quay
└ 💎 10% hoa hồng VNDC

Người được giới thiệu:
└ 💰 50,000 Vàng
└ 🎫 5 Lượt quay

📋 *DANH SÁCH ĐÃ GIỚI THIỆU*
━━━━━━━━━━━━━━━━━━━━
${formatReferralPage(page)}`;

      const getKeyboard = (currentPage) => {
        const keyboard = [];

        if (account.pendingReferralVndc > 0) {
          keyboard.push([{ text: `💎 Nhận ${account.pendingReferralVndc.toFixed(4)} VNDC`, callback_data: 'claim_referral_vndc' }]);
        }

        if (totalPages > 1) {
          const navButtons = [];
          if (currentPage > 1) {
            navButtons.push({ text: '◀️', callback_data: `ref_page_${currentPage-1}` });
          }
          navButtons.push({ text: `${currentPage}/${totalPages}`, callback_data: 'noop' });
          if (currentPage < totalPages) {
            navButtons.push({ text: '▶️', callback_data: `ref_page_${currentPage+1}` });
          }
          keyboard.push(navButtons);
        }

        keyboard.push([{ text: '🔄 Làm mới', callback_data: 'refresh_referral' }]);

        return {
          inline_keyboard: keyboard
        };
      };

      await bot.editMessageCaption(mainText, {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: 'Markdown',
        reply_markup: getKeyboard(page)
      });
    }
    else if (action === 'refresh_referral') {
      bot.emit('message', { ...msg, text: '/invite', from: { id: userId } });
    }

  } catch (error) {
    console.error('Error in callback query:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Có lỗi xảy ra, vui lòng thử lại sau.',
      show_alert: true
    });
  }
});













// Constants
const STATES = {
  IDLE: 'IDLE',
  WAITING_ACCOUNT_NUMBER: 'WAITING_ACCOUNT_NUMBER',
  WAITING_ACCOUNT_NAME: 'WAITING_ACCOUNT_NAME',
  WAITING_WITHDRAWAL_AMOUNT: 'WAITING_WITHDRAWAL_AMOUNT',
  CONFIRMING_WITHDRAWAL: 'CONFIRMING_WITHDRAWAL'
};

const BANK_LIST = {
  MOMO: { code: 'MOMO', name: 'Ví MoMo', regex: /^0\d{9}$/ },
  ZALOPAY: { code: 'ZALOPAY', name: 'ZaloPay', regex: /^0\d{9}$/ },
  VCB: { code: 'VCB', name: 'Vietcombank', regex: /^\d{10,14}$/ },
  TCB: { code: 'TCB', name: 'Techcombank', regex: /^\d{10,14}$/ },
  MB: { code: 'MB', name: 'MB Bank', regex: /^\d{10,14}$/ },
  ACB: { code: 'ACB', name: 'ACB', regex: /^\d{10,14}$/ },
  BIDV: { code: 'BIDV', name: 'BIDV', regex: /^\d{10,14}$/ },
  VTB: { code: 'VTB', name: 'VietinBank', regex: /^\d{10,14}$/ },
  TPB: { code: 'TPB', name: 'TPBank', regex: /^\d{10,14}$/ },
  MSB: { code: 'MSB', name: 'Maritime Bank', regex: /^\d{10,14}$/ },
  VPB: { code: 'VPB', name: 'VPBank', regex: /^\d{10,14}$/ },
  SHB: { code: 'SHB', name: 'SHB', regex: /^\d{10,14}$/ },
  OCB: { code: 'OCB', name: 'OCB', regex: /^\d{10,14}$/ }
};

const MIN_WITHDRAWAL = 20000;
const MAX_WITHDRAWAL = 50000000;

// Utility functions
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function validateAccountNumber(bankCode, accountNumber) {
  const bank = BANK_LIST[bankCode];
  if (!bank) return false;
  return bank.regex.test(accountNumber);
}

function validateAccountName(name) {
  // Chỉ cho phép chữ cái, số và khoảng trắng, độ dài 5-50 ký tự
  const regex = /^[A-Za-z0-9\s]{5,50}$/;
  return regex.test(name);
}


// Keyboard generators
function getBankKeyboard(currentPage = 0, banksPerPage = 8) {
  const banks = Object.values(BANK_LIST);
  const totalPages = Math.ceil(banks.length / banksPerPage);
  const startIdx = currentPage * banksPerPage;
  const pageButtons = banks
    .slice(startIdx, startIdx + banksPerPage)
    .map(bank => [{
      text: `${bank.name}`,
      callback_data: `bank_select:${bank.code}`
    }]);

  const navigationRow = [];
  if (currentPage > 0) {
    navigationRow.push({
      text: '⬅️ Trang trước',
      callback_data: `bank_page:${currentPage - 1}`
    });
  }
  if (currentPage < totalPages - 1) {
    navigationRow.push({
      text: 'Trang sau ➡️',
      callback_data: `bank_page:${currentPage + 1}`
    });
  }

  return {
    inline_keyboard: [
      ...pageButtons,
      navigationRow,
      [{
        text: '❌ Đóng',
        callback_data: 'close_menu'
      }]
    ]
  };
}

function getWithdrawalKeyboard(hasLinkedBank = false) {
  const keyboard = {
    inline_keyboard: [
      [{
        text: hasLinkedBank ? '🔄 Thay đổi tài khoản ngân hàng' : '🏦 Liên kết tài khoản ngân hàng',
        callback_data: 'link_bank'
      }]
    ]
  };

  if (hasLinkedBank) {
    keyboard.inline_keyboard.unshift([{
      text: '💸 Rút tiền',
      callback_data: 'withdraw_money'
    }]);
    keyboard.inline_keyboard.push([{
      text: '📜 Lịch sử rút tiền',
      callback_data: 'withdrawal_history'
    }]);
  }

  keyboard.inline_keyboard.push([{
    text: '❌ Đóng',
    callback_data: 'close_menu'
  }]);

  return keyboard;
}

function getConfirmationKeyboard(amount) {
  return {
    inline_keyboard: [
      [{
        text: '✅ Xác nhận',
        callback_data: `confirm_withdrawal:${amount}`
      }],
      [{
        text: '❌ Hủy',
        callback_data: 'cancel_withdrawal'
      }]
    ]
  };
}

// Add new constant for image URL
const WITHDRAWAL_IMAGE_URL = 'https://iili.io/2Iferga.png'; // Replace with actual image URL

// Modified message templates to include image
function getWithdrawalMenuMessage(account) {
  const hasLinkedBank = account.bankInfo && account.bankInfo.isVerified;
  return {
    photo: WITHDRAWAL_IMAGE_URL,
    caption: `🏧 *THÔNG TIN RÚT TIỀN*\n\n` +
      `💎 Số dư VNDC: ${formatNumber(account.vndc)}\n` +
      `💵 Tỷ giá: 1 VNDC = 1 VNĐ\n` +
      `📊 Số tiền tối thiểu: ${formatNumber(MIN_WITHDRAWAL)} VNDC\n` +
      `📊 Số tiền tối đa: ${formatNumber(MAX_WITHDRAWAL)} VNDC\n\n` +
      `${hasLinkedBank ? 
        `🏦 Tài khoản đã liên kết:\n` +
        `Ngân hàng: ${BANK_LIST[account.bankInfo.bankCode].name}\n` +
        `Số TK: ${account.bankInfo.accountNumber}\n` +
        `Chủ TK: ${account.bankInfo.accountName}\n` :
        '❗️ Vui lòng liên kết tài khoản ngân hàng để rút tiền.'}`,
    options: {
      parse_mode: 'Markdown',
      reply_markup: getWithdrawalKeyboard(hasLinkedBank)
    }
  };
}

function getConfirmationMessage(account, amount) {
  return {
    photo: WITHDRAWAL_IMAGE_URL,
    caption: `🔄 *XÁC NHẬN RÚT TIỀN*\n\n` +
      `💎 Số tiền: ${formatNumber(amount)} VNDC\n` +
      `🏦 Ngân hàng: ${BANK_LIST[account.bankInfo.bankCode].name}\n` +
      `👤 Chủ TK: ${account.bankInfo.accountName}\n` +
      `📝 Số TK: ${account.bankInfo.accountNumber}\n\n` +
      `⚠️ Vui lòng kiểm tra thông tin trước khi xác nhận.`,
    options: {
      parse_mode: 'Markdown',
      reply_markup: getConfirmationKeyboard(amount)
    }
  };
}


// Modified command handlers to use sendPhoto instead of sendMessage
bot.onText(/\/ruttien|Rút tiền/, async (msg) => {
  try {
    const account = await Account.findOne({ userId: msg.from.id });
    if (!account) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản.');
    }

    // Reset user state
    account.userState = {
      currentState: STATES.IDLE,
      bankCode: null,
      tempWithdrawalAmount: 0,
      lastMessageId: null
    };
    await account.save();

    const withdrawalMenu = getWithdrawalMenuMessage(account);
    const sentMessage = await bot.sendPhoto(
      msg.chat.id,
      withdrawalMenu.photo,
      {
        caption: withdrawalMenu.caption,
        ...withdrawalMenu.options
      }
    );

    // Update lastMessageId
    account.userState.lastMessageId = sentMessage.message_id;
    await account.save();
  } catch (error) {
    console.error('Error in withdrawal command:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Message handler for user inputs
bot.on('message', async (msg) => {

  try {
    const account = await Account.findOne({ userId: msg.from.id });
    if (!account || !account.userState) return;

    switch (account.userState.currentState) {
      case STATES.WAITING_ACCOUNT_NUMBER:
        await handleAccountNumberInput(msg, account);
        break;
      case STATES.WAITING_ACCOUNT_NAME:
        await handleAccountNameInput(msg, account);
        break;
      case STATES.WAITING_WITHDRAWAL_AMOUNT:
        await handleWithdrawalAmountInput(msg, account);
        break;
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
  try {
    const action = callbackQuery.data.split(':')[0];
    const value = callbackQuery.data.split(':')[1];
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;

    // Handle admin actions separately
    if (action === 'admin_confirm' || action === 'admin_cancel') {
      if (!ADMIN_IDS.includes(userId)) {
        return bot.answerCallbackQuery(callbackQuery.id, '❌ Bạn không có quyền thực hiện thao tác này.');
      }

      const transactionId = value;
      const withdrawal = await Withdrawal.findOne({ transactionId });
      if (!withdrawal) {
        return bot.answerCallbackQuery(callbackQuery.id, '❌ Không tìm thấy giao dịch.');
      }

      const account = await Account.findOne({ userId: withdrawal.userId });
      if (!account) {
        return bot.answerCallbackQuery(callbackQuery.id, '❌ Không tìm thấy tài khoản.');
      }

      if (action === 'admin_confirm') {
        withdrawal.status = 'completed';
        await withdrawal.save();

        await bot.editMessageCaption(
          msg.caption + '\n\n✅ Đã xử lý thành công',
          {
            chat_id: ADMIN_GROUP_ID,
            message_id: msg.message_id,
            parse_mode: 'Markdown'
          }
        );

        await bot.sendPhoto(
          account.userId,
          WITHDRAWAL_IMAGE_URL,
          {
            caption: `✅ *GIAO DỊCH THÀNH CÔNG*\n\n` +
                    `🆔 Mã GD: #${transactionId.slice(-6)}\n` +
                    `💎 Số tiền: ${formatNumber(withdrawal.amount)} VNDC đã được rút thành công.`,
            parse_mode: 'Markdown'
          }
        );
      } else {
        withdrawal.status = 'cancelled';
        account.vndc += withdrawal.amount;
        await withdrawal.save();
        await account.save();

        await bot.editMessageCaption(
          msg.caption + '\n\n❌ Đã hủy yêu cầu',
          {
            chat_id: ADMIN_GROUP_ID,
            message_id: msg.message_id,
            parse_mode: 'Markdown'
          }
        );

        await bot.sendPhoto(
          account.userId,
          WITHDRAWAL_IMAGE_URL,
          {
            caption: `❌ *GIAO DỊCH BỊ HỦY*\n\n` +
                    `🆔 Mã GD: #${transactionId.slice(-6)}\n` +
                    `💎 Số tiền: ${formatNumber(withdrawal.amount)} VNDC đã được hoàn lại vào tài khoản.`,
            parse_mode: 'Markdown'
          }
        );
      }

      return bot.answerCallbackQuery(callbackQuery.id, '✅ Đã xử lý thành công');
    }

    // Handle regular user actions
    const account = await Account.findOne({ userId });
    if (!account) {
      return bot.answerCallbackQuery(callbackQuery.id, '❌ Không tìm thấy tài khoản.');
    }

    switch (action) {
      case 'link_bank':
        await handleBankLinking(msg, account);
        break;

      case 'bank_page':
        const keyboard = getBankKeyboard(parseInt(value));
        await bot.editMessageCaption(msg.caption, {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        break;

      case 'bank_select':
        await handleBankSelection(msg, account, value);
        break;

      case 'withdraw_money':
        await handleWithdrawalRequest(msg, account);
        break;

      case 'confirm_withdrawal':
        await handleWithdrawalConfirmation(msg, account, parseInt(value));
        break;

      case 'cancel_withdrawal':
        await handleWithdrawalCancellation(msg, account);
        const menuMessage = getWithdrawalMenuMessage(account);
        await bot.editMessageCaption(menuMessage.caption, {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          parse_mode: 'Markdown',
          reply_markup: menuMessage.options.reply_markup
        });
        break;

      case 'withdrawal_history':
        await handleWithdrawalHistory(msg, account);
        break;

      case 'close_menu':
        await bot.deleteMessage(msg.chat.id, msg.message_id);
        break;

      case 'back_to_menu':
        const withdrawalMenu = getWithdrawalMenuMessage(account);
        await bot.editMessageCaption(withdrawalMenu.caption, {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          parse_mode: 'Markdown',
          reply_markup: withdrawalMenu.options.reply_markup
        });
        break;
    }

    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('Error in callback query:', error);
    bot.answerCallbackQuery(callbackQuery.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});


// Handler functions
async function handleBankLinking(msg, account) {
  account.userState.currentState = STATES.WAITING_ACCOUNT_NUMBER;
  await account.save();

  await bot.editMessageCaption('🏦 Vui lòng chọn ngân hàng:', {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: 'Markdown',
    reply_markup: getBankKeyboard()
  });
}

async function handleBankPagination(msg, account, page) {
  await bot.editMessageReplyMarkup(getBankKeyboard(parseInt(page)), {
    chat_id: msg.chat.id,
    message_id: msg.message_id
  });
}

async function handleBankSelection(msg, account, bankCode) {
  account.userState.currentState = STATES.WAITING_ACCOUNT_NUMBER;
  account.userState.bankCode = bankCode;
  await account.save();

  const bankName = BANK_LIST[bankCode].name;
  await bot.editMessageCaption(
    `🏦 Bạn đã chọn: ${bankName}\n\n` +
    'Vui lòng nhập số tài khoản:',
    {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      parse_mode: 'Markdown'
    }
  );
}

async function handleAccountNumberInput(msg, account) {
  const accountNumber = msg.text.trim();
  if (!validateAccountNumber(account.userState.bankCode, accountNumber)) {
    return bot.sendPhoto(
      msg.chat.id,
      ERROR_IMAGE_URL,
      {
        caption: '❌ Số tài khoản không hợp lệ. Vui lòng kiểm tra và nhập lại.',
        parse_mode: 'Markdown'
      }
    );
  }

  account.userState.currentState = STATES.WAITING_ACCOUNT_NAME;
  account.bankInfo = {
    ...account.bankInfo,
    bankCode: account.userState.bankCode,
    accountNumber: accountNumber
  };
  await account.save();

  await bot.editMessageCaption(
    '👤 Vui lòng nhập tên chủ tài khoản (VIẾT HOA KHÔNG DẤU):',
    {
      chat_id: msg.chat.id,
      message_id: account.userState.lastMessageId,
      parse_mode: 'Markdown'
    }
  );
}

async function handleAccountNameInput(msg, account) {
  const accountName = msg.text.trim().toUpperCase();
  if (!validateAccountName(accountName)) {
    return bot.sendPhoto(
      msg.chat.id,
      ERROR_IMAGE_URL,
      {
        caption: '❌ Tên chủ tài khoản không hợp lệ. Vui lòng nhập lại (chỉ sử dụng chữ cái và số, độ dài 5-50 ký tự).',
        parse_mode: 'Markdown'
      }
    );
  }

  account.bankInfo.accountName = accountName;
  account.bankInfo.isVerified = true;
  account.userState.currentState = STATES.IDLE;
  await account.save();

  const withdrawalMenu = getWithdrawalMenuMessage(account);
  await bot.editMessageCaption(
    withdrawalMenu.caption,
    {
      chat_id: msg.chat.id,
      message_id: account.userState.lastMessageId,
      parse_mode: 'Markdown',
      reply_markup: withdrawalMenu.options.reply_markup
    }
  );
}

async function handleWithdrawalRequest(msg, account) {
  if (account.vndc < MIN_WITHDRAWAL) {
    return bot.editMessageCaption(
      '❌ Số dư không đủ. Tối thiểu 20,000 VNDC.',
      {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: 'Markdown'
      }
    );
  }

  account.userState.currentState = STATES.WAITING_WITHDRAWAL_AMOUNT;
  await account.save();

  await bot.editMessageCaption(
    `💎 Số dư hiện tại: ${formatNumber2(account.vndc)} VNDC\n\n` +
    `📝 Vui lòng nhập số VNDC muốn rút (${formatNumber2(MIN_WITHDRAWAL)} - ${formatNumber2(MAX_WITHDRAWAL)}):`,
    {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      parse_mode: 'Markdown'
    }
  );
}

async function handleWithdrawalAmountInput(msg, account) {
  try {
    // Delete user's message
    await bot.deleteMessage(msg.chat.id, msg.message_id);

    const amount = parseInt(msg.text.replace(/\D/g, ''));

    // Validate amount format
    if (isNaN(amount)) {
      return bot.sendMessage(
        msg.chat.id,
        '❌ Vui lòng nhập số tiền hợp lệ.'
      );
    }

    // Validate amount range
    if (amount < MIN_WITHDRAWAL || amount > MAX_WITHDRAWAL) {
      return bot.sendMessage(
        msg.chat.id,
        `❌ Số tiền rút phải từ ${formatNumber(MIN_WITHDRAWAL)} đến ${formatNumber(MAX_WITHDRAWAL)} VNDC.`
      );
    }

    // Validate account balance
    if (amount > account.vndc) {
      return bot.sendMessage(
        msg.chat.id,
        '❌ Số dư không đủ để thực hiện giao dịch.'
      );
    }

    // Update user state
    account.userState.currentState = STATES.CONFIRMING_WITHDRAWAL;
    account.userState.tempWithdrawalAmount = amount;
    await account.save();

    // Delete previous message if exists
    if (account.userState.lastMessageId) {
      try {
        await bot.deleteMessage(msg.chat.id, account.userState.lastMessageId);
      } catch (error) {
        console.log('Error deleting previous message:', error);
      }
    }

    // Send confirmation message with image
    const confirmationMessage = getConfirmationMessage(account, amount);
    const sentMessage = await bot.sendPhoto(
      msg.chat.id,
      WITHDRAWAL_IMAGE_URL,
      {
        caption: confirmationMessage.caption,
        ...confirmationMessage.options
      }
    );

    // Update lastMessageId
    account.userState.lastMessageId = sentMessage.message_id;
    await account.save();

  } catch (error) {
    console.error('Error in withdrawal amount input:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
}

async function handleWithdrawalConfirmation(msg, account, amount) {
  try {
    // Validate amount and account balance
    if (amount < MIN_WITHDRAWAL || amount > MAX_WITHDRAWAL) {
      return bot.sendMessage(
        msg.chat.id,
        `❌ Số tiền rút phải từ ${formatNumber(MIN_WITHDRAWAL)} đến ${formatNumber(MAX_WITHDRAWAL)} VNDC.`
      );
    }

    if (amount > account.vndc) {
      return bot.sendMessage(
        msg.chat.id,
        '❌ Số dư không đủ để thực hiện giao dịch.'
      );
    }

    // Generate transaction ID
    const transactionId = `W${Date.now()}${Math.random().toString(36).substr(2, 6)}`;

    // Create new withdrawal record
    const withdrawal = new Withdrawal({
      transactionId,
      userId: account.userId,
      amount,
      bankCode: account.bankInfo.bankCode,
      accountNumber: account.bankInfo.accountNumber,
      accountName: account.bankInfo.accountName,
      status: 'pending',
      createdAt: new Date()
    });

    // Deduct amount from user's balance
    account.vndc -= amount;
    await account.save();
    await withdrawal.save();

    // Send confirmation to user
    await bot.editMessageCaption(
      `✅ *YÊU CẦU RÚT TIỀN THÀNH CÔNG*\n\n` +
      `🆔 Mã GD: #${transactionId.slice(-6)}\n` +
      `💎 Số tiền: ${formatNumber(amount)} VNDC\n` +
      `🏦 Ngân hàng: ${BANK_LIST[account.bankInfo.bankCode].name}\n` +
      `👤 Chủ TK: ${account.bankInfo.accountName}\n` +
      `📝 Số TK: ${account.bankInfo.accountNumber}\n\n` +
      `⏳ Trạng thái: Đang xử lý\n` +
      `ℹ️ Yêu cầu của bạn sẽ được xử lý trong thời gian sớm nhất.`,
      {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: 'Markdown'
      }
    );

    // Reset user state
    account.userState = {
      currentState: STATES.IDLE,
      bankCode: null,
      tempWithdrawalAmount: 0,
      lastMessageId: null
    };
    await account.save();

    // Send notification to admin group
    await bot.sendPhoto(
      ADMIN_GROUP_ID,
      WITHDRAWAL_IMAGE_URL,
      {
        caption: `🔔 *YÊU CẦU RÚT TIỀN MỚI*\n\n` +
          `🆔 Mã GD: #${transactionId.slice(-6)}\n` +
          `👤 User ID: ${account.userId}\n` +
          `💎 Số tiền: ${formatNumber(amount)} VNDC\n` +
          `🏦 Ngân hàng: ${BANK_LIST[account.bankInfo.bankCode].name}\n` +
          `👤 Chủ TK: ${account.bankInfo.accountName}\n` +
          `📝 Số TK: ${account.bankInfo.accountNumber}`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '✅ Xác nhận',
                callback_data: `admin_confirm:${transactionId}`
              },
              {
                text: '❌ Hủy',
                callback_data: `admin_cancel:${transactionId}`
              }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error('Error in withdrawal confirmation:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
}

async function handleWithdrawalCancellation(msg, account) {
  account.userState.currentState = STATES.IDLE;
  account.userState.tempWithdrawalAmount = 0;
  await account.save();

  const withdrawalMenu = getWithdrawalMenuMessage(account);
  await bot.editMessageText(
    withdrawalMenu.text,
    {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      ...withdrawalMenu.options
    }
  );
}

async function handleWithdrawalHistory(msg, account) {
  const history = account.withdrawalHistory.slice(-5).reverse(); // Get last 5 transactions
  let historyText = '📜 *LỊCH SỬ RÚT TIỀN*\n\n';

  if (history.length === 0) {
    historyText += 'Chưa có giao dịch nào.';
  } else {
    history.forEach((transaction, index) => {
      historyText += `${index + 1}. Giao dịch #${transaction.transactionId.slice(-6)}\n` +
        `💎 Số tiền: ${formatNumber(transaction.amount)} VNDC\n` +
        `🏦 Ngân hàng: ${BANK_LIST[transaction.bankInfo.bankCode].name}\n` +
        `📝 Số TK: ${transaction.bankInfo.accountNumber}\n` +
        `📅 Ngày: ${transaction.requestDate.toLocaleDateString('vi-VN')}\n` +
        `📊 Trạng thái: ${getStatusText(transaction.status)}\n\n`;
    });
  }

  try {
    // Thử cập nhật caption nếu message có hình ảnh
    await bot.editMessageCaption(historyText, {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{
          text: '🔙 Quay lại',
          callback_data: 'back_to_withdrawal'
        }]]
      }
    });
  } catch (error) {
    // Nếu không có hình ảnh, sử dụng editMessageText
    if (error.description.includes('message to edit not found')) {
      await bot.editMessageText(historyText, {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{
            text: '🔙 Quay lại',
            callback_data: 'back_to_withdrawal'
          }]]
        }
      });
    } else {
      throw error; // Ném lại lỗi nếu là lỗi khác
    }
  }
}

function getStatusText(status) {
  switch (status) {
    case 'pending': return '⏳ Đang xử lý';
    case 'completed': return '✅ Đã hoàn thành';
    case 'rejected': return '❌ Đã từ chối';
    default: return status;
  }
}


// Add these constants at the top
const ADMIN_GROUP_ID = -1002176195187;
const ADMIN_IDS = [7305842707];

// Add message cleanup function
async function cleanupMessages(chatId, keepMessageId) {
  try {
    if (global.messageCleanupQueue && global.messageCleanupQueue[chatId]) {
      for (const msgId of global.messageCleanupQueue[chatId]) {
        if (msgId !== keepMessageId) {
          await bot.deleteMessage(chatId, msgId).catch(() => {});
        }
      }
      global.messageCleanupQueue[chatId] = [keepMessageId];
    }
  } catch (error) {
    console.error('Error cleaning up messages:', error);
  }
}


// Modify the message sending function to track messages
async function sendBotMessage(chatId, text, options = {}) {
  const msg = await bot.sendMessage(chatId, text, options);
  if (!global.messageCleanupQueue) global.messageCleanupQueue = {};
  if (!global.messageCleanupQueue[chatId]) global.messageCleanupQueue[chatId] = [];
  global.messageCleanupQueue[chatId].push(msg.message_id);
  return msg;
}
















const schedule = require('node-schedule');

// Thêm vào phần Constants
const INTERMEDIATE_SERVER_URL = 'https://game-49kg.onrender.com';

// Thêm schema mới để lưu trữ trạng thái xem video
const videoWatchSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  taskId: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  completed: { type: Boolean, default: false },
  clickCount: { type: Number, default: 0 }
});

const VideoWatch = mongoose.model('VideoWatch', videoWatchSchema);


const taskSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  completedTasks: [{
    taskId: String,
    completedAt: Date
  }],
  dailyTasks: [{
    taskId: String,
    lastCompletedAt: Date,
    progress: {
      watchTime: Number,
      checkpoints: [Date]
    }
  }],
  lastDailyReset: { type: Date, default: Date.now }
});

const taskTemplateSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true },
  type: { 
    type: String, 
    enum: ['one_time', 'daily', 'join_group', 'join_channel', 'watch_video', 'interact'], 
    required: true 
  },
  title: { type: String, required: true },
  description: String,
  link: String,
  rewards: {
    vndc: { type: Number, default: 0 },
    gold: { type: Number, default: 0 },
    spins: { type: Number, default: 0 }
  },
  requirements: {
    groupId: Number,
    channelId: Number,
    interactionCount: Number,
    messageCount: Number
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  createdBy: Number,
  expiresAt: Date
});

const Task = mongoose.model('Task', taskSchema);
const TaskTemplate = mongoose.model('TaskTemplate', taskTemplateSchema);

// User Session Management
const userSessions = new Map();
const taskCreationStates = new Map();
const videoWatchSessions = new Map();

// Constants
 // Replace with actual admin IDs
const DAILY_RESET_HOUR = 0; // Reset at midnight

// Utility Functions
function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

function createTaskButton(taskId, title, completed = false) {
  return {
    text: `${completed ? '✅' : '⭕'} ${title}`,
    callback_data: `task_${taskId}`
  };
}

function createCheckButton(taskId) {
  return {
    text: '🔍 Kiểm tra',
    callback_data: `check_${taskId}`
  };
}

function isSameDay(d1, d2) {
  if (!d1 || !d2) return false;
  d1 = new Date(d1);
  d2 = new Date(d2);
  return d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();
}



async function resetDailyTasks() {
  const users = await Task.find({});
  for (const user of users) {
    user.dailyTasks = [];
    user.lastDailyReset = new Date();
    await user.save();
  }
}

// Schedule daily reset
schedule.scheduleJob(`0 ${DAILY_RESET_HOUR} * * *`, resetDailyTasks);


function createIntermediateLink(userId, taskId, originalLink) {
  const params = new URLSearchParams({
    userId: userId,
    taskId: taskId,
    redirect: originalLink
  });
  return `${INTERMEDIATE_SERVER_URL}/click?${params.toString()}`;
}



// Task Completion Check Functions
async function checkGroupMembership(userId, groupId) {
  try {
    const member = await bot.getChatMember(groupId, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (error) {
    console.error('Error checking group membership:', error);
    return false;
  }
}

async function checkChannelMembership(userId, channelId) {
  try {
    const member = await bot.getChatMember(channelId, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (error) {
    console.error('Error checking channel membership:', error);
    return false;
  }
}

async function checkVideoWatching(userId, taskId) {
  try {
    const watchRecord = await VideoWatch.findOne({ 
      userId: userId,
      taskId: taskId,
      completed: true
    });

    if (!watchRecord) return false;

    // Kiểm tra thời gian xem
    const watchDuration = Date.now() - watchRecord.startTime;
    const minimumDuration = 30000; // 30 giây

    return watchDuration >= minimumDuration;
  } catch (error) {
    console.error('Lỗi kiểm tra xem video:', error);
    return false;
  }
}



async function awardTaskRewards(userId, rewards) {
  const account = await Account.findOne({ userId });
  if (!account) return false;

  account.vndc += rewards.vndc;
  account.gold += rewards.gold;
  account.spinCount += rewards.spins;
  await account.save();
  return true;
}

// Add delete task command
bot.onText(/\/xoanhiemvu (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const taskId = match[1];

  if (!isAdmin(userId)) {
    await bot.sendMessage(chatId, "⛔ Bạn không có quyền sử dụng lệnh này!");
    return;
  }

  try {
    const result = await TaskTemplate.deleteOne({ taskId });
    if (result.deletedCount > 0) {
      await bot.sendMessage(chatId, `✅ Đã xóa nhiệm vụ ${taskId} thành công!`);
    } else {
      await bot.sendMessage(chatId, "❌ Không tìm thấy nhiệm vụ!");
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    await bot.sendMessage(chatId, "❌ Có lỗi xảy ra khi xóa nhiệm vụ!");
  }
});

// Admin Commands
bot.onText(/\/themnhiemvu/, async (msg) => {
  if (!isAdmin(msg.from.id)) {
    await bot.sendMessage(msg.chat.id, "⛔ Bạn không có quyền sử dụng lệnh này!");
    return;
  }

  const userId = msg.from.id;
  const chatId = msg.chat.id;

  taskCreationStates.set(userId, {
    step: 0,
    data: {}
  });

  const taskTypes = [
    ['one_time', 'Nhiệm vụ một lần'],
    ['daily', 'Nhiệm vụ hàng ngày'],
    ['join_group', 'Tham gia nhóm'],
    ['join_channel', 'Tham gia kênh'],
    ['watch_video', 'Xem video'],
    ['interact', 'Tương tác']
  ];

  const keyboard = taskTypes.map(([value, label]) => [{
    text: label,
    callback_data: `create_task_${value}`
  }]);

  await bot.sendMessage(chatId, 
    "👉 Chọn loại nhiệm vụ muốn tạo:",
    {
      reply_markup: {
        inline_keyboard: keyboard
      }
    }
  );
});



// Main Callback Query Handler
bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  console.log(`Received callback: ${action} from user ${userId}`);

  try {
    if (action.startsWith('tasks_page_')) {
      const page = parseInt(action.replace('tasks_page_', ''));
      await bot.deleteMessage(chatId, messageId);
      await showTasks(chatId, userId, page);
    }
    else if (action.startsWith('create_task_')) {
      const taskType = action.replace('create_task_', '');

      taskCreationStates.set(userId, {
        step: 1,
        type: taskType,
        data: {}
      });

      const questions = {
        title: "📝 Nhập tiêu đề nhiệm vụ:",
        description: "📄 Nhập mô tả nhiệm vụ:",
        link: "🔗 Nhập link thực hiện nhiệm vụ:",
        rewards: "🎁 Nhập phần thưởng (định dạng: VNDC,Gold,Spins):",
        requirements: "⚙️ Nhập yêu cầu nhiệm vụ theo định dạng phù hợp:"
      };

      await bot.editMessageText(questions.title, {
        chat_id: chatId,
        message_id: messageId
      });
    }
    else if (action.startsWith('check_')) {
      const taskId = action.replace('check_', '');
      await bot.sendMessage(chatId, "🔄 Đang kiểm tra nhiệm vụ...");
      await checkTaskCompletion(taskId, userId, chatId);
    }

    await bot.answerCallbackQuery(callbackQuery.id);

  } catch (error) {
    console.error('Error handling callback query:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Có lỗi xảy ra!",
      show_alert: true
    });
  }
});

// Message Handler for Task Creation
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (!taskCreationStates.has(userId)) return;

  const state = taskCreationStates.get(userId);
  const text = msg.text;

  try {
    switch (state.step) {
      case 1:
        state.data.title = text;
        state.step++;
        await bot.sendMessage(chatId, "📄 Nhập mô tả nhiệm vụ:");
        break;

      case 2:
        state.data.description = text;
        state.step++;
        await bot.sendMessage(chatId, "🔗 Nhập link thực hiện nhiệm vụ:");
        break;

      case 3:
        state.data.link = text;
        state.step++;
        await bot.sendMessage(chatId, "🎁 Nhập phần thưởng (VNDC,Gold,Spins):");
        break;

      case 4:
        const rewards = text.split(',').map(Number);
        if (rewards.length !== 3 || rewards.some(isNaN)) {
          await bot.sendMessage(chatId, "❌ Định dạng không hợp lệ. Vui lòng nhập lại (VD: 10,1000,2):");
          return;
        }

        state.data.rewards = {
          vndc: rewards[0],
          gold: rewards[1],
          spins: rewards[2]
        };

        state.step++;

        // Ask for specific requirements based on task type
        let requirementsPrompt = "⚙️ ";
        switch (state.type) {
          case 'join_group':
            requirementsPrompt += "Nhập Group ID:";
            break;
          case 'join_channel':
            requirementsPrompt += "Nhập Channel ID:";
            break;
          case 'watch_video':
            requirementsPrompt += "Nhập Video ID và thời gian xem tối thiểu (giây), cách nhau bởi dấu phẩy:";
            break;
          case 'interact':
            requirementsPrompt += "Nhập số lượng tương tác cần thiết:";
            break;
          default:
            // Skip requirements for simple tasks
            state.step = 6;
            await finalizeTaskCreation(userId, chatId);
            return;
        }

        await bot.sendMessage(chatId, requirementsPrompt);
        break;

      case 5:
        // Process requirements based on task type
        let requirements = {};
        switch (state.type) {
          case 'join_group':
            requirements.groupId = text;
            break;
          case 'join_channel':
            requirements.channelId = text;
            break;
          case 'watch_video':
            const [videoId, watchTime] = text.split(',');
            requirements = {
              videoId: videoId.trim(),
              watchTimeSeconds: parseInt(watchTime) || 30
            };
            break;
          case 'interact':
            requirements.interactionCount = parseInt(text) || 1;
            break;
        }

        state.data.requirements = requirements;
        await finalizeTaskCreation(userId, chatId);
        break;
    }
  } catch (error) {
    console.error('Error in task creation:', error);
    await bot.sendMessage(chatId, "❌ Có lỗi xảy ra trong quá trình tạo nhiệm vụ!");
    taskCreationStates.delete(userId);
  }
});

async function finalizeTaskCreation(userId, chatId) {
  const state = taskCreationStates.get(userId);

  try {
    const newTask = new TaskTemplate({
      taskId: `task_${Date.now()}`,
      type: state.type,
      title: state.data.title,
      description: state.data.description,
      link: state.data.link,
      rewards: state.data.rewards,
      requirements: state.data.requirements,
      createdBy: userId
    });

    await newTask.save();

    const successMessage = `
✅ *Tạo nhiệm vụ thành công!*

📌 Tiêu đề: ${state.data.title}
📝 Mô tả: ${state.data.description}
🎁 Phần thưởng:
   └ 💎 ${state.data.rewards.vndc} VNDC
   └ 🏅 ${state.data.rewards.gold} Vàng
   └ 🎫 ${state.data.rewards.spins} Lượt quay
    `;

    await bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
    taskCreationStates.delete(userId);
  } catch (error) {
    console.error('Error finalizing task creation:', error);
    await bot.sendMessage(chatId, "❌ Có lỗi xảy ra khi tạo nhiệm vụ!");
    taskCreationStates.delete(userId);
  }
}

// Modified checkTaskCompletion function
async function checkTaskCompletion(taskId, userId, chatId) {
  try {
    const taskTemplate = await TaskTemplate.findOne({ taskId });
    if (!taskTemplate) {
      await bot.sendMessage(chatId, "❌ Không tìm thấy nhiệm vụ!");
      return;
    }

    const userTask = await Task.findOne({ userId });
    if (!userTask) return;

    // Check if task was already completed
    const alreadyCompleted = userTask.completedTasks.some(t => t.taskId === taskId);
    if (alreadyCompleted) {
      await bot.sendMessage(chatId, "❌ Bạn đã hoàn thành nhiệm vụ này rồi!");
      return;
    }

    let isCompleted = false;
    let message = "";

    switch (taskTemplate.type) {
      case 'join_group':
        isCompleted = await checkGroupMembership(userId, taskTemplate.requirements.groupId);
        message = isCompleted ? "✅ Đã tham gia nhóm thành công!" : "❌ Bạn chưa tham gia nhóm!";
        break;

      case 'join_channel':
        isCompleted = await checkChannelMembership(userId, taskTemplate.requirements.channelId);
        message = isCompleted ? "✅ Đã tham gia kênh thành công!" : "❌ Bạn chưa tham gia kênh!";
        break;

      case 'watch_video':
      isCompleted = await checkVideoWatching(userId, taskId);
      message = isCompleted ? 
        "✅ Đã xem video thành công!" : 
        "❌ Bạn cần xem video trong ít nhất 30 giây!";
      break;

      case 'daily':
        const lastComplete = userTask.dailyTasks.find(t => t.taskId === taskId);
        const today = new Date();
        isCompleted = !lastComplete || !isSameDay(lastComplete.lastCompletedAt, today);
        message = isCompleted ? "✅ Nhiệm vụ hàng ngày hoàn thành!" : "❌ Bạn đã hoàn thành nhiệm vụ này hôm nay!";
        break;

      case 'interact':
        const taskProgress = userTask.dailyTasks.find(t => t.taskId === taskId);
        isCompleted = taskProgress && taskProgress.progress && 
                     taskProgress.progress.checkpoints.length >= taskTemplate.requirements.interactionCount;
        message = isCompleted ? "✅ Đã hoàn thành yêu cầu tương tác!" : 
                 `❌ Còn thiếu ${taskTemplate.requirements.interactionCount - (taskProgress?.progress?.checkpoints?.length || 0)} lượt tương tác!`;
        break;
    }

    if (isCompleted) {
      // Update completion status
      if (taskTemplate.type === 'daily' || taskTemplate.type === 'interact') {
        await Task.updateOne(
          { userId },
          { 
            $pull: { dailyTasks: { taskId } },
            $push: { dailyTasks: { 
              taskId, 
              lastCompletedAt: new Date(),
              progress: {
                checkpoints: []
              }
            }}
          }
        );
      } else {
        await Task.updateOne(
          { userId },
          { $addToSet: { completedTasks: { taskId, completedAt: new Date() } } }
        );
      }

      // Award rewards
      const awarded = await awardTaskRewards(userId, taskTemplate.rewards);
      if (awarded) {
        message += `\n\n🎁 Phần thưởng:\n`;
        message += `└ 💎 ${taskTemplate.rewards.vndc} VNDC\n`;
        message += `└ 🏅 ${taskTemplate.rewards.gold} Vàng\n`;
        message += `└ 🎫 ${taskTemplate.rewards.spins} Lượt quay`;
      }
    }

    await bot.sendMessage(chatId, message);

  } catch (error) {
    console.error('Error checking task completion:', error);
    await bot.sendMessage(chatId, "❌ Có lỗi xảy ra khi kiểm tra nhiệm vụ!");
  }
}

// Add these constants at the top
const TASKS_PER_PAGE = 10;
const MISSION_IMAGE_URL = 'https://iili.io/2zUT8iX.png';

// Modified View Tasks Command
bot.onText(/Nhiệm vụ|\/tasks/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  try {
    // Default to page 1
    await showTasks(chatId, userId, 1);
  } catch (error) {
    console.error('Error displaying tasks:', error);
    await bot.sendMessage(chatId, "❌ Có lỗi xảy ra khi hiển thị nhiệm vụ!");
  }
});

async function showTasks(chatId, userId, page) {
  try {
    let userTask = await Task.findOne({ userId });
    if (!userTask) {
      userTask = new Task({ userId });
      await userTask.save();
    }

    // Reset daily tasks if needed
    if (!isSameDay(userTask.lastDailyReset, new Date())) {
      userTask.dailyTasks = [];
      userTask.lastDailyReset = new Date();
      await userTask.save();
    }

    const completedTaskIds = userTask.completedTasks.map(t => t.taskId);
    const dailyTaskIds = userTask.dailyTasks.map(t => t.taskId);

    // Get all active tasks
    const activeTasks = await TaskTemplate.find({ 
      isActive: true,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    });

    // Filter tasks based on completion status
    const filteredTasks = activeTasks.filter(task => {
      if (task.type === 'daily') {
        return !dailyTaskIds.includes(task.taskId);
      }
      return !completedTaskIds.includes(task.taskId);
    });

    // Calculate pagination
    const totalTasks = filteredTasks.length;
    const totalPages = Math.ceil(totalTasks / TASKS_PER_PAGE);
    const startIdx = (page - 1) * TASKS_PER_PAGE;
    const endIdx = Math.min(startIdx + TASKS_PER_PAGE, totalTasks);
    const tasksToShow = filteredTasks.slice(startIdx, endIdx);

    // Group tasks by type
    const tasksByType = {
      daily: [],
      one_time: [],
      join_group: [],
      join_channel: [],
      watch_video: [],
      interact: []
    };

    tasksToShow.forEach(task => {
      tasksByType[task.type].push(task);
    });

    let message = "🎯 *DANH SÁCH NHIỆM VỤ*\n━━━━━━━━━━━━━━━━━━━━\n\n";
    let keyboard = [];

    // Build message and keyboard
    Object.entries(tasksByType).forEach(([type, tasks]) => {
      if (tasks.length > 0) {
        message += `*${getTaskTypeTitle(type)}*\n`;

        tasks.forEach(task => {
          const isCompleted = type === 'daily' 
            ? dailyTaskIds.includes(task.taskId)
            : completedTaskIds.includes(task.taskId);

          message += `${isCompleted ? '✅' : '❌'} ${task.title}\n`;
          if (task.description) {
            message += `└ ${task.description}\n`;
          }
          message += `└ Phần thưởng: ${task.rewards.vndc} VNDC, ${task.rewards.gold} Vàng, ${task.rewards.spins} Lượt quay\n\n`;

          // Tạo nút tương tác dựa vào loại nhiệm vụ
          let taskButton;
          if (task.type === 'watch_video') {
            const intermediateLink = createIntermediateLink(userId, task.taskId, task.link);
            taskButton = { text: `${isCompleted ? '✅' : '🎥'} ${task.title}`, url: intermediateLink };
          } else {
            taskButton = { text: `${isCompleted ? '✅' : '🎯'} ${task.title}`, url: task.link };
          }

          keyboard.push([
            taskButton,
            createCheckButton(task.taskId)
          ]);
        });
      }
    });

    // Add pagination buttons if needed
    if (totalPages > 1) {
      const paginationRow = [];
      if (page > 1) {
        paginationRow.push({
          text: '⬅️ Trang trước',
          callback_data: `tasks_page_${page - 1}`
        });
      }
      paginationRow.push({
        text: `📄 ${page}/${totalPages}`,
        callback_data: 'current_page'
      });
      if (page < totalPages) {
        paginationRow.push({
          text: 'Trang sau ➡️',
          callback_data: `tasks_page_${page + 1}`
        });
      }
      keyboard.push(paginationRow);
    }

    // Send image with caption and keyboard
    await bot.sendPhoto(chatId, MISSION_IMAGE_URL, {
      caption: message,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    console.error('Error in showTasks:', error);
    await bot.sendMessage(chatId, "❌ Có lỗi xảy ra khi hiển thị nhiệm vụ!");
  }
}

function getTaskTypeTitle(type) {
  const titles = {
    daily: '📅 NHIỆM VỤ HÀNG NGÀY',
    one_time: '🎯 NHIỆM VỤ MỘT LẦN',
    join_group: '👥 THAM GIA NHÓM',
    join_channel: '📢 THAM GIA KÊNH',
    watch_video: '🎥 XEM VIDEO',
    interact: '💬 TƯƠNG TÁC'
  };
  return titles[type] || type.toUpperCase();
}

// Start the bot
console.log('Bot is running...');

const express = require('express');
const app = express();

app.get('/click', async (req, res) => {
  const { userId, taskId, redirect } = req.query;

  try {
    // Tạo hoặc cập nhật bản ghi xem video
    await VideoWatch.findOneAndUpdate(
      { userId: Number(userId), taskId },
      { 
        $inc: { clickCount: 1 },
        $setOnInsert: { startTime: new Date() }
      },
      { upsert: true }
    );

    // Sau 30 giây, đánh dấu hoàn thành
    setTimeout(async () => {
      await VideoWatch.findOneAndUpdate(
        { userId: Number(userId), taskId },
        { completed: true }
      );
    }, 30000);

    // Chuyển hướng người dùng đến video
    res.redirect(redirect);
  } catch (error) {
    console.error('Lỗi xử lý click:', error);
    res.status(500).send('Đã xảy ra lỗi');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại cổng ${PORT}`);
});











// Daily rewards configuration
const DAILY_REWARDS = [
  { day: 1, gold: 10000, spins: 2 },
  { day: 2, gold: 15000, spins: 3 },
  { day: 3, gold: 25000, spins: 4 },
  { day: 4, gold: 40000, spins: 5 },
  { day: 5, gold: 60000, spins: 6 },
  { day: 6, gold: 90000, spins: 8 },
  { day: 7, gold: 120000, spins: 10, vndc: 500 },
  { day: 8, gold: 150000, spins: 12 },
  { day: 9, gold: 200000, spins: 15 },
  { day: 10, gold: 300000, spins: 20 },
  { day: 11, gold: 400000, spins: 25 },
  { day: 12, gold: 500000, spins: 30 },
  { day: 13, gold: 700000, spins: 35 },
  { day: 14, gold: 900000, spins: 40, vndc: 700 },
  { day: 15, gold: 1200000, spins: 50 },
  { day: 16, gold: 1500000, spins: 60 },
  { day: 17, gold: 1800000, spins: 70 },
  { day: 18, gold: 2200000, spins: 80 },
  { day: 19, gold: 2600000, spins: 90 },
  { day: 20, gold: 3000000, spins: 100 },
  { day: 21, gold: 3500000, spins: 120 },
  { day: 22, gold: 4000000, spins: 140 },
  { day: 23, gold: 5000000, spins: 160 },
  { day: 24, gold: 6000000, spins: 180 },
  { day: 25, gold: 7000000, spins: 200 },
  { day: 26, gold: 8000000, spins: 220 },
  { day: 27, gold: 9000000, spins: 240 },
  { day: 28, gold: 10000000, spins: 260 },
  { day: 29, gold: 12000000, spins: 280 },
  { day: 30, gold: 15000000, spins: 300, vndc: 1000 }
];


// Command handler
bot.onText(/\/checkin|Điểm Danh Hàng Ngày/, async (msg) => {
  try {
    const account = await Account.findOne({ userId: msg.from.id });
    if (!account) {
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy tài khoản!');
    }

    // Khởi tạo dailyCheckin nếu chưa có
    if (!account.dailyCheckin) {
      account.dailyCheckin = {
        lastCheckin: null,
        streak: 0,
        totalCheckins: 0
      };
      await account.save();
    }

    const mainText = generateCheckinText(account);
    
    await bot.sendPhoto(msg.chat.id, 'https://iili.io/2IzPsIV.png', {
      caption: mainText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Điểm Danh Ngay', callback_data: 'do_checkin' }],
          [{ text: '📋 Xem Phần Thưởng', callback_data: 'view_rewards' }]
        ]
      }
    });

  } catch (error) {
    console.error('Error in checkin command:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
  try {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;

    if (action === 'do_checkin') {
      const account = await Account.findOne({ userId });
      if (!account) return;

      const now = new Date();
      
      // Khởi tạo dailyCheckin nếu chưa có
      if (!account.dailyCheckin) {
        account.dailyCheckin = {
          lastCheckin: null,
          streak: 0,
          totalCheckins: 0
        };
      }

      // Kiểm tra đã điểm danh chưa
      if (account.dailyCheckin.lastCheckin && isSameDay(account.dailyCheckin.lastCheckin, now)) {
        return bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Bạn đã điểm danh hôm nay rồi!\nQuay lại vào ngày mai nhé!',
          show_alert: true
        });
      }

      // Kiểm tra và cập nhật streak
      if (account.dailyCheckin.lastCheckin) {
        if (!isConsecutiveDay(account.dailyCheckin.lastCheckin, now)) {
          account.dailyCheckin.streak = 0;
        }
      }

      // Cập nhật thông tin điểm danh
      account.dailyCheckin.streak = Number(account.dailyCheckin.streak || 0) + 1;
      account.dailyCheckin.lastCheckin = now;
      account.dailyCheckin.totalCheckins = Number(account.dailyCheckin.totalCheckins || 0) + 1;

      // Tìm phần thưởng phù hợp
      const reward = DAILY_REWARDS.find(r => r.day === account.dailyCheckin.streak) || 
                    DAILY_REWARDS[0];

      // Cập nhật phần thưởng
      account.gold = Number(account.gold || 0) + reward.gold;
      account.spinCount = Number(account.spinCount || 0) + reward.spins;
      if (reward.vndc) {
        account.vndc = Number(account.vndc || 0) + reward.vndc;
      }

      await account.save();

      // Tạo thông báo phần thưởng
      let rewardMsg = `🎉 *ĐIỂM DANH THÀNH CÔNG*\n`;
      rewardMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
      rewardMsg += `📅 Ngày điểm danh thứ: ${account.dailyCheckin.streak}\n\n`;
      rewardMsg += `🎁 Phần thưởng nhận được:\n`;
      rewardMsg += `└ 💰 +${reward.gold.toLocaleString()} Vàng\n`;
      rewardMsg += `└ 🎫 +${reward.spins} Lượt quay\n`;
      if (reward.vndc) {
        rewardMsg += `└ 💎 +${reward.vndc} VNDC\n`;
      }

      await bot.editMessageCaption(rewardMsg, {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Làm mới', callback_data: 'refresh_checkin' }]
          ]
        }
      });

    } else if (action === 'view_rewards') {
      const rewardsText = generateRewardsText();
      
      await bot.editMessageCaption(rewardsText, {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '◀️ Quay lại', callback_data: 'refresh_checkin' }]
          ]
        }
      });

    } else if (action === 'refresh_checkin') {
      const account = await Account.findOne({ userId });
      const mainText = generateCheckinText(account);
      
      await bot.editMessageCaption(mainText, {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Điểm Danh Ngay', callback_data: 'do_checkin' }],
            [{ text: '📋 Xem Phần Thưởng', callback_data: 'view_rewards' }]
          ]
        }
      });
    }

  } catch (error) {
    console.error('Error in callback query:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Có lỗi xảy ra, vui lòng thử lại sau.',
      show_alert: true
    });
  }
});

// Helper functions
function generateCheckinText(account) {
  const streak = Number(account.dailyCheckin?.streak || 0);
  const totalCheckins = Number(account.dailyCheckin?.totalCheckins || 0);
  const lastCheckin = account.dailyCheckin?.lastCheckin;
  
  let text = `
📝 *HỆ THỐNG ĐIỂM DANH HÀNG NGÀY*
━━━━━━━━━━━━━━━━━━━━
👤 Người chơi: \`${account.username || account.userId}\`

📊 *Thống kê điểm danh:*
└ 🔥 Chuỗi hiện tại: ${streak} ngày
└ 📅 Tổng số lần: ${totalCheckins} lần

⏰ *Trạng thái:* ${lastCheckin && isSameDay(lastCheckin, new Date()) 
  ? '✅ Đã điểm danh hôm nay'
  : '❌ Chưa điểm danh hôm nay'}

🎯 *Mốc điểm danh đặc biệt:*
└ 7️⃣ Ngày: +500 VNDC
└ 1️⃣4️⃣ Ngày: +700 VNDC
└ 3️⃣0️⃣ Ngày: +1000 VNDC

💡 Lưu ý: Bỏ lỡ một ngày sẽ làm mất chuỗi điểm danh!
`;
  return text;
}

function generateRewardsText() {
  let text = `
📋 *BẢNG PHẦN THƯỞNG ĐIỂM DANH*
━━━━━━━━━━━━━━━━━━━━\n`;

  DAILY_REWARDS.forEach(reward => {
    text += `*Ngày ${reward.day}:*\n`;
    text += `└ 💰 ${reward.gold.toLocaleString()} Vàng\n`;
    text += `└ 🎫 ${reward.spins} Lượt quay\n`;
    if (reward.vndc) {
      text += `└ 💎 ${reward.vndc} VNDC\n`;
    }
    text += '\n';
  });

  return text;
}

function isSameDay(date1, date2) {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function isConsecutiveDay(lastDate, currentDate) {
  if (!lastDate || !currentDate) return false;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const lastDay = new Date(lastDate);
  const currDay = new Date(currentDate);
  lastDay.setHours(0, 0, 0, 0);
  currDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((currDay - lastDay) / oneDayMs);
  return diffDays === 1;
}










// Thêm command để xem danh sách người chơi
bot.onText(/\/players/, async (msg) => {
  try {
    // Kiểm tra quyền admin
    if (msg.from.id !== -10038972420) {
      return bot.sendMessage(msg.chat.id, '❌ Bạn không có quyền sử dụng lệnh này!');
    }

    await showPlayerList(msg.chat.id, 1);

  } catch (error) {
    console.error('Error in players command:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

// Hàm hiển thị danh sách người chơi
async function showPlayerList(chatId, page) {
  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  // Lấy tổng số người chơi
  const totalPlayers = await Account.countDocuments();
  const totalPages = Math.ceil(totalPlayers / pageSize);

  // Lấy danh sách người chơi theo trang
  const players = await Account.find()
    .sort({ createdAt: -1 }) // Sắp xếp theo thời gian tạo mới nhất
    .skip(skip)
    .limit(pageSize);

  let message = `👥 *DANH SÁCH NGƯỜI CHƠI*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📄 Trang ${page}/${totalPages}\n\n`;

  players.forEach((player, index) => {
    message += `*${skip + index + 1}. ${player.username || 'Không tên'}*\n`;
    message += `└ 🆔 ID: \`${player.userId}\`\n`;
    message += `└ 💰 Vàng: ${player.gold?.toLocaleString() || 0}\n`;
    message += `└ 💎 VNDC: ${player.vndc?.toLocaleString() || 0}\n`;
    message += `└ 💵 VNĐ: ${player.vnd?.toLocaleString() || 0}\n`;
    message += `└ 🏝 Cấp độ đảo: ${player.islandLevel || 1}\n`;
    message += `└ 🎫 Lượt quay: ${player.spinCount || 0}\n`;
    message += `└ 👥 Lượt mời: ${player.referralCount || 0}\n`;
    message += `└ ⏰ Hoạt động: ${formatLastActive(player.lastActive)}\n`;
    message += `\n`;
  });

  // Tạo nút điều hướng trang
  const keyboard = [];
  const navigation = [];

  if (page > 1) {
    navigation.push({ text: '⬅️ Trang trước', callback_data: `players_${page-1}` });
  }
  
  if (page < totalPages) {
    navigation.push({ text: 'Trang sau ➡️', callback_data: `players_${page+1}` });
  }

  if (navigation.length > 0) {
    keyboard.push(navigation);
  }

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard.length > 0 ? {
      inline_keyboard: keyboard
    } : undefined
  });
}

// Xử lý nút chuyển trang
bot.on('callback_query', async (callbackQuery) => {
  try {
    const action = callbackQuery.data;
    
    if (action.startsWith('players_')) {
      const page = parseInt(action.split('_')[1]);
      await bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
      await showPlayerList(callbackQuery.message.chat.id, page);
    }

  } catch (error) {
    console.error('Error in callback query:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Có lỗi xảy ra, vui lòng thử lại sau.',
      show_alert: true
    });
  }
});

// Middleware để tự động thông báo người chơi mới
// Thêm vào phần xử lý đăng ký tài khoản
async function notifyNewPlayer(account) {
  try {
    const message = `
🎉 *NGƯỜI CHƠI MỚI THAM GIA*
━━━━━━━━━━━━━━━━━━━━
👤 *Thông tin người chơi:*
└ Tên: ${account.username || 'Không tên'}
└ ID: \`${account.userId}\`
└ Thời gian: ${formatDate(account.createdAt)}

💰 *Tài sản:*
└ Vàng: ${account.gold?.toLocaleString() || 0}
└ VNDC: ${account.vndc?.toLocaleString() || 0}
└ VNĐ: ${account.vnd?.toLocaleString() || 0}

🎮 *Trạng thái:*
└ Cấp độ đảo: ${account.currentLevel || 1}
└ Lượt quay: ${account.spinCount || 0}
`;

    // Gửi thông báo cho admin
    await bot.sendMessage(-10038972420, message, {
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('Error in notifying new player:', error);
  }
}

// Hàm hỗ trợ format thời gian hoạt động gần nhất
function formatLastActive(date) {
  if (!date) return 'Chưa hoạt động';

  const now = new Date();
  const lastActive = new Date(date);
  const diffTime = Math.abs(now - lastActive);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays} ngày trước`;
  } else if (diffHours > 0) {
    return `${diffHours} giờ trước`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} phút trước`;
  } else {
    return 'Vừa xong';
  }
}

// Hàm format ngày tháng
function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');

  return `${day}/${month}/${year} ${hour}:${minute}`;
}

// Middleware để tự động cập nhật thời gian hoạt động
accountSchema.pre('save', function(next) {
  this.lastActive = new Date();
  next();
});







bot.onText(/\/xemnguoichoi/, async (msg) => {
  try {
    if (msg.from.id !== 7305842707) {
      return bot.sendMessage(msg.chat.id, '❌ Bạn không có quyền sử dụng lệnh này!');
    }
    await showPlayerList(msg.chat.id, 1);
  } catch (error) {
    console.error('Error in players command:', error);
    bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
  }
});

async function showPlayerList(chatId, page) {
  const pageSize = 10;
  const skip = (page - 1) * pageSize;
  const totalPlayers = await Account.countDocuments();
  const totalPages = Math.ceil(totalPlayers / pageSize);

  const players = await Account.find()
    .sort({ _id: -1 })
    .skip(skip)
    .limit(pageSize);

  let message = `👥 *DANH SÁCH NGƯỜI CHƠI*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📄 Trang ${page}/${totalPages}\n\n`;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const miningStatus = player.isMining ? 'Đang đào 🟢' : ' không đào🔴';
    const bankStatus = player.bankInfo?.isVerified ? 'đã XT ✅' : 'Chưa XT❌';

    message += `${skip + i + 1}. *${player.username || 'Không tên'}*\n`;
    message += `├ Tên: ${player.fullName || 'Không có'}\n`;
    message += `├ ID: \`${player.userId}\` ${miningStatus} ${bankStatus}\n`;
    message += `└ VNDC: ${formatNumber(player.vndc)}\n`;
    message += `├ Vàng: ${formatNumber(player.gold)}\n`;
    message += `│ ├ Lượt quay: ${player.spinCount}\n`;
    message += `│ └ Điểm danh: ${player.dailyCheckin.totalCheckins} lần\n`;
    message += `│ └ Đảo: ${player.islandUpgradeCount} nâng cấp\n\n`;
  }

  const keyboard = [];
  if (totalPages > 1) {
    const row = [];
    if (page > 1) {
      row.push({ text: '⬅️ Trang trước', callback_data: `players_${page-1}` });
    }
    if (page < totalPages) {
      row.push({ text: 'Trang sau ➡️', callback_data: `players_${page+1}` });
    }
    keyboard.push(row);
  }

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
  });
}

bot.on('callback_query', async (callbackQuery) => {
  try {
    const action = callbackQuery.data;
    if (action.startsWith('players_')) {
      const page = parseInt(action.split('_')[1]);
      await bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
      await showPlayerList(callbackQuery.message.chat.id, page);
    }
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error('Error in callback query:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Có lỗi xảy ra, vui lòng thử lại sau.',
      show_alert: true
    });
  }
});

async function notifyNewPlayer(account) {
  try {
    const message = `
🎉 *NGƯỜI CHƠI MỚI*
━━━━━━━━━━━━━━━━
👤 Tên: ${account.username || 'Không tên'}
👥 Họ và tên: ${account.fullName || 'Không có'}
🆔 ID: \`${account.userId}\`
💰 VNDC: ${formatNumber(account.vndc)}
${account.referredBy ? `👥 Ref: \`${account.referredBy}\`` : ''}`;

    await bot.sendMessage(-10038972420, message, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error in notifying new player:', error);
  }
}

function formatNumber(number) {
  return number?.toLocaleString('en-US', {maximumFractionDigits: 0}) || '0';
}






// Command to show rankings
bot.onText(/Bảng xếp hạng/, async (msg) => {
  try {
    await sendRankingMenu(msg.chat.id);
  } catch (error) {
    handleError(error, msg.chat.id);
  }
});

// Handle all callback queries
bot.on('callback_query', async (callbackQuery) => {
  try {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;

    if (data === 'rankings') {
      await showRankingMenu(chatId, messageId);
    } else if (data.startsWith('rank_')) {
      await handleRankingDisplay(data, chatId, messageId, userId);
    }

    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    handleCallbackError(error, callbackQuery);
  }
});

// Helper Functions
function createRankingKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🏆 Xếp hạng Vàng', callback_data: 'rank_gold_1' },
        { text: '💎 Xếp hạng VNDC', callback_data: 'rank_vndc_1' }
      ],
      [
        { text: '💵 Xếp hạng VNĐ', callback_data: 'rank_vnd_1' }
      ]
    ]
  };
}

async function sendRankingMenu(chatId) {
  await bot.sendPhoto(chatId, 'https://iili.io/2IRSVAx.png', {
    caption: '📊 *BẢNG XẾP HẠNG*\nChọn loại xếp hạng bạn muốn xem:',
    parse_mode: 'Markdown',
    reply_markup: createRankingKeyboard()
  });
}

async function showRankingMenu(chatId, messageId) {
  await bot.editMessageCaption('📊 *BẢNG XẾP HẠNG*\nChọn loại xếp hạng bạn muốn xem:', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: createRankingKeyboard()
  });
}

async function handleRankingDisplay(data, chatId, messageId, userId) {
  const [, type, page] = data.split('_');
  await showRanking(chatId, type, parseInt(page), userId, messageId);
}

async function showRanking(chatId, type, page, userId, messageId) {
  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  const rankingConfig = getRankingConfig(type);
  const totalPlayers = await Account.countDocuments({ [rankingConfig.sortField]: { $gt: 0 } });
  const totalPages = Math.ceil(totalPlayers / pageSize);

  const topPlayers = await getTopPlayers(rankingConfig.sortField, skip, pageSize);
  const userInfo = await getUserRankInfo(userId, rankingConfig.sortField);

  const message = generateRankingMessage(rankingConfig, page, totalPages, topPlayers, userInfo, skip);
  const keyboard = createNavigationKeyboard(page, totalPages, type);

  await bot.editMessageCaption(message, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

function getRankingConfig(type) {
  const configs = {
    gold: {
      sortField: 'gold',
      title: '🏆 BẢNG XẾP HẠNG VÀNG',
      symbol: '🏆'
    },
    vndc: {
      sortField: 'vndc',
      title: '💎 BẢNG XẾP HẠNG VNDC',
      symbol: '💎'
    },
    vnd: {
      sortField: 'vnd',
      title: '💵 BẢNG XẾP HẠNG VNĐ',
      symbol: '💵'
    }
  };
  return configs[type];
}

async function getTopPlayers(sortField, skip, pageSize) {
  return await Account.find({ [sortField]: { $gt: 0 } })
    .select(`username fullName ${sortField}`)
    .sort({ [sortField]: -1 })
    .skip(skip)
    .limit(pageSize);
}

async function getUserRankInfo(userId, sortField) {
  const userData = await Account.findOne({ userId }).select(`username fullName ${sortField}`);
  if (!userData) return null;

  const userRank = await Account.countDocuments({
    [sortField]: { $gt: userData[sortField] }
  }) + 1;
  return { userData, userRank };
}

function generateRankingMessage(config, page, totalPages, topPlayers, userInfo, skip) {
  let message = `*${config.title}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📄 Trang ${page}/${totalPages}\n\n`;

  topPlayers.forEach((player, index) => {
    const rank = skip + index + 1;
    message += formatPlayerInfo(player, rank, config);
  });

  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  if (userInfo) {
    message += formatUserRankInfo(userInfo, config);
  }

  return message;
}

function formatPlayerInfo(player, rank, config) {
  const medal = getMedalForRank(rank);
  return `${medal} *${player.username || 'Không tên'}*\n` +
         `├ ${player.fullName || 'Không có'}\n` +
         `└ ${formatNumber(player[config.sortField])} ${config.symbol}\n\n`;
}

function getMedalForRank(rank) {
  const medals = {
    1: '🥇',
    2: '🥈',
    3: '🥉'
  };
  return medals[rank] || `${rank}.`;
}

function formatUserRankInfo({ userData, userRank }, config) {
  return `🎯 Hạng của bạn: #${userRank}\n` +
         `└ ${formatNumber(userData[config.sortField])} ${config.symbol}\n`;
}

function createNavigationKeyboard(page, totalPages, type) {
  const keyboard = [];

  if (totalPages > 1) {
    const navigationRow = [];
    if (page > 1) {
      navigationRow.push({ text: '⬅️ Trang trước', callback_data: `rank_${type}_${page-1}` });
    }
    if (page < totalPages) {
      navigationRow.push({ text: 'Trang sau ➡️', callback_data: `rank_${type}_${page+1}` });
    }
    keyboard.push(navigationRow);
  }

  keyboard.push([{ text: '🔄 Đổi bảng xếp hạng', callback_data: 'rankings' }]);
  return { inline_keyboard: keyboard };
}

function formatNumber(number) {
  return number?.toLocaleString('en-US', {maximumFractionDigits: 0}) || '0';
}

function handleError(error, chatId) {
  console.error('Error:', error);
  bot.sendMessage(chatId, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
}

function handleCallbackError(error, callbackQuery) {
  console.error('Callback Error:', error);
  bot.answerCallbackQuery(callbackQuery.id, {
    text: '❌ Có lỗi xảy ra, vui lòng thử lại sau.',
    show_alert: true
  });
}


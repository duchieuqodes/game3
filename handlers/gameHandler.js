module.exports = (bot) => {
  const Player = require('../models/Player');
  const keyboard = require('../utils/keyboard');

  // Start game command
  bot.onText(/\/start/, async (msg) => {
    const { id: userId, username } = msg.from;

    try {
      let player = await Player.findOne({ userId });

      if (!player) {
        player = new Player({
          userId,
          username,
          inventory: {
            gold: 100000,
            seeds: { cabbage: 5 },
            fertilizer: 10
          }
        });
        await player.save();

        await bot.sendMessage(
          userId,
          `🎮 Chào mừng đến với Nông Trại Vui Vẻ!\n\n` +
          `Bạn nhận được:\n` +
          `💰 100,000 vàng\n` +
          `🌱 5 hạt giống cải bắp\n` +
          `🌿 10 phân bón\n\n` +
          `Hãy bắt đầu trồng cây nào! 🌱`,
          { reply_markup: keyboard.mainKeyboard }
        );
      } else {
        await bot.sendMessage(
          userId,
          '👋 Chào mừng trở lại với Nông Trại Vui Vẻ!',
          { reply_markup: keyboard.mainKeyboard }
        );
      }
    } catch (err) {
      console.error('Start game error:', err);
      await bot.sendMessage(userId, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
    }
  });
};
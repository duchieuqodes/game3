module.exports = (bot) => {
  const Player = require('../models/Player');
  const plantTypes = require('../models/Plant');
  const animalTypes = require('../handlers/animalHandler');

  // Escape special characters for Markdown except percentages
  const escapeMarkdown = (text) => {
    return text.replace(/([\*\_\[\]()~`>#+\-=|{}.!])/g, '\\$&');
  };

  bot.onText(/📊 Kho của tôi/, async (msg) => {
    const userId = msg.from.id;

    try {
      // Fetch player data
      const player = await Player.findOne({ userId });
      if (!player) {
        return bot.sendMessage(userId, '_❌ Không tìm thấy thông tin người chơi!_', { parse_mode: 'Markdown' });
      }

      // Header with first and last name
      const firstName = escapeMarkdown(msg.from.first_name || '');
      const lastName = escapeMarkdown(msg.from.last_name || '');
      const fullName = `${firstName} ${lastName}`.trim() || 'Người chơi ẩn danh';
      const header = `🌟━━━━━━━━━━━━━━━━━━━━━🌟\n` +
                     `🎉 *Tài sản của: ${fullName}* 🎉\n` +
                     `🌟━━━━━━━━━━━━━━━━━━━━━🌟\n`;

      // Gold and land/animal info
      const generalInfo = `💰 *Vàng:* ${escapeMarkdown(player.inventory.gold.toLocaleString())}\n` +
        `🌾 *Ô đất:* ${escapeMarkdown(player.landSlots.toString())}\n` +
        `🏠 *Chuồng trại:* ${escapeMarkdown(player.barns.toString())}\n` +
        `🌟━━━━━━━━━━━━━━━━━━━━━🌟\n`;

      // Animal details
      const animalDetails = player.animals.length > 0
        ? `🐄 *Vật nuôi:*\n` +
          player.animals.map((animal, index) => {
            const status = animal.isSick ? '_Bị bệnh_' : '_Khỏe mạnh_';
            const animalName = animal.type in animalTypes ? animalTypes[animal.type].name : escapeMarkdown(animal.type);
            return `  • *${animalName}*: ${status}, phát triển: ${animal.growthProgress.toFixed(1)}%`;
          }).join('\n')
        : '_Không có vật nuôi._';

      // Plant details (brief)
      const plantDetails = player.plants.length > 0
        ? `🌿 *Cây trồng:*\n` +
          player.plants.map((plant, index) => {
            const plantName = plant.type in plantTypes ? plantTypes[plant.type].name : escapeMarkdown(plant.type);
            return `  • *${plantName}*: ${plant.progress.toFixed(1)}% phát triển`;
          }).join('\n')
        : '_Không có cây trồng._';

      // Combine all parts
      const caption = header + '\n' +
        generalInfo + '\n' +
        animalDetails + '\n\n' +
        plantDetails + '\n\n🌟━━━━━━━━━━━━━━━━━━━━━🌟\n✨ *Tiếp tục chăm chỉ và mở rộng nông trại của bạn!* ✨';

      const imageUrl = 'https://img.upanh.tv/2025/01/17/DALLE-2025-01-17-11.43.01---A-2D-game-interface-for-the-feature-Tai-san-ca-toi-My-Assets-in-a-Vietnamese-farm-game.-The-interface-is-playful-cute-and-uniquely-creative.-Th.png'; // Replace with your image URL

      await bot.sendPhoto(userId, imageUrl, {
        caption,
        parse_mode: 'Markdown',
      });
    } catch (err) {
      console.error('Error fetching player assets:', err);
      await bot.sendMessage(userId, '_❌ Có lỗi xảy ra khi lấy tài sản của bạn!_', { parse_mode: 'Markdown' });
    }
  });
};

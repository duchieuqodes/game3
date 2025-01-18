module.exports = (bot) => {
  const Player = require('../models/Player');

  const animalTypes = {
    chicken: {
      name: '🐔 Gà',
      price: 500,
      growthTime: 3600000, // 1 giờ
      images: {
        0: 'https://img.upanh.tv/2025/01/15/ga1.png',
        20: 'https://img.upanh.tv/2025/01/15/ga2.png',
        40: 'https://img.upanh.tv/2025/01/15/ga3.png',
        60: 'https://img.upanh.tv/2025/01/15/ga4.png',
        80: 'https://img.upanh.tv/2025/01/15/ga5.png',
        100: 'https://img.upanh.tv/2025/01/15/ga6.png',
      },
    },
    cow: {
      name: '🐄 Bò',
      price: 1500,
      growthTime: 10800000, // 3 giờ
      images: {
        0: 'https://img.upanh.tv/2025/01/15/cow1.png',
        20: 'https://img.upanh.tv/2025/01/15/cow2.png',
        40: 'https://img.upanh.tv/2025/01/15/cow3.png',
        60: 'https://img.upanh.tv/2025/01/15/cow4.png',
        80: 'https://img.upanh.tv/2025/01/15/cow5.png',
        100: 'https://img.upanh.tv/2025/01/15/cow6.png',
      },
    },
  };
  
  const createProgressBar = (progress, health) => {
    const filled = '█';
    const empty = '▒';
    const barLength = 10;
    const progressFilled = Math.floor((progress / 100) * barLength);
    const healthFilled = Math.floor((health / 100) * barLength);

    return {
      growth: `${filled.repeat(progressFilled)}${empty.repeat(barLength - progressFilled)}`,
      health: `${filled.repeat(healthFilled)}${empty.repeat(barLength - healthFilled)}`,
    };
  };

  const formatTime = (milliseconds) => {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} giờ ${minutes} phút`;
  };

  bot.onText(/Chăm sóc vật nuôi/, async (msg) => {
    const userId = msg.from.id;
    const player = await Player.findOne({ userId });

    if (!player || player.animals.length === 0) {
      return bot.sendMessage(userId, '❌ Bạn chưa sở hữu vật nuôi nào! Hãy mua tại cửa hàng.');
    }

    for (const [index, animal] of player.animals.entries()) {
      const animalData = animalTypes[animal.type];
      if (!animalData) {
        continue; // Bỏ qua nếu loại vật nuôi không tồn tại
      }

      const growthPercentage = Math.min(100, animal.growthProgress);
      const timeRemaining = Math.max(0, animalData.growthTime - (growthPercentage / 100) * animalData.growthTime);
      const imageUrl = Object.entries(animalData.images).reduce((url, [threshold, img]) => {
        return growthPercentage >= parseInt(threshold) ? img : url;
      }, animalData.images[0]);

      const progressBar = createProgressBar(animal.growthProgress, animal.health);

      let hungerStatus = animal.lastFed && Date.now() - new Date(animal.lastFed) > 7200000 ? 'Đói' : 'No';
      let thirstStatus = animal.lastWatered && Date.now() - new Date(animal.lastWatered) > 7200000 ? 'Khát' : 'Không khát';
      let sickStatus = animal.isSick ? 'Bị bệnh' : 'Khỏe mạnh';

      const actions = [
        [{ text: '🍎 Cho ăn', callback_data: `feed_animal:${index}` }],
        [{ text: '💧 Cho uống nước', callback_data: `water_animal:${index}` }],
        [{ text: '🩺 Chữa bệnh', callback_data: `heal_animal:${index}` }],
      ];
      if (growthPercentage >= 100) {
        actions.push([{ text: '💰 Bán', callback_data: `sell_animal:${index}` }]);
      }

      await bot.sendPhoto(userId, imageUrl, {
        caption: `🐾 ${animalData.name}:
  🌱 Tiến trình phát triển: ${progressBar.growth} ${animal.growthProgress.toFixed(1)}%
  ⏳ Thời gian còn lại: ${formatTime(timeRemaining)}
  ❤️ Sức khỏe: ${progressBar.health} ${animal.health.toFixed(1)}%
  🍎 Tình trạng: ${hungerStatus}
  💧 Nước: ${thirstStatus}
  🩺 Tình trạng: ${sickStatus}`,
        reply_markup: { inline_keyboard: actions },
      });
    }
  });

  bot.on('callback_query', async (query) => {
    const [action, index] = query.data.split(':');
    const userId = query.from.id;

    if (!action.startsWith('feed_animal') &&
        !action.startsWith('water_animal') &&
        !action.startsWith('heal_animal') &&
        !action.startsWith('sell_animal')) {
      // Bỏ qua nếu không phải hành động liên quan đến vật nuôi
      return;
    }

    const player = await Player.findOne({ userId });

    if (!player || !player.animals[index]) {
      return bot.answerCallbackQuery(query.id, '❌ Vật nuôi không tồn tại!');
    }

    const animal = player.animals[index];
    const animalData = animalTypes[animal.type];
    if (!animalData) {
      return bot.answerCallbackQuery(query.id, '❌ Loại vật nuôi không hợp lệ!');
    }

    let message = '';

    switch (action) {
      case 'feed_animal':
        animal.lastFed = new Date();
        animal.health = Math.min(100, animal.health + 20);
        message = '✅ Đã cho vật nuôi ăn!';
        break;
      case 'water_animal':
        animal.lastWatered = new Date();
        animal.health = Math.min(100, animal.health + 15);
        message = '✅ Đã cho vật nuôi uống nước!';
        break;
      case 'heal_animal':
        if (animal.isSick) {
          animal.isSick = false;
          animal.health = Math.min(100, animal.health + 30);
          message = '✅ Vật nuôi đã được chữa bệnh!';
        } else {
          message = '❌ Vật nuôi không bị bệnh!';
        }
        break;
      case 'sell_animal':
        if (animal.growthProgress >= 100) {
          const sellPrice = Math.floor(animalData.price * 2 * (animal.health / 100));
          player.inventory.gold += sellPrice;
          player.animals.splice(index, 1);
          message = `✅ Đã bán vật nuôi với giá ${sellPrice} vàng!`;
        } else {
          message = '❌ Vật nuôi chưa trưởng thành!';
        }
        break;
      default:
        return bot.answerCallbackQuery(query.id, '❌ Hành động không hợp lệ!');
    }

    player.markModified('animals');
    await player.save();
    bot.answerCallbackQuery(query.id, message);
  });



  setInterval(async () => {
    const players = await Player.find({});
    const now = Date.now();

    for (const player of players) {
      for (const animal of player.animals) {
        const timeElapsed = (now - new Date(animal.lastChecked)) / 60000; // Thời gian đã trôi qua (phút)

        // Tăng trưởng
        if (animal.growthProgress < 100) {
          const growthIncrease = (timeElapsed / (animalTypes[animal.type].growthTime / 60000)) * 100;
          animal.growthProgress = Math.min(100, animal.growthProgress + growthIncrease);
        }

        // Đói
        if (animal.lastFed && now - new Date(animal.lastFed) > 3600000 + Math.random() * 3600000) {
          animal.health = Math.max(0, animal.health - timeElapsed * 0.5); // Sức khỏe giảm nếu đói
        }

        // Khát
        if (animal.lastWatered && now - new Date(animal.lastWatered) > 3600000 + Math.random() * 3600000) {
          animal.health = Math.max(0, animal.health - timeElapsed * 0.5); // Sức khỏe giảm nếu khát
        }

        // Bệnh
        if (!animal.isSick && Math.random() < 0.02) {
          animal.isSick = true; // Xác suất bị bệnh
        }

        if (animal.isSick) {
          animal.health = Math.max(0, animal.health - timeElapsed * 0.8); // Sức khỏe giảm nhanh hơn khi bệnh
        }

        // Cập nhật thời gian kiểm tra
        animal.lastChecked = now;
      }

      player.markModified('animals');
      await player.save();
    }
  }, 60000); // Cập nhật mỗi phút

  };


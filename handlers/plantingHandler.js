module.exports = (bot) => {
  const Player = require('../models/Player');
  const plantTypes = require('../models/Plant');

  // Hàm tạo số ngẫu nhiên trong khoảng [min, max]
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  setInterval(async () => {
    const players = await Player.find({});
    const now = new Date();

    for (const player of players) {
      const updatedPlants = player.plants.map((plant) => {
        const timeElapsed = (now - new Date(plant.lastChecked)) / 60000; // Thời gian trôi qua (phút)

        // Trạng thái cây dựa trên nước và sâu bệnh
        const isHealthy = plant.waterLevel >= 70 && plant.pestLevel <= 25;
        const isModerate = (plant.waterLevel >= 50 && plant.waterLevel < 70) || (plant.pestLevel > 25 && plant.pestLevel <= 50);
        const isWeak = plant.waterLevel < 50 || plant.pestLevel > 50;

        // Tăng hoặc giảm sức sống dựa trên trạng thái
        if (isHealthy) {
          plant.vitality = Math.min(100, plant.vitality + timeElapsed * 1.6);
        } else if (isModerate) {
          plant.vitality = Math.min(100, plant.vitality + timeElapsed * 0.8);
        } else if (isWeak) {
          const vitalityDecrease = timeElapsed * 0.5;
          plant.vitality = Math.max(0, plant.vitality - vitalityDecrease);
        }

        // Giảm nước và tăng sâu bệnh theo thời gian
        const waterDecrease = timeElapsed * 0.5;
        plant.waterLevel = Math.max(0, plant.waterLevel - waterDecrease);

        const pestIncrease = randomInt(0.5, 1);
        plant.pestLevel = Math.min(100, plant.pestLevel + pestIncrease);

        // Cập nhật trạng thái thu hoạch nếu tiến trình đạt 100%
        const progress = Math.min(100, (now - new Date(plant.plantedAt)) / plantTypes[plant.type].growthTime * 100);
        plant.progress = progress;

        if (progress >= 100 && plant.status !== 'ready') {
          plant.status = 'ready';
          bot.sendMessage(player.userId, `🌟 Cây ${plantTypes[plant.type].name} đã sẵn sàng để thu hoạch!`);
        }

        plant.lastChecked = now; // Cập nhật thời gian kiểm tra cuối cùng
        return plant;
      });

      await Player.findByIdAndUpdate(player._id, { plants: updatedPlants });
    }
  }, 60000); // Cập nhật mỗi phút


  // Hàm tạo thanh tiến trình hiển thị trạng thái cây trồng
  const createProgressBar = (progress, water, vitality, pestCount, remainingTime) => {
    const filled = '█'; // Biểu tượng phần đã hoàn thành
    const empty = '▒'; // Biểu tượng phần chưa hoàn thành
    const barLength = 10; // Độ dài của thanh tiến trình

    const progressFilled = Math.floor((progress / 100) * barLength); // Số lượng khối đầy theo tiến trình
    const waterFilled = Math.floor((water / 100) * barLength); // Số lượng khối đầy theo mức nước
    const vitalityFilled = Math.floor((vitality / 100) * barLength); // Số lượng khối đầy theo sức sống

    const timeDisplay = remainingTime > 0
      ? `Còn ⏳ ${(remainingTime / 60000).toFixed(1)} phút`
      : '✨ Đã có thể thu hoạch!'; // Hiển thị thời gian còn lại hoặc trạng thái sẵn sàng

    return {
      growth: `${filled.repeat(progressFilled)}${empty.repeat(barLength - progressFilled)}`,
      water: `${filled.repeat(waterFilled)}${empty.repeat(barLength - waterFilled)}`,
      vitality: `${filled.repeat(vitalityFilled)}${empty.repeat(barLength - vitalityFilled)}`,
      pests: `🐛 Sâu bệnh: ${Math.floor(pestCount)}%`,
      time: timeDisplay
    };
  };

  // Xử lý lệnh trồng cây
  bot.onText(/🌱 Trồng cây/, async (msg) => {
    const userId = msg.from.id;
    try {
      const player = await Player.findOne({ userId });
      const availableSeeds = Object.entries(player.inventory.seeds)
        .filter(([_, count]) => count > 0) // Lọc các loại hạt giống có số lượng > 0
        .map(([type, count]) => ({
          text: `${plantTypes[type].name} (${count})`, // Hiển thị tên và số lượng hạt giống
          callback_data: `plant_seed:${type}` // Dữ liệu callback để xử lý khi người chơi chọn
        }));

      if (availableSeeds.length === 0) {
        return bot.sendMessage(userId, '❌ Bạn không có hạt giống nào! Hãy mua thêm tại cửa hàng 🏪');
      }

      await bot.sendMessage(userId, '🌱 Chọn loại hạt giống muốn trồng:', {
        reply_markup: {
          inline_keyboard: availableSeeds.map(seed => [seed]) // Hiển thị các lựa chọn hạt giống
        }
      });
    } catch (err) {
      console.error('Plant seed error:', err);
      await bot.sendMessage(userId, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
    }
  });

  // Hiển thị trạng thái của các cây trồng
  bot.onText(/Chăm sóc cây trồng/, async (msg) => {
    const userId = msg.from.id;
    try {
       // Cập nhật trạng thái cây trước khi hiển thị
      const player = await Player.findOne({ userId });

      if (player.plants.length === 0) {
        return bot.sendMessage(userId, '❌ Bạn chưa trồng cây nào!');
      }

      for (const [index, plant] of player.plants.entries()) {
        const now = new Date();
        const timeRemaining = Math.max(0, plantTypes[plant.type].growthTime - (now - plant.plantedAt));
        const progressBar = createProgressBar(
          plant.progress,
          plant.waterLevel,
          plant.vitality,
          plant.pestLevel,
          timeRemaining
        );

        const imageUrls = plantTypes[plant.type].images; // Lấy danh sách hình ảnh tương ứng với tiến trình
        let currentImage = imageUrls[0];
        for (const [threshold, url] of Object.entries(imageUrls)) {
          if (plant.progress >= parseInt(threshold)) {
            currentImage = url; // Chọn hình ảnh phù hợp nhất với tiến trình hiện tại
          }
        }

        await bot.sendPhoto(userId, currentImage, {
          caption: `🌿 Cây ${index + 1} (${plantTypes[plant.type].name}):\n` +
            `🌱 Phát triển: ${progressBar.growth} ${plant.progress.toFixed(1)}%\n` +
            `💧 Nước: ${progressBar.water} ${plant.waterLevel.toFixed(1)}%\n` +
            `✨ Sức sống: ${progressBar.vitality} ${plant.vitality.toFixed(1)}%\n` +
            `${progressBar.pests}\n${progressBar.time}`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💧 Tưới nước', callback_data: `action:water:${index}` },
                { text: '✨ Bón phân', callback_data: `action:fertilize:${index}` },
                { text: '🐛 Diệt sâu', callback_data: `action:pesticide:${index}` }
              ],
              ...(plant.status === 'ready' ? [[{ text: '🌿 Thu hoạch', callback_data: `harvest:${index}` }]] : [])
            ]
          }
        });
      }
    } catch (err) {
      console.error('Show plant status error:', err);
      await bot.sendMessage(userId, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
    }
  });

  // Xử lý các hành động tương tác với cây trồng
  bot.on('callback_query', async (query) => {
    const userId = query.from.id;
    const data = query.data;

    if (data.startsWith('plant_seed:')) {
        const seedType = data.split(':')[1];
        const player = await Player.findOne({ userId });

        if (player.plants.length >= player.landSlots) {
            return bot.answerCallbackQuery(query.id, { text: '❌ Bạn đã sử dụng hết số ô đất! Hãy mua thêm tại cửa hàng.' });

        }

        if (player.inventory.seeds[seedType] <= 0) {
            return bot.answerCallbackQuery(query.id, { text:'❌ Bạn không có đủ hạt giống!'});
        }

        player.inventory.seeds[seedType]--;
        player.plants.push({
            type: seedType,
            status: 'growing',
            progress: 0,
            waterLevel: 100,
            vitality: 100,
            pestLevel: 0,
            plantedAt: new Date(),
            lastChecked: new Date()
        });

        await player.save();
        bot.answerCallbackQuery(query.id, { text: '✅ Gieo hạt thành công!'});
    } else if (data.startsWith('action:')) {
      const [action, plantIndex] = data.split(':').slice(1);
      const player = await Player.findOne({ userId });
      const plant = player.plants[plantIndex];

      if (!plant) {
        return bot.answerCallbackQuery(query.id, '❌ Cây không tồn tại!');
      }

      let message = '';
      // Xử lý các hành động cụ thể
      switch (action) {
        case 'water':
          if (plant.waterLevel < 100) {
            plant.waterLevel = Math.min(100, plant.waterLevel + 20); // Tưới nước, tối đa 100%
            message = '💧 Cây đã được tưới nước!';
          } else {
            return bot.answerCallbackQuery(query.id, { text:'❌ Cây đã đủ nước!'});
          }
          break;
        case 'fertilize':
          player.inventory.fertilizer = player.inventory.fertilizer || 0;
          if (player.inventory.fertilizer > 0) {
            plant.vitality = Math.min(100, plant.vitality + 10); // Bón phân, tăng sức sống
            player.inventory.fertilizer--;
            message = '✨ Cây đã được bón phân!';
          } else {
            return bot.answerCallbackQuery(query.id, { text:'❌ Không còn phân bón!'});
          }
          break;
        case 'pesticide':
          player.inventory.pesticide = player.inventory.pesticide || 0;
          if (player.inventory.pesticide > 0 && plant.pestLevel > 0) {
            plant.pestLevel = Math.max(0, plant.pestLevel - 5); // Diệt sâu bệnh, giảm mức sâu bệnh
            player.inventory.pesticide--;
            message = '🐛 Sâu bệnh đã được xử lý!';
          } else {
            return bot.answerCallbackQuery(query.id, { text:'❌ Không có sâu bệnh để xử lý hoặc hết thuốc!'});
          }
          break;
        default:
          return bot.answerCallbackQuery(query.id, '❌ Hành động không hợp lệ!');
      }

      player.markModified('plants');
      await player.save();

      // Cập nhật trạng thái cây ngay lập tức
      const now = new Date();
      const timeRemaining = Math.max(0, plantTypes[plant.type].growthTime - (now - plant.plantedAt));
      const progressBar = createProgressBar(
        plant.progress,
        plant.waterLevel,
        plant.vitality,
        plant.pestLevel,
        timeRemaining
      );

      const imageUrls = plantTypes[plant.type].images;
      let currentImage = imageUrls[0];
      for (const [threshold, url] of Object.entries(imageUrls)) {
        if (plant.progress >= parseInt(threshold)) {
          currentImage = url;
        }
      }

      const newCaption = `🌿 Cây ${parseInt(plantIndex) + 1} (${plantTypes[plant.type].name}):\n` +
        `🌱 Phát triển: ${progressBar.growth} ${plant.progress.toFixed(1)}%\n` +
        `💧 Nước: ${progressBar.water} ${plant.waterLevel.toFixed(1)}%\n` +
        `✨ Sức sống: ${progressBar.vitality} ${plant.vitality.toFixed(1)}%\n` +
        `${progressBar.pests}\n${progressBar.time}`;

      bot.editMessageMedia(
        {
          type: 'photo',
          media: currentImage,
          caption: newCaption
        },
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        }
      ).catch((err) => {
        if (err.response && err.response.body && err.response.body.description.includes('message is not modified')) {
          console.log('Message content is identical; no update made.');
        } else {
          console.error('Error updating message:', err);
        }
      });

      bot.editMessageReplyMarkup(
        {
          inline_keyboard: [
            [
              { text: '💧 Tưới nước', callback_data: `action:water:${plantIndex}` },
              { text: '✨ Bón phân', callback_data: `action:fertilize:${plantIndex}` },
              { text: '🐛 Diệt sâu', callback_data: `action:pesticide:${plantIndex}` }
            ],
            ...(plant.status === 'ready' ? [[{ text: '🌿 Thu hoạch', callback_data: `harvest:${plantIndex}` }]] : [])
          ]
        },
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        }
      ).catch((err) => {
        if (err.response && err.response.body && err.response.body.description.includes('message is not modified')) {
          console.log('Reply markup is identical; no update made.');
        } else {
          console.error('Error updating reply markup:', err);
        }
      });

      bot.answerCallbackQuery(query.id, `✅ ${message}`);
    } else if (data.startsWith('harvest:')) {
      const plantIndex = parseInt(data.split(':')[1]);
      const player = await Player.findOne({ userId });
      const plant = player.plants[plantIndex];

      if (!plant) {
        return bot.answerCallbackQuery(query.id, '❌ Cây không tồn tại hoặc đã được thu hoạch!');
      }

      if (plant.status !== 'ready') {
        return bot.answerCallbackQuery(query.id, '❌ Cây chưa sẵn sàng để thu hoạch!');
      }

      const vitalityFactor = (plant.vitality || 0) / 100; // Hệ số dựa trên sức sống
      const reward = Math.floor(plantTypes[plant.type].sellPrice * vitalityFactor); // Tính phần thưởng thu hoạch
      player.inventory.gold += reward; // Cộng vàng vào kho người chơi
      player.plants.splice(plantIndex, 1); // Xóa cây khỏi danh sách
      await player.save();

      bot.answerCallbackQuery(query.id, `✅ Thu hoạch thành công! Bạn nhận được ${reward} vàng.`);
      bot.deleteMessage(query.message.chat.id, query.message.message_id); // Xóa tin nhắn liên quan đến cây
    }
  });

  bot.onText(/\/📊 Kho của tôi/, async (msg) => {
    const userId = msg.from.id;
    try {
      const player = await Player.findOne({ userId });

      if (!player) {
        return bot.sendMessage(userId, '_❌ Không tìm thấy thông tin người chơi!_', { parse_mode: 'Markdown' });
      }

      // Chuẩn bị dữ liệu hiển thị
      const { inventory, plants, animals, barns, landSlots } = player;
      const plantDescriptions = plants.map((plant, index) => {
        return `*Cây ${index + 1}*: Loại: _${plant.type}_ | Trạng thái: _${plant.status}_ | Phát triển: _${plant.progress.toFixed(1)}%_ | Sức sống: _${plant.vitality.toFixed(1)}%_`;
      }).join('\n');

      const animalDescriptions = animals.map((animal, index) => {
        return `*Vật nuôi ${index + 1}*: Loại: _${animal.type}_ | Trạng thái: _${animal.status}_ | Phát triển: _${animal.growthProgress.toFixed(1)}%_ | Sức khỏe: _${animal.health.toFixed(1)}%_`;
      }).join('\n');

      const inventoryDescription = `\n*Vật phẩm trong kho*: \n💰 *Vàng*: _${inventory.gold}_\n🌱 *Hạt giống*: ${Object.entries(inventory.seeds).map(([type, count]) => `_${type}_: ${count}`).join(', ')}\n✨ *Phân bón*: _${inventory.fertilizer}_\n🐛 *Thuốc trừ sâu*: _${inventory.pesticide}_\n🍗 *Thức ăn vật nuôi*: _${inventory.animalFood}_\n💊 *Thuốc*: _${inventory.medicine}_`;

      const extraInfo = `\n\n*Thông tin khác*: \n🌾 *Ô đất*: _${landSlots}_\n🏠 *Chuồng trại*: _${barns}_`;

      const fullDescription = `*🎒 Tài sản của bạn:*\n\n${plantDescriptions || '_Không có cây nào được trồng._'}\n\n${animalDescriptions || '_Không có vật nuôi nào._'}${inventoryDescription}${extraInfo}`;

      // Gửi ảnh minh họa kèm thông tin tài sản
      const assetImageUrl = 'https://img.upanh.tv/2025/01/17/DALLE-2025-01-17-11.43.01---A-2D-game-interface-for-the-feature-Tai-san-ca-toi-My-Assets-in-a-Vietnamese-farm-game.-The-interface-is-playful-cute-and-uniquely-creative.-Th.png'; // Thay thế bằng URL hình ảnh của bạn
      await bot.sendPhoto(userId, assetImageUrl, {
        caption: fullDescription,
        parse_mode: 'Markdown',
      });
    } catch (err) {
      console.error('Error displaying assets:', err);
      bot.sendMessage(userId, '_❌ Có lỗi xảy ra khi hiển thị tài sản. Vui lòng thử lại sau._', { parse_mode: 'Markdown' });
    }
  });
};

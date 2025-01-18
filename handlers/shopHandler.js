module.exports = (bot) => {
  const Player = require('../models/Player');
  const plantTypes = require('../models/Plant');

  const animalTypes = {
    chicken: {
      name: '🐔 Gà',
      price: 500,
    },
    cow: {
      name: '🐄 Bò',
      price: 1500,
    },
  };

  bot.onText(/🏪 Cửa hàng/, async (msg) => {
    const userId = msg.from.id;
    try {
      const shopItems = [
        ...Object.entries(plantTypes).map(([type, plant]) => ({
          text: `${plant.name} - 💰${plant.price}`,
          callback_data: `buy_seed:${type}`
        })),
        { text: '🌿 Phân bón - 💰80', callback_data: 'buy:fertilizer' },
        { text: '🧪 Thuốc diệt sâu - 💰20', callback_data: 'buy:pesticide' },
        { text: '🪧 Mua ô đất - 💰Thay đổi', callback_data: 'buy:land_slot' },
        { text: '🏠 Mua chuồng trại', callback_data: 'buy:barn' },
        { text: '🍎 Thức ăn vật nuôi - 💰50', callback_data: 'buy:animal_food' },
        { text: '🩺 Thuốc chữa bệnh - 💰50', callback_data: 'buy:medicine' },
        ...Object.entries(animalTypes).map(([type, animal]) => ({
          text: `${animal.name} - 💰${animal.price}`,
          callback_data: `buy_animal:${type}`
        }))
      ];

      await bot.sendMessage(
        userId,
        '🏪 Chào mừng đến với cửa hàng!\nChọn vật phẩm bạn muốn mua:',
        {
          reply_markup: {
            inline_keyboard: shopItems.map(item => [item])
          }
        }
      );
    } catch (err) {
      console.error('Shop error:', err);
      await bot.sendMessage(userId, '❌ Có lỗi xảy ra, vui lòng thử lại sau.');
    }
  });

  // Handle buy callbacks
  bot.on('callback_query', async (callbackQuery) => {
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (!data.startsWith('buy')) return;

    try {
      const player = await Player.findOne({ userId });

      if (data.startsWith('buy_seed:')) {
        const seedType = data.split(':')[1];
        const plant = plantTypes[seedType];

        if (player.inventory.gold < plant.price) {
          return bot.answerCallbackQuery(callbackQuery.id, '❌ Không đủ vàng!');
        }

        player.inventory.gold -= plant.price;
        player.inventory.seeds[seedType] = (player.inventory.seeds[seedType] || 0) + 1;
        await player.save();

        await bot.answerCallbackQuery(
          callbackQuery.id,
          `✅ Đã mua 1 hạt giống ${plant.name}!`
        );
      } else if (data.startsWith('buy_animal:')) {
        const animalType = data.split(':')[1];
        const animal = animalTypes[animalType];

        if (player.inventory.gold < animal.price) {
          return bot.answerCallbackQuery(callbackQuery.id, '❌ Không đủ vàng!');
        }

        player.inventory.gold -= animal.price;
        player.animals.push({
          type: animalType,
          status: 'baby',
          growthProgress: 0,
          health: 100,
          lastChecked: new Date(),
        });

        await player.save();

        await bot.answerCallbackQuery(
          callbackQuery.id,
          `✅ Đã mua 1 ${animal.name}!`
        );
      } else if (data === 'buy:fertilizer') {
        const fertilizerPrice = 80;

        if (player.inventory.gold < fertilizerPrice) {
          return bot.answerCallbackQuery(callbackQuery.id, '❌ Không đủ vàng!');
        }

        player.inventory.gold -= fertilizerPrice;
        player.inventory.fertilizer = (player.inventory.fertilizer || 0) + 1;
        await player.save();

        await bot.answerCallbackQuery(
          callbackQuery.id,
          '✅ Đã mua 1 phân bón!'
        );
      } else if (data === 'buy:pesticide') {
        const pesticidePrice = 20;

        if (player.inventory.gold < pesticidePrice) {
          return bot.answerCallbackQuery(callbackQuery.id, '❌ Không đủ vàng!');
        }

        player.inventory.gold -= pesticidePrice;
        player.inventory.pesticide = (player.inventory.pesticide || 0) + 1;
        await player.save();

        await bot.answerCallbackQuery(
          callbackQuery.id,
          '✅ Đã mua 1 thuốc diệt sâu!'
        );
      } else if (data === 'buy:land_slot') {
        const currentSlots = player.landSlots;
        const landSlotPrice = 10000 * Math.pow(2, currentSlots - 2);

        if (player.inventory.gold < landSlotPrice) {
          return bot.answerCallbackQuery(callbackQuery.id, `❌ Không đủ vàng! Giá: ${landSlotPrice}`);
        }

        player.inventory.gold -= landSlotPrice;
        player.landSlots += 1;
        await player.save();

        await bot.answerCallbackQuery(callbackQuery.id, `✅ Bạn đã mua thêm 1 ô đất! Số ô đất hiện tại: ${player.landSlots}`);
      }
    } catch (err) {
      console.error('Buy error:', err);
      await bot.answerCallbackQuery(callbackQuery.id, '❌ Có lỗi xảy ra, vui lòng thử lại.');
    }
  });

  bot.on('callback_query', async (query) => {
      const userId = query.from.id;
      const data = query.data;

      try {
        const player = await Player.findOne({ userId });
        if (!player) {
          return bot.answerCallbackQuery(query.id, '❌ Người chơi không tồn tại!');
        }

        if (data === 'buy:barn') {
          const currentBarns = player.inventory.barns || 2; // Bắt đầu với 2 chuồng
          const maxBarns = 10;
          if (currentBarns >= maxBarns) {
            return bot.answerCallbackQuery(
              query.id,
              '❌ Bạn đã đạt tối đa 10 chuồng trại!'
            );
          }

          const barnPrice = 10000 * Math.pow(2, currentBarns - 2); // Tăng giá gấp đôi mỗi lần
          if (player.inventory.gold < barnPrice) {
            return bot.answerCallbackQuery(
              query.id,
              `❌ Không đủ vàng! Giá: ${barnPrice}`
            );
          }

          player.inventory.gold -= barnPrice;
          player.inventory.barns = currentBarns + 1;
          await player.save();
          return bot.answerCallbackQuery(
            query.id,
            `✅ Đã mua thêm 1 chuồng trại! Số chuồng hiện tại: ${player.inventory.barns}`
          );
        } else if (data === 'buy:animal_food') {
          const foodPrice = 50;
          if (player.inventory.gold < foodPrice) {
            return bot.answerCallbackQuery(query.id, '❌ Không đủ vàng!');
          }
          player.inventory.gold -= foodPrice;
          player.inventory.animalFood = (player.inventory.animalFood || 0) + 1;
          await player.save();
          return bot.answerCallbackQuery(query.id, '✅ Đã mua thức ăn vật nuôi!');
        } else if (data === 'buy:medicine') {
          const medicinePrice = 50;
          if (player.inventory.gold < medicinePrice) {
            return bot.answerCallbackQuery(query.id, '❌ Không đủ vàng!');
          }
          player.inventory.gold -= medicinePrice;
          player.inventory.medicine = (player.inventory.medicine || 0) + 1;
          await player.save();
          return bot.answerCallbackQuery(query.id, '✅ Đã mua thuốc chữa bệnh!');
        } else if (data.startsWith('buy_animal:')) {
          const animalType = data.split(':')[1];
          const animalData = animalTypes[animalType];
          const currentBarns = player.inventory.barns || 2;
          const currentAnimals = player.animals.length;

          if (currentAnimals >= currentBarns) {
            return bot.answerCallbackQuery(
              query.id,
              '❌ Bạn đã sử dụng hết chuồng trại! Hãy mua thêm chuồng.'
            );
          }

          if (player.inventory.gold < animalData.price) {
            return bot.answerCallbackQuery(query.id, '❌ Không đủ vàng!');
          }

          player.inventory.gold -= animalData.price;
          player.animals.push({
            type: animalType,
            status: 'baby',
            growthProgress: 0,
            health: 100,
            lastFed: new Date(),
            lastWatered: new Date(),
            isSick: false,
            lastChecked: new Date(),
          });
          await player.save();
          return bot.answerCallbackQuery(
            query.id,
            `✅ Đã mua 1 ${animalData.name}!`
          );
        }
      } catch (err) {
        console.error('Buy error:', err);
        await bot.answerCallbackQuery(query.id, '❌ Có lỗi xảy ra, vui lòng thử lại.');
      }
    });
  };


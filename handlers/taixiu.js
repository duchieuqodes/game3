module.exports = (bot) => {
  // Import necessary modules
  const mongoose = require('mongoose');

  // TaiXiu Schema
  // Sửa TaiXiu Schema - Thêm default cho userId
  const TaiXiuSchema = new mongoose.Schema({
    userId: { 
      type: Number, 
      required: true,
      default: function() {
        return this.parent().userId; // Lấy userId từ document cha
      }
    },
    totalBets: { type: Number, default: 0 },
    wins: { type: Number, default: 0 }, 
    losses: { type: Number, default: 0 },
    totalWagered: { type: Number, default: 0 },
  });


  const Player = require('../models/Player');
  Player.schema.add({ taiXiu: TaiXiuSchema });

  // Initialize TaiXiu stats for player
  const initializeTaiXiu = async (player) => {
    try {
      if (!player.taiXiu) {
        player.taiXiu = {
          userId: player.userId,
          totalBets: 0,
          wins: 0,
          losses: 0,
          totalWagered: 0
        };

        // Đảm bảo save thành công
        await player.save();
    
      }
    } catch (error) {
      console.error('Lỗi khởi tạo TaiXiu:', error);
    }
  };

  // Player tracking with Map
  const globalPlayers = new Map(); // Store player info as Map(userId => {chatId, messageId})

  // Game state
  let gameState = {
    bets: [],
    timeLeft: 30,
    isRunning: false
  };

  // Main game logic
  const startGame = async () => {
    gameState.isRunning = true;
    gameState.timeLeft = 30;

    const countdownInterval = setInterval(async () => {
      gameState.timeLeft -= 10;

      if (gameState.timeLeft <= 0) {
        clearInterval(countdownInterval);
        await rollDiceAndResolveBets();
        gameState.isRunning = false;

        setTimeout(async () => {
          await prepareNewGame();
          startGame();
        }, 10000);
      } else {
        // Update messages for all active players
        for (const bet of gameState.bets) {
          if (!bet.chatId || !bet.messageId) continue;

          const currentBet = gameState.bets.find((b) => b.userId === bet.userId);
          const extraInfo = currentBet.type
            ? `\n- 🎯 *Loại cược:* ${currentBet.type}\n- 💵 *Mức cược:* ${currentBet.amount.toLocaleString()} vàng`
            : '';

          const caption = `*🎲 Trò chơi Tài Xỉu đang diễn ra!*\n\n⏳ *Thời gian còn lại:* ${gameState.timeLeft} giây${extraInfo}`;

          const options = [
            [
              { text: 'Tài', callback_data: 'bet:Tai' },
              { text: 'Xỉu', callback_data: 'bet:Xiu' },
            ],
            [
              { text: 'Cược 1000', callback_data: 'betAmount:1000' },
              { text: 'Cược 5000', callback_data: 'betAmount:5000' },
            ],
            [
              { text: 'Cược 10000', callback_data: 'betAmount:10000' },
            ],
          ];

          try {
            await bot.editMessageCaption(caption, {
              chat_id: bet.chatId,
              message_id: bet.messageId,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: options },
            });
          } catch (error) {
            console.log(`Không thể cập nhật tin nhắn cho người chơi ${bet.userId}`);
          }
        }
      }
    }, 10000);
  };

  const prepareNewGame = async () => {
    const caption = `*🎲 Trò chơi Tài Xỉu đã bắt đầu!*\n\n⏳ *Thời gian cược còn lại:* 30 giây\n_Hãy đặt cược vào "Tài" hoặc "Xỉu" để thử vận may!_`;
    const initialImageUrl = 'https://img.upanh.tv/2025/01/17/chocuoc.png';

    gameState.bets = []; // Reset bets

    for (const [userId, playerInfo] of globalPlayers) {
      try {
        const player = await Player.findOne({ userId });
        if (!player) {
          console.warn(`Không tìm thấy người chơi: ${userId}`);
          continue;
        }

        const chatId = playerInfo.chatId;
        const options = [
          [
            { text: 'Tài', callback_data: 'bet:Tai' },
            { text: 'Xỉu', callback_data: 'bet:Xiu' },
          ],
          [
            { text: 'Cược 1000', callback_data: 'betAmount:1000' },
            { text: 'Cược 5000', callback_data: 'betAmount:5000' },
          ],
          [
            { text: 'Cược 10000', callback_data: 'betAmount:10000' },
          ],
        ];

        try {
          // Try to edit existing message
          await bot.editMessageMedia(
            {
              type: 'photo',
              media: initialImageUrl,
              caption: caption,
              parse_mode: 'Markdown',
            },
            {
              chat_id: chatId,
              message_id: playerInfo.messageId,
              reply_markup: { inline_keyboard: options },
            }
          );

          gameState.bets.push({
            userId,
            chatId,
            messageId: playerInfo.messageId,
            type: null,
            amount: 0,
          });
        } catch (error) {
          // If edit fails, send new message
          const sentMessage = await bot.sendPhoto(chatId, initialImageUrl, {
            caption: caption,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: options },
          });

          globalPlayers.set(userId, { ...playerInfo, messageId: sentMessage.message_id });

          gameState.bets.push({
            userId,
            chatId,
            messageId: sentMessage.message_id,
            type: null,
            amount: 0,
          });
        }
      } catch (error) {
        console.error(`Lỗi khi tạo game mới cho người chơi ${userId}:`, error.message);
      }
    }
  };

  const rollDiceAndResolveBets = async () => {
    const diceRolls = [
      Math.ceil(Math.random() * 6),
      Math.ceil(Math.random() * 6),
      Math.ceil(Math.random() * 6),
    ];
    const total = diceRolls.reduce((a, b) => a + b, 0);
    const isTriple = diceRolls[0] === diceRolls[1] && diceRolls[1] === diceRolls[2];
    const result = isTriple ? 'Triple' : total >= 11 ? 'Tai' : 'Xiu';

    let resultImageUrl = result === 'Tai'
      ? 'https://img.upanh.tv/2025/01/17/tai.png'
      : result === 'Xiu'
      ? 'https://img.upanh.tv/2025/01/17/xiu.png'
      : 'https://img.upanh.tv/2025/01/17/chocuoc.png';

    const resultCaption = `*🎲 Kết quả:* 🎲🎲🎲 ${diceRolls.join(' + ')} = ${total}\n\n*Kết quả:* ${isTriple ? 'Bộ Ba (Nhà cái thắng)' : result}`;

    for (const bet of gameState.bets) {
      try {
        const player = await Player.findOne({ userId: bet.userId });
        if (!player) continue;
        await initializeTaiXiu(player);

        let message;
        if (bet.type) {
          if (result === bet.type) {
            const winnings = bet.amount + Math.floor(bet.amount * 0.95);
            player.inventory.gold += winnings;
            player.taiXiu.wins += 1;
            message = `🎉 *Chúc mừng!* Bạn đã thắng cược và nhận được ${winnings.toLocaleString()} vàng! 🏆`;
          } else {
            player.taiXiu.losses += 1;
            message = `❌ *Rất tiếc!* Bạn đã thua cược. Bạn bị trừ ${bet.amount.toLocaleString()} vàng.`;
          }

          player.taiXiu.totalBets += 1;
          player.taiXiu.totalWagered += bet.amount;
          await player.save();
        } else {
          message = `❗ Ván này bạn chưa cược. Hãy tham gia ván tiếp theo!`;
        }

        const nextGameCaption = `${resultCaption}\n\n${message}\n\n💬 *Ván mới sẽ bắt đầu sau 10 giây!*`;

        await bot.editMessageMedia(
          {
            type: 'photo',
            media: resultImageUrl,
            caption: nextGameCaption,
            parse_mode: 'Markdown',
          },
          {
            chat_id: bet.chatId,
            message_id: bet.messageId,
          }
        ).catch(() => {});
      } catch (error) {
        console.error(`Lỗi khi xử lý kết quả cho người chơi ${bet.userId}:`, error.message);
      }
    }
  };

  // Command handler
  bot.onText(/tài xỉu/i, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    // Kiểm tra và tạo Player nếu chưa có
    let player = await Player.findOne({ userId });
    if (!player) {
      player = new Player({ userId });
      await player.save();
    }
     await initializeTaiXiu(player);

    // Add player to global tracking
    globalPlayers.set(userId, { chatId, messageId: null });

    const initialCaption = `*🎲 Trò chơi Tài Xỉu đang diễn ra!*\n\n⏳ *Thời gian còn lại:* 30 giây\n_Hãy đặt cược vào "Tài" (11 - 17 điểm) hoặc "Xỉu" (4 - 10 điểm)._`;
    const initialImageUrl = 'https://img.upanh.tv/2025/01/17/chocuoc.png';

    const options = [
      [
        { text: 'Tài', callback_data: 'bet:Tai' },
        { text: 'Xỉu', callback_data: 'bet:Xiu' },
      ],
      [
        { text: 'Cược 1000', callback_data: 'betAmount:1000' },
        { text: 'Cược 5000', callback_data: 'betAmount:5000' },
      ],
      [
        { text: 'Cược 10000', callback_data: 'betAmount:10000' },
      ],
    ];

    try {
      const sentMessage = await bot.sendPhoto(chatId, initialImageUrl, {
        caption: initialCaption,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: options },
      });

      globalPlayers.set(userId, { chatId, messageId: sentMessage.message_id });

      gameState.bets.push({
        userId,
        chatId,
        messageId: sentMessage.message_id,
        type: null,
        amount: 0,
      });
    } catch (error) {
      console.error(`Lỗi khi tạo game mới:`, error.message);
    }
  });

  // Callback query handler
  bot.on('callback_query', async (query) => {
    const userId = query.from.id;
    const data = query.data;

    try {
      const player = await Player.findOne({ userId });
      if (!player) return;
      await initializeTaiXiu(player);

      const currentBet = gameState.bets.find((bet) => bet.userId === userId);
      if (!currentBet) return;

      if (data.startsWith('bet:')) {
        currentBet.type = data.split(':')[1];
        await bot.answerCallbackQuery(query.id, { 
          text: `🎲 Bạn đã chọn cược vào ${currentBet.type}!`,
          show_alert: true
        });
      }

      if (data.startsWith('betAmount:')) {
        const amount = parseInt(data.split(':')[1]);
        if (player.inventory.gold < amount) {
          await bot.answerCallbackQuery(query.id, { 
            text: '❌ Bạn không đủ vàng để đặt cược!',
            show_alert: true
          });
          return;
        }

        currentBet.amount = amount;
        player.inventory.gold -= amount;
        player.markModified('inventory');
        await player.save();

        await bot.answerCallbackQuery(query.id, {
          text: `💰 Bạn đã đặt cược ${amount.toLocaleString()} vàng!`,
          show_alert: true
        });

        const caption = `*🎲 Đặt cược thành công!*\n\n- 🎯 *Loại cược:* ${currentBet.type}\n- 💵 *Mức cược:* ${amount.toLocaleString()} vàng\n\n_Chờ kết quả..._`;

        await bot.editMessageCaption(caption, {
          chat_id: currentBet.chatId,
          message_id: currentBet.messageId,
          parse_mode: 'Markdown',
        }).catch(() => {});
      }
    } catch (error) {
      console.error(`Lỗi khi xử lý callback query:`, error.message);
    }
  });

  // Start the game loop
  if (!gameState.isRunning) {
    startGame();
  }
};

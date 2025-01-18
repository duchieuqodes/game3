const mongoose = require('mongoose');

const PlantSchema = new mongoose.Schema({
  type: { type: String, required: true },
  status: { type: String, required: true },
  progress: { type: Number, required: true, default: 0 },
  waterLevel: { type: Number, required: true, default: 50 },
  fertilizeLevel: { type: Number, required: true, default: 0 },
  pestLevel: { type: Number, required: true, default: 0 },
  vitality: { type: Number, required: true, default: 100 },
  plantedAt: { type: Date, required: true },
  lastChecked: { type: Date, required: true }
});

const AnimalSchema = new mongoose.Schema({
  type: { type: String, required: true }, // Loại vật nuôi (gà, bò,...)
  status: { type: String, default: 'baby' }, // Trạng thái phát triển
  growthProgress: { type: Number, default: 0 }, // Phần trăm phát triển
  health: { type: Number, default: 100 }, // Sức khỏe của vật nuôi
  lastFed: { type: Date, default: null }, // Thời điểm cho ăn lần cuối
  lastWatered: { type: Date, default: null }, // Thời điểm cho uống nước lần cuối
  isSick: { type: Boolean, default: false }, // Trạng thái có bị bệnh không
  lastChecked: { type: Date, default: Date.now }, // Thời điểm cập nhật lần cuối
});

const PlayerSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  username: String,
  inventory: {
    gold: { type: Number, default: 100000 },
    seeds: {
      cabbage: { type: Number, default: 5 },
      dragon_fruit: { type: Number, default: 0 },
      nho: { type: Number, default: 0 },
      lua: { type: Number, default: 0 }
    },
    fertilizer: { type: Number, default: 10 },
    pesticide: { type: Number, default: 0 }
  },
  barns: { type: Number, default: 2 }, // Số chuồng trại hiện có
    animalFood: { type: Number, default: 0 }, // Thức ăn vật nuôi
    medicine: { type: Number, default: 0 }, // Thuốc chữa bệnh
  landSlots: { type: Number, default: 2 }, // Số ô đất hiện có
  animals: [AnimalSchema],
  plants: [PlantSchema]
});

module.exports = mongoose.model('Player', PlayerSchema);
const mainKeyboard = {
  keyboard: [
    ['🌱 Trồng cây', 'Chăm sóc cây trồng'],
    ['Chăm sóc vật nuôi', 'Tài xỉu'],
    ['🏪 Cửa hàng', '📊 Kho của tôi']
  ],
  resize_keyboard: true
};

const createPlantButtons = (plants) => {
  return {
    inline_keyboard: plants.map(plant => [{
      text: plant.name,
      callback_data: `plant:${plant.id}`
    }])
  };
};

// ... more keyboard configurations

module.exports = {
  mainKeyboard,
  createPlantButtons
};
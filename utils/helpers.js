const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const calculateGrowthTime = (plantType) => {
  const times = {
      cabbage: 3 * 60 * 60 * 1000, // 3 giờ
      dragon_fruit: 8 * 60 * 60 * 1000 // 8 giờ
  };
  return times[plantType] || 3 * 60 * 60 * 1000;
};

const getPlantInfo = (type) => {
  const plants = {
      cabbage: {
          name: "Cải bắp",
          emoji: "🥬",
          basePrice: 500,
          sellPrice: 1000,
          growthTime: 3 * 60 * 60 * 1000,
          waterNeeded: 3,
          fertilizerNeeded: 1
      },
      dragon_fruit: {
          name: "Thanh long",
          emoji: "🐉",
          basePrice: 1000,
          sellPrice: 2500,
          growthTime: 8 * 60 * 60 * 1000,
          waterNeeded: 5,
          fertilizerNeeded: 2
      }
  };
  return plants[type];
};

const createProgressBar = (current, max, length = 10) => {
  const percentage = (current / max) * length;
  const filled = '▓'.repeat(Math.floor(percentage));
  const empty = '░'.repeat(length - Math.floor(percentage));
  return filled + empty;
};

const getTimeLeft = (targetDate) => {
  const now = new Date();
  const diff = targetDate - now;

  if (diff <= 0) return "Đã sẵn sàng!";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
};

module.exports = {
  formatNumber,
  calculateGrowthTime,
  getPlantInfo,
  createProgressBar,
  getTimeLeft
};
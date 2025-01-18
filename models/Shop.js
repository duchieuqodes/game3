const mongoose = require('mongoose');

const shopItemSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['seed', 'tool', 'fertilizer', 'pesticide', 'water']
    },
    name: {
        type: String,
        required: true
    },
    code: {
        type: String,
        required: true,
        unique: true
    },
    price: {
        type: Number,
        required: true
    },
    description: String,
    emoji: String,
    available: {
        type: Boolean,
        default: true
    },
    discount: {
        active: { type: Boolean, default: false },
        percentage: { type: Number, default: 0 },
        endDate: Date
    },
    stockLimit: {
        type: Number,
        default: -1 // -1 means unlimited
    },
    currentStock: {
        type: Number,
        default: -1
    }
});

// Virtual for discounted price
shopItemSchema.virtual('currentPrice').get(function() {
    if (this.discount.active) {
        return Math.floor(this.price * (1 - this.discount.percentage / 100));
    }
    return this.price;
});

// Method to check if item is in stock
shopItemSchema.methods.isInStock = function() {
    return this.stockLimit === -1 || this.currentStock > 0;
};

// Method to decrease stock
shopItemSchema.methods.decreaseStock = async function(quantity) {
    if (this.stockLimit !== -1) {
        this.currentStock = Math.max(0, this.currentStock - quantity);
        await this.save();
    }
};

const Shop = mongoose.model('Shop', shopItemSchema);

// Initialize default shop items
const initializeShop = async () => {
    const defaultItems = [
        {
            type: 'seed',
            name: 'Hạt giống cải bắp',
            code: 'cabbage_seed',
            price: 500,
            emoji: '🥬',
            description: 'Hạt giống cải bắp thông thường, thời gian thu hoạch 3 giờ'
        },
        {
            type: 'seed',
            name: 'Hạt giống thanh long',
            code: 'dragon_fruit_seed',
            price: 1000,
            emoji: '🐉',
            description: 'Hạt giống thanh long quý hiếm, thời gian thu hoạch 8 giờ'
        },
        {
            type: 'seed',
            name: 'Hạt giống nho',
            code: 'nho',
            price: 4000,
            emoji: '🍇',
            description: 'Hạt giống nho xịn, thời gian thu hoạch 8 giờ'
        },
        {
            type: 'seed',
            name: 'Hạt giống lúa',
            code: 'lúa',
            price: 8000,
            emoji: '🌾',
            description: 'Hạt giống lúa gạo nếp, thời gian thu hoạch 16 giờ'
        },
        {
            type: 'fertilizer',
            name: 'Phân bón NPK',
            code: 'fertilizer',
            price: 80,
            emoji: '💊',
            description: 'Giúp cây phát triển nhanh hơn 20%'
        },
        {
            type: 'pesticide',
            name: 'Thuốc trừ sâu',
            code: 'pesticide',
            price: 50,
            emoji: '🧪',
            description: 'Bảo vệ cây khỏi sâu bệnh trong 24 giờ'
        },
        {
            type: 'water',
            name: 'Nước tưới',
            code: 'water',
            price: 100,
            emoji: '💧',
            description: 'Tưới nước cho cây'
        }
    ];

    for (const item of defaultItems) {
        await Shop.findOneAndUpdate(
            { code: item.code },
            item,
            { upsert: true, new: true }
        );
    }
};

module.exports = { Shop, initializeShop };
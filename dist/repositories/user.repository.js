"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const user_model_1 = require("../models/user.model");
class UserRepository {
    async findActiveUsers() {
        return user_model_1.UserModel.find({ isCallActive: true })
            .select('name teluguName handle mitraId avatar bio teluguBio location isVerified gender profession callCategory isCallActive callLanguage callRating callRatingCount callRateCoins coins earnedCoins callActiveAt')
            .sort({ callActiveAt: -1, callRating: -1 })
            .lean();
    }
    async findById(id) {
        return user_model_1.UserModel.findById(id);
    }
    async findByIdLean(id, selectFields) {
        const query = user_model_1.UserModel.findById(id);
        if (selectFields) {
            query.select(selectFields);
        }
        return query.lean();
    }
    async updateUser(id, updateFields) {
        return user_model_1.UserModel.findByIdAndUpdate(id, updateFields, { new: true });
    }
    async deductCoins(id, amount) {
        return user_model_1.UserModel.findByIdAndUpdate(id, { $inc: { coins: -amount } }, { new: true });
    }
    async refundCoins(id, amount) {
        return user_model_1.UserModel.findByIdAndUpdate(id, { $inc: { coins: amount } }, { new: true });
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();

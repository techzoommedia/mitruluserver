import { UserModel, IUser } from '../models/user.model';

export interface IUserRepository {
  findActiveUsers(): Promise<any[]>;
  findById(id: string): Promise<IUser | null>;
  findByIdLean(id: string, selectFields?: string): Promise<any | null>;
  updateUser(id: string, updateFields: any): Promise<IUser | null>;
  deductCoins(id: string, amount: number): Promise<IUser | null>;
  refundCoins(id: string, amount: number): Promise<IUser | null>;
}

export class UserRepository implements IUserRepository {
  async findActiveUsers(): Promise<any[]> {
    return UserModel.find({ isCallActive: true })
      .select(
        'name teluguName handle mitraId avatar bio teluguBio location isVerified gender profession callCategory isCallActive callLanguage callRating callRatingCount callRateCoins coins earnedCoins callActiveAt'
      )
      .sort({ callActiveAt: -1, callRating: -1 })
      .lean();
  }

  async findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id);
  }

  async findByIdLean(id: string, selectFields?: string): Promise<any | null> {
    const query = UserModel.findById(id);
    if (selectFields) {
      query.select(selectFields);
    }
    return query.lean();
  }

  async updateUser(id: string, updateFields: any): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, updateFields, { new: true });
  }

  async deductCoins(id: string, amount: number): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { $inc: { coins: -amount } },
      { new: true }
    );
  }

  async refundCoins(id: string, amount: number): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { $inc: { coins: amount } },
      { new: true }
    );
  }
}

export const userRepository = new UserRepository();

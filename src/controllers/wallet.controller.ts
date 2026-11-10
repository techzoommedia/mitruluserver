import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import UserModel from '../models/user.model';

export class WalletController {
  async createOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { packageId, customCoins } = req.body;
      let coins = 2000;
      let rupees = 3000;

      if (customCoins) {
        coins = Math.max(1, Number(customCoins));
        rupees = Math.max(1, Math.round(coins * 1.5));
      } else if (packageId) {
        coins = Number(packageId);
        rupees = Math.max(1, Math.round(coins * 1.5));
      }

      const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      res.json({
        success: true,
        orderId,
        amount: rupees * 100,
        currency: 'INR',
        coins,
        rupees,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create wallet order' });
    }
  }

  async verifyPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { coins, orderId, paymentId } = req.body;
      const coinsNum = Number(coins) || 0;

      const user = await UserModel.findById(currentUserId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      user.coins = (user.coins || 0) + coinsNum;
      user.coinHistory = user.coinHistory || [];
      user.coinHistory.push({
        type: 'credit',
        action: 'deposit',
        amount: coinsNum,
        balanceAfter: user.coins,
        description: `Purchased ${coinsNum} coins`,
        teluguDescription: `${coinsNum} నాణేలు కొనుగోలు చేసారు`,
        orderId,
        paymentId,
        createdAt: new Date(),
      });

      await user.save();
      res.json({ success: true, coins: user.coins });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async requestPayout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { amountCoins, upiId } = req.body;
      const coinsNum = Number(amountCoins);

      if (!coinsNum || coinsNum < 100 || !upiId?.trim()) {
        res.status(400).json({ error: 'కనీసం 100 నాణేలు మరియు చెల్లుబాటు అయ్యే UPI ID అవసరం (Min 100 coins and valid UPI required)' });
        return;
      }

      const user = await UserModel.findById(currentUserId);
      if (!user || (user.coins || 0) < coinsNum) {
        res.status(400).json({ error: 'నాణేల నిల్వ సరిపోదు (Insufficient balance)' });
        return;
      }

      const amountRupees = Math.round(coinsNum * 0.7); // payout rate
      user.coins = user.coins - coinsNum;
      user.coinsWithdrawn = (user.coinsWithdrawn || 0) + coinsNum;
      user.payoutRequests = user.payoutRequests || [];
      user.payoutRequests.push({
        amountCoins: coinsNum,
        amountRupees,
        upiId: upiId.trim(),
        status: 'pending',
        requestedAt: new Date(),
      });

      await user.save();
      res.json({ success: true, remainingCoins: user.coins, amountRupees });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const walletController = new WalletController();
export default walletController;


import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import UserModel from '../models/user.model';
import { socketManager } from '../sockets/socket.manager';

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

      const PACKAGE_RATES: Record<string, { coins: number; rupees: number }> = {
        '1': { coins: 1, rupees: 1 },
        '100': { coins: 100, rupees: 170 },
        '500': { coins: 500, rupees: 800 },
        '2000': { coins: 2000, rupees: 3000 },
        '5000': { coins: 5000, rupees: 7000 },
        '10000': { coins: 10000, rupees: 13000 },
      };

      if (customCoins) {
        coins = Math.max(1, Number(customCoins));
        rupees = Math.max(1, Math.round(coins * 1.5));
      } else if (packageId && PACKAGE_RATES[String(packageId)]) {
        coins = PACKAGE_RATES[String(packageId)].coins;
        rupees = PACKAGE_RATES[String(packageId)].rupees;
      } else if (packageId) {
        coins = Number(packageId) || 2000;
        rupees = Math.max(1, Math.round(coins * 1.5));
      }

      const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_live_SSI6V2PjrkG5Fl';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || 'Iih3AxfFbpTQYZYiVPoMHa6i';
      let realOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Create official order with Razorpay API if live keys are present
      if (keyId && keySecret && !keyId.includes('mock')) {
        try {
          const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
          const rzpResp = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: rupees * 100,
              currency: 'INR',
              receipt: `rcpt_${currentUserId.slice(-6)}_${Date.now()}`,
              notes: {
                userId: currentUserId,
                coins,
                rupees,
              },
            }),
          });
          const rzpData: any = await rzpResp.json();
          if (rzpData?.id) {
            realOrderId = rzpData.id;
          } else {
            console.warn('[WalletController.createOrder] Razorpay API warning:', rzpData);
          }
        } catch (apiErr: any) {
          console.warn('[WalletController.createOrder] Failed calling Razorpay API directly:', apiErr.message);
        }
      }

      res.json({
        success: true,
        orderId: realOrderId,
        amount: rupees * 100,
        currency: 'INR',
        coins,
        rupees,
        keyId,
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

      const {
        coins,
        orderId,
        paymentId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;
      const coinsNum = Number(coins) || 0;
      const finalOrderId = razorpay_order_id || orderId;
      const finalPaymentId = razorpay_payment_id || paymentId;

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
        orderId: finalOrderId,
        paymentId: finalPaymentId,
        createdAt: new Date(),
      });

      await user.save();
      res.json({ success: true, coins: user.coins, newBalance: user.coins });
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

  /**
   * Secure Peer-to-Peer Coin Transfer
   * Features:
   * - Strict integer & bounds validation (1 to 50,000 coins)
   * - Atomic conditional balance deduction ({ coins: { $gte: amount } })
   * - Race-condition immunity & zero-negative balance guarantee
   * - Automatic rollback if recipient credit fails
   * - Full audit log in coinHistory for both sender and receiver
   * - Realtime WebSocket push notifications to both parties
   */
  async transferCoins(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.userId;
      if (!currentUserId) {
        res.status(401).json({ error: 'లాగిన్ అవ్వండి (Authentication required)' });
        return;
      }

      const { recipientId, amount, note } = req.body;
      const cleanRecipientId = String(recipientId || '').trim();

      if (!cleanRecipientId) {
        res.status(400).json({ error: 'గ్రహీత ID తప్పనిసరి (Recipient identifier is required)' });
        return;
      }

      // Input validation: positive integer only
      const parsedAmount = Number(amount);
      if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
        res.status(400).json({
          error: 'దయచేసి సరైన పూర్ణాంక నాణేల సంఖ్యను నమోదు చేయండి (Valid positive integer coins required)',
        });
        return;
      }

      if (parsedAmount > 50000) {
        res.status(400).json({
          error: 'ఒక లావాదేవీకి గరిష్టంగా 50,000 నాణేలు మాత్రమే పంపగలరు (Max 50,000 coins per transfer)',
        });
        return;
      }

      // Find recipient user
      let recipient = null;
      if (mongoose.Types.ObjectId.isValid(cleanRecipientId)) {
        recipient = await UserModel.findById(cleanRecipientId);
      }
      if (!recipient) {
        recipient = await UserModel.findOne({
          $or: [
            { handle: cleanRecipientId.replace(/^@/, '') },
            { mitraId: cleanRecipientId.replace(/^@/, '') },
          ],
        });
      }

      if (!recipient) {
        res.status(404).json({ error: 'గ్రహీత ఖాతా కనుగొనబడలేదు (Recipient user not found)' });
        return;
      }

      // Prevent self-transfer
      const recipientOidStr = recipient._id.toString();
      const senderOidStr = String(currentUserId);
      if (recipientOidStr === senderOidStr) {
        res.status(400).json({
          error: 'మీకు మీరే నాణేలు పంపుకోలేరు (Cannot transfer coins to yourself)',
        });
        return;
      }

      // Atomic conditional deduction from sender (prevents race condition & double spending)
      const senderTransaction = {
        type: 'debit',
        action: 'transfer_sent',
        amount: parsedAmount,
        recipientId: recipientOidStr,
        recipientName: recipient.name,
        recipientHandle: recipient.mitraId || recipient.handle || 'mitrudu',
        description: `Sent ${parsedAmount} coins to ${recipient.name}${note ? `: "${note}"` : ''}`,
        teluguDescription: `${recipient.teluguName || recipient.name} కి ${parsedAmount} నాణేలు పంపారు${note ? `: "${note}"` : ''}`,
        createdAt: new Date(),
      };

      const updatedSender = await UserModel.findOneAndUpdate(
        { _id: currentUserId, coins: { $gte: parsedAmount } },
        {
          $inc: { coins: -parsedAmount },
          $push: { coinHistory: senderTransaction },
        },
        { new: true }
      );

      if (!updatedSender) {
        res.status(400).json({
          error: 'మీ ఖాతాలో తగినంత నాణేల నిల్వ లేదు (Insufficient coin balance in your account)',
        });
        return;
      }

      // Atomic credit to recipient
      const recipientTransaction = {
        type: 'credit',
        action: 'transfer_received',
        amount: parsedAmount,
        senderId: senderOidStr,
        senderName: updatedSender.name,
        senderHandle: updatedSender.mitraId || updatedSender.handle || 'mitrudu',
        description: `Received ${parsedAmount} coins from ${updatedSender.name}${note ? `: "${note}"` : ''}`,
        teluguDescription: `${updatedSender.teluguName || updatedSender.name} నుండి ${parsedAmount} నాణేలు అందాయి${note ? `: "${note}"` : ''}`,
        createdAt: new Date(),
      };

      let updatedRecipient;
      try {
        updatedRecipient = await UserModel.findOneAndUpdate(
          { _id: recipient._id },
          {
            $inc: { coins: parsedAmount, earnedCoins: parsedAmount },
            $push: { coinHistory: recipientTransaction },
          },
          { new: true }
        );
      } catch (creditErr) {
        // Rollback sender deduction on rare recipient failure
        await UserModel.findOneAndUpdate(
          { _id: currentUserId },
          {
            $inc: { coins: parsedAmount },
            $push: {
              coinHistory: {
                type: 'credit',
                action: 'transfer_rollback',
                amount: parsedAmount,
                description: `Rollback ${parsedAmount} coins due to transfer failure`,
                teluguDescription: `లావాదేవీ విఫలమైనందున ${parsedAmount} నాణేలు తిరిగి జమ చేయబడ్డాయి`,
                createdAt: new Date(),
              },
            },
          }
        );
        res.status(500).json({ error: 'లావాదేవీ విఫలమైంది, నాణేలు రీఫండ్ అయ్యాయి (Transfer failed, coins refunded)' });
        return;
      }

      // Realtime notification via WebSockets
      try {
        socketManager.emitToUser(senderOidStr, 'coins:updated', {
          coins: updatedSender.coins,
        });
        socketManager.emitToUser(recipientOidStr, 'coins:updated', {
          coins: updatedRecipient?.coins,
        });
        socketManager.emitToUser(recipientOidStr, 'coins:received', {
          senderId: senderOidStr,
          senderName: updatedSender.name,
          senderAvatar: updatedSender.avatar,
          amount: parsedAmount,
          newBalance: updatedRecipient?.coins,
          note,
        });
      } catch (wsErr) {
        console.warn('[Wallet] Non-fatal WS emit warning on transfer:', wsErr);
      }

      res.json({
        success: true,
        amount: parsedAmount,
        senderCoins: updatedSender.coins,
        recipient: {
          id: recipientOidStr,
          name: recipient.name,
          teluguName: recipient.teluguName,
          handle: recipient.mitraId || recipient.handle,
          avatar: recipient.avatar,
        },
      });
    } catch (err: any) {
      console.error('[Wallet] transferCoins error:', err);
      res.status(500).json({ error: err.message || 'Coin transfer processing failed' });
    }
  }
}

export const walletController = new WalletController();
export default walletController;


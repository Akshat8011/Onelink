import { Request, Response } from 'express';
import { Wallet } from '../models/Wallet';
import { Card } from '../models/Card';
import { BankAccount } from '../models/BankAccount';
import { Transaction } from '../models/Transaction';
import mongoose from 'mongoose';

export class WalletController {
  
  /**
   * Fetch all wallet dashboard data (Balance, Cards, Banks, Recent Txns)
   */
  async getDashboard(req: Request, res: Response) {
    try {
      const userId = 'mock-user-123'; // Hardcoded for demo
      
      const wallet = await Wallet.findOne({ userId });
      const cards = await Card.find({ userId });
      const banks = await BankAccount.find({ userId });
      const transactions = await Transaction.find({ userId }).sort({ date: -1 }).limit(10);

      // Calculate spend analytics
      const spendByCategory = await Transaction.aggregate([
        { $match: { userId, type: 'DEBIT' } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } }
      ]);

      res.json({ 
        success: true, 
        data: { 
          wallet, 
          cards, 
          banks, 
          transactions,
          analytics: spendByCategory
        } 
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
    }
  }

  /**
   * Add funds to Wallet from a Bank Account or Card
   */
  async addFunds(req: Request, res: Response) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { amount, sourceId } = req.body; // sourceId = cardId or accountId
      const userId = 'mock-user-123';

      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) throw new Error('Wallet not found');

      wallet.balance += amount;
      await wallet.save({ session });

      const txnId = `TXN_${Date.now()}`;
      await Transaction.create([{
        transactionId: txnId,
        userId,
        type: 'CREDIT',
        amount,
        category: 'ADD_FUNDS',
        description: `Added funds from ${sourceId}`,
        status: 'SUCCESS'
      }], { session });

      await session.commitTransaction();
      session.endSession();

      res.json({ success: true, message: 'Funds added successfully', balance: wallet.balance });
    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ success: false, message: error.message || 'Failed to add funds' });
    }
  }

  /**
   * Toggle Card Settings (Block, International Payments, Online)
   */
  async toggleCardSetting(req: Request, res: Response) {
    try {
      const { cardId } = req.params;
      const { setting, value } = req.body; // setting: 'isBlocked', 'internationalPayments', 'onlineTransactions'

      const card = await Card.findOne({ cardId });
      if (!card) return res.status(404).json({ success: false, message: 'Card not found' });

      (card as any)[setting] = value;
      await card.save();

      res.json({ success: true, message: `Card ${setting} updated`, data: card });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update card' });
    }
  }

  /**
   * Update Card Daily Limit
   */
  async updateCardLimit(req: Request, res: Response) {
    try {
      const { cardId } = req.params;
      const { limit } = req.body;

      const card = await Card.findOne({ cardId });
      if (!card) return res.status(404).json({ success: false, message: 'Card not found' });

      card.dailyLimit = limit;
      await card.save();

      res.json({ success: true, message: 'Card limit updated', data: card });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update card limit' });
    }
  }
}

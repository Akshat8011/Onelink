import { Request, Response } from 'express';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import mongoose from 'mongoose';

export class RetailController {
  
  /**
   * Fetch all products grouped by category, with pagination support
   */
  async getProducts(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50; // default 50 items per page
      const category = req.query.category as string;
      
      const query: any = {};
      if (category) query.category = category;

      const products = await Product.find(query)
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();
        
      res.json({ success: true, data: products });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
  }

  /**
   * Fetch a specific product by ID
   */
  async getProductById(req: Request, res: Response) {
    try {
      const product = await Product.findOne({ productId: req.params.productId });
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
      res.json({ success: true, data: product });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch product' });
    }
  }

  /**
   * Fetch categories list
   */
  async getCategories(req: Request, res: Response) {
    try {
      const categories = await Product.distinct('category');
      res.json({ success: true, data: categories });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
  }

  /**
   * Place an order (decrement inventory)
   */
  async placeOrder(req: Request, res: Response) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { items, deliveryAddress } = req.body;
      
      if (!items || !items.length) {
        return res.status(400).json({ success: false, message: 'Cart is empty' });
      }

      let totalAmount = 0;
      const orderItems = [];

      // Verify stock and calculate total
      for (const item of items) {
        const product = await Product.findOne({ productId: item.productId }).session(session);
        
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
        }

        // Decrement stock
        product.stock -= item.quantity;
        await product.save({ session });

        totalAmount += product.price * item.quantity;
        orderItems.push({
          productId: product.productId,
          name: product.name,
          price: product.price,
          quantity: item.quantity
        });
      }

      // Create Order
      const orderId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newOrder = new Order({
        orderId,
        userId: 'mock-user-123',
        items: orderItems,
        totalAmount,
        deliveryAddress: deliveryAddress || 'Lucknow HQ',
        status: 'CONFIRMED'
      });

      await newOrder.save({ session });
      await session.commitTransaction();
      session.endSession();

      res.json({ 
        success: true, 
        message: 'Order placed successfully', 
        data: newOrder
      });
    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ success: false, message: error.message || 'Failed to place order' });
    }
  }

  /**
   * Track order
   */
  async getOrder(req: Request, res: Response) {
    try {
      const order = await Order.findOne({ orderId: req.params.orderId });
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      res.json({ success: true, data: order });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch order' });
    }
  }
}

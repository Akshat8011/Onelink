import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    cardUid: string;
    name: string;
  };
}

/**
 * JWT authentication middleware
 * Extracts and validates Bearer token from Authorization header
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };

    const user = await User.findOne({ userId: decoded.userId }).select('userId cardUid name');
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = {
      userId: user.userId,
      cardUid: user.cardUid,
      name: user.name,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Generate JWT token for a user
 */
export const generateToken = (userId: string, expiresIn?: string): string => {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: (expiresIn || env.JWT_EXPIRES_IN) as any });
};

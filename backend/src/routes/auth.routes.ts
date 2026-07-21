import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { emitToUser } from '../utils/realtime.js';
import { hashCardUid, cardUidQuery } from '../utils/cardUid.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { generateLinkedBanks } from '../utils/banks.js';
import { isAdminUser } from '../utils/admin.js';

const router = Router();

// Pairing tokens are only 10 digits — cap attempts per IP to deter guessing.
const pairLimiter = rateLimit({ windowMs: 60_000, max: 10, name: 'auth/pair-card' });
const loginLimiter = rateLimit({ windowMs: 60_000, max: 20, name: 'auth/login' });

async function generateUniquePairingToken(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const token = crypto.randomInt(1000000000, 9999999999).toString();
    const exists = await User.findOne({ pairingToken: token });
    if (!exists) return token;
  }
  throw new Error('Could not generate unique pairing token');
}

function generateUserId(): string {
  return `usr_${crypto.randomBytes(4).toString('hex')}`;
}

function sanitizeUser(user: InstanceType<typeof User>) {
  return {
    userId: user.userId,
    username: user.username,
    cardUid: user.isCardPaired ? user.cardUid : null,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    wallet: user.wallet,
    card: {
      cardNumber: user.card.cardNumber,
      cardType: user.card.cardType,
      expiry: user.card.expiry,
      isBlocked: user.card.isBlocked,
      domesticUsage: user.card.domesticUsage,
      internationalUsage: user.card.internationalUsage,
    },
    linkedBanks: user.linkedBanks,
    loyaltyPoints: user.loyaltyPoints,
    memberTier: user.memberTier,
    language: user.language,
    theme: user.theme,
    isCardPaired: user.isCardPaired,
    isAdmin: isAdminUser(user),
    pairingToken: null,
    hasPairingCode: !user.isCardPaired && !!user.pairingToken,
  };
}

/**
 * POST /api/v1/auth/register
 * Create a new account with username + password; returns a 10-digit RFID pairing token.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const trimmedUsername = username.trim();
    const usernameRegex = new RegExp(`^${trimmedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const existing = await User.findOne({
      $or: [
        { username: usernameRegex },
        { email: trimmedUsername.toLowerCase().replace(/\s+/g, '.') + '@onelink.local' },
      ],
    });
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const userId = generateUserId();
    const pairingToken = await generateUniquePairingToken();
    const passwordHash = await bcrypt.hash(password, 10);
    const cvvHash = await bcrypt.hash('000', 10);
    const email = `${trimmedUsername.toLowerCase().replace(/\s+/g, '.')}@onelink.local`;

    const user = await User.create({
      userId,
      username: trimmedUsername,
      name: trimmedUsername,
      email,
      phone: '',
      passwordHash,
      cardUid: `UNPAIRED_${userId}`,
      pairingToken,
      pairingTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isCardPaired: false,
      wallet: {
        balance: 5000,
        currency: 'INR',
        dailyLimit: 50000,
        contactlessLimit: 2000,
        lastTopUp: null,
      },
      card: {
        cardNumber: '****-****-****-0000',
        cardType: 'NFC Smart Card',
        expiry: '12/30',
        isBlocked: false,
        domesticUsage: true,
        internationalUsage: false,
        dailyLimit: 50000,
        contactlessLimit: 2000,
        cvvHash,
      },
      linkedBanks: generateLinkedBanks(2),
      loyaltyPoints: 0,
      transactionCount: 0,
      memberTier: 'BRONZE',
      language: 'EN',
      theme: 'DARK',
      notificationsEnabled: true,
    });

    const token = generateToken(user.userId);

    res.status(201).json({
      token,
      user: sanitizeUser(user),
      message: 'Account created. View your pairing code in Profile (password required).',
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/v1/auth/login
 * Login with username + password, cardUid + CVV, or email + password.
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { cardUid, cvv, email, password, username, rememberMe } = req.body;

    let user;

    if (cardUid && cvv) {
      user = await User.findOne({ ...cardUidQuery(cardUid), isCardPaired: true });
      if (!user) return res.status(401).json({ error: 'Invalid card UID' });

      const cvvMatch = await bcrypt.compare(cvv, user.card.cvvHash);
      if (!cvvMatch) return res.status(401).json({ error: 'Invalid CVV' });
    } else if (username && password) {
      const trimmed = username.trim();
      user = await User.findOne({
        $or: [
          { username: trimmed },
          { name: trimmed },
          { email: trimmed },
        ],
      });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const passMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passMatch) return res.status(401).json({ error: 'Invalid credentials' });
    } else if (email && password) {
      user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const passMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passMatch) return res.status(401).json({ error: 'Invalid credentials' });
    } else {
      return res.status(400).json({ error: 'Provide username+password, email+password, or cardUid+cvv' });
    }

    if (user.card?.isBlocked) {
      return res.status(403).json({ error: 'Card is blocked. Contact support.' });
    }

    const expiresIn = rememberMe ? '30d' : env.JWT_EXPIRES_IN;
    const token = generateToken(user.userId, expiresIn);

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/v1/auth/pair-card
 * Permanently map an RFID card UID to a user profile using the pairing token.
 * Called by IoT terminal when user enters PIN after tapping a new card.
 */
router.post('/pair-card', pairLimiter, async (req: Request, res: Response) => {
  try {
    const { pairingToken, cardUid } = req.body;

    if (!pairingToken || !cardUid) {
      return res.status(400).json({ error: 'pairingToken and cardUid are required' });
    }

    const user = await User.findOne({ pairingToken: pairingToken.toString().trim() });
    if (!user) {
      return res.status(404).json({ error: 'Invalid pairing token' });
    }

    if (user.isCardPaired && !String(user.cardUid).startsWith('UNPAIRED_')) {
      return res.status(409).json({ error: 'This account already has a linked RFID card' });
    }

    if (user.pairingTokenExpiresAt && user.pairingTokenExpiresAt < new Date()) {
      return res.status(410).json({ error: 'Pairing token expired. Register again or request a new token.' });
    }

    const normalizedUid = cardUid.toString().trim().toUpperCase();

    // Reclaim this card UID from any other account first. The cardUid field is
    // UNIQUE, so a stale record still holding this UID would make the link
    // write throw a duplicate-key error (surfacing as a 500). Releasing it
    // self-heals that state; possessing the valid code authorises the claim.
    const conflicts = await User.find({ cardUid: normalizedUid, userId: { $ne: user.userId } })
      .select('userId')
      .lean();
    for (const c of conflicts) {
      await User.updateOne(
        { userId: c.userId },
        { $set: { cardUid: `UNPAIRED_${c.userId}`, isCardPaired: false, cardUidHash: null } },
      );
    }

    // Targeted update (dot-notation) instead of user.save() so we never trip
    // full-document validation on legacy/partial docs and a missing `card`
    // sub-document is created rather than throwing.
    // Store a unique per-user "consumed" marker instead of null: the Atlas
    // pairingToken index is unique but not sparse, so multiple null tokens
    // collide (E11000). A marker never matches a 10-digit code and never
    // collides, so pairing works regardless of the index definition.
    const linkUpdate = {
      $set: {
        cardUid: normalizedUid,
        cardUidHash: hashCardUid(normalizedUid),
        isCardPaired: true,
        pairingToken: `used_${user.userId}`,
        pairingTokenExpiresAt: null,
        'card.cardNumber': `****-****-****-${normalizedUid.slice(-4)}`,
      },
    };
    try {
      await User.updateOne({ userId: user.userId }, linkUpdate);
    } catch (writeErr: any) {
      if (writeErr?.code === 11000) {
        const stillConflicting = await User.find({ cardUid: normalizedUid, userId: { $ne: user.userId } })
          .select('userId')
          .lean();
        for (const c of stillConflicting) {
          await User.updateOne(
            { userId: c.userId },
            { $set: { cardUid: `UNPAIRED_${c.userId}`, isCardPaired: false, cardUidHash: null } },
          );
        }
        await User.updateOne({ userId: user.userId }, linkUpdate);
      } else {
        throw writeErr;
      }
    }

    logger.info(`🔗 Card paired: ${user.name} (${normalizedUid})`);

    try {
      emitToUser(user.userId, 'card:paired', {
        cardUid: normalizedUid,
        message: `Card linked to ${user.name}`,
      });
    } catch (emitErr) {
      logger.warn('card:paired emit failed (non-fatal):', emitErr);
    }

    res.json({
      success: true,
      userId: user.userId,
      name: user.name,
      cardUid: normalizedUid,
      balance: user.wallet?.balance ?? 0,
      message: `RFID card linked to ${user.name}`,
    });
  } catch (error: any) {
    logger.error('Pair card error:', error?.stack || error?.message || error);
    res.status(500).json({ error: 'Card pairing failed' });
  }
});

/**
 * POST /api/v1/auth/reveal-pairing-token
 * Return the pairing code after password verification.
 */
router.post('/reveal-pairing-token', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const user = await User.findOne({ userId: req.user!.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isCardPaired) {
      return res.status(400).json({ error: 'Your RFID card is already linked.' });
    }
    if (!user.pairingToken) {
      return res.status(404).json({ error: 'No pairing code found. Generate a new one.' });
    }
    if (user.pairingTokenExpiresAt && user.pairingTokenExpiresAt < new Date()) {
      return res.status(410).json({ error: 'Pairing code expired. Generate a new one.' });
    }

    const passMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    res.json({
      success: true,
      pairingToken: user.pairingToken,
    });
  } catch (error) {
    logger.error('Reveal pairing token error:', error);
    res.status(500).json({ error: 'Failed to reveal pairing code' });
  }
});

/**
 * POST /api/v1/auth/regenerate-pairing-token
 * Issue a new 10-digit pairing code when the user has not linked a card yet.
 */
router.post('/regenerate-pairing-token', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const user = await User.findOne({ userId: req.user!.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isCardPaired) {
      return res.status(400).json({ error: 'Your RFID card is already linked. Pairing codes cannot be regenerated.' });
    }

    const passMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const pairingToken = await generateUniquePairingToken();
    user.pairingToken = pairingToken;
    user.pairingTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    logger.info(`🔄 Pairing token regenerated for ${user.username}`);

    res.json({
      success: true,
      pairingToken,
      message: 'New pairing code generated. Use it when tapping your RFID card at a terminal.',
      user: sanitizeUser(user),
    });
  } catch (error) {
    logger.error('Regenerate pairing token error:', error);
    res.status(500).json({ error: 'Failed to regenerate pairing code' });
  }
});

/**
 * GET /api/v1/auth/profile
 * Get current user's full profile
 */
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ userId: req.user!.userId }).select('-passwordHash -card.cvvHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(sanitizeUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * PATCH /api/v1/auth/nfc-card
 * Control the user's linked NFC/RFID card (block, limits, usage flags).
 */
router.patch('/nfc-card', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ userId: req.user!.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.isCardPaired) {
      return res.status(400).json({ error: 'No RFID card linked yet. Pair your card at a terminal first.' });
    }

    const { isBlocked, domesticUsage, internationalUsage, dailyLimit, contactlessLimit } = req.body;

    if (typeof isBlocked === 'boolean') user.card.isBlocked = isBlocked;
    if (typeof domesticUsage === 'boolean') user.card.domesticUsage = domesticUsage;
    if (typeof internationalUsage === 'boolean') user.card.internationalUsage = internationalUsage;
    if (typeof dailyLimit === 'number' && dailyLimit > 0) user.card.dailyLimit = dailyLimit;
    if (typeof contactlessLimit === 'number' && contactlessLimit > 0) user.card.contactlessLimit = contactlessLimit;

    await user.save();

    res.json({
      success: true,
      card: {
        cardUid: user.cardUid,
        isBlocked: user.card.isBlocked,
        domesticUsage: user.card.domesticUsage,
        internationalUsage: user.card.internationalUsage,
        dailyLimit: user.card.dailyLimit,
        contactlessLimit: user.card.contactlessLimit,
      },
    });
  } catch (error) {
    logger.error('NFC card update error:', error);
    res.status(500).json({ error: 'Failed to update card settings' });
  }
});

/**
 * POST /api/v1/auth/delink-card
 * Unlink the RFID card from the account and issue a fresh pairing code so the
 * user can immediately re-link the same or a different card.
 */
router.post('/delink-card', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ userId: req.user!.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.isCardPaired || String(user.cardUid).startsWith('UNPAIRED_')) {
      return res.status(400).json({ error: 'No RFID card is linked to this account.' });
    }

    const previousCardUid = user.cardUid;
    const newToken = await generateUniquePairingToken();

    // Targeted update (dot-notation) to avoid full-document validation on
    // legacy docs. Reset the card fields and issue a fresh pairing code.
    await User.updateOne(
      { userId: user.userId },
      {
        $set: {
          cardUid: `UNPAIRED_${user.userId}`,
          cardUidHash: null,
          isCardPaired: false,
          pairingToken: newToken,
          pairingTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          'card.cardNumber': '****-****-****-0000',
          'card.isBlocked': false,
        },
      },
    );

    logger.info(`🔓 Card delinked from ${user.name} (was ${previousCardUid})`);

    try {
      emitToUser(user.userId, 'card:delinked', {
        message: 'Card unlinked from your account',
      });
    } catch (emitErr) {
      logger.warn('card:delinked emit failed (non-fatal):', emitErr);
    }

    return res.json({
      success: true,
      pairingToken: newToken,
      message: 'Card unlinked. Use the new code to link a card again.',
    });
  } catch (error: any) {
    logger.error('Delink card error:', error?.stack || error?.message || error);
    res.status(500).json({ error: 'Failed to unlink card' });
  }
});

export default router;

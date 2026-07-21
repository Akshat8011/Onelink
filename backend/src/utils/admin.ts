import { Response, NextFunction } from 'express';
import { User, IUser } from '../models/User.js';
import { AuthRequest } from '../middleware/auth.js';

// Accounts that are always treated as admins even if the DB flag was never set
// (case-insensitive match against username / name / email). This lets the owner
// account gain admin access without a manual DB migration.
const ADMIN_IDENTIFIERS = new Set([
  'akshat choudhary',
  'akshat',
]);

export function isAdminUser(user: Pick<IUser, 'isAdmin' | 'username' | 'name' | 'email'> | null | undefined): boolean {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  const candidates = [user.username, user.name, user.email]
    .filter(Boolean)
    .map((s) => String(s).trim().toLowerCase());
  return candidates.some((c) => ADMIN_IDENTIFIERS.has(c));
}

/**
 * Route guard: allow only admin users. Must run AFTER `authenticate` (which
 * sets req.user). Loads the full user to check the persisted flag + identifier
 * allow-list, and lazily promotes matching accounts so the DB flag sticks.
 */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const user = await User.findOne({ userId: req.user.userId });
    if (!user || !isAdminUser(user)) {
      res.status(403).json({ error: 'Admin access only' });
      return;
    }
    if (!user.isAdmin) {
      user.isAdmin = true;
      await user.save().catch(() => {});
    }
    next();
  } catch {
    res.status(403).json({ error: 'Admin access only' });
  }
}

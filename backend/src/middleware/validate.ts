import { Request, Response, NextFunction } from 'express';

/**
 * Tiny dependency-free request-body validator (Phase 2 input validation).
 *
 * Beyond rejecting malformed input, enforcing `type: 'string'` on identifiers
 * like cardUid/cartId also blocks NoSQL-operator injection: a client sending
 * `{ "cardUid": { "$ne": null } }` is refused before it can reach a Mongo query.
 */

export type FieldRule = {
  type: 'string' | 'number' | 'array' | 'boolean';
  required?: boolean;
  min?: number; // number: min value | array: min length
  max?: number; // number: max value | array: max length
  maxLen?: number; // string: max characters
  pattern?: RegExp; // string: must match
};

export type BodySchema = Record<string, FieldRule>;

function checkField(name: string, value: unknown, rule: FieldRule): string | null {
  if (value === undefined || value === null || value === '') {
    return rule.required ? `${name} is required` : null;
  }

  switch (rule.type) {
    case 'string': {
      if (typeof value !== 'string') return `${name} must be a string`;
      if (rule.maxLen && value.length > rule.maxLen) return `${name} is too long`;
      if (rule.pattern && !rule.pattern.test(value)) return `${name} is invalid`;
      return null;
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${name} must be a number`;
      if (rule.min !== undefined && value < rule.min) return `${name} must be ≥ ${rule.min}`;
      if (rule.max !== undefined && value > rule.max) return `${name} must be ≤ ${rule.max}`;
      return null;
    }
    case 'array': {
      if (!Array.isArray(value)) return `${name} must be an array`;
      if (rule.min !== undefined && value.length < rule.min) return `${name} must have ≥ ${rule.min} items`;
      if (rule.max !== undefined && value.length > rule.max) return `${name} must have ≤ ${rule.max} items`;
      return null;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') return `${name} must be a boolean`;
      return null;
    }
    default:
      return null;
  }
}

export function validateBody(schema: BodySchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const errors: string[] = [];

    for (const [name, rule] of Object.entries(schema)) {
      const error = checkField(name, body[name], rule);
      if (error) errors.push(error);
    }

    if (errors.length) {
      res.status(400).json({ success: false, error: errors.join('; '), fields: errors });
      return;
    }
    next();
  };
}

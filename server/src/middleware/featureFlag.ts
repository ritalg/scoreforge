import { Request, Response, NextFunction } from 'express';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';

export function requireFeature(flagKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const flag = db.select().from(schema.featureFlags)
      .where(eq(schema.featureFlags.flagKey, flagKey)).get();
    if (!flag?.enabled) {
      return res.status(503).json({ error: `Feature '${flagKey}' is currently disabled` });
    }
    next();
  };
}

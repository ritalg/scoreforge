import { Request, Response, NextFunction } from 'express';
import { db, schema } from '../db';

export function auditLog(action: string, entityType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode < 400 && req.user && req.user.role !== 'student') {
        try {
          db.insert(schema.auditLogs).values({
            userId: req.user.id,
            action,
            entityType,
            entityId: String((req.params as Record<string, string>).id ?? (body as Record<string, unknown>)?.id ?? ''),
            payloadJson: JSON.stringify(req.body),
            ipAddress: req.ip,
          }).run();
        } catch {
          // audit log failure must not block the response
        }
      }
      return originalJson(body);
    };
    next();
  };
}

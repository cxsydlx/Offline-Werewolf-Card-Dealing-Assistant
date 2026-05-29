import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      deviceFingerprint?: string;
    }
  }
}

export function deviceAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const fingerprint = req.headers["x-device-fingerprint"] as string | undefined;
  req.deviceFingerprint = fingerprint || undefined;
  next();
}

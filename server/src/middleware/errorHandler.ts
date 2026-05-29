import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      ok: false,
      error: err.code,
      message: err.message,
    });
    return;
  }

  console.error("❌ 未捕获错误:", err);
  res.status(500).json({
    ok: false,
    error: "INTERNAL_ERROR",
    message: process.env.NODE_ENV === "production" ? "服务器内部错误" : err.message,
  });
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

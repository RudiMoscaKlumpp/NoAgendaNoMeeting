import type { Request, Response, NextFunction } from "express";
import { config } from "./config";

export function shsAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  if (token !== config.shsSecret) {
    res.status(403).json({ error: "Invalid bearer token" });
    return;
  }
  next();
}

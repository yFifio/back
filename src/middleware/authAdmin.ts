import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthAdminRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
}

export const authAdminMiddleware = (req: AuthAdminRequest, res: Response, next: NextFunction) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: number; isAdmin?: boolean };
    req.userId = decoded.id;
    req.isAdmin = Boolean(decoded.isAdmin);

    if (!req.isAdmin) return res.status(403).json({ error: 'Acesso negado' });
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};
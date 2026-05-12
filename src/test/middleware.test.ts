import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth';
import { authAdminMiddleware } from '../middleware/authAdmin';

type TestResponse = Response & { status: Mock; json: Mock };

const makeRes = (): TestResponse => ({ status: vi.fn().mockReturnThis(), json: vi.fn() } as TestResponse);
const makeNext = (): NextFunction => vi.fn() as unknown as NextFunction;

const makeReq = (headers: Record<string, string> = {}): Request =>
  ({ headers } as unknown as Request);

describe('authMiddleware', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('retorna 401 quando não há token', () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();
    authMiddleware(req as any, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token não fornecido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('retorna 401 com token inválido', () => {
    const req = makeReq({ authorization: 'Bearer invalid.token.here' });
    const res = makeRes();
    const next = makeNext();
    authMiddleware(req as any, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido ou expirado' });
  });

  it('define userId e isAdmin e chama next com token válido', () => {
    const secret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign({ id: 42, isAdmin: false }, secret, { expiresIn: '1h' });
    const req = makeReq({ authorization: `Bearer ${token}` }) as any;
    const res = makeRes();
    const next = makeNext();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe(42);
    expect(req.isAdmin).toBe(false);
  });

  it('define isAdmin=true para token de admin', () => {
    const secret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign({ id: 1, isAdmin: true }, secret, { expiresIn: '1h' });
    const req = makeReq({ authorization: `Bearer ${token}` }) as any;
    const res = makeRes();
    const next = makeNext();
    authMiddleware(req, res, next);
    expect(req.isAdmin).toBe(true);
    expect(next).toHaveBeenCalled();
  });
});

describe('authAdminMiddleware', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('retorna 401 quando não há token', () => {
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();
    authAdminMiddleware(req as any, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token não fornecido' });
  });

  it('retorna 401 com token inválido', () => {
    const req = makeReq({ authorization: 'Bearer badtoken' });
    const res = makeRes();
    const next = makeNext();
    authAdminMiddleware(req as any, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido ou expirado' });
  });

  it('retorna 403 quando usuário não é admin', () => {
    const secret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign({ id: 5, isAdmin: false }, secret, { expiresIn: '1h' });
    const req = makeReq({ authorization: `Bearer ${token}` }) as any;
    const res = makeRes();
    const next = makeNext();
    authAdminMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('chama next quando usuário é admin com token válido', () => {
    const secret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign({ id: 1, isAdmin: true }, secret, { expiresIn: '1h' });
    const req = makeReq({ authorization: `Bearer ${token}` }) as any;
    const res = makeRes();
    const next = makeNext();
    authAdminMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.isAdmin).toBe(true);
  });
});

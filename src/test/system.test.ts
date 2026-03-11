import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { SystemController } from '../controllers/SystemController';
import { Request, Response } from 'express';
import { System } from '../models/System';

type TestRequest = Partial<Request> & {
  body?: { name?: string; type?: string };
  params?: { id?: string };
  query?: { type?: string };
};

type TestResponse = Response & { status: Mock; json: Mock };

interface SystemLike {
  id: number;
  name: string;
  save: Mock;
}

const makeReq = (data: TestRequest): Request => data as Request;
const makeRes = (): TestResponse => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
} as TestResponse);

vi.mock('../models/System', () => {
  const findAll = vi.fn();
  const create = vi.fn();
  const findByPk = vi.fn();
  const destroy = vi.fn();
  return { System: { findAll, create, findByPk, destroy } };
});

describe('SystemController', () => {
  const ctrl = new SystemController();
  beforeEach(() => vi.resetAllMocks());

  it('lista todos quando não informo type', async () => {
    (System.findAll as Mock).mockResolvedValueOnce([{ id: 1, name: 'X', type: 'A' }]);
    const req = makeReq({ query: {} });
    const res = makeRes();
    await ctrl.list(req, res);
    expect(System.findAll).toHaveBeenCalledWith({ where: {} });
    expect(res.json).toHaveBeenCalledWith([{ id: 1, name: 'X', type: 'A' }]);
  });

  it('filtra por type quando fornecido', async () => {
    (System.findAll as Mock).mockResolvedValueOnce([]);
    const req = makeReq({ query: { type: 'B' } });
    const res = makeRes();
    await ctrl.list(req, res);
    expect(System.findAll).toHaveBeenCalledWith({ where: { type: 'B' } });
  });

  it('retorna erro em exceção no list', async () => {
    (System.findAll as Mock).mockRejectedValueOnce(new Error('boom'));
    const res = makeRes();
    await ctrl.list(makeReq({ query: {} }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao listar sistemas' });
  });

  it('cria novo sistema com dados válidos', async () => {
    (System.create as Mock).mockResolvedValueOnce({ id: 10, name: 'Teste', type: 'C' });
    const req = makeReq({ body: { name: 'Teste', type: 'C' } });
    const res = makeRes();
    await ctrl.create(req, res);
    expect(System.create).toHaveBeenCalledWith({ name: 'Teste', type: 'C' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 10, name: 'Teste', type: 'C' });
  });

  it('recusa criação com dados invalidos', async () => {
    const res = makeRes();
    await ctrl.create(makeReq({ body: { name: '', type: 'X' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('atualiza sistema existente', async () => {
    const sysObj: SystemLike = { id: 5, name: 'Old', save: vi.fn() };
    (System.findByPk as Mock).mockResolvedValueOnce(sysObj).mockResolvedValueOnce(sysObj);
    const req = makeReq({ params: { id: '5' }, body: { name: 'Novo' } });
    const res = makeRes();
    await ctrl.update(req, res);
    expect(sysObj.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(sysObj);
  });

  it('retorna 404 se não encontrado para update', async () => {
    (System.findByPk as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.update(makeReq({ params: { id: '1' }, body: { name: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deleta sistema existente', async () => {
    (System.destroy as Mock).mockResolvedValueOnce(1);
    const req = makeReq({ params: { id: '8' } });
    const res = makeRes();
    await ctrl.delete(req, res);
    expect(System.destroy).toHaveBeenCalledWith({ where: { id: '8' } });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('retorna 404 se não existe ao deletar', async () => {
    (System.destroy as Mock).mockResolvedValueOnce(0);
    const res = makeRes();
    await ctrl.delete(makeReq({ params: { id: '9' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

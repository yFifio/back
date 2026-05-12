import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { SupplierController } from '../controllers/SupplierController';
import { Request, Response } from 'express';
import { Supplier } from '../models/Supplier';

type TestRequest = Partial<Request> & {
  body?: { name?: string; email?: string };
  params?: { id?: string };
  query?: Record<string, string>;
};

type TestResponse = Response & { status: Mock; json: Mock };

interface SupplierLike {
  id: number;
  name: string;
  email?: string;
  save: Mock;
}

const makeReq = (data: TestRequest): Request => data as Request;
const makeRes = (): TestResponse => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
} as TestResponse);

vi.mock('../models/Supplier', () => {
  const findAndCountAll = vi.fn();
  const create = vi.fn();
  const findByPk = vi.fn();
  const destroy = vi.fn();
  return { Supplier: { findAndCountAll, create, findByPk, destroy } };
});

describe('SupplierController', () => {
  const ctrl = new SupplierController();
  beforeEach(() => vi.resetAllMocks());

  it('lista fornecedores', async () => {
    (Supplier.findAndCountAll as Mock).mockResolvedValueOnce({ count: 1, rows: [{ id: 1, name: 'X' }] });
    const res = makeRes();
    await ctrl.list(makeReq({}), res);
    expect(Supplier.findAndCountAll).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ data: [{ id: 1, name: 'X' }], total: 1, limit: 10, offset: 0 });
  });

  it('cria fornecedor valido', async () => {
    (Supplier.create as Mock).mockResolvedValueOnce({ id: 2, name: 'Y' });
    const res = makeRes();
    await ctrl.create(makeReq({ body: { name: 'Y' } }), res);
    expect(Supplier.create).toHaveBeenCalledWith({ name: 'Y', email: undefined });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('recusa criação sem nome', async () => {
    const res = makeRes();
    await ctrl.create(makeReq({ body: { name: '' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('atualiza existente', async () => {
    const item: SupplierLike = { id: 3, name: 'old', save: vi.fn() };
    (Supplier.findByPk as Mock).mockResolvedValueOnce(item);
    const res = makeRes();
    await ctrl.update(makeReq({ params: { id: '3' }, body: { name: 'new' } }), res);
    expect(item.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(item);
  });

  it('busca fornecedor por id', async () => {
    (Supplier.findByPk as Mock).mockResolvedValueOnce({ id: 9, name: 'Fornecedor X' });
    const res = makeRes();
    await ctrl.getById(makeReq({ params: { id: '9' } }), res);
    expect(Supplier.findByPk).toHaveBeenCalledWith('9');
    expect(res.json).toHaveBeenCalledWith({ id: 9, name: 'Fornecedor X' });
  });

  it('retorna 404 no getById quando não existe', async () => {
    (Supplier.findByPk as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.getById(makeReq({ params: { id: '99' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('404 update se não existe', async () => {
    (Supplier.findByPk as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.update(makeReq({ params: { id: '5' }, body: { name: 'a' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deleta com sucesso', async () => {
    (Supplier.destroy as Mock).mockResolvedValueOnce(1);
    const res = makeRes();
    await ctrl.delete(makeReq({ params: { id: '7' } }), res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('404 delete se não existe', async () => {
    (Supplier.destroy as Mock).mockResolvedValueOnce(0);
    const res = makeRes();
    await ctrl.delete(makeReq({ params: { id: '8' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

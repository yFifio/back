import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { ProductController } from '../controllers/ProductController';
import { Request, Response } from 'express';
import { Product } from '../models/Produtos';
import sequelize from '../config/database';

type TestRequest = Partial<Request> & {
  body?: Record<string, unknown>;
  params?: { id?: string };
  query?: { page?: string; limit?: string };
};
type TestResponse = Response & { status: Mock; json: Mock };

const makeReq = (data: TestRequest): Request => data as Request;
const makeRes = (): TestResponse => ({ status: vi.fn().mockReturnThis(), json: vi.fn() } as TestResponse);

vi.mock('../models/Produtos', () => {
  const findByPk = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const destroy = vi.fn();
  return { Product: { findByPk, create, update, destroy } };
});

vi.mock('../config/database', () => ({
  default: { query: vi.fn() },
}));

describe('ProductController', () => {
  const ctrl = new ProductController();

  beforeEach(() => vi.resetAllMocks());

  // list
  it('list retorna produtos paginados', async () => {
    (sequelize.query as Mock)
      .mockResolvedValueOnce([{ id: 1, name: 'Book' }])
      .mockResolvedValueOnce([{ total: 1 }]);
    const res = makeRes();
    await ctrl.list(makeReq({ query: { page: '1', limit: '10' } }), res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ id: 1, name: 'Book' }], total: 1, page: 1 })
    );
  });

  it('list retorna 500 em exceção', async () => {
    (sequelize.query as Mock).mockRejectedValueOnce(new Error('db fail'));
    const res = makeRes();
    await ctrl.list(makeReq({ query: {} }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao listar produtos' });
  });

  it('list calcula totalPages corretamente', async () => {
    (sequelize.query as Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 25 }]);
    const res = makeRes();
    await ctrl.list(makeReq({ query: { page: '2', limit: '10' } }), res);
    const json = (res.json as Mock).mock.calls[0][0];
    expect(json.totalPages).toBe(3);
    expect(json.page).toBe(2);
  });

  // getById
  it('getById retorna produto existente', async () => {
    (Product.findByPk as Mock).mockResolvedValueOnce({ id: 1, name: 'Test' });
    const res = makeRes();
    await ctrl.getById(makeReq({ params: { id: '1' } }), res);
    expect(res.json).toHaveBeenCalledWith({ id: 1, name: 'Test' });
  });

  it('getById retorna 404 quando não existe', async () => {
    (Product.findByPk as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.getById(makeReq({ params: { id: '99' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Produto não encontrado' });
  });

  it('getById retorna 500 em exceção', async () => {
    (Product.findByPk as Mock).mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await ctrl.getById(makeReq({ params: { id: '1' } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao buscar produto' });
  });

  // create
  it('create cria produto com sucesso', async () => {
    (Product.create as Mock).mockResolvedValueOnce({ id: 5, name: 'Novo' });
    const res = makeRes();
    await ctrl.create(makeReq({ body: { name: 'Novo', price: 10 } }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 5, name: 'Novo' });
  });

  it('create retorna 500 em exceção', async () => {
    (Product.create as Mock).mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await ctrl.create(makeReq({ body: { name: 'X' } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao criar produto' });
  });

  // update
  it('update atualiza produto com sucesso', async () => {
    (Product.update as Mock).mockResolvedValueOnce([1]);
    const res = makeRes();
    await ctrl.update(makeReq({ params: { id: '1' }, body: { name: 'Updated' } }), res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('update retorna 404 quando produto não encontrado', async () => {
    (Product.update as Mock).mockResolvedValueOnce([0]);
    const res = makeRes();
    await ctrl.update(makeReq({ params: { id: '99' }, body: { name: 'X' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Produto não encontrado' });
  });

  it('update retorna 500 em exceção', async () => {
    (Product.update as Mock).mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await ctrl.update(makeReq({ params: { id: '1' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao atualizar produto' });
  });

  // delete
  it('delete exclui produto com sucesso', async () => {
    (Product.destroy as Mock).mockResolvedValueOnce(1);
    const res = makeRes();
    await ctrl.delete(makeReq({ params: { id: '1' } }), res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('delete retorna 404 quando produto não existe', async () => {
    (Product.destroy as Mock).mockResolvedValueOnce(0);
    const res = makeRes();
    await ctrl.delete(makeReq({ params: { id: '99' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Produto não encontrado' });
  });

  it('delete retorna 500 em exceção', async () => {
    (Product.destroy as Mock).mockRejectedValueOnce(new Error('fail'));
    const res = makeRes();
    await ctrl.delete(makeReq({ params: { id: '1' } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao deletar produto' });
  });
});

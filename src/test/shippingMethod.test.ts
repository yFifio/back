import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { ShippingMethodController } from '../controllers/ShippingMethodController';
import { Request, Response } from 'express';
import { ShippingMethod } from '../models/ShippingMethod';

type TestRequest = Partial<Request> & {
  body?: { name?: string; price?: number };
  params?: { id?: string };
};

type TestResponse = Response & { status: Mock; json: Mock };

interface ShippingMethodLike {
  id: number;
  name: string;
  price: number;
  save: Mock;
}

const makeReq = (data: TestRequest): Request => data as Request;
const makeRes = (): TestResponse => ({ status: vi.fn().mockReturnThis(), json: vi.fn() } as TestResponse);

vi.mock('../models/ShippingMethod', () => {
  const findAndCountAll = vi.fn();
  const create = vi.fn();
  const findByPk = vi.fn();
  const destroy = vi.fn();
  return { ShippingMethod: { findAndCountAll, create, findByPk, destroy } };
});

describe('ShippingMethodController', () => {
  const ctrl = new ShippingMethodController();
  beforeEach(() => vi.resetAllMocks());

  it('lista metodos', async () => {
    (ShippingMethod.findAndCountAll as Mock).mockResolvedValueOnce({ count: 1, rows: [{ id:1, name:'x', price:0 }] });
    const res = makeRes();
    await ctrl.list(makeReq({}), res);
    expect(ShippingMethod.findAndCountAll).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ data: [{ id:1, name:'x', price:0 }], total: 1, limit: 10, offset: 0 });
  });

  it('cria valido', async () => {
    (ShippingMethod.create as Mock).mockResolvedValueOnce({ id:2, name:'y', price:10 });
    const res = makeRes();
    await ctrl.create(makeReq({ body:{ name:'y', price:10 } }), res);
    expect(ShippingMethod.create).toHaveBeenCalledWith({ name:'y', price:10 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('atualiza existente', async () => {
    const item: ShippingMethodLike = { id:3, name:'old', price:5, save: vi.fn() };
    (ShippingMethod.findByPk as Mock).mockResolvedValueOnce(item);
    const res = makeRes();
    await ctrl.update(makeReq({ params:{id:'3'}, body:{ name:'new', price:7 } }), res);
    expect(item.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(item);
  });

  it('busca método por id', async () => {
    (ShippingMethod.findByPk as Mock).mockResolvedValueOnce({ id: 4, name: 'Express', price: 20 });
    const res = makeRes();
    await ctrl.getById(makeReq({ params: { id: '4' } }), res);
    expect(ShippingMethod.findByPk).toHaveBeenCalledWith('4');
    expect(res.json).toHaveBeenCalledWith({ id: 4, name: 'Express', price: 20 });
  });

  it('retorna 404 no getById quando método não existe', async () => {
    (ShippingMethod.findByPk as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.getById(makeReq({ params: { id: '88' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('delete 404 se nao', async () => {
    (ShippingMethod.destroy as Mock).mockResolvedValueOnce(0);
    const res = makeRes();
    await ctrl.delete(makeReq({ params:{id:'5'} }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

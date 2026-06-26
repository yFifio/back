import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { OrderController } from '../controllers/OrderController';
import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { User } from '../models/User';
import { Coupon } from '../models/Coupon';
import { Request, Response } from 'express';

type TestRequest = Partial<Request> & {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  userId?: number;
  isAdmin?: boolean;
};

type TestResponse = Response & { status: Mock; json: Mock };

const makeReq = (data: TestRequest): Request => data as Request;
const makeRes = (): TestResponse => ({ status: vi.fn().mockReturnThis(), json: vi.fn() } as TestResponse);

vi.mock('../models/Order', () => {
  const create = vi.fn();
  const findByPk = vi.fn();
  const findAll = vi.fn();
  const max = vi.fn();
  return { Order: { create, findByPk, findAll, max } };
});

vi.mock('../models/OrderItem', () => ({
  OrderItem: { create: vi.fn() },
}));

vi.mock('../models/User', () => ({
  User: { findByPk: vi.fn() },
}));

vi.mock('../models/Coupon', () => ({
  Coupon: { findOne: vi.fn() },
}));

describe('OrderController', () => {
  let orderCtrl: OrderController;

  beforeEach(() => {
    vi.resetAllMocks();
    orderCtrl = new OrderController();
  });

  it('create returns 401 for unauthenticated user', async () => {
    const req = makeReq({
      body: { items: [{ productId: 1, productName: 'x', price: 10, quantity: 1 }], customerEmail: 'a', customerName: 'b', customerCpf: '123', totalPrice: 10 },
    });
    const res = makeRes();

    await orderCtrl.create(req as any, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não autenticado' });
  });

  it('create returns illustrative payment payload and marks order paid', async () => {
    const order = { id: 5, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
    (Order.create as Mock).mockResolvedValue(order);
    (OrderItem.create as Mock).mockResolvedValue({});

    const req = makeReq({
      userId: 1,
      body: {
        items: [{ productId: 1, productName: 'Livro', price: 10, quantity: 1 }],
        customerEmail: 'cliente@teste.com',
        customerName: 'Cliente',
        customerCpf: '52998224725',
        totalPrice: 10,
      },
    });
    const res = makeRes();

    await orderCtrl.create(req as any, res);

    expect(order.update).toHaveBeenCalledWith({ status: 'paid' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 5,
      mode: 'illustrative',
      init_point: null,
      preference_id: null,
    }));
  });

  it('list restricts non-admin to own orders', async () => {
    (User.findByPk as Mock).mockResolvedValue({ id: 7, isAdmin: false });
    (Order.findAll as Mock).mockResolvedValue([]);
    const req = makeReq({ query: {}, userId: 7, isAdmin: false });
    const res = makeRes();

    await orderCtrl.list(req as any, res);

    expect(Order.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { customer_id: '7' } }));
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('list allows admin to view all orders', async () => {
    (User.findByPk as Mock).mockResolvedValue({ id: 1, isAdmin: true });
    (Order.findAll as Mock).mockResolvedValue([]);
    const req = makeReq({ query: {}, userId: 1, isAdmin: true });
    const res = makeRes();

    await orderCtrl.list(req as any, res);

    expect(Order.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('markPaid allows only admins to mark paid', async () => {
    const order = { id: 5, customer_id: 1, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
    (Order.findByPk as Mock).mockResolvedValue(order);

    const nonAdminRes = makeRes();
    await orderCtrl.markPaid(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }) as any, nonAdminRes);
    expect(nonAdminRes.status).toHaveBeenCalledWith(403);

    const adminRes = makeRes();
    await orderCtrl.markPaid(makeReq({ params: { id: '5' }, userId: 99, isAdmin: true }) as any, adminRes);
    expect(order.update).toHaveBeenCalledWith({ status: 'paid' });
    expect(adminRes.json).toHaveBeenCalledWith({ success: true });
  });

  it('syncPaymentStatus returns paid message when already paid', async () => {
    (Order.findByPk as Mock).mockResolvedValue({ id: 5, customer_id: 1, status: 'paid' });
    const res = makeRes();

    await orderCtrl.syncPaymentStatus(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }) as any, res);

    expect(res.json).toHaveBeenCalledWith({ status: 'paid', message: 'Pedido já foi marcado como pago' });
  });

  it('syncPaymentStatus returns pending sync-disabled message when pending', async () => {
    (Order.findByPk as Mock).mockResolvedValue({ id: 5, customer_id: 1, status: 'pending' });
    const res = makeRes();

    await orderCtrl.syncPaymentStatus(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }) as any, res);

    expect(res.json).toHaveBeenCalledWith({
      status: 'pending',
      message: 'Sincronização de pagamento desativada (modo ilustrativo)',
    });
  });

  it('create returns 500 when coupon is invalid', async () => {
    (Coupon.findOne as Mock).mockResolvedValue(null);
    const req = makeReq({
      userId: 1,
      body: {
        items: [{ productId: 1, productName: 'Livro', price: 10, quantity: 1 }],
        customerEmail: 'cliente@teste.com',
        customerName: 'Cliente',
        customerCpf: '52998224725',
        totalPrice: 10,
        couponCode: 'INVALID',
      },
    });
    const res = makeRes();

    await orderCtrl.create(req as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Cupom inválido') }));
  });
});

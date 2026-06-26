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

vi.mock('../models/Order', () => ({
  Order: { create: vi.fn(), findByPk: vi.fn(), findAll: vi.fn(), max: vi.fn() },
}));
vi.mock('../models/OrderItem', () => ({
  OrderItem: { create: vi.fn() },
}));
vi.mock('../models/User', () => ({
  User: { findByPk: vi.fn() },
}));
vi.mock('../models/Coupon', () => ({
  Coupon: { findOne: vi.fn() },
}));

describe('OrderController - markPaid', () => {
  let ctrl: OrderController;
  beforeEach(() => { vi.resetAllMocks(); ctrl = new OrderController(); });

  it('retorna 404 quando pedido não encontrado', async () => {
    (Order.findByPk as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.markPaid(makeReq({ params: { id: '1' }, userId: 1 }) as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 403 quando usuário não tem acesso ao pedido', async () => {
    const order = { id: 5, customer_id: 99, status: 'pending', update: vi.fn() };
    (Order.findByPk as Mock).mockResolvedValueOnce(order);
    const res = makeRes();
    await ctrl.markPaid(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }) as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado' });
  });

  it('retorna 403 quando dono do pedido não é admin', async () => {
    const order = { id: 5, customer_id: 1, status: 'pending', update: vi.fn() };
    (Order.findByPk as Mock).mockResolvedValueOnce(order);
    const res = makeRes();
    await ctrl.markPaid(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }) as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Apenas administradores podem marcar pedidos como pagos' });
  });

  it('admin pode marcar como pago', async () => {
    const order = { id: 7, customer_id: 2, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
    (Order.findByPk as Mock).mockResolvedValueOnce(order);
    const res = makeRes();
    await ctrl.markPaid(makeReq({ params: { id: '7' }, userId: 1, isAdmin: true }) as any, res);
    expect(order.update).toHaveBeenCalledWith({ status: 'paid' });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});

describe('OrderController - updateStatus', () => {
  let ctrl: OrderController;
  beforeEach(() => { vi.resetAllMocks(); ctrl = new OrderController(); });

  it('retorna 403 quando usuário não é admin', async () => {
    (User.findByPk as Mock).mockResolvedValueOnce({ id: 1, isAdmin: false });
    const res = makeRes();
    await ctrl.updateStatus(makeReq({ params: { id: '1' }, body: { status: 'shipped' }, userId: 1, isAdmin: false }) as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 400 para status inválido', async () => {
    (User.findByPk as Mock).mockResolvedValueOnce({ id: 1, isAdmin: true });
    const res = makeRes();
    await ctrl.updateStatus(makeReq({ params: { id: '1' }, body: { status: 'invalid' }, userId: 1, isAdmin: true }) as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('atualiza status com sucesso para status válido', async () => {
    (User.findByPk as Mock).mockResolvedValueOnce({ id: 1, isAdmin: true });
    const order = { id: 10, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
    (Order.findByPk as Mock).mockResolvedValueOnce(order);
    const res = makeRes();
    await ctrl.updateStatus(makeReq({ params: { id: '10' }, body: { status: 'shipped' }, userId: 1, isAdmin: true }) as any, res);
    expect(order.update).toHaveBeenCalledWith({ status: 'shipped' });
    expect(res.json).toHaveBeenCalledWith({ success: true, orderId: 10, status: 'shipped' });
  });
});

describe('OrderController - syncPaymentStatus', () => {
  let ctrl: OrderController;
  beforeEach(() => { vi.resetAllMocks(); ctrl = new OrderController(); });

  it('retorna 404 quando pedido não existe', async () => {
    (Order.findByPk as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.syncPaymentStatus(makeReq({ params: { id: '99' }, userId: 1, isAdmin: true }) as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 403 quando usuário não tem acesso', async () => {
    const order = { id: 5, customer_id: 99, status: 'pending' };
    (Order.findByPk as Mock).mockResolvedValueOnce(order);
    const res = makeRes();
    await ctrl.syncPaymentStatus(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }) as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna mensagem de já pago quando status é paid', async () => {
    const order = { id: 5, customer_id: 1, status: 'paid' };
    (Order.findByPk as Mock).mockResolvedValueOnce(order);
    const res = makeRes();
    await ctrl.syncPaymentStatus(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }) as any, res);
    expect(res.json).toHaveBeenCalledWith({ status: 'paid', message: 'Pedido já foi marcado como pago' });
  });

  it('retorna mensagem de sincronização desativada para pending', async () => {
    const order = { id: 5, customer_id: 1, status: 'pending' };
    (Order.findByPk as Mock).mockResolvedValueOnce(order);
    const res = makeRes();
    await ctrl.syncPaymentStatus(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }) as any, res);
    expect(res.json).toHaveBeenCalledWith({
      status: 'pending',
      message: 'Sincronização de pagamento desativada (modo ilustrativo)',
    });
  });
});

describe('OrderController - create/list extra', () => {
  let ctrl: OrderController;
  beforeEach(() => { vi.resetAllMocks(); ctrl = new OrderController(); });

  it('retorna 400 para pedido vazio', async () => {
    const res = makeRes();
    await ctrl.create(makeReq({ userId: 1, body: { items: [] } }) as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('cria pedido com cupom válido', async () => {
    (Coupon.findOne as Mock).mockResolvedValueOnce({ code: 'SAVE10', discount: 10 });
    const order = { id: 20, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
    (Order.create as Mock).mockResolvedValueOnce(order);
    (OrderItem.create as Mock).mockResolvedValue({});

    const res = makeRes();
    await ctrl.create(makeReq({
      userId: 1,
      body: {
        items: [{ productId: 1, productName: 'Livro', price: 20, quantity: 1 }],
        customerEmail: 'c@d.com',
        customerName: 'User',
        customerCpf: '52998224725',
        couponCode: 'save10',
      },
    }) as any, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ orderId: 20, mode: 'illustrative' }));
  });

  it('list retorna 401 quando usuário não encontrado', async () => {
    (User.findByPk as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.list(makeReq({ query: {}, userId: 1 }) as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

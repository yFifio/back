import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { Request, Response } from 'express';
import { PaymentNotificationController } from '../controllers/PaymentNotificationController';
import { Order } from '../models/Order';

type TestRequest = Partial<Request> & {
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  params?: Record<string, string>;
  userId?: number;
  isAdmin?: boolean;
};

type TestResponse = Response & {
  status: Mock;
  json: Mock;
  sendStatus: Mock;
};

const makeReq = (data: TestRequest): Request => data as Request;
const makeRes = (): TestResponse => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
  sendStatus: vi.fn(),
} as TestResponse);

vi.mock('../models/Order', () => ({
  Order: { findByPk: vi.fn() },
}));

describe('PaymentNotificationController - handleNotification', () => {
  let controller: PaymentNotificationController;

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new PaymentNotificationController();
  });

  it('sempre responde 200 para qualquer payload', async () => {
    const req = makeReq({ body: { topic: 'payment', data: { id: '123' } }, query: {} });
    const res = makeRes();

    await controller.handleNotification(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it('responde 200 mesmo com payload vazio', async () => {
    const req = makeReq({ body: {}, query: {} });
    const res = makeRes();

    await controller.handleNotification(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });
});

describe('PaymentNotificationController - getPaymentStatus', () => {
  let controller: PaymentNotificationController;

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new PaymentNotificationController();
  });

  it('retorna 404 quando pedido não existe', async () => {
    (Order.findByPk as Mock).mockResolvedValueOnce(null);
    const req = makeReq({ params: { id: '99' }, userId: 1, isAdmin: true });
    const res = makeRes();

    await controller.getPaymentStatus(req as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Pedido não encontrado' });
  });

  it('retorna 403 quando usuário não tem acesso', async () => {
    (Order.findByPk as Mock).mockResolvedValueOnce({ id: 5, customer_id: 99, status: 'pending' });
    const req = makeReq({ params: { id: '5' }, userId: 1, isAdmin: false });
    const res = makeRes();

    await controller.getPaymentStatus(req as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado' });
  });

  it('retorna status do pedido quando autorizado', async () => {
    (Order.findByPk as Mock).mockResolvedValueOnce({ id: 30, customer_id: 1, status: 'paid' });
    const req = makeReq({ params: { id: '30' }, userId: 1, isAdmin: false });
    const res = makeRes();

    await controller.getPaymentStatus(req as any, res);

    expect(res.json).toHaveBeenCalledWith({ order_id: 30, order_status: 'paid' });
  });

  it('retorna 500 em exceção', async () => {
    (Order.findByPk as Mock).mockRejectedValueOnce(new Error('db error'));
    const req = makeReq({ params: { id: '1' }, userId: 1, isAdmin: true });
    const res = makeRes();

    await controller.getPaymentStatus(req as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao buscar status do pagamento' });
  });
});

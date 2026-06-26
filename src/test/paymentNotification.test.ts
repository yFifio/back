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

vi.mock('../models/Order', () => {
  const findByPk = vi.fn();
  return { Order: { findByPk } };
});

describe('PaymentNotificationController', () => {
  let controller: PaymentNotificationController;

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new PaymentNotificationController();
  });

  it('handleNotification returns 200 status', async () => {
    const req = makeReq({ body: {}, query: {} });
    const res = makeRes();

    await controller.handleNotification(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it('getPaymentStatus returns order status', async () => {
    const order = { id: 20, status: 'paid', customer_id: 1 };
    (Order.findByPk as Mock).mockResolvedValue(order);

    const req = makeReq({ params: { id: '20' }, userId: 1, isAdmin: false });
    const res = makeRes();

    await controller.getPaymentStatus(req as any, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      order_id: 20,
      order_status: 'paid',
    }));
  });

  it('getPaymentStatus returns 404 when order not found', async () => {
    (Order.findByPk as Mock).mockResolvedValue(null);

    const req = makeReq({ params: { id: '99' }, userId: 1, isAdmin: false });
    const res = makeRes();

    await controller.getPaymentStatus(req as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Pedido não encontrado' });
  });

  it('getPaymentStatus returns 403 when user tries to access order they do not own', async () => {
    const order = { id: 20, status: 'paid', customer_id: 2 }; // Different customer
    (Order.findByPk as Mock).mockResolvedValue(order);

    const req = makeReq({ params: { id: '20' }, userId: 1, isAdmin: false });
    const res = makeRes();

    await controller.getPaymentStatus(req as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado' });
  });
});

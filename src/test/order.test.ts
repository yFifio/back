import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { OrderController } from '../controllers/OrderController';
import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { Request, Response } from 'express';

interface CorpoPedido {
  items: Array<{ productId: number; productName: string; price: number; quantity: number }>;
  customerEmail: string;
  customerName: string;
  customerCpf: string;
  totalPrice: number;
}

interface PreferenceBody {
  items: object[];
  payer: object;
  back_urls: object;
  external_reference: string;
}

type MethodArg = string | number | boolean | object | null | undefined;

interface PrivateOrderMethods {
  salvarPedido: (...args: MethodArg[]) => Promise<{ id: number }>;
  salvarItens: (...args: MethodArg[]) => Promise<void>;
  gerarPagamento: (order: { id: number }, body: CorpoPedido) => Promise<{ orderId: number; mode?: string }>;
  montarUrlsRetorno: (orderId: number) => { success: string; failure: string; pending: string; };
  montarCorpoPreferencia: (...args: MethodArg[]) => PreferenceBody;
}

type TestRequest = Partial<Request> & {
  body?: CorpoPedido;
  params?: Record<string, string>;
  query?: Record<string, string>;
};

type TestResponse = Response & { status: Mock; json: Mock };

const makeReq = (data: TestRequest): Request => data as Request;
const makeRes = (): TestResponse => ({ status: vi.fn().mockReturnThis(), json: vi.fn() } as TestResponse);

vi.mock('../models/Order', () => {
  const create = vi.fn();
  const findByPk = vi.fn();
  return { Order: { create, findByPk } };
});

vi.mock('../models/OrderItem', () => {
  const create = vi.fn();
  return { OrderItem: { create } };
});

describe('OrderController', () => {
  let orderCtrl: OrderController;
  let orderCtrlPrivate: PrivateOrderMethods;

  beforeEach(() => {
    vi.resetAllMocks();
    orderCtrl = new OrderController();
    orderCtrlPrivate = orderCtrl as object as PrivateOrderMethods;
  });

  it('should return 500 when mercado pago fails during pagamento', async () => {
    vi.spyOn(orderCtrlPrivate, 'salvarPedido').mockResolvedValue({ id: 42 });
    vi.spyOn(orderCtrlPrivate, 'salvarItens').mockResolvedValue(undefined);
    vi.spyOn(orderCtrlPrivate, 'gerarPagamento').mockRejectedValue(new Error('MP down'));

    const req = makeReq({
      body: { items: [{ productId: 1, productName: 'x', price: 10, quantity: 1 }], customerEmail: 'a', customerName: 'b', customerCpf: '12345678901', totalPrice: 10 },
    });
    const res = makeRes();

    await orderCtrl.create(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao processar pedido: MP down' });
  });

  it('should create mock preference when token missing', async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = '';
    vi.spyOn(orderCtrlPrivate, 'salvarPedido').mockResolvedValue({ id: 5 });
    vi.spyOn(orderCtrlPrivate, 'salvarItens').mockResolvedValue(undefined);

    const req = makeReq({
      body: { items: [{ productId: 1, productName: 'x', price: 10, quantity: 1 }], customerEmail: 'a', customerName: 'b', customerCpf: '12345678901', totalPrice: 10 },
    });
    const res = makeRes();

    await orderCtrl.create(req, res);
    const response = (res.json as Mock).mock.calls[0][0];
    expect(response.orderId).toBe(5);
    expect(response.mode).toBe('mock');
  });

  it('montarUrlsRetorno produces a valid object even with empty FRONT_URL', () => {
    delete process.env.FRONT_URL;
    const urls = orderCtrlPrivate.montarUrlsRetorno(99);
    expect(urls).toEqual({
      success: 'http://localhost:3000/order-success?order_id=99',
      failure: 'http://localhost:3000/checkout',
      pending: 'http://localhost:3000/checkout',
    });

    process.env.FRONT_URL = ' example.com/ ';
    const urls2 = orderCtrlPrivate.montarUrlsRetorno(5);
    expect(urls2.success).toBe('http://example.com/order-success?order_id=5');
  });

  it('passes correct structure directly to preference.create', async () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'dummy';
    const fakeBody = { items: [], payer: {}, back_urls: {}, external_reference: '1' };
    const prefSpy = vi.spyOn(orderCtrlPrivate, 'montarCorpoPreferencia').mockReturnValue(fakeBody);

    const mercadopago = await import('mercadopago');
    const preferenceResponse = {
      id: 'pref-1',
      init_point: 'http://localhost/test',
      api_response: { status: 201, headers: ['content-type', ['application/json']], body: {} },
    } as Awaited<ReturnType<typeof mercadopago.Preference.prototype.create>>;
    const createSpy = vi.spyOn(mercadopago.Preference.prototype, 'create')
                          .mockResolvedValue(preferenceResponse);

    await orderCtrlPrivate.gerarPagamento(
      { id: 77 },
      { items: [], customerEmail: '', customerName: '', customerCpf: '', totalPrice: 0 },
    );

    expect(prefSpy).toHaveBeenCalled();
    expect(createSpy).toHaveBeenCalledWith({ body: fakeBody });
  });

  it('salvarItens should use the supplied order id when creating items', async () => {
    const fakeOrderId = 123;
    const items = [{ productId: 2, productName: 'foo', price: 5, quantity: 2 }];
    const createSpy = vi.spyOn(OrderItem, 'create');

    await orderCtrlPrivate.salvarItens(fakeOrderId, items);

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ order_id: fakeOrderId }));
  });
});

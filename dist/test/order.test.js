import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderController } from '../controllers/OrderController';
import { OrderItem } from '../models/OrderItem';
// mocks para evitar acesso real ao banco ou MercadoPago
vi.mock('../models/Order', () => {
    const create = vi.fn();
    const findByPk = vi.fn();
    return { Order: { create, findByPk } };
});
vi.mock('../models/OrderItem', () => {
    const create = vi.fn();
    return { OrderItem: { create } };
});
// não precisamos mockar mercadopago porque vamos espiar o método gerarPagamento
describe('OrderController', () => {
    let orderCtrl;
    beforeEach(() => {
        vi.resetAllMocks();
        orderCtrl = new OrderController();
    });
    it('should return 500 when mercado pago fails during pagamento', async () => {
        // preparar spies nos métodos privados
        vi.spyOn(orderCtrl, 'salvarPedido').mockResolvedValue({ id: 42 });
        vi.spyOn(orderCtrl, 'salvarItens').mockResolvedValue(undefined);
        vi.spyOn(orderCtrl, 'gerarPagamento').mockRejectedValue(new Error('MP down'));
        const req = { body: { items: [{ productId: 1, productName: 'x', price: 10, quantity: 1 }], customerEmail: 'a', customerName: 'b', customerCpf: '12345678901', totalPrice: 10 } };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await orderCtrl.create(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao processar pedido: MP down' });
    });
    it('should create mock preference when token missing', async () => {
        process.env.MERCADOPAGO_ACCESS_TOKEN = '';
        vi.spyOn(orderCtrl, 'salvarPedido').mockResolvedValue({ id: 5 });
        vi.spyOn(orderCtrl, 'salvarItens').mockResolvedValue(undefined);
        // deixar gerarPagamento rodar normalmente (ele retornará mock)
        const req = { body: { items: [{ productId: 1, productName: 'x', price: 10, quantity: 1 }], customerEmail: 'a', customerName: 'b', customerCpf: '12345678901', totalPrice: 10 } };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await orderCtrl.create(req, res);
        const response = res.json.mock.calls[0][0];
        expect(response.orderId).toBe(5);
        expect(response.mode).toBe('mock');
    });
    it('montarUrlsRetorno produces a valid object even with empty FRONT_URL', () => {
        delete process.env.FRONT_URL;
        const urls = orderCtrl.montarUrlsRetorno(99);
        expect(urls).toEqual({
            success: 'http://localhost:3000/order-success?order_id=99',
            failure: 'http://localhost:3000/checkout',
            pending: 'http://localhost:3000/checkout',
        });
        process.env.FRONT_URL = ' example.com/ '; // whitespace and missing protocol
        const urls2 = orderCtrl.montarUrlsRetorno(5);
        expect(urls2.success).toBe('http://example.com/order-success?order_id=5');
    });
    it('passes correct structure directly to preference.create', async () => {
        process.env.MERCADOPAGO_ACCESS_TOKEN = 'dummy';
        const fakeBody = { items: [], payer: {}, back_urls: {}, external_reference: '1' };
        const prefSpy = vi.spyOn(orderCtrl, 'montarCorpoPreferencia').mockReturnValue(fakeBody);
        // stub MP create to avoid network
        const mercadopago = await import('mercadopago');
        const createSpy = vi.spyOn(mercadopago.Preference.prototype, 'create')
            // return a minimal object; cast to any to satisfy types
            .mockResolvedValue({});
        // call gerarPagamento directly, bypassing other controller logic
        await orderCtrl.gerarPagamento({ id: 77 }, { items: [], customerEmail: '', customerName: '', customerCpf: '', totalPrice: 0 });
        expect(prefSpy).toHaveBeenCalled();
        expect(createSpy).toHaveBeenCalledWith({ body: fakeBody });
    });
    it('salvarItens should use the supplied order id when creating items', async () => {
        const fakeOrderId = 123;
        const items = [{ productId: 2, productName: 'foo', price: 5, quantity: 2 }];
        const createSpy = vi.spyOn(OrderItem, 'create');
        await orderCtrl.salvarItens(fakeOrderId, items);
        expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ order_id: fakeOrderId }));
    });
});

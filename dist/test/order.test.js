import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderController } from '../controllers/OrderController';
import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { User } from '../models/User';
const makeReq = (data) => data;
const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
vi.mock('../models/Order', () => {
    const create = vi.fn();
    const findByPk = vi.fn();
    const findAll = vi.fn();
    return { Order: { create, findByPk, findAll } };
});
vi.mock('../models/OrderItem', () => {
    const create = vi.fn();
    return { OrderItem: { create } };
});
vi.mock('../models/User', () => {
    const findByPk = vi.fn();
    return { User: { findByPk } };
});
describe('OrderController', () => {
    let orderCtrl;
    let orderCtrlPrivate;
    beforeEach(() => {
        vi.resetAllMocks();
        orderCtrl = new OrderController();
        orderCtrlPrivate = orderCtrl;
    });
    it('should return 500 when mercado pago fails during pagamento', async () => {
        vi.spyOn(orderCtrlPrivate, 'salvarPedido').mockResolvedValue({ id: 42 });
        vi.spyOn(orderCtrlPrivate, 'salvarItens').mockResolvedValue(undefined);
        vi.spyOn(orderCtrlPrivate, 'gerarPagamento').mockRejectedValue(new Error('MP down'));
        const req = makeReq({
            userId: 1,
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
            userId: 1,
            body: { items: [{ productId: 1, productName: 'x', price: 10, quantity: 1 }], customerEmail: 'a', customerName: 'b', customerCpf: '12345678901', totalPrice: 10 },
        });
        const res = makeRes();
        await orderCtrl.create(req, res);
        const response = res.json.mock.calls[0][0];
        expect(response.orderId).toBe(5);
        expect(response.mode).toBe('mock');
    });
    it('montarUrlsRetorno produces a valid object even with empty FRONT_URL', () => {
        delete process.env.FRONT_URL;
        const urls = orderCtrlPrivate.montarUrlsRetorno(99);
        expect(urls).toEqual({
            success: 'http://localhost:3000/order-success?order_id=99',
            failure: 'http://localhost:3000/order-success?order_id=99',
            pending: 'http://localhost:3000/order-success?order_id=99',
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
        };
        const createSpy = vi.spyOn(mercadopago.Preference.prototype, 'create')
            .mockResolvedValue(preferenceResponse);
        await orderCtrlPrivate.gerarPagamento({ id: 77 }, { items: [], customerEmail: '', customerName: '', customerCpf: '', totalPrice: 0 });
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
    it('salvarPedido should persist delivery data and customer cpf', async () => {
        const createSpy = vi.spyOn(Order, 'create').mockResolvedValue({ id: 10 });
        await orderCtrlPrivate.salvarPedido({
            items: [{ productId: 1, productName: 'Livro', price: 30, quantity: 1 }],
            customerEmail: 'cliente@teste.com',
            customerName: 'Cliente',
            customerCpf: '52998224725',
            customerId: 2,
            totalPrice: 30,
            deliveryAddress: {
                address: 'Rua B, 456',
                city: 'Campinas',
                state: 'SP',
                zip: '13000-000',
                phone: '(19) 99999-9999',
            },
        }, { subtotal: 30, discountAmount: 0, finalTotal: 30, couponCode: null });
        expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
            customer_cpf: '52998224725',
            delivery_address: 'Rua B, 456',
            delivery_city: 'Campinas',
            delivery_state: 'SP',
            delivery_zip: '13000-000',
            delivery_phone: '(19) 99999-9999',
        }));
    });
    it('list should restrict non-admin users to their own orders', async () => {
        User.findByPk.mockResolvedValueOnce({ id: 7, isAdmin: false });
        const findAllSpy = vi.spyOn(Order, 'findAll').mockResolvedValue([]);
        const req = makeReq({ query: {}, userId: 7 });
        const res = makeRes();
        await orderCtrl.list(req, res);
        expect(findAllSpy).toHaveBeenCalledWith(expect.objectContaining({ where: { customer_id: '7' } }));
        expect(res.json).toHaveBeenCalledWith([]);
    });
    it('list should allow admin users to view all orders', async () => {
        User.findByPk.mockResolvedValueOnce({ id: 1, isAdmin: true });
        const findAllSpy = vi.spyOn(Order, 'findAll').mockResolvedValue([]);
        const req = makeReq({ query: {}, userId: 1 });
        const res = makeRes();
        await orderCtrl.list(req, res);
        expect(findAllSpy).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
        expect(res.json).toHaveBeenCalledWith([]);
    });
    it('list should allow admin token to view all orders even when DB flag is not admin', async () => {
        User.findByPk.mockResolvedValueOnce({ id: 1, isAdmin: false });
        const findAllSpy = vi.spyOn(Order, 'findAll').mockResolvedValue([]);
        const req = makeReq({ query: {}, userId: 1, isAdmin: true });
        const res = makeRes();
        await orderCtrl.list(req, res);
        expect(findAllSpy).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
        expect(res.json).toHaveBeenCalledWith([]);
    });
    it('syncPaymentStatus should mark order as paid when payment_id is approved', async () => {
        process.env.MERCADOPAGO_ACCESS_TOKEN = 'dummy';
        const order = { id: 33, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValue(order);
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: 'mp-123',
            status: 'approved',
            external_reference: '33',
        });
        const req = makeReq({ userId: 33, isAdmin: true, params: { id: '33' }, query: { payment_id: 'mp-123' } });
        const res = makeRes();
        await orderCtrl.syncPaymentStatus(req, res);
        expect(order.update).toHaveBeenCalledWith({ status: 'paid' });
        expect(res.json).toHaveBeenCalledWith({ status: 'paid', message: 'Pagamento sincronizado com sucesso' });
    });
    it('syncPaymentStatus accepts paymentId query key (camelCase)', async () => {
        process.env.MERCADOPAGO_ACCESS_TOKEN = 'dummy';
        const order = { id: 88, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValue(order);
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: 'mp-888',
            status: 'approved',
            external_reference: '88',
        });
        const req = makeReq({ userId: 1, isAdmin: true, params: { id: '88' }, query: { paymentId: 'mp-888' } });
        const res = makeRes();
        await orderCtrl.syncPaymentStatus(req, res);
        expect(order.update).toHaveBeenCalledWith({ status: 'paid' });
        expect(res.json).toHaveBeenCalledWith({ status: 'paid', message: 'Pagamento sincronizado com sucesso' });
    });
    it('syncPaymentStatus falls back to search when payment lookup fails and finds approved result', async () => {
        process.env.MERCADOPAGO_ACCESS_TOKEN = 'dummy';
        const order = { id: 91, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValue(order);
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockRejectedValue(new Error('payment not found'));
        vi.spyOn(mercadopago.Payment.prototype, 'search').mockResolvedValue({
            results: [
                { id: 'mp-pending', status: 'pending', external_reference: '91' },
                { id: 'mp-approved', status: 'approved', external_reference: '91' },
            ],
        });
        const req = makeReq({ userId: 1, isAdmin: true, params: { id: '91' }, query: { payment_id: 'invalid-id' } });
        const res = makeRes();
        await orderCtrl.syncPaymentStatus(req, res);
        expect(order.update).toHaveBeenCalledWith({ status: 'paid' });
        expect(res.json).toHaveBeenCalledWith({ status: 'paid', message: 'Pagamento sincronizado com sucesso' });
    });
    it('create uses MP fallback when auto_return is invalid', async () => {
        process.env.MERCADOPAGO_ACCESS_TOKEN = 'dummy';
        Order.create.mockResolvedValue({ id: 501, status: 'pending', discount_amount: 0, coupon_code: null });
        OrderItem.create.mockResolvedValue({});
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Preference.prototype, 'create')
            .mockRejectedValueOnce(new Error('auto_return invalid'))
            .mockResolvedValueOnce({ id: 'pref-fallback', init_point: 'http://fallback' });
        const req = makeReq({
            userId: 10,
            body: {
                items: [{ productId: 1, productName: 'x', price: 10, quantity: 1 }],
                customerEmail: 'a@a.com',
                customerName: 'Nome Sobrenome',
                customerCpf: '52998224725',
                totalPrice: 10,
            },
        });
        const res = makeRes();
        await orderCtrl.create(req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ orderId: 501, preference_id: 'pref-fallback' }));
    });
    it('normalizarErro falls back to String on circular data', () => {
        const circular = {};
        circular.self = circular;
        const msg = orderCtrlPrivate.normalizarErro(circular);
        expect(msg).toContain('[object Object]');
    });
    it('montarCorpoPreferencia includes discount item and payer fallback', () => {
        const payload = orderCtrlPrivate.montarCorpoPreferencia({ id: 77, discount_amount: 5, coupon_code: 'OFF5' }, {
            items: [{ productId: 1, productName: '', price: 15.5, quantity: 0 }],
            customerEmail: '',
            customerName: '',
            customerCpf: '',
            totalPrice: 15.5,
        });
        expect(payload.items).toHaveLength(2);
        expect(payload.items[1]).toEqual(expect.objectContaining({ id: 'discount', unit_price: -5 }));
        expect(payload.payer).toEqual(expect.objectContaining({ email: 'teste@teste.com', name: 'Cliente' }));
    });
    it('markOrderAsPaid returns false when order does not exist', async () => {
        Order.findByPk.mockResolvedValueOnce(null);
        await expect(orderCtrlPrivate.markOrderAsPaid(999)).resolves.toBe(false);
    });
    it('markOrderAsPaid returns true when order is already paid', async () => {
        Order.findByPk.mockResolvedValueOnce({ id: 12, status: 'paid', update: vi.fn() });
        await expect(orderCtrlPrivate.markOrderAsPaid(12)).resolves.toBe(true);
    });
});

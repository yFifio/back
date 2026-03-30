import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderController } from '../controllers/OrderController';
import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { User } from '../models/User';
import { Payment } from '../models/Payment';
import { PaymentWebhook } from '../models/PaymentWebhook';
import { Coupon } from '../models/Coupon';
const makeReq = (data) => data;
const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
vi.mock('../models/Order', () => ({
    Order: { create: vi.fn(), findByPk: vi.fn(), findAll: vi.fn() },
}));
vi.mock('../models/OrderItem', () => ({
    OrderItem: { create: vi.fn() },
}));
vi.mock('../models/User', () => ({
    User: { findByPk: vi.fn() },
}));
vi.mock('../models/Payment', () => ({
    Payment: { findOne: vi.fn(), create: vi.fn() },
}));
vi.mock('../models/PaymentWebhook', () => ({
    PaymentWebhook: { findOne: vi.fn(), create: vi.fn(), findAll: vi.fn() },
}));
vi.mock('../models/Coupon', () => ({
    Coupon: { findOne: vi.fn() },
}));
describe('OrderController - markPaid', () => {
    let ctrl;
    beforeEach(() => { vi.resetAllMocks(); ctrl = new OrderController(); });
    it('retorna 404 quando pedido não encontrado', async () => {
        Order.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.markPaid(makeReq({ params: { id: '1' }, userId: 1 }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
    it('retorna 403 quando usuário não tem acesso', async () => {
        const order = { id: 5, customer_id: 99, status: 'pending', update: vi.fn() };
        Order.findByPk.mockResolvedValueOnce(order);
        const res = makeRes();
        await ctrl.markPaid(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }), res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado' });
    });
    it('retorna 409 quando não-admin e pagamento não aprovado', async () => {
        const order = { id: 5, customer_id: 1, status: 'pending', update: vi.fn() };
        Order.findByPk.mockResolvedValueOnce(order);
        Payment.findOne.mockResolvedValueOnce(null);
        PaymentWebhook.findOne.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.markPaid(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }), res);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ error: 'Pagamento ainda não foi confirmado.' });
    });
    it('marca como pago quando non-admin mas tem pagamento aprovado', async () => {
        const order = { id: 5, customer_id: 1, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValueOnce(order);
        Payment.findOne.mockResolvedValueOnce({ id: 1, status: 'approved' });
        const res = makeRes();
        await ctrl.markPaid(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }), res);
        expect(order.update).toHaveBeenCalledWith({ status: 'paid' });
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
    it('marca como pago via webhook aprovado quando não tem Payment', async () => {
        const order = { id: 5, customer_id: 1, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValueOnce(order);
        Payment.findOne.mockResolvedValueOnce(null);
        PaymentWebhook.findOne.mockResolvedValueOnce({ id: 1, mercado_pago_status: 'approved' });
        const res = makeRes();
        await ctrl.markPaid(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }), res);
        expect(order.update).toHaveBeenCalledWith({ status: 'paid' });
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
    it('admin pode marcar como pago sem verificar pagamento', async () => {
        const order = { id: 7, customer_id: 2, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValueOnce(order);
        const res = makeRes();
        await ctrl.markPaid(makeReq({ params: { id: '7' }, userId: 1, isAdmin: true }), res);
        expect(order.update).toHaveBeenCalledWith({ status: 'paid' });
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
    it('retorna 500 em exceção', async () => {
        Order.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.markPaid(makeReq({ params: { id: '1' }, userId: 1, isAdmin: true }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
describe('OrderController - updateStatus', () => {
    let ctrl;
    beforeEach(() => { vi.resetAllMocks(); ctrl = new OrderController(); });
    it('retorna 403 quando não é admin', async () => {
        User.findByPk.mockResolvedValueOnce({ id: 1, isAdmin: false });
        const res = makeRes();
        await ctrl.updateStatus(makeReq({ params: { id: '1' }, body: { status: 'shipped' }, userId: 1, isAdmin: false }), res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado' });
    });
    it('retorna 400 para status inválido', async () => {
        User.findByPk.mockResolvedValueOnce({ id: 1, isAdmin: true });
        const res = makeRes();
        await ctrl.updateStatus(makeReq({ params: { id: '1' }, body: { status: 'invalid_status' }, userId: 1, isAdmin: true }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Status inválido' });
    });
    it('retorna 404 quando pedido não encontrado', async () => {
        User.findByPk.mockResolvedValueOnce({ id: 1, isAdmin: true });
        Order.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.updateStatus(makeReq({ params: { id: '999' }, body: { status: 'shipped' }, userId: 1, isAdmin: true }), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Pedido não encontrado' });
    });
    it('atualiza status com sucesso', async () => {
        User.findByPk.mockResolvedValueOnce({ id: 1, isAdmin: true });
        const order = { id: 10, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValueOnce(order);
        const res = makeRes();
        await ctrl.updateStatus(makeReq({ params: { id: '10' }, body: { status: 'shipped' }, userId: 1, isAdmin: true }), res);
        expect(order.update).toHaveBeenCalledWith({ status: 'shipped' });
        expect(res.json).toHaveBeenCalledWith({ success: true, orderId: 10, status: 'shipped' });
    });
    it('retorna 500 em exceção', async () => {
        User.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.updateStatus(makeReq({ params: { id: '1' }, body: { status: 'paid' }, userId: 1, isAdmin: true }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
    it('retorna todos os status válidos', async () => {
        for (const status of ['pending', 'paid', 'shipped', 'delivered', 'cancelled']) {
            vi.resetAllMocks();
            User.findByPk.mockResolvedValueOnce({ id: 1, isAdmin: true });
            const order = { id: 10, status: 'pending', update: vi.fn().mockResolvedValue(undefined) };
            Order.findByPk.mockResolvedValueOnce(order);
            const res = makeRes();
            await ctrl.updateStatus(makeReq({ params: { id: '10' }, body: { status }, userId: 1, isAdmin: true }), res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status }));
        }
    });
});
describe('OrderController - syncPaymentStatus extra', () => {
    let ctrl;
    beforeEach(() => { vi.resetAllMocks(); ctrl = new OrderController(); });
    it('retorna 404 quando pedido não existe', async () => {
        Order.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.syncPaymentStatus(makeReq({ params: { id: '99' }, userId: 1, isAdmin: true }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
    it('retorna 403 quando usuário não tem acesso', async () => {
        const order = { id: 5, customer_id: 99, status: 'pending' };
        Order.findByPk.mockResolvedValueOnce(order);
        const res = makeRes();
        await ctrl.syncPaymentStatus(makeReq({ params: { id: '5' }, userId: 1, isAdmin: false }), res);
        expect(res.status).toHaveBeenCalledWith(403);
    });
    it('retorna "já pago" quando status é paid', async () => {
        const order = { id: 5, customer_id: 1, status: 'paid' };
        Order.findByPk.mockResolvedValueOnce(order);
        const res = makeRes();
        await ctrl.syncPaymentStatus(makeReq({ params: { id: '5' }, query: {}, userId: 1, isAdmin: false }), res);
        expect(res.json).toHaveBeenCalledWith({ status: 'paid', message: 'Pedido já foi marcado como pago' });
    });
    it('retorna status pendente quando sem token MP', async () => {
        const savedToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        delete process.env.MERCADOPAGO_ACCESS_TOKEN;
        const order = { id: 5, customer_id: 1, status: 'pending' };
        Order.findByPk.mockResolvedValueOnce(order);
        const res = makeRes();
        await ctrl.syncPaymentStatus(makeReq({ params: { id: '5' }, query: {}, userId: 1, isAdmin: false }), res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
        process.env.MERCADOPAGO_ACCESS_TOKEN = savedToken;
    });
    it('retorna 500 em exceção', async () => {
        Order.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.syncPaymentStatus(makeReq({ params: { id: '1' }, userId: 1, isAdmin: true }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
describe('OrderController - create extra', () => {
    let ctrl;
    beforeEach(() => { vi.resetAllMocks(); ctrl = new OrderController(); });
    it('retorna 401 quando não autenticado', async () => {
        const res = makeRes();
        await ctrl.create(makeReq({
            body: { items: [{ productId: 1, productName: 'X', price: 10, quantity: 1 }], customerEmail: 'a@b.com', customerName: 'C', customerCpf: '123' },
        }), res);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não autenticado' });
    });
    it('retorna 400 para pedido vazio', async () => {
        const res = makeRes();
        await ctrl.create(makeReq({
            userId: 1,
            body: { items: [], customerEmail: 'a@b.com', customerName: 'C', customerCpf: '123' },
        }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Pedido vazio' });
    });
    it('cria pedido com modo illustrative sem token MP', async () => {
        process.env.MERCADOPAGO_ACCESS_TOKEN = '';
        Order.create.mockResolvedValueOnce({ id: 10, status: 'pending', update: vi.fn().mockResolvedValue(undefined) });
        OrderItem.create.mockResolvedValue({});
        Coupon.findOne.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.create(makeReq({
            userId: 1,
            body: {
                items: [{ productId: 1, productName: 'Livro', price: 20, quantity: 2 }],
                customerEmail: 'c@d.com',
                customerName: 'Usuario',
                customerCpf: '52998224725',
                paymentMethod: 'illustrative',
            },
        }), res);
        const payload = res.json.mock.calls[0]?.[0];
        expect(payload?.mode).toBe('illustrative');
    });
    it('retorna 500 quando cupom é inválido', async () => {
        Coupon.findOne.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.create(makeReq({
            userId: 1,
            body: {
                items: [{ productId: 1, productName: 'X', price: 10, quantity: 1 }],
                customerEmail: 'a@b.com',
                customerName: 'C',
                customerCpf: '123',
                couponCode: 'INVALID',
            },
        }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Cupom inválido') }));
    });
    it('cria pedido com cupom válido', async () => {
        process.env.MERCADOPAGO_ACCESS_TOKEN = '';
        Coupon.findOne.mockResolvedValueOnce({ code: 'SAVE10', discount: 10 });
        Order.create.mockResolvedValueOnce({ id: 20, status: 'pending', discount_amount: 2, coupon_code: 'SAVE10', update: vi.fn().mockResolvedValue(undefined) });
        OrderItem.create.mockResolvedValue({});
        const res = makeRes();
        await ctrl.create(makeReq({
            userId: 1,
            body: {
                items: [{ productId: 1, productName: 'Livro', price: 20, quantity: 1 }],
                customerEmail: 'c@d.com',
                customerName: 'User',
                customerCpf: '52998224725',
                couponCode: 'save10',
                paymentMethod: 'illustrative',
            },
        }), res);
        const payload = res.json.mock.calls[0]?.[0];
        expect(payload?.orderId).toBe(20);
    });
    it('list retorna 500 em exceção', async () => {
        User.findByPk.mockRejectedValueOnce(new Error('db err'));
        const res = makeRes();
        await ctrl.list(makeReq({ query: {}, userId: 1 }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
    it('list retorna 401 quando usuário não encontrado', async () => {
        User.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.list(makeReq({ query: {}, userId: 1 }), res);
        expect(res.status).toHaveBeenCalledWith(401);
    });
    it('buscarPedidoPorId retorna pedido pelo id', async () => {
        Order.findByPk.mockResolvedValueOnce({ id: 55 });
        const result = await ctrl.buscarPedidoPorId(55);
        expect(Order.findByPk).toHaveBeenCalledWith(55);
        expect(result).toEqual({ id: 55 });
    });
});

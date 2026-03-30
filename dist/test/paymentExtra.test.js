import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentNotificationController } from '../controllers/PaymentNotificationController';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { PaymentWebhook } from '../models/PaymentWebhook';
const makeReq = (data) => data;
const makeRes = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    sendStatus: vi.fn(),
});
vi.mock('../models/Order', () => ({ Order: { findByPk: vi.fn() } }));
vi.mock('../models/Payment', () => ({ Payment: { create: vi.fn() } }));
vi.mock('../models/PaymentWebhook', () => ({
    PaymentWebhook: { findOne: vi.fn(), create: vi.fn(), findAll: vi.fn() },
}));
describe('PaymentNotificationController - handleNotification extra', () => {
    let controller;
    beforeEach(() => { vi.resetAllMocks(); controller = new PaymentNotificationController(); });
    it('acknowledges unknown/ignored topic silently', async () => {
        const req = makeReq({ query: { type: 'ignored_topic' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('acknowledges merchant_order ping with data.id', async () => {
        const req = makeReq({ query: {}, body: { topic: 'merchant_order', data: { id: '123' } } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('processes merchant_order and marks order as paid when payment is approved', async () => {
        const order = { id: 123, status: 'pending', save: vi.fn().mockResolvedValue(undefined) };
        const webhook = { processed: false, save: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValue(order);
        PaymentWebhook.findOne.mockResolvedValue(null);
        PaymentWebhook.create.mockResolvedValue(webhook);
        Payment.create.mockResolvedValue({});
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.MerchantOrder.prototype, 'get').mockResolvedValue({
            id: 'mo-123',
            external_reference: '123',
            payments: [
                {
                    id: 'pay-123',
                    status: 'approved',
                    status_detail: 'accredited',
                    transaction_amount: 150,
                    payment_method_id: 'pix',
                    payer: { email: 'buyer@test.com' },
                },
            ],
        });
        const req = makeReq({ body: { topic: 'merchant_order', data: { id: 'mo-123' } } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(order.status).toBe('paid');
        expect(order.save).toHaveBeenCalled();
        expect(Payment.create).toHaveBeenCalled();
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('acknowledges payment topic without paymentId', async () => {
        const req = makeReq({ query: { type: 'payment' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('ignores already-processed webhook', async () => {
        Order.findByPk.mockResolvedValue({ id: 100, status: 'pending', save: vi.fn() });
        PaymentWebhook.findOne.mockResolvedValue({ processed: true });
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '777',
            status: 'approved',
            external_reference: '100',
            status_detail: 'accredited',
            transaction_amount: 50,
            payment_method: { id: 'pix' },
            payer: { email: 'test@test.com' },
        });
        const req = makeReq({ query: { type: 'payment', 'data.id': '777' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(Payment.create).not.toHaveBeenCalled();
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('processes pending payment status', async () => {
        const order = { id: 50, status: 'pending', save: vi.fn().mockResolvedValue(undefined) };
        const webhook = { processed: false, save: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValue(order);
        PaymentWebhook.findOne.mockResolvedValue(null);
        PaymentWebhook.create.mockResolvedValue(webhook);
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '888',
            status: 'pending',
            external_reference: '50',
            status_detail: 'awaiting',
            transaction_amount: 30,
            payment_method: { id: 'boleto' },
            payer: { email: 'user@test.com' },
        });
        const req = makeReq({ query: { type: 'payment', 'data.id': '888' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(order.save).toHaveBeenCalled();
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('processes rejected payment status', async () => {
        const order = { id: 60, status: 'pending', save: vi.fn().mockResolvedValue(undefined) };
        const webhook = { processed: false, save: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValue(order);
        PaymentWebhook.findOne.mockResolvedValue(null);
        PaymentWebhook.create.mockResolvedValue(webhook);
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '999',
            status: 'rejected',
            external_reference: '60',
            status_detail: 'cc_rejected',
            transaction_amount: 20,
            payment_method: { id: 'debit' },
            payer: { email: 'user@t.com' },
        });
        const req = makeReq({ query: { type: 'payment', 'data.id': '999' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(order.save).toHaveBeenCalled();
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('processes cancelled payment status', async () => {
        const order = { id: 70, status: 'pending', save: vi.fn().mockResolvedValue(undefined) };
        const webhook = { processed: false, save: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValue(order);
        PaymentWebhook.findOne.mockResolvedValue(null);
        PaymentWebhook.create.mockResolvedValue(webhook);
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '1010',
            status: 'cancelled',
            external_reference: '70',
            status_detail: 'expired',
            transaction_amount: 15,
            payment_method: { id: 'cash' },
            payer: { email: 'u@x.com' },
        });
        const req = makeReq({ query: { type: 'payment', 'data.id': '1010' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(order.save).toHaveBeenCalled();
        expect(order.status).toBe('cancelled');
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('handles missing external_reference gracefully', async () => {
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '2020',
            status: 'approved',
            external_reference: '',
            transaction_amount: 10,
            payment_method: { id: 'pix' },
            payer: { email: 'x@x.com' },
        });
        const req = makeReq({ query: { type: 'payment', 'data.id': '2020' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(Order.findByPk).not.toHaveBeenCalledWith('');
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('handles order not found gracefully', async () => {
        Order.findByPk.mockResolvedValue(null);
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '3030',
            status: 'approved',
            external_reference: '9999',
            transaction_amount: 10,
            payment_method: { id: 'pix' },
            payer: { email: 'x@x.com' },
        });
        const req = makeReq({ query: { type: 'payment', 'data.id': '3030' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(Payment.create).not.toHaveBeenCalled();
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('handles fetchPaymentDetails failure gracefully', async () => {
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockRejectedValue(new Error('MP API error'));
        const req = makeReq({ query: { type: 'payment', 'data.id': '4040' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('extracts payment id from resource object', async () => {
        Order.findByPk.mockResolvedValue({ id: 5, status: 'pending', save: vi.fn() });
        PaymentWebhook.findOne.mockResolvedValue({ processed: true });
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '5050',
            status: 'approved',
            external_reference: '5',
            transaction_amount: 10,
            payment_method: { id: 'pix' },
            payer: { email: 'x@x.com' },
        });
        const req = makeReq({ query: {}, body: { type: 'payment', resource: { id: '5050' } } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('extracts payment id from resource string', async () => {
        Order.findByPk.mockResolvedValue({ id: 6, status: 'pending', save: vi.fn() });
        PaymentWebhook.findOne.mockResolvedValue({ processed: true });
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '6060',
            status: 'approved',
            external_reference: '6',
            transaction_amount: 10,
            payment_method: { id: 'pix' },
            payer: { email: 'x@x.com' },
        });
        const req = makeReq({ query: {}, body: { topic: 'payment', resource: '/collections/6060' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('extracts payment id from action field', async () => {
        PaymentWebhook.findOne.mockResolvedValue({ processed: true });
        Order.findByPk.mockResolvedValue({ id: 7, status: 'pending', save: vi.fn() });
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '7070',
            status: 'approved',
            external_reference: '7',
            transaction_amount: 10,
            payment_method: { id: 'pix' },
            payer: { email: 'x@x.com' },
        });
        const req = makeReq({ query: {}, body: { action: 'payment.updated', id: '7070' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('catches and acknowledges when processing flow throws', async () => {
        Order.findByPk.mockResolvedValue({ id: 80, status: 'pending', save: vi.fn().mockResolvedValue(undefined) });
        PaymentWebhook.findOne.mockResolvedValue(null);
        PaymentWebhook.create.mockRejectedValue(new Error('db write error'));
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '8080',
            status: 'approved',
            external_reference: '80',
            status_detail: 'accredited',
            transaction_amount: 10,
            payment_method: { id: 'pix' },
            payer: { email: 'flow@test.com' },
        });
        const req = makeReq({ query: { type: 'payment', 'data.id': '8080' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
});
describe('PaymentNotificationController - getPaymentStatus extra', () => {
    let controller;
    beforeEach(() => { vi.resetAllMocks(); controller = new PaymentNotificationController(); });
    it('retorna 404 quando pedido não existe', async () => {
        Order.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await controller.getPaymentStatus(makeReq({ params: { id: '99' }, query: {}, userId: 1, isAdmin: true }), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Pedido não encontrado' });
    });
    it('retorna 403 quando usuário não tem acesso', async () => {
        const order = { id: 5, customer_id: 99, status: 'pending' };
        Order.findByPk.mockResolvedValueOnce(order);
        const res = makeRes();
        await controller.getPaymentStatus(makeReq({ params: { id: '5' }, query: {}, userId: 1, isAdmin: false }), res);
        expect(res.status).toHaveBeenCalledWith(403);
    });
    it('retorna status sem payment_id', async () => {
        const order = { id: 30, customer_id: 1, status: 'pending' };
        Order.findByPk.mockResolvedValueOnce(order);
        PaymentWebhook.findAll.mockResolvedValueOnce([]);
        const res = makeRes();
        await controller.getPaymentStatus(makeReq({ params: { id: '30' }, query: {}, userId: 1, isAdmin: false }), res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ order_id: 30, order_status: 'pending' }));
    });
    it('retorna 500 em exceção', async () => {
        Order.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await controller.getPaymentStatus(makeReq({ params: { id: '1' }, query: {}, userId: 1, isAdmin: true }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

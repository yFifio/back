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
vi.mock('../models/Order', () => {
    const findByPk = vi.fn();
    return { Order: { findByPk } };
});
vi.mock('../models/Payment', () => {
    const create = vi.fn();
    return { Payment: { create } };
});
vi.mock('../models/PaymentWebhook', () => {
    const findOne = vi.fn();
    const create = vi.fn();
    const findAll = vi.fn();
    return { PaymentWebhook: { findOne, create, findAll } };
});
describe('PaymentNotificationController', () => {
    let controller;
    beforeEach(() => {
        vi.resetAllMocks();
        controller = new PaymentNotificationController();
    });
    it('processes webhook when Mercado Pago sends type and data.id', async () => {
        const order = { id: 15, status: 'pending', save: vi.fn().mockResolvedValue(undefined) };
        const webhook = { processed: false, save: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk.mockResolvedValue(order);
        PaymentWebhook.findOne.mockResolvedValue(null);
        PaymentWebhook.create.mockResolvedValue(webhook);
        Payment.create.mockResolvedValue({});
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: '999',
            status: 'approved',
            external_reference: '15',
            status_detail: 'accredited',
            transaction_amount: 49.9,
            payment_method: { id: 'visa' },
            payer: { email: 'cliente@teste.com' },
        });
        const req = makeReq({ query: { type: 'payment', 'data.id': '999' } });
        const res = makeRes();
        await controller.handleNotification(req, res);
        expect(order.save).toHaveBeenCalled();
        expect(Payment.create).toHaveBeenCalledWith(expect.objectContaining({
            order_id: 15,
            mercado_pago_id: '999',
            status: 'approved',
        }));
        expect(webhook.save).toHaveBeenCalled();
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
    it('getPaymentStatus uses payment_id to sync approved payments', async () => {
        const pendingOrder = { id: 20, status: 'pending', save: vi.fn().mockResolvedValue(undefined) };
        const paidOrder = { id: 20, status: 'paid' };
        const webhook = { processed: false, save: vi.fn().mockResolvedValue(undefined) };
        Order.findByPk
            .mockResolvedValueOnce(pendingOrder)
            .mockResolvedValueOnce(pendingOrder)
            .mockResolvedValueOnce(paidOrder);
        PaymentWebhook.findOne.mockResolvedValue(null);
        PaymentWebhook.create.mockResolvedValue(webhook);
        PaymentWebhook.findAll.mockResolvedValue([
            { mercado_pago_status: 'approved', mercado_pago_id: 'abc123', payer_email: 'cliente@teste.com', amount: 99.9 },
        ]);
        Payment.create.mockResolvedValue({});
        const mercadopago = await import('mercadopago');
        vi.spyOn(mercadopago.Payment.prototype, 'get').mockResolvedValue({
            id: 'abc123',
            status: 'approved',
            external_reference: '20',
            status_detail: 'accredited',
            transaction_amount: 99.9,
            payment_method: { id: 'master' },
            payer: { email: 'cliente@teste.com' },
        });
        const req = makeReq({ params: { id: '20' }, query: { payment_id: 'abc123' }, isAdmin: true, userId: 1 });
        const res = makeRes();
        await controller.getPaymentStatus(req, res);
        expect(pendingOrder.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            order_id: 20,
            order_status: 'paid',
        }));
    });
});

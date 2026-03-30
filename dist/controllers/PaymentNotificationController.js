import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { PaymentWebhook } from '../models/PaymentWebhook';
import { MercadoPagoConfig, Payment as MPPayment, MerchantOrder as MPMerchantOrder } from 'mercadopago';
export class PaymentNotificationController {
    client;
    constructor() {
        this.client = new MercadoPagoConfig({
            accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
        });
    }
    handleNotification = async (req, res) => {
        try {
            return await this.handleNotificationInternal(req, res);
        }
        catch (error) {
            console.error('[WebhookMP] Erro ao tratar notificação:', error);
            return res.sendStatus(200);
        }
    };
    async fetchPaymentDetails(paymentId) {
        try {
            const payment = new MPPayment(this.client);
            const response = await payment.get({ id: paymentId });
            return response;
        }
        catch (error) {
            console.error(`[WebhookMP] Falha ao buscar pagamento ${paymentId}:`, error);
            return null;
        }
    }
    async processPaymentById(paymentId) {
        const payment = await this.fetchPaymentDetails(paymentId);
        if (payment)
            await this.processPayment(payment);
    }
    async fetchMerchantOrderDetails(merchantOrderId) {
        try {
            const merchantOrder = new MPMerchantOrder(this.client);
            const response = await merchantOrder.get({ merchantOrderId });
            return response;
        }
        catch (error) {
            console.error(`[WebhookMP] Falha ao buscar merchant_order ${merchantOrderId}:`, error);
            return null;
        }
    }
    chooseRelevantMerchantOrderPayment(merchantOrder) {
        const payments = merchantOrder.payments || [];
        if (payments.length === 0)
            return null;
        const approved = payments.find((payment) => payment.status === 'approved');
        if (approved)
            return approved;
        const pendingLike = payments.find((payment) => ['in_process', 'pending', 'authorized'].includes(String(payment.status || '')));
        if (pendingLike)
            return pendingLike;
        return payments[0] || null;
    }
    async processMerchantOrderById(merchantOrderId) {
        const merchantOrder = await this.fetchMerchantOrderDetails(merchantOrderId);
        if (!merchantOrder?.external_reference) {
            console.warn(`[WebhookMP] merchant_order ${merchantOrderId} sem external_reference`);
            return;
        }
        const selectedPayment = this.chooseRelevantMerchantOrderPayment(merchantOrder);
        if (!selectedPayment?.id) {
            console.warn(`[WebhookMP] merchant_order ${merchantOrderId} sem pagamentos válidos`);
            return;
        }
        await this.processPayment({
            id: selectedPayment.id,
            external_reference: merchantOrder.external_reference,
            status: selectedPayment.status,
            status_detail: selectedPayment.status_detail,
            transaction_amount: selectedPayment.transaction_amount,
            payment_method: { id: selectedPayment.payment_method_id },
            payer: { email: selectedPayment.payer?.email },
        });
    }
    async processPayment(paymentData) {
        try {
            await this.processPaymentFlow(paymentData);
        }
        catch (error) {
            console.error('[WebhookMP] Erro ao processar pagamento:', error);
            throw error;
        }
    }
    async processPaymentFlow(paymentData) {
        const payment = this.normalizePaymentData(paymentData);
        if (!this.hasExternalReference(payment))
            return;
        const order = await this.findOrderByReference(payment.externalReference);
        if (!order || (await this.isPaymentAlreadyProcessed(payment.mpPaymentId)))
            return;
        const webhook = await this.createWebhookEntry(payment, paymentData);
        await this.syncOrderWithPayment(order, payment, paymentData);
        await this.markWebhookAsProcessed(webhook);
    }
    normalizePaymentData(paymentData) {
        return {
            externalReference: String(paymentData.external_reference || ''),
            mpPaymentId: String(paymentData.id || ''),
            mpStatus: String(paymentData.status || ''),
            mpStatusDetail: String(paymentData.status_detail || ''),
            amount: Number(paymentData.transaction_amount || 0),
            paymentMethodId: String(paymentData.payment_method?.id || ''),
            payerEmail: String(paymentData.payer?.email || ''),
        };
    }
    hasExternalReference(payment) {
        if (payment.externalReference)
            return true;
        console.warn('[WebhookMP] external_reference ausente nos dados de pagamento');
        return false;
    }
    async findOrderByReference(externalReference) {
        const order = await Order.findByPk(externalReference);
        if (order)
            return order;
        console.warn(`[WebhookMP] Pedido não encontrado: ${externalReference}`);
        return null;
    }
    async isPaymentAlreadyProcessed(mpPaymentId) {
        const existingWebhook = await PaymentWebhook.findOne({ where: { mercado_pago_id: mpPaymentId } });
        if (existingWebhook?.processed)
            console.log(`[WebhookMP] Payment already processed: ${mpPaymentId}`);
        return Boolean(existingWebhook?.processed);
    }
    async createWebhookEntry(payment, paymentData) {
        return PaymentWebhook.create(this.buildWebhookPayload(payment, paymentData));
    }
    async syncOrderWithPayment(order, payment, paymentData) {
        if (payment.mpStatus === 'approved')
            return this.markOrderApproved(order, payment, paymentData);
        if (payment.mpStatus === 'pending')
            return this.markOrderPending(order);
        if (payment.mpStatus === 'rejected' || payment.mpStatus === 'cancelled')
            return this.markOrderCancelled(order, payment.mpStatus);
    }
    async markOrderApproved(order, payment, paymentData) {
        order.status = 'paid';
        await order.save();
        await Payment.create(this.buildPaymentPayload(order, payment, paymentData));
        console.log(`[WebhookMP] Pagamento aprovado para o pedido ${order.id}`);
    }
    async markOrderPending(order) {
        order.status = 'pending';
        await order.save();
        console.log(`[WebhookMP] Pagamento pendente para o pedido ${order.id}`);
    }
    async markOrderCancelled(order, status) {
        order.status = 'cancelled';
        await order.save();
        console.log(`[WebhookMP] Payment ${status} for order ${order.id}`);
    }
    async markWebhookAsProcessed(webhook) {
        webhook.processed = true;
        await webhook.save();
    }
    buildWebhookPayload(payment, paymentData) {
        return {
            order_id: parseInt(payment.externalReference), mercado_pago_id: payment.mpPaymentId,
            mercado_pago_status: payment.mpStatus, mercado_pago_status_detail: payment.mpStatusDetail,
            amount: payment.amount, payment_method_id: payment.paymentMethodId,
            payer_email: payment.payerEmail, raw_data: paymentData, processed: false,
        };
    }
    buildPaymentPayload(order, payment, paymentData) {
        return {
            order_id: order.id, mercado_pago_id: payment.mpPaymentId, status: 'approved',
            amount: payment.amount, payment_method: payment.paymentMethodId,
            payer_email: payment.payerEmail, raw_data: paymentData,
        };
    }
    getPaymentStatus = async (req, res) => {
        try {
            return await this.getPaymentStatusInternal(req, res);
        }
        catch (error) {
            console.error('[PaymentStatus] Erro:', error);
            res.status(500).json({ error: 'Erro ao buscar status do pagamento' });
        }
    };
    async handleNotificationInternal(req, res) {
        const payload = this.extractNotificationPayload(req);
        const topic = this.extractNotificationTopic(payload);
        const paymentId = this.extractNotificationPaymentId(payload);
        console.log(`[WebhookMP] Notificação recebida: topic=${topic}, paymentId=${paymentId || payload.id || 'N/A'}`);
        if (!this.shouldProcessTopic(topic))
            return this.ackIgnoredTopic(topic, res);
        if (topic === 'merchant_order' && paymentId) {
            await this.processMerchantOrderById(paymentId);
            return res.sendStatus(200);
        }
        if (topic === 'payment' && paymentId)
            await this.processPaymentById(paymentId);
        return res.sendStatus(200);
    }
    async getPaymentStatusInternal(req, res) {
        const orderId = req.params.id;
        const paymentId = this.getPaymentIdFromRequest(req);
        let order = await Order.findByPk(orderId);
        if (!order)
            return this.orderNotFound(res);
        if (!this.usuarioPodeAcessarPedido(req, order)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        if (paymentId && order.status !== 'paid') {
            await this.processPaymentById(paymentId);
            order = await Order.findByPk(orderId);
            if (!order)
                return this.orderNotFound(res);
        }
        const latestWebhook = await this.getLatestWebhook(orderId);
        return res.json(this.buildStatusResponse(order, latestWebhook));
    }
    extractNotificationPayload(req) {
        const query = (req.query || {});
        const body = (req.body || {}) || {};
        return {
            ...body,
            id: body.id ?? query.id,
            topic: body.topic ?? query.topic,
            type: body.type ?? query.type,
            action: body.action ?? query.action,
            resource: body.resource ?? query.resource,
            data: body.data ?? (query['data.id'] ? { id: query['data.id'] } : undefined),
        };
    }
    extractNotificationTopic(payload) {
        const rawTopic = payload.topic || payload.type || payload.action?.split('.')[0] || '';
        return String(rawTopic);
    }
    extractNotificationPaymentId(payload) {
        if (typeof payload.resource === 'object' && payload.resource?.id != null) {
            return String(payload.resource.id);
        }
        if (typeof payload.resource === 'string') {
            const resourceId = payload.resource.split('/').filter(Boolean).pop();
            if (resourceId)
                return resourceId;
        }
        if (payload.data?.id != null)
            return String(payload.data.id);
        if ((payload.topic === 'payment' || payload.type === 'payment') && payload.id != null)
            return String(payload.id);
        return null;
    }
    getPaymentIdFromRequest(req) {
        const query = req.query;
        return query.payment_id || query.paymentId || undefined;
    }
    shouldProcessTopic(topic) {
        return topic === 'payment' || topic === 'merchant_order';
    }
    ackIgnoredTopic(topic, res) {
        console.log(`[WebhookMP] Ignorando tópico: ${topic}`);
        return res.sendStatus(200);
    }
    async getLatestWebhook(orderId) {
        const webhooks = await PaymentWebhook.findAll({
            where: { order_id: parseInt(orderId) },
            order: [['createdAt', 'DESC']],
            limit: 1,
        });
        return webhooks[0] || null;
    }
    buildStatusResponse(order, latestWebhook) {
        return { order_id: order.id, order_status: order.status, latest_webhook: latestWebhook };
    }
    usuarioPodeAcessarPedido(req, order) {
        if (!req.userId)
            return false;
        if (req.isAdmin)
            return true;
        return Number(order.customer_id) === Number(req.userId);
    }
    orderNotFound(res) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
    }
}

import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { PaymentWebhook } from '../models/PaymentWebhook';
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
export class PaymentNotificationController {
    client;
    constructor() {
        this.client = new MercadoPagoConfig({
            accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
        });
    }
    handleNotification = async (req, res) => {
        try {
            const { id, topic, resource, data } = req.body;
            console.log(`[WebhookMP] Received notification: topic=${topic}, id=${id}`);
            if (topic !== 'payment' && topic !== 'merchant_order') {
                console.log(`[WebhookMP] Ignoring topic: ${topic}`);
                return res.sendStatus(200); // acknowledge but ignore
            }
            if (topic === 'merchant_order' && data?.id) {
                return res.sendStatus(200);
            }
            if (topic === 'payment' && resource?.id) {
                const paymentId = resource.id;
                const payment = await this.fetchPaymentDetails(paymentId);
                if (payment) {
                    await this.processPayment(payment);
                }
            }
            return res.sendStatus(200);
        }
        catch (error) {
            console.error('[WebhookMP] Error handling notification:', error);
            // Always return 200 to avoid MP retries on our infrastructure errors
            return res.sendStatus(200);
        }
    };
    /**
     * Fetch full payment details from Mercado Pago using SDK
     */
    async fetchPaymentDetails(paymentId) {
        try {
            const payment = new MPPayment(this.client);
            const response = await payment.get({ id: paymentId });
            return response;
        }
        catch (error) {
            console.error(`[WebhookMP] Failed to fetch payment ${paymentId}:`, error);
            return null;
        }
    }
    /**
     * Process the payment and update order status accordingly
     */
    async processPayment(paymentData) {
        try {
            const externalReference = String(paymentData.external_reference || '');
            const mpPaymentId = String(paymentData.id || '');
            const mpStatus = String(paymentData.status || '');
            const mpStatusDetail = String(paymentData.status_detail || '');
            if (!externalReference) {
                console.warn('[WebhookMP] Missing external_reference in payment data');
                return;
            }
            // Find order by external reference (orderId)
            const order = await Order.findByPk(externalReference);
            if (!order) {
                console.warn(`[WebhookMP] Order not found: ${externalReference}`);
                return;
            }
            // Check if we already processed this payment
            const existingWebhook = await PaymentWebhook.findOne({
                where: { mercado_pago_id: mpPaymentId },
            });
            if (existingWebhook?.processed) {
                console.log(`[WebhookMP] Payment already processed: ${mpPaymentId}`);
                return;
            }
            // Store webhook for audit trail
            const webhook = await PaymentWebhook.create({
                order_id: parseInt(externalReference),
                mercado_pago_id: mpPaymentId,
                mercado_pago_status: mpStatus,
                mercado_pago_status_detail: mpStatusDetail,
                amount: Number(paymentData.transaction_amount || 0),
                payment_method_id: String(paymentData.payment_method?.id || ''),
                payer_email: String(paymentData.payer?.email || ''),
                raw_data: paymentData,
                processed: false,
            });
            // Update order status based on payment status
            if (mpStatus === 'approved') {
                order.status = 'paid';
                await order.save();
                // Create/update payment record
                await Payment.create({
                    order_id: order.id,
                    mercado_pago_id: mpPaymentId,
                    status: 'approved',
                    amount: Number(paymentData.transaction_amount || 0),
                    payment_method: String(paymentData.payment_method?.id || ''),
                    payer_email: String(paymentData.payer?.email || ''),
                    raw_data: paymentData,
                });
                console.log(`[WebhookMP] Payment approved for order ${order.id}`);
            }
            else if (mpStatus === 'pending') {
                order.status = 'pending';
                await order.save();
                console.log(`[WebhookMP] Payment pending for order ${order.id}`);
            }
            else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
                order.status = 'cancelled';
                await order.save();
                console.log(`[WebhookMP] Payment ${mpStatus} for order ${order.id}`);
            }
            // Mark webhook as processed
            webhook.processed = true;
            await webhook.save();
        }
        catch (error) {
            console.error('[WebhookMP] Error processing payment:', error);
            throw error;
        }
    }
    /**
     * Query payment status by order ID
     * GET /api/orders/:id/payment-status
     */
    getPaymentStatus = async (req, res) => {
        try {
            const orderId = req.params.id;
            const order = await Order.findByPk(orderId);
            if (!order) {
                return res.status(404).json({ error: 'Pedido não encontrado' });
            }
            const webhooks = await PaymentWebhook.findAll({
                where: { order_id: parseInt(orderId) },
                order: [['createdAt', 'DESC']],
                limit: 1,
            });
            return res.json({
                order_id: order.id,
                order_status: order.status,
                latest_webhook: webhooks[0] || null,
            });
        }
        catch (error) {
            console.error('[PaymentStatus] Error:', error);
            res.status(500).json({ error: 'Erro ao buscar status do pagamento' });
        }
    };
}

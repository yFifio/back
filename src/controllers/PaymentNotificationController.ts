import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { Payment } from '../models/Payment';
import { PaymentWebhook } from '../models/PaymentWebhook';
import { MercadoPagoConfig, Payment as MPPayment, MerchantOrder as MPMerchantOrder } from 'mercadopago';
import { AuthRequest } from '../types';

interface MercadoPagoPaymentData {
  external_reference?: string | number;
  id?: string | number;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  payment_method?: { id?: string | number };
  payer?: { email?: string };
}

interface MercadoPagoNotificationPayload {
  id?: string | number;
  topic?: string;
  type?: string;
  action?: string;
  resource?: string | { id?: string | number };
  data?: { id?: string | number };
}

interface MercadoPagoMerchantOrderData {
  id?: string | number;
  external_reference?: string | number;
  payments?: Array<{
    id?: string | number;
    status?: string;
    status_detail?: string;
    transaction_amount?: number;
    payment_method_id?: string;
    payer?: { email?: string };
  }>;
}

interface NormalizedPayment {
  externalReference: string;
  mpPaymentId: string;
  mpStatus: string;
  mpStatusDetail: string;
  amount: number;
  paymentMethodId: string;
  payerEmail: string;
}

export class PaymentNotificationController {
  private client: MercadoPagoConfig;

  constructor() {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
    });
  }

 
  handleNotification = async (req: Request, res: Response) => {
    try {
      return await this.handleNotificationInternal(req, res);
    } catch (error) {
      console.error('[WebhookMP] Erro ao tratar notificação:', error);
      return res.sendStatus(200);
    }
  }

  private async fetchPaymentDetails(paymentId: string) {
    try {
      const payment = new MPPayment(this.client);
      const response = await payment.get({ id: paymentId });
      return response;
    } catch (error) {
      console.error(`[WebhookMP] Falha ao buscar pagamento ${paymentId}:`, error);
      return null;
    }
  }

  private async processPaymentById(paymentId: string) {
    const payment = await this.fetchPaymentDetails(paymentId);
    if (payment) await this.processPayment(payment);
  }

  private async fetchMerchantOrderDetails(merchantOrderId: string) {
    try {
      const merchantOrder = new MPMerchantOrder(this.client);
      const response = await merchantOrder.get({ merchantOrderId });
      return response as MercadoPagoMerchantOrderData;
    } catch (error) {
      console.error(`[WebhookMP] Falha ao buscar merchant_order ${merchantOrderId}:`, error);
      return null;
    }
  }

  private chooseRelevantMerchantOrderPayment(merchantOrder: MercadoPagoMerchantOrderData) {
    const payments = merchantOrder.payments || [];
    if (payments.length === 0) return null;

    const approved = payments.find((payment) => payment.status === 'approved');
    if (approved) return approved;

    const pendingLike = payments.find((payment) => ['in_process', 'pending', 'authorized'].includes(String(payment.status || '')));
    if (pendingLike) return pendingLike;

    return payments[0] || null;
  }

  private async processMerchantOrderById(merchantOrderId: string) {
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

  private async processPayment(paymentData: MercadoPagoPaymentData) {
    try {
      await this.processPaymentFlow(paymentData);
    } catch (error) {
      console.error('[WebhookMP] Erro ao processar pagamento:', error);
      throw error;
    }
  }

  private async processPaymentFlow(paymentData: MercadoPagoPaymentData) {
    const payment = this.normalizePaymentData(paymentData);
    if (!this.hasExternalReference(payment)) return;
    const order = await this.findOrderByReference(payment.externalReference);
    if (!order || (await this.isPaymentAlreadyProcessed(payment.mpPaymentId))) return;
    const webhook = await this.createWebhookEntry(payment, paymentData);
    await this.syncOrderWithPayment(order, payment, paymentData);
    await this.markWebhookAsProcessed(webhook);
  }

  private normalizePaymentData(paymentData: MercadoPagoPaymentData): NormalizedPayment {
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

  private hasExternalReference(payment: NormalizedPayment) {
    if (payment.externalReference) return true;
    console.warn('[WebhookMP] external_reference ausente nos dados de pagamento');
    return false;
  }

  private async findOrderByReference(externalReference: string) {
    const order = await Order.findByPk(externalReference);
    if (order) return order;
    console.warn(`[WebhookMP] Pedido não encontrado: ${externalReference}`);
    return null;
  }

  private async isPaymentAlreadyProcessed(mpPaymentId: string) {
    const existingWebhook = await PaymentWebhook.findOne({ where: { mercado_pago_id: mpPaymentId } });
    if (existingWebhook?.processed) console.log(`[WebhookMP] Payment already processed: ${mpPaymentId}`);
    return Boolean(existingWebhook?.processed);
  }

  private async createWebhookEntry(payment: NormalizedPayment, paymentData: MercadoPagoPaymentData) {
    return PaymentWebhook.create(this.buildWebhookPayload(payment, paymentData));
  }

  private async syncOrderWithPayment(order: Order, payment: NormalizedPayment, paymentData: MercadoPagoPaymentData) {
    if (payment.mpStatus === 'approved') return this.markOrderApproved(order, payment, paymentData);
    if (payment.mpStatus === 'pending') return this.markOrderPending(order);
    if (payment.mpStatus === 'rejected' || payment.mpStatus === 'cancelled') return this.markOrderCancelled(order, payment.mpStatus);
  }

  private async markOrderApproved(order: Order, payment: NormalizedPayment, paymentData: MercadoPagoPaymentData) {
    order.status = 'paid';
    await order.save();
    await Payment.create(this.buildPaymentPayload(order, payment, paymentData));
    console.log(`[WebhookMP] Pagamento aprovado para o pedido ${order.id}`);
  }

  private async markOrderPending(order: Order) {
    order.status = 'pending';
    await order.save();
    console.log(`[WebhookMP] Pagamento pendente para o pedido ${order.id}`);
  }

  private async markOrderCancelled(order: Order, status: string) {
    order.status = 'cancelled';
    await order.save();
    console.log(`[WebhookMP] Payment ${status} for order ${order.id}`);
  }

  private async markWebhookAsProcessed(webhook: PaymentWebhook) {
    webhook.processed = true;
    await webhook.save();
  }

  private buildWebhookPayload(payment: NormalizedPayment, paymentData: MercadoPagoPaymentData) {
    return {
      order_id: parseInt(payment.externalReference), mercado_pago_id: payment.mpPaymentId,
      mercado_pago_status: payment.mpStatus, mercado_pago_status_detail: payment.mpStatusDetail,
      amount: payment.amount, payment_method_id: payment.paymentMethodId,
      payer_email: payment.payerEmail, raw_data: paymentData, processed: false,
    };
  }

  private buildPaymentPayload(order: Order, payment: NormalizedPayment, paymentData: MercadoPagoPaymentData) {
    return {
      order_id: order.id, mercado_pago_id: payment.mpPaymentId, status: 'approved',
      amount: payment.amount, payment_method: payment.paymentMethodId,
      payer_email: payment.payerEmail, raw_data: paymentData,
    };
  }

  getPaymentStatus = async (req: AuthRequest, res: Response) => {
    try {
      return await this.getPaymentStatusInternal(req, res);
    } catch (error) {
      console.error('[PaymentStatus] Erro:', error);
      res.status(500).json({ error: 'Erro ao buscar status do pagamento' });
    }
  }

  private async handleNotificationInternal(req: Request, res: Response) {
    const payload = this.extractNotificationPayload(req);
    const topic = this.extractNotificationTopic(payload);
    const paymentId = this.extractNotificationPaymentId(payload);

    console.log(`[WebhookMP] Notificação recebida: topic=${topic}, paymentId=${paymentId || payload.id || 'N/A'}`);
    if (!this.shouldProcessTopic(topic)) return this.ackIgnoredTopic(topic, res);
    if (topic === 'merchant_order' && paymentId) {
      await this.processMerchantOrderById(paymentId);
      return res.sendStatus(200);
    }
    if (topic === 'payment' && paymentId) await this.processPaymentById(paymentId);
    return res.sendStatus(200);
  }

  private async getPaymentStatusInternal(req: AuthRequest, res: Response) {
    const orderId = req.params.id;
    const paymentId = this.getPaymentIdFromRequest(req);
    let order = await Order.findByPk(orderId);
    if (!order) return this.orderNotFound(res);

    if (!this.usuarioPodeAcessarPedido(req, order)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (paymentId && order.status !== 'paid') {
      await this.processPaymentById(paymentId);
      order = await Order.findByPk(orderId);
      if (!order) return this.orderNotFound(res);
    }

    const latestWebhook = await this.getLatestWebhook(orderId);
    return res.json(this.buildStatusResponse(order, latestWebhook));
  }

  private extractNotificationPayload(req: Request): MercadoPagoNotificationPayload {
    const query = ((req.query as Record<string, string | undefined>) || {}) as Record<string, string | undefined>;
    const body = ((req.body || {}) as MercadoPagoNotificationPayload) || {};

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

  private extractNotificationTopic(payload: MercadoPagoNotificationPayload) {
    const rawTopic = payload.topic || payload.type || payload.action?.split('.')[0] || '';
    return String(rawTopic);
  }

  private extractNotificationPaymentId(payload: MercadoPagoNotificationPayload) {
    if (typeof payload.resource === 'object' && payload.resource?.id != null) {
      return String(payload.resource.id);
    }

    if (typeof payload.resource === 'string') {
      const resourceId = payload.resource.split('/').filter(Boolean).pop();
      if (resourceId) return resourceId;
    }

    if (payload.data?.id != null) return String(payload.data.id);
    if ((payload.topic === 'payment' || payload.type === 'payment') && payload.id != null) return String(payload.id);
    return null;
  }

  private getPaymentIdFromRequest(req: Request) {
    const query = req.query as Record<string, string | undefined>;
    return query.payment_id || query.paymentId || undefined;
  }

  private shouldProcessTopic(topic: string) {
    return topic === 'payment' || topic === 'merchant_order';
  }

  private ackIgnoredTopic(topic: string, res: Response) {
    console.log(`[WebhookMP] Ignorando tópico: ${topic}`);
    return res.sendStatus(200);
  }

  private async getLatestWebhook(orderId: string) {
    const webhooks = await PaymentWebhook.findAll({
      where: { order_id: parseInt(orderId) },
      order: [['createdAt', 'DESC']],
      limit: 1,
    });
    return webhooks[0] || null;
  }

  private buildStatusResponse(order: Order, latestWebhook: PaymentWebhook | null) {
    return { order_id: order.id, order_status: order.status, latest_webhook: latestWebhook };
  }

  private usuarioPodeAcessarPedido(req: AuthRequest, order: Order) {
    if (!req.userId) return false;
    if (req.isAdmin) return true;
    return Number(order.customer_id) === Number(req.userId);
  }

  private orderNotFound(res: Response) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }
}

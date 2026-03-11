import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { Coupon } from '../models/Coupon';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' 
});

interface ItemPedido {
  productId: number | string;
  productName: string;
  price: number;
  quantity: number;
}

interface CorpoPedido {
  items: ItemPedido[];
  customerEmail: string;
  customerName: string;
  customerCpf: string;
  customerId?: number;
  totalPrice: number;
  couponCode?: string;
}

interface RespostaPagamento {
  orderId: number;
  init_point: string | null;
  preference_id: string | null;
  warning?: string;
  mode?: string;
}

export class OrderController {
  public create = async (req: Request, res: Response): Promise<Response> => {
    try {
      const body = this.extrairPedido(req);
      const pricing = await this.calcularTotais(body);
      const order = await this.salvarPedido(body, pricing);
      await this.salvarItens(order.id, body.items);
      return res.json(await this.gerarPagamento(order, body));
    } catch (error) {
      return this.responderErroCriacao(res, error as Error | string | number | boolean | object | null | undefined);
    }
  };

  private extrairPedido(req: Request): CorpoPedido {
    const body = req.body as CorpoPedido;
    if (!body.items || body.items.length === 0) throw new Error('Pedido vazio');
    return body;
  }

  private responderErroCriacao(
    res: Response,
    error: Error | string | number | boolean | object | null | undefined
  ) {
    const msg = this.normalizarErro(error);
    if (msg === 'Pedido vazio') return res.status(400).json({ error: msg });
    console.error('Erro criando pedido:', msg);
    return res.status(500).json({ error: `Erro ao processar pedido: ${msg}` });
  }

  public list = async (req: Request, res: Response): Promise<Response> => {
    try {
      const orders = await this.buscarPedidos(req.query.userId as string | undefined);
      return res.json(orders);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar pedidos' });
    }
  };

  public markPaid = async (req: Request, res: Response): Promise<Response> => {
    try {
      const order = await Order.findByPk(req.params.id);
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
      await order.update({ status: 'paid' });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Falha ao atualizar' });
    }
  };

  private async salvarPedido(
    body: CorpoPedido,
    pricing: { subtotal: number; discountAmount: number; finalTotal: number; couponCode: string | null }
  ): Promise<Order> {
    return Order.create(this.montarPayloadPedido(body, pricing));
  }

  private montarPayloadPedido(
    body: CorpoPedido,
    pricing: { subtotal: number; discountAmount: number; finalTotal: number; couponCode: string | null }
  ) {
    return {
      customer_id: body.customerId || null,
      customer_email: body.customerEmail,
      customer_name: body.customerName || null,
      subtotal_price: pricing.subtotal,
      coupon_code: pricing.couponCode,
      discount_amount: pricing.discountAmount,
      total_price: pricing.finalTotal,
      status: 'pending' as const,
    };
  }

  private async calcularTotais(body: CorpoPedido): Promise<{ subtotal: number; discountAmount: number; finalTotal: number; couponCode: string | null }> {
    const subtotal = this.calcularSubtotal(body.items);
    const { discountPercent, couponCode } = await this.obterDescontoCupom(body.couponCode);
    const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
    const finalTotal = Number(Math.max(0, subtotal - discountAmount).toFixed(2));
    return { subtotal, discountAmount, finalTotal, couponCode };
  }

  private calcularSubtotal(items: ItemPedido[]): number {
    return Number(
      items.reduce((acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 0), 0).toFixed(2)
    );
  }

  private async obterDescontoCupom(code?: string): Promise<{ discountPercent: number; couponCode: string | null }> {
    if (!code) return { discountPercent: 0, couponCode: null };
    const normalizedCode = String(code).trim().toUpperCase();
    const coupon = await Coupon.findOne({ where: { code: normalizedCode } });
    if (!coupon) throw new Error('Cupom inválido');
    return { discountPercent: Number(coupon.discount || 0), couponCode: normalizedCode };
  }

  private async salvarItens(orderId: number, items: ItemPedido[]): Promise<void> {
    const promessas = items.map(it => OrderItem.create({
      order_id: orderId, product_id: Number(it.productId), product_name: it.productName || '',
      price_at_purchase: it.price || 0, quantity: it.quantity,
    }));
    await Promise.all(promessas);
  }

  private async gerarPagamento(order: Order, body: CorpoPedido): Promise<RespostaPagamento> {
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return this.gerarMockPreference(order.id);
    try {
      return await this.criarPreferenciaMercadoPago(order, body);
    } catch (err) {
      throw new Error(this.logAndNormalizeMpError(err as Error | string | number | boolean | object | null | undefined));
    }
  }

  private logAndNormalizeMpError(err: Error | string | number | boolean | object | null | undefined) {
    const message = this.normalizarErro(err);
    console.error('ERRO MERCADO PAGO:', message);
    return message;
  }

  private async criarPreferenciaMercadoPago(order: Order, body: CorpoPedido): Promise<RespostaPagamento> {
    const preference = new Preference(client);
    const preferenceBody = this.montarCorpoPreferencia(order, body);
    console.debug('Enviando preferência MP:', JSON.stringify(preferenceBody));
    const res = await preference.create({ body: preferenceBody });
    return { orderId: order.id, init_point: res.init_point || null, preference_id: res.id || null };
  }

  private normalizarErro(err: Error | string | number | boolean | object | null | undefined): string {
    if (err instanceof Error) return err.message;
    try { return JSON.stringify(err); } catch { return String(err); }
  }

  private gerarMockPreference(orderId: number): RespostaPagamento {
    return {
      orderId, preference_id: `SANDBOX-${orderId}-${Date.now()}`, mode: 'mock',
      init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?preference-id=SANDBOX-${orderId}`,
    };
  }

  private montarCorpoPreferencia(order: Order, body: CorpoPedido) {
    return {
      items: body.items.map(it => ({ id: String(it.productId), title: it.productName || 'Produto', quantity: Number(it.quantity) || 1, currency_id: 'BRL', unit_price: Number(it.price) })),
      payer: this.montarPagador(body), external_reference: String(order.id),
      back_urls: this.montarUrlsRetorno(order.id), auto_return: 'approved' as const,
    };
  }

  private montarPagador(body: CorpoPedido) {
    const parts = (body.customerName || '').trim().split(' ');
    return {
      email: body.customerEmail || 'teste@teste.com',
      name: parts[0] || 'Cliente', surname: parts.slice(1).join(' ').trim() || 'Cliente',
      identification: body.customerCpf ? { type: 'CPF', number: body.customerCpf.replace(/\D/g, '') } : undefined,
    };
  }

  private montarUrlsRetorno(orderId: number) {
    const base = this.obterBaseUrl();
    return {
      success: `${base}/order-success?order_id=${orderId}`,
      failure: `${base}/checkout`,
      pending: `${base}/checkout`,
    };
  }

  private obterBaseUrl(): string {
    let base = (process.env.FRONT_URL || '').trim();
    if (!base) base = 'http://localhost:3000';
    base = base.replace(/\/+$/g, '');
    if (!/^https?:\/\//i.test(base)) base = 'http://' + base;
    return base;
  }

  private async buscarPedidos(userId?: string) {
     const where = userId ? { customer_id: userId } : {};
     return Order.findAll({ where, include: [{ model: OrderItem, as: 'order_items' }] });
  }
}
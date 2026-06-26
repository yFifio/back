import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { Product } from '../models/Produtos';
import { Coupon } from '../models/Coupon';
import { User } from '../models/User';
import { AuthRequest } from '../types';

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
  paymentMethod?: string;
  couponCode?: string;
  deliveryAddress?: {
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
  };
}

type StatusPedido = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

interface RespostaPagamento {
  orderId: number;
  init_point: string | null;
  preference_id: string | null;
  warning?: string;
  mode?: string;
}

export class OrderController {
  public create = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const body = this.extrairPedido(req);
      if (!req.userId) return res.status(401).json({ error: 'Usuário não autenticado' });
      body.customerId = req.userId;
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

  public list = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const requestingUser = await this.buscarUsuarioAutenticado(req.userId);
      if (!requestingUser) return res.status(401).json({ error: 'Usuário não autenticado' });

      const requestedUserId = req.query.userId as string | undefined;
      const isAdminRequest = Boolean(req.isAdmin || requestingUser.isAdmin);
      const effectiveUserId = isAdminRequest ? requestedUserId : String(requestingUser.id);

      const orders = await this.buscarPedidos(effectiveUserId);
      await this.sincronizarPedidosPendentes(orders);

      if (orders.some((order) => order.status === 'pending')) {
        const refreshedOrders = await this.buscarPedidos(effectiveUserId);
        return res.json(refreshedOrders);
      }

      return res.json(orders);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar pedidos' });
    }
  };

  private async sincronizarPedidosPendentes(orders: Order[]): Promise<void> {
    // Placeholder for future payment synchronization
  }


  public markPaid = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const order = await Order.findByPk(req.params.id);
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
      if (!(await this.usuarioPodeAcessarPedido(req, order))) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      // Only admins or payment confirmations can mark as paid
      if (!req.isAdmin) {
        return res.status(403).json({ error: 'Apenas administradores podem marcar pedidos como pagos' });
      }

      await order.update({ status: 'paid' });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Falha ao atualizar' });
    }
  };

  public updateStatus = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const requestingUser = await this.buscarUsuarioAutenticado(req.userId);
      if (!requestingUser?.isAdmin) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
        const tokenIsAdmin = Boolean(req.isAdmin);
        if (!tokenIsAdmin) {
          const requestingUser = await this.buscarUsuarioAutenticado(req.userId);
          if (!requestingUser?.isAdmin) {
            return res.status(403).json({ error: 'Acesso negado' });
          }
        }

        const status = this.normalizarStatus(req.body?.status);
        if (!status) {
          return res.status(400).json({ error: 'Status inválido' });
        }

        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

        await order.update({ status });
        return res.json({ success: true, orderId: order.id, status });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao atualizar status';
        return res.status(500).json({ error: message });
      }
    };

  public updateDelivery = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const requestingUser = await this.buscarUsuarioAutenticado(req.userId);
      if (!requestingUser?.isAdmin && !req.isAdmin) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const order = await Order.findByPk(req.params.id);
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

      const payload = {
        delivery_address: req.body?.delivery_address ?? null,
        delivery_city: req.body?.delivery_city ?? null,
        delivery_state: req.body?.delivery_state ?? null,
        delivery_zip: req.body?.delivery_zip ?? null,
        delivery_phone: req.body?.delivery_phone ?? null,
        tracking_code: req.body?.tracking_code ?? null,
      };

      await order.update(payload);
      return res.json(order);
    } catch (error) {
      return res.status(500).json({ error: 'Falha ao atualizar dados de entrega' });
    }
  };

  public delete = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const requestingUser = await this.buscarUsuarioAutenticado(req.userId);
      if (!requestingUser?.isAdmin && !req.isAdmin) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const order = await Order.findByPk(req.params.id);
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

      await order.destroy();
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: 'Falha ao excluir pedido' });
    }
  };

  public sendTrackingEmail = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const requestingUser = await this.buscarUsuarioAutenticado(req.userId);
      if (!requestingUser?.isAdmin && !req.isAdmin) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const order = await Order.findByPk(req.params.id);
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

      return res.json({ success: true, message: 'Email de rastreio enfileirado' });
    } catch (error) {
      return res.status(500).json({ error: 'Falha ao enviar email de rastreio' });
    }
  };

  public syncPaymentStatus = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const order = await Order.findByPk(req.params.id);
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
      if (!(await this.usuarioPodeAcessarPedido(req, order))) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      if (order.status === 'paid') {
        return res.json({ status: 'paid', message: 'Pedido já foi marcado como pago' });
      }

      return res.json({
        status: order.status,
        message: 'Sincronização de pagamento desativada (modo ilustrativo)'
      });
    } catch (error) {
      return res.status(500).json({ error: 'Falha ao sincronizar pagamento' });
    }
  };


  private async salvarPedido(
    body: CorpoPedido,
    pricing: { subtotal: number; discountAmount: number; finalTotal: number; couponCode: string | null }
  ): Promise<Order> {
    const payload = this.montarPayloadPedido(body, pricing);
    try {
      return await Order.create(payload);
    } catch (error) {
      if (this.isMissingDefaultIdError(error)) {
        const nextId = await this.getNextOrderId();
        return Order.create({ ...payload, id: nextId });
      }
      throw error;
    }
  }

  private async getNextOrderId(): Promise<number> {
    const maxId = await Order.max('id');
    const numericMax = Number(maxId || 0);
    return Number.isFinite(numericMax) ? numericMax + 1 : 1;
  }

  private isMissingDefaultIdError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as {
      message?: string;
      parent?: { code?: string; sqlMessage?: string };
      original?: { code?: string; sqlMessage?: string };
    };
    const dbCode = maybeError.parent?.code || maybeError.original?.code;
    const dbMessage = String(
      maybeError.parent?.sqlMessage || maybeError.original?.sqlMessage || maybeError.message || ''
    );
    return dbCode === 'ER_NO_DEFAULT_FOR_FIELD' || dbMessage.includes("Field 'id' doesn't have a default value");
  }

  private montarPayloadPedido(
    body: CorpoPedido,
    pricing: { subtotal: number; discountAmount: number; finalTotal: number; couponCode: string | null }
  ) {
    const delivery = body.deliveryAddress;

    return {
      customer_id: body.customerId || null,
      customer_email: body.customerEmail,
      customer_name: body.customerName || null,
      customer_cpf: body.customerCpf || null,
      subtotal_price: pricing.subtotal,
      coupon_code: pricing.couponCode,
      discount_amount: pricing.discountAmount,
      total_price: pricing.finalTotal,
      delivery_address: delivery?.address || null,
      delivery_city: delivery?.city || null,
      delivery_state: delivery?.state || null,
      delivery_zip: delivery?.zip || null,
      delivery_phone: delivery?.phone || null,
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
    // All orders now use illustrative (mock) payment mode
    if (order.status !== 'paid') {
      await order.update({ status: 'paid' });
    }

    return {
      orderId: order.id,
      init_point: null,
      preference_id: null,
      mode: 'illustrative',
      warning: 'Pagamento confirmado no site.',
    };
  }

  private async buscarUsuarioAutenticado(userId?: number) {
    if (!userId) return null;
    return User.findByPk(userId);
  }

  private async usuarioPodeAcessarPedido(req: AuthRequest, order: Order) {
    if (!req.userId) return false;
    if (req.isAdmin) return true;
    return Number(order.customer_id) === Number(req.userId);
  }

  public async buscarPedidoPorId(orderId: number) {
    return Order.findByPk(orderId);
  }

  private normalizarErro(err: Error | string | number | boolean | object | null | undefined): string {
    if (err instanceof Error) return err.message;
    try { return JSON.stringify(err); } catch { return String(err); }
  }

  private normalizarStatus(value: unknown): StatusPedido | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!['pending', 'paid', 'shipped', 'delivered', 'cancelled'].includes(normalized)) {
      return null;
    }
    return normalized as StatusPedido;
  }

  private async buscarPedidos(userId?: string) {
     const where = userId ? { customer_id: userId } : {};
     return Order.findAll({
       where,
       include: [
         {
           model: OrderItem,
           as: 'order_items',
           include: [
             { model: Product, as: 'products', attributes: ['id', 'name', 'category', 'image_url'] }
           ]
         }
       ]
     });
  }
}
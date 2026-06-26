import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { AuthRequest } from '../types';

export class PaymentNotificationController {
  handleNotification = async (req: Request, res: Response) => {
    // Placeholder for potential future payment notification handling
    return res.sendStatus(200);
  };

  getPaymentStatus = async (req: AuthRequest, res: Response) => {
    try {
      const orderId = req.params.id;
      const order = await Order.findByPk(orderId);
      
      if (!order) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      if (!this.usuarioPodeAcessarPedido(req, order)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      return res.json({ 
        order_id: order.id, 
        order_status: order.status 
      });
    } catch (error) {
      console.error('[PaymentStatus] Erro:', error);
      res.status(500).json({ error: 'Erro ao buscar status do pagamento' });
    }
  };

  private usuarioPodeAcessarPedido(req: AuthRequest, order: Order) {
    if (!req.userId) return false;
    if (req.isAdmin) return true;
    return Number(order.customer_id) === Number(req.userId);
  }
}

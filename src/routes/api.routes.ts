import { Router, Request, Response } from 'express';
import { UserController } from '../controllers/UserController';
import { PaymentNotificationController } from '../controllers/PaymentNotificationController';
import { OrderController } from '../controllers/OrderController';
import { CategoryController } from '../controllers/CategoryController';
import { SystemController } from '../controllers/SystemController';
import { SupplierController } from '../controllers/SupplierController';
import { ShippingMethodController } from '../controllers/ShippingMethodController';
import { CouponController } from '../controllers/CouponController';
import { ProductController } from '../controllers/ProductController';
import { Product } from '../models/Produtos';
import { OrderItem } from '../models/OrderItem';
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import { authMiddleware } from '../middleware/auth';
import { authAdminMiddleware } from '../middleware/authAdmin';

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' 
});

const router = Router();
const userCtrl = new UserController();
const orderCtrl = new OrderController();
const paymentCtrl = new PaymentNotificationController();
const categoryCtrl = new CategoryController();
const systemCtrl = new SystemController();
const supplierCtrl = new SupplierController();
const shippingCtrl = new ShippingMethodController();
const couponCtrl = new CouponController();
const productCtrl = new ProductController();

router.get('/mercadopago/check', authAdminMiddleware, async (req: Request, res: Response) => {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return res.status(400).json({ ok: false, error: 'Token não configurado' });

  try {
    const paymentClient = new MPPayment(client);
    const searchResult = await paymentClient.search({}); 
    return res.json({ ok: true, message: 'Credencial válida', searchResult });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
    return res.status(500).json({ ok: false, error: errorMsg });
  }
});

router.get('/welcome', (req: Request, res: Response) => res.send('welcome'));

router.post('/register', (req: Request, res: Response) => userCtrl.register(req, res));
router.post('/login', (req: Request, res: Response) => userCtrl.login(req, res));
router.get('/users', authAdminMiddleware, (req: Request, res: Response) => userCtrl.list(req, res));
router.delete('/users/:id', authAdminMiddleware, (req: Request, res: Response) => userCtrl.delete(req, res));
router.put('/users/me', authMiddleware, (req: Request, res: Response) => userCtrl.updateMe(req, res));
router.put('/users/:id', authAdminMiddleware, (req: Request, res: Response) => userCtrl.updateById(req, res));

router.get('/products', (req: Request, res: Response) => productCtrl.list(req, res));
router.get('/products/:id', authAdminMiddleware, (req: Request, res: Response) => productCtrl.getById(req, res));
router.post('/products', authAdminMiddleware, (req: Request, res: Response) => productCtrl.create(req, res));
router.put('/products/:id', authAdminMiddleware, (req: Request, res: Response) => productCtrl.update(req, res));
router.delete('/products/:id', authAdminMiddleware, (req: Request, res: Response) => productCtrl.delete(req, res));

router.get('/categories', (req: Request, res: Response) => categoryCtrl.list(req, res));
router.post('/categories', authAdminMiddleware, (req: Request, res: Response) => categoryCtrl.create(req, res));
router.put('/categories/:id', authAdminMiddleware, (req: Request, res: Response) => categoryCtrl.update(req, res));
router.delete('/categories/:id', authAdminMiddleware, (req: Request, res: Response) => categoryCtrl.delete(req, res));
router.get('/categories/:id', (req: Request, res: Response) => categoryCtrl.getById(req, res));

router.post('/orders', authMiddleware, (req: Request, res: Response) => orderCtrl.create(req, res));
router.get('/orders', authMiddleware, (req: Request, res: Response) => orderCtrl.list(req, res));
router.post('/orders/:id/mark-paid', authMiddleware, (req: Request, res: Response) => orderCtrl.markPaid(req, res));
router.put('/orders/:id/status', authAdminMiddleware, (req: Request, res: Response) => orderCtrl.updateStatus(req, res));
router.patch('/orders/:id', authAdminMiddleware, (req: Request, res: Response) => orderCtrl.updateDelivery(req, res));
router.post('/orders/:id/tracking-email', authAdminMiddleware, (req: Request, res: Response) => orderCtrl.sendTrackingEmail(req, res));
router.get('/orders/:id/sync-payment', authMiddleware, (req: Request, res: Response) => orderCtrl.syncPaymentStatus(req, res));

  router.get('/systems', authAdminMiddleware, (req: Request, res: Response) => systemCtrl.list(req, res));
  router.post('/systems', authAdminMiddleware, (req: Request, res: Response) => systemCtrl.create(req, res));
  router.put('/systems/:id', authAdminMiddleware, (req: Request, res: Response) => systemCtrl.update(req, res));
  router.delete('/systems/:id', authAdminMiddleware, (req: Request, res: Response) => systemCtrl.delete(req, res));

  router.get('/suppliers', authAdminMiddleware, (req: Request, res: Response) => supplierCtrl.list(req, res));
  router.get('/suppliers/:id', authAdminMiddleware, (req: Request, res: Response) => supplierCtrl.getById(req, res));
  router.post('/suppliers', authAdminMiddleware, (req: Request, res: Response) => supplierCtrl.create(req, res));
  router.put('/suppliers/:id', authAdminMiddleware, (req: Request, res: Response) => supplierCtrl.update(req, res));
  router.delete('/suppliers/:id', authAdminMiddleware, (req: Request, res: Response) => supplierCtrl.delete(req, res));

  router.get('/shipping', authAdminMiddleware, (req: Request, res: Response) => shippingCtrl.list(req, res));
  router.get('/shipping/:id', authAdminMiddleware, (req: Request, res: Response) => shippingCtrl.getById(req, res));
  router.post('/shipping', authAdminMiddleware, (req: Request, res: Response) => shippingCtrl.create(req, res));
  router.put('/shipping/:id', authAdminMiddleware, (req: Request, res: Response) => shippingCtrl.update(req, res));
  router.delete('/shipping/:id', authAdminMiddleware, (req: Request, res: Response) => shippingCtrl.delete(req, res));

  router.get('/coupons', authAdminMiddleware, (req: Request, res: Response) => couponCtrl.list(req, res));
  router.get('/coupons/:id', authAdminMiddleware, (req: Request, res: Response) => couponCtrl.getById(req, res));
  router.post('/coupons/validate', (req: Request, res: Response) => couponCtrl.validate(req, res));
  router.post('/coupons', authAdminMiddleware, (req: Request, res: Response) => couponCtrl.create(req, res));
  router.put('/coupons/:id', authAdminMiddleware, (req: Request, res: Response) => couponCtrl.update(req, res));
  router.delete('/coupons/:id', authAdminMiddleware, (req: Request, res: Response) => couponCtrl.delete(req, res));

router.post('/downloads/request', authMiddleware, async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token não informado.' });

  if (typeof token === 'string' && token.startsWith('sim_')) {
    const authReq = req as Request & { userId?: number; isAdmin?: boolean };
    const parts = token.split('_');
    const orderId = Number(parts[1]);
    const productId = Number(parts[2]);
    const namePart = parts.slice(3).join('_');

    if (!Number.isFinite(orderId) || orderId <= 0 || !Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Token de download inválido.' });
    }

    const order = await orderCtrl.buscarPedidoPorId(orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

    const canAccess = authReq.isAdmin || (authReq.userId && order.customer_id === authReq.userId);
    if (!canAccess) {
      return res.status(403).json({ error: 'Acesso negado ao download.' });
    }

    const orderItem = await OrderItem.findOne({ where: { order_id: orderId, product_id: productId } });
    if (!orderItem) {
      return res.status(404).json({ error: 'Arquivo digital não encontrado neste pedido.' });
    }

    if (order.status === 'paid') {
      await order.update({ status: 'delivered' });
    }

    const product = await Product.findByPk(productId);
    if (product?.category === 'digital' && product.pdf_url) {
      return res.json({
        url: product.pdf_url,
        remainingDownloads: null,
        simulated: false,
        fileName: product.pdf_file_name || `${product.name}.pdf`
      });
    }

    const productName = namePart ? decodeURIComponent(namePart) : 'Produto Digital';
    const content = [
      '=== ARQUIVO DIGITAL ===',
      `Produto: ${productName}`,
      `Baixado em: ${new Date().toLocaleString('pt-BR')}`,
      '',
      'Obrigado pela sua compra!'
    ].join('\n');
    const base64 = Buffer.from(content, 'utf-8').toString('base64');
    return res.json({
      url: `data:text/plain;base64,${base64}`,
      remainingDownloads: null,
      simulated: true
    });
  }

  return res.status(404).json({ error: 'Token de download não encontrado ou expirado.' });
});

router.get('/notifications/mercadopago', (req: Request, res: Response) => paymentCtrl.handleNotification(req, res));
router.post('/notifications/mercadopago', (req: Request, res: Response) => paymentCtrl.handleNotification(req, res));
router.get('/orders/:id/payment-status', authMiddleware, (req: Request, res: Response) => paymentCtrl.getPaymentStatus(req, res));

export default router;
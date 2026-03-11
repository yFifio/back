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
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import { authMiddleware } from '../middleware/auth';

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

router.get('/mercadopago/check', async (req: Request, res: Response) => {
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
router.get('/users', authMiddleware, (req: Request, res: Response) => userCtrl.list(req, res));
router.delete('/users/:id', authMiddleware, (req: Request, res: Response) => userCtrl.delete(req, res));
router.put('/users/me', authMiddleware, (req: Request, res: Response) => userCtrl.updateMe(req, res));
router.put('/users/:id', authMiddleware, (req: Request, res: Response) => userCtrl.updateById(req, res));

router.get('/products', authMiddleware, (req: Request, res: Response) => productCtrl.list(req, res));
router.get('/products/:id', authMiddleware, (req: Request, res: Response) => productCtrl.getById(req, res));
router.post('/products', authMiddleware, (req: Request, res: Response) => productCtrl.create(req, res));
router.put('/products/:id', authMiddleware, (req: Request, res: Response) => productCtrl.update(req, res));
router.delete('/products/:id', authMiddleware, (req: Request, res: Response) => productCtrl.delete(req, res));

router.get('/categories', authMiddleware, (req: Request, res: Response) => categoryCtrl.list(req, res));
router.post('/categories', authMiddleware, (req: Request, res: Response) => categoryCtrl.create(req, res));
router.put('/categories/:id', authMiddleware, (req: Request, res: Response) => categoryCtrl.update(req, res));
router.delete('/categories/:id', authMiddleware, (req: Request, res: Response) => categoryCtrl.delete(req, res));
router.get('/categories/:id', authMiddleware, (req: Request, res: Response) => categoryCtrl.getById(req, res));

router.post('/orders', authMiddleware, (req: Request, res: Response) => orderCtrl.create(req, res));
router.get('/orders', authMiddleware, (req: Request, res: Response) => orderCtrl.list(req, res));
router.post('/orders/:id/mark-paid', authMiddleware, (req: Request, res: Response) => orderCtrl.markPaid(req, res));

  router.get('/systems', authMiddleware, (req: Request, res: Response) => systemCtrl.list(req, res));
  router.post('/systems', authMiddleware, (req: Request, res: Response) => systemCtrl.create(req, res));
  router.put('/systems/:id', authMiddleware, (req: Request, res: Response) => systemCtrl.update(req, res));
  router.delete('/systems/:id', authMiddleware, (req: Request, res: Response) => systemCtrl.delete(req, res));

  router.get('/suppliers', authMiddleware, (req: Request, res: Response) => supplierCtrl.list(req, res));
  router.get('/suppliers/:id', authMiddleware, (req: Request, res: Response) => supplierCtrl.getById(req, res));
  router.post('/suppliers', authMiddleware, (req: Request, res: Response) => supplierCtrl.create(req, res));
  router.put('/suppliers/:id', authMiddleware, (req: Request, res: Response) => supplierCtrl.update(req, res));
  router.delete('/suppliers/:id', authMiddleware, (req: Request, res: Response) => supplierCtrl.delete(req, res));

  router.get('/shipping', authMiddleware, (req: Request, res: Response) => shippingCtrl.list(req, res));
  router.get('/shipping/:id', authMiddleware, (req: Request, res: Response) => shippingCtrl.getById(req, res));
  router.post('/shipping', authMiddleware, (req: Request, res: Response) => shippingCtrl.create(req, res));
  router.put('/shipping/:id', authMiddleware, (req: Request, res: Response) => shippingCtrl.update(req, res));
  router.delete('/shipping/:id', authMiddleware, (req: Request, res: Response) => shippingCtrl.delete(req, res));

  router.get('/coupons', authMiddleware, (req: Request, res: Response) => couponCtrl.list(req, res));
  router.get('/coupons/:id', authMiddleware, (req: Request, res: Response) => couponCtrl.getById(req, res));
  router.post('/coupons/validate', authMiddleware, (req: Request, res: Response) => couponCtrl.validate(req, res));
  router.post('/coupons', authMiddleware, (req: Request, res: Response) => couponCtrl.create(req, res));
  router.put('/coupons/:id', authMiddleware, (req: Request, res: Response) => couponCtrl.update(req, res));
  router.delete('/coupons/:id', authMiddleware, (req: Request, res: Response) => couponCtrl.delete(req, res));

router.post('/notifications/mercadopago', (req: Request, res: Response) => paymentCtrl.handleNotification(req, res));
router.get('/orders/:id/payment-status', (req: Request, res: Response) => paymentCtrl.getPaymentStatus(req, res));

export default router;
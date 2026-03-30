import { Router } from 'express';
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
router.get('/mercadopago/check', authAdminMiddleware, async (req, res) => {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token)
        return res.status(400).json({ ok: false, error: 'Token não configurado' });
    try {
        const paymentClient = new MPPayment(client);
        const searchResult = await paymentClient.search({});
        return res.json({ ok: true, message: 'Credencial válida', searchResult });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        return res.status(500).json({ ok: false, error: errorMsg });
    }
});
router.get('/welcome', (req, res) => res.send('welcome'));
router.post('/register', (req, res) => userCtrl.register(req, res));
router.post('/login', (req, res) => userCtrl.login(req, res));
router.get('/users', authAdminMiddleware, (req, res) => userCtrl.list(req, res));
router.delete('/users/:id', authAdminMiddleware, (req, res) => userCtrl.delete(req, res));
router.put('/users/me', authMiddleware, (req, res) => userCtrl.updateMe(req, res));
router.put('/users/:id', authAdminMiddleware, (req, res) => userCtrl.updateById(req, res));
router.get('/products', (req, res) => productCtrl.list(req, res));
router.get('/products/:id', authAdminMiddleware, (req, res) => productCtrl.getById(req, res));
router.post('/products', authAdminMiddleware, (req, res) => productCtrl.create(req, res));
router.put('/products/:id', authAdminMiddleware, (req, res) => productCtrl.update(req, res));
router.delete('/products/:id', authAdminMiddleware, (req, res) => productCtrl.delete(req, res));
router.get('/categories', (req, res) => categoryCtrl.list(req, res));
router.post('/categories', authAdminMiddleware, (req, res) => categoryCtrl.create(req, res));
router.put('/categories/:id', authAdminMiddleware, (req, res) => categoryCtrl.update(req, res));
router.delete('/categories/:id', authAdminMiddleware, (req, res) => categoryCtrl.delete(req, res));
router.get('/categories/:id', (req, res) => categoryCtrl.getById(req, res));
router.post('/orders', authMiddleware, (req, res) => orderCtrl.create(req, res));
router.get('/orders', authMiddleware, (req, res) => orderCtrl.list(req, res));
router.post('/orders/:id/mark-paid', authMiddleware, (req, res) => orderCtrl.markPaid(req, res));
router.put('/orders/:id/status', authAdminMiddleware, (req, res) => orderCtrl.updateStatus(req, res));
router.patch('/orders/:id', authAdminMiddleware, (req, res) => orderCtrl.updateDelivery(req, res));
router.post('/orders/:id/tracking-email', authAdminMiddleware, (req, res) => orderCtrl.sendTrackingEmail(req, res));
router.get('/orders/:id/sync-payment', authMiddleware, (req, res) => orderCtrl.syncPaymentStatus(req, res));
router.get('/systems', authAdminMiddleware, (req, res) => systemCtrl.list(req, res));
router.post('/systems', authAdminMiddleware, (req, res) => systemCtrl.create(req, res));
router.put('/systems/:id', authAdminMiddleware, (req, res) => systemCtrl.update(req, res));
router.delete('/systems/:id', authAdminMiddleware, (req, res) => systemCtrl.delete(req, res));
router.get('/suppliers', authAdminMiddleware, (req, res) => supplierCtrl.list(req, res));
router.get('/suppliers/:id', authAdminMiddleware, (req, res) => supplierCtrl.getById(req, res));
router.post('/suppliers', authAdminMiddleware, (req, res) => supplierCtrl.create(req, res));
router.put('/suppliers/:id', authAdminMiddleware, (req, res) => supplierCtrl.update(req, res));
router.delete('/suppliers/:id', authAdminMiddleware, (req, res) => supplierCtrl.delete(req, res));
router.get('/shipping', authAdminMiddleware, (req, res) => shippingCtrl.list(req, res));
router.get('/shipping/:id', authAdminMiddleware, (req, res) => shippingCtrl.getById(req, res));
router.post('/shipping', authAdminMiddleware, (req, res) => shippingCtrl.create(req, res));
router.put('/shipping/:id', authAdminMiddleware, (req, res) => shippingCtrl.update(req, res));
router.delete('/shipping/:id', authAdminMiddleware, (req, res) => shippingCtrl.delete(req, res));
router.get('/coupons', authAdminMiddleware, (req, res) => couponCtrl.list(req, res));
router.get('/coupons/:id', authAdminMiddleware, (req, res) => couponCtrl.getById(req, res));
router.post('/coupons/validate', (req, res) => couponCtrl.validate(req, res));
router.post('/coupons', authAdminMiddleware, (req, res) => couponCtrl.create(req, res));
router.put('/coupons/:id', authAdminMiddleware, (req, res) => couponCtrl.update(req, res));
router.delete('/coupons/:id', authAdminMiddleware, (req, res) => couponCtrl.delete(req, res));
router.post('/downloads/request', authMiddleware, async (req, res) => {
    const { token } = req.body;
    if (!token)
        return res.status(400).json({ error: 'Token não informado.' });
    if (typeof token === 'string' && token.startsWith('sim_')) {
        const authReq = req;
        const parts = token.split('_');
        const orderId = Number(parts[1]);
        const productId = Number(parts[2]);
        const namePart = parts.slice(3).join('_');
        if (!Number.isFinite(orderId) || orderId <= 0 || !Number.isFinite(productId) || productId <= 0) {
            return res.status(400).json({ error: 'Token de download inválido.' });
        }
        const order = await orderCtrl.buscarPedidoPorId(orderId);
        if (!order)
            return res.status(404).json({ error: 'Pedido não encontrado.' });
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
router.get('/notifications/mercadopago', (req, res) => paymentCtrl.handleNotification(req, res));
router.post('/notifications/mercadopago', (req, res) => paymentCtrl.handleNotification(req, res));
router.get('/orders/:id/payment-status', authMiddleware, (req, res) => paymentCtrl.getPaymentStatus(req, res));
export default router;

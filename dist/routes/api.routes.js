import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { PaymentNotificationController } from '../controllers/PaymentNotificationController';
import { OrderController } from '../controllers/OrderController';
import { CategoryController } from '../controllers/CategoryController';
import { SystemController } from '../controllers/SystemController';
import { SupplierController } from '../controllers/SupplierController';
import { ShippingMethodController } from '../controllers/ShippingMethodController';
import { CouponController } from '../controllers/CouponController';
import { Product } from '../models/Produtos';
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
router.get('/mercadopago/check', async (req, res) => {
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
// ==========================================
// 1. CRUD DE USUÁRIOS (Todas Autenticadas, exceto Login/Register)
// ==========================================
router.post('/register', (req, res) => userCtrl.register(req, res));
router.post('/login', (req, res) => userCtrl.login(req, res));
router.get('/users', authMiddleware, (req, res) => userCtrl.list(req, res));
router.delete('/users/:id', authMiddleware, (req, res) => userCtrl.delete(req, res));
router.put('/users/me', authMiddleware, (req, res) => userCtrl.updateMe(req, res));
// admin editing another user (email/cpf will be ignored)
router.put('/users/:id', authMiddleware, (req, res) => userCtrl.updateById(req, res));
// ==========================================
// 2. CRUD DE PRODUTOS (Todas Autenticadas + Validação 404)
// ==========================================
router.get('/products', authMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const { count, rows } = await Product.findAndCountAll({ limit, offset, order: [['id', 'DESC']] });
        res.json({ data: rows, total: count });
    }
    catch (error) {
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});
router.post('/products', authMiddleware, async (req, res) => {
    try {
        res.json(await Product.create(req.body));
    }
    catch (error) {
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
});
router.put('/products/:id', authMiddleware, async (req, res) => {
    try {
        const [afetados] = await Product.update(req.body, { where: { id: req.params.id } });
        if (afetados === 0)
            return res.status(404).json({ error: 'Produto não encontrado' });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
});
router.delete('/products/:id', authMiddleware, async (req, res) => {
    try {
        const afetados = await Product.destroy({ where: { id: req.params.id } });
        if (afetados === 0)
            return res.status(404).json({ error: 'Produto não encontrado' });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Erro ao deletar produto' });
    }
});
// ==========================================
// 3. CRUD DE CATEGORIAS (Todas Autenticadas - Completa a exigência da rubrica)
// ==========================================
router.get('/categories', authMiddleware, (req, res) => categoryCtrl.list(req, res));
router.post('/categories', authMiddleware, (req, res) => categoryCtrl.create(req, res));
router.put('/categories/:id', authMiddleware, (req, res) => categoryCtrl.update(req, res));
router.delete('/categories/:id', authMiddleware, (req, res) => categoryCtrl.delete(req, res));
router.get('/categories/:id', authMiddleware, (req, res) => categoryCtrl.getById(req, res));
// ==========================================
// ROTAS DE PEDIDOS (Autenticadas)
// ==========================================
router.post('/orders', authMiddleware, (req, res) => orderCtrl.create(req, res));
router.get('/orders', authMiddleware, (req, res) => orderCtrl.list(req, res));
router.post('/orders/:id/mark-paid', authMiddleware, (req, res) => orderCtrl.markPaid(req, res));
// ==========================================
// NOVOS CRUDS DE SISTEMAS (aba "Configurações")
// ==========================================
// legacy systems route (kept for compatibility, but not used)
router.get('/systems', authMiddleware, (req, res) => systemCtrl.list(req, res));
router.post('/systems', authMiddleware, (req, res) => systemCtrl.create(req, res));
router.put('/systems/:id', authMiddleware, (req, res) => systemCtrl.update(req, res));
router.delete('/systems/:id', authMiddleware, (req, res) => systemCtrl.delete(req, res));
// new real resources
router.get('/suppliers', authMiddleware, (req, res) => supplierCtrl.list(req, res));
router.post('/suppliers', authMiddleware, (req, res) => supplierCtrl.create(req, res));
router.put('/suppliers/:id', authMiddleware, (req, res) => supplierCtrl.update(req, res));
router.delete('/suppliers/:id', authMiddleware, (req, res) => supplierCtrl.delete(req, res));
router.get('/shipping', authMiddleware, (req, res) => shippingCtrl.list(req, res));
router.post('/shipping', authMiddleware, (req, res) => shippingCtrl.create(req, res));
router.put('/shipping/:id', authMiddleware, (req, res) => shippingCtrl.update(req, res));
router.delete('/shipping/:id', authMiddleware, (req, res) => shippingCtrl.delete(req, res));
router.get('/coupons', authMiddleware, (req, res) => couponCtrl.list(req, res));
router.post('/coupons/validate', authMiddleware, (req, res) => couponCtrl.validate(req, res));
router.post('/coupons', authMiddleware, (req, res) => couponCtrl.create(req, res));
router.put('/coupons/:id', authMiddleware, (req, res) => couponCtrl.update(req, res));
router.delete('/coupons/:id', authMiddleware, (req, res) => couponCtrl.delete(req, res));
// ==========================================
// PAGAMENTOS E WEBHOOKS
// ==========================================
router.post('/notifications/mercadopago', (req, res) => paymentCtrl.handleNotification(req, res));
router.get('/orders/:id/payment-status', (req, res) => paymentCtrl.getPaymentStatus(req, res));
export default router;

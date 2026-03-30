import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { Product } from '../models/Produtos';
import { Payment } from '../models/Payment';
import { PaymentWebhook } from '../models/PaymentWebhook';
import { Coupon } from '../models/Coupon';
import { User } from '../models/User';
import { MercadoPagoConfig, Preference, Payment as MPPayment } from 'mercadopago';
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
});
export class OrderController {
    create = async (req, res) => {
        try {
            const body = this.extrairPedido(req);
            if (!req.userId)
                return res.status(401).json({ error: 'Usuário não autenticado' });
            body.customerId = req.userId;
            const pricing = await this.calcularTotais(body);
            const order = await this.salvarPedido(body, pricing);
            await this.salvarItens(order.id, body.items);
            return res.json(await this.gerarPagamento(order, body));
        }
        catch (error) {
            return this.responderErroCriacao(res, error);
        }
    };
    extrairPedido(req) {
        const body = req.body;
        if (!body.items || body.items.length === 0)
            throw new Error('Pedido vazio');
        return body;
    }
    responderErroCriacao(res, error) {
        const msg = this.normalizarErro(error);
        if (msg === 'Pedido vazio')
            return res.status(400).json({ error: msg });
        console.error('Erro criando pedido:', msg);
        return res.status(500).json({ error: `Erro ao processar pedido: ${msg}` });
    }
    list = async (req, res) => {
        try {
            const requestingUser = await this.buscarUsuarioAutenticado(req.userId);
            if (!requestingUser)
                return res.status(401).json({ error: 'Usuário não autenticado' });
            const requestedUserId = req.query.userId;
            const isAdminRequest = Boolean(req.isAdmin || requestingUser.isAdmin);
            const effectiveUserId = isAdminRequest ? requestedUserId : String(requestingUser.id);
            const orders = await this.buscarPedidos(effectiveUserId);
            return res.json(orders);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao buscar pedidos' });
        }
    };
    markPaid = async (req, res) => {
        try {
            const order = await Order.findByPk(req.params.id);
            if (!order)
                return res.status(404).json({ error: 'Pedido não encontrado' });
            if (!(await this.usuarioPodeAcessarPedido(req, order))) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            if (!req.isAdmin) {
                const pagamentoAprovado = await this.pedidoTemPagamentoAprovado(order.id);
                if (!pagamentoAprovado) {
                    return res.status(409).json({ error: 'Pagamento ainda não foi confirmado.' });
                }
            }
            await order.update({ status: 'paid' });
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ error: 'Falha ao atualizar' });
        }
    };
    updateStatus = async (req, res) => {
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
            if (!order)
                return res.status(404).json({ error: 'Pedido não encontrado' });
            await order.update({ status });
            return res.json({ success: true, orderId: order.id, status });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao atualizar status';
            return res.status(500).json({ error: message });
        }
    };
    updateDelivery = async (req, res) => {
        try {
            const requestingUser = await this.buscarUsuarioAutenticado(req.userId);
            if (!requestingUser?.isAdmin && !req.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            const order = await Order.findByPk(req.params.id);
            if (!order)
                return res.status(404).json({ error: 'Pedido não encontrado' });
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
        }
        catch (error) {
            return res.status(500).json({ error: 'Falha ao atualizar dados de entrega' });
        }
    };
    sendTrackingEmail = async (req, res) => {
        try {
            const requestingUser = await this.buscarUsuarioAutenticado(req.userId);
            if (!requestingUser?.isAdmin && !req.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            const order = await Order.findByPk(req.params.id);
            if (!order)
                return res.status(404).json({ error: 'Pedido não encontrado' });
            return res.json({ success: true, message: 'Email de rastreio enfileirado' });
        }
        catch (error) {
            return res.status(500).json({ error: 'Falha ao enviar email de rastreio' });
        }
    };
    syncPaymentStatus = async (req, res) => {
        try {
            const order = await Order.findByPk(req.params.id);
            if (!order)
                return res.status(404).json({ error: 'Pedido não encontrado' });
            if (!(await this.usuarioPodeAcessarPedido(req, order))) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            const paymentId = this.extractPaymentId(req);
            if (order.status === 'paid') {
                return res.json({ status: 'paid', message: 'Pedido já foi marcado como pago' });
            }
            if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
                const syncResult = await this.syncWithMercadoPago(order.id, paymentId);
                if (syncResult) {
                    return res.json({ status: 'paid', message: 'Pagamento sincronizado com sucesso' });
                }
            }
            return res.json({
                status: order.status,
                message: 'Status sincronizado (verifique o webhook do Mercado Pago)'
            });
        }
        catch (error) {
            return res.status(500).json({ error: 'Falha ao sincronizar pagamento' });
        }
    };
    async syncWithMercadoPago(orderId, paymentId) {
        try {
            const mpPayment = new MPPayment(client);
            if (paymentId) {
                try {
                    const payment = await mpPayment.get({ id: paymentId });
                    if (this.isApprovedPaymentForOrder(payment, orderId)) {
                        return this.markOrderAsPaid(orderId);
                    }
                }
                catch (paymentLookupError) {
                    console.warn(`Falha ao buscar pagamento ${paymentId} no MP, tentando fallback por external_reference`);
                }
            }
            // Fallback: search by external_reference
            const response = await mpPayment.search({ options: { external_reference: String(orderId) } });
            const payments = response?.results || [];
            const approvedPayment = payments.find((payment) => this.isApprovedPaymentForOrder(payment, orderId));
            if (approvedPayment) {
                return this.markOrderAsPaid(orderId);
            }
            const approvedFromRest = await this.searchApprovedPaymentByExternalReference(orderId);
            if (approvedFromRest) {
                return this.markOrderAsPaid(orderId);
            }
            return false;
        }
        catch (error) {
            console.error('Erro ao sincronizar com Mercado Pago:', error);
            return false;
        }
    }
    async searchApprovedPaymentByExternalReference(orderId) {
        const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!token)
            return false;
        const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(String(orderId))}&sort=date_created&criteria=desc&limit=50`;
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                console.warn(`Falha no fallback REST do MP (status ${response.status}): ${body}`);
                return false;
            }
            const data = await response.json();
            const results = Array.isArray(data?.results) ? data.results : [];
            return results.some((payment) => this.isApprovedPaymentForOrder(payment, orderId));
        }
        catch (error) {
            console.warn('Erro no fallback REST do MP:', error);
            return false;
        }
    }
    extractPaymentId(req) {
        const query = req.query;
        return query.payment_id || query.paymentId || undefined;
    }
    async buscarPedidoPorId(orderId) {
        return Order.findByPk(orderId);
    }
    async usuarioPodeAcessarPedido(req, order) {
        if (!req.userId)
            return false;
        if (req.isAdmin)
            return true;
        return Number(order.customer_id) === Number(req.userId);
    }
    async pedidoTemPagamentoAprovado(orderId) {
        const approvedPayment = await Payment.findOne({ where: { order_id: orderId, status: 'approved' } });
        if (approvedPayment)
            return true;
        const approvedWebhook = await PaymentWebhook.findOne({
            where: { order_id: orderId, mercado_pago_status: 'approved' }
        });
        return Boolean(approvedWebhook);
    }
    isApprovedPaymentForOrder(payment, orderId) {
        if (payment?.status !== 'approved')
            return false;
        const externalReference = payment?.external_reference;
        if (externalReference == null || externalReference === '')
            return true;
        return String(externalReference) === String(orderId);
    }
    async markOrderAsPaid(orderId) {
        const order = await Order.findByPk(orderId);
        if (order && order.status !== 'paid') {
            await order.update({ status: 'paid' });
            console.log(`✅ Pedido ${orderId} marcado como pago via sincronização Mercado Pago`);
            return true;
        }
        return Boolean(order?.status === 'paid');
    }
    async salvarPedido(body, pricing) {
        return Order.create(this.montarPayloadPedido(body, pricing));
    }
    montarPayloadPedido(body, pricing) {
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
            status: 'pending',
        };
    }
    async calcularTotais(body) {
        const subtotal = this.calcularSubtotal(body.items);
        const { discountPercent, couponCode } = await this.obterDescontoCupom(body.couponCode);
        const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
        const finalTotal = Number(Math.max(0, subtotal - discountAmount).toFixed(2));
        return { subtotal, discountAmount, finalTotal, couponCode };
    }
    calcularSubtotal(items) {
        return Number(items.reduce((acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 0), 0).toFixed(2));
    }
    async obterDescontoCupom(code) {
        if (!code)
            return { discountPercent: 0, couponCode: null };
        const normalizedCode = String(code).trim().toUpperCase();
        const coupon = await Coupon.findOne({ where: { code: normalizedCode } });
        if (!coupon)
            throw new Error('Cupom inválido');
        return { discountPercent: Number(coupon.discount || 0), couponCode: normalizedCode };
    }
    async salvarItens(orderId, items) {
        const promessas = items.map(it => OrderItem.create({
            order_id: orderId, product_id: Number(it.productId), product_name: it.productName || '',
            price_at_purchase: it.price || 0, quantity: it.quantity,
        }));
        await Promise.all(promessas);
    }
    async gerarPagamento(order, body) {
        if (body.paymentMethod === 'illustrative') {
            return this.gerarPagamentoIlustrativo(order);
        }
        if (!process.env.MERCADOPAGO_ACCESS_TOKEN)
            return this.gerarMockPreference(order.id);
        try {
            return await this.criarPreferenciaMercadoPago(order, body);
        }
        catch (err) {
            throw new Error(this.logAndNormalizeMpError(err));
        }
    }
    async gerarPagamentoIlustrativo(order) {
        if (order.status !== 'paid') {
            await order.update({ status: 'paid' });
        }
        return {
            orderId: order.id,
            init_point: null,
            preference_id: null,
            mode: 'illustrative',
            warning: 'Pagamento confirmado via site.',
        };
    }
    logAndNormalizeMpError(err) {
        const message = this.normalizarErro(err);
        console.error('ERRO MERCADO PAGO:', message);
        return message;
    }
    async criarPreferenciaMercadoPago(order, body) {
        const preference = new Preference(client);
        let preferenceBody = this.montarCorpoPreferencia(order, body);
        try {
            const res = await preference.create({ body: preferenceBody });
            return { orderId: order.id, init_point: res.init_point || null, preference_id: res.id || null };
        }
        catch (err) {
            const errMsg = this.normalizarErro(err);
            if (errMsg.includes('auto_return invalid') || errMsg.includes('back_url')) {
                delete preferenceBody.auto_return;
                delete preferenceBody.autoReturn;
                const resFallback = await preference.create({ body: preferenceBody });
                return { orderId: order.id, init_point: resFallback.init_point || null, preference_id: resFallback.id || null };
            }
            throw err;
        }
    }
    normalizarErro(err) {
        if (err instanceof Error)
            return err.message;
        try {
            return JSON.stringify(err);
        }
        catch {
            return String(err);
        }
    }
    normalizarStatus(value) {
        if (typeof value !== 'string')
            return null;
        const normalized = value.trim().toLowerCase();
        if (!['pending', 'paid', 'shipped', 'delivered', 'cancelled'].includes(normalized)) {
            return null;
        }
        return normalized;
    }
    gerarMockPreference(orderId) {
        return {
            orderId, preference_id: `SANDBOX-${orderId}-${Date.now()}`, mode: 'mock',
            init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?preference-id=SANDBOX-${orderId}`,
        };
    }
    montarCorpoPreferencia(order, body) {
        const urls = this.montarUrlsRetorno(order.id);
        const items = body.items.map(it => ({
            id: String(it.productId),
            title: it.productName || 'Produto',
            quantity: Number(it.quantity) || 1,
            currency_id: 'BRL',
            unit_price: Number(it.price)
        }));
        if (order.discount_amount && order.discount_amount > 0) {
            items.push({
                id: 'discount',
                title: `Desconto${order.coupon_code ? ` (${order.coupon_code})` : ''}`,
                quantity: 1,
                currency_id: 'BRL',
                unit_price: -Number(order.discount_amount),
            });
        }
        return {
            items,
            payer: this.montarPagador(body),
            external_reference: String(order.id), // Use snake_case as per Mercado Pago API
            purpose: 'wallet_purchase',
            back_urls: urls, // Use snake_case as per Mercado Pago API
            auto_return: 'approved',
        };
    }
    montarPagador(body) {
        const parts = (body.customerName || '').trim().split(' ');
        return {
            email: body.customerEmail || 'teste@teste.com',
            name: parts[0] || 'Cliente', surname: parts.slice(1).join(' ').trim() || 'Cliente',
            identification: body.customerCpf ? { type: 'CPF', number: body.customerCpf.replace(/\D/g, '') } : undefined,
        };
    }
    montarUrlsRetorno(orderId) {
        const frontUrl = this.obterBaseUrl();
        return {
            success: `${frontUrl}/order-success?order_id=${orderId}`,
            failure: `${frontUrl}/order-success?order_id=${orderId}`,
            pending: `${frontUrl}/order-success?order_id=${orderId}`,
        };
    }
    obterBaseUrl() {
        let base = (process.env.FRONT_URL || '').trim();
        if (!base)
            base = 'http://localhost:3000';
        base = base.replace(/\/+$/g, '');
        if (!/^https?:\/\//i.test(base))
            base = 'http://' + base;
        return base;
    }
    async buscarUsuarioAutenticado(userId) {
        if (!userId)
            return null;
        return User.findByPk(userId);
    }
    async buscarPedidos(userId) {
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

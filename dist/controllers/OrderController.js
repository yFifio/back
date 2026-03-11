import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { Coupon } from '../models/Coupon';
import { MercadoPagoConfig, Preference } from 'mercadopago';
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
});
export class OrderController {
    create = async (req, res) => {
        try {
            const body = req.body;
            if (!body.items || body.items.length === 0)
                return res.status(400).json({ error: 'Pedido vazio' });
            const pricing = await this.calcularTotais(body);
            const order = await this.salvarPedido(body, pricing);
            await this.salvarItens(order.id, body.items);
            return res.json(await this.gerarPagamento(order, body));
        }
        catch (error) {
            // normaliza várias formas de erro para que a resposta não seja '[object Object]'
            let msg;
            if (error instanceof Error) {
                msg = error.message;
            }
            else if (typeof error === 'object') {
                try {
                    msg = JSON.stringify(error);
                }
                catch {
                    msg = String(error);
                }
            }
            else {
                msg = String(error);
            }
            console.error('Erro criando pedido:', msg);
            return res.status(500).json({ error: `Erro ao processar pedido: ${msg}` });
        }
    };
    list = async (req, res) => {
        try {
            const orders = await this.buscarPedidos(req.query.userId);
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
            await order.update({ status: 'paid' });
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ error: 'Falha ao atualizar' });
        }
    };
    async salvarPedido(body, pricing) {
        return Order.create({
            customer_id: body.customerId || null, customer_email: body.customerEmail,
            customer_name: body.customerName || null,
            subtotal_price: pricing.subtotal,
            coupon_code: pricing.couponCode,
            discount_amount: pricing.discountAmount,
            total_price: pricing.finalTotal,
            status: 'pending',
        });
    }
    async calcularTotais(body) {
        const subtotal = Number(body.items.reduce((acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 0), 0).toFixed(2));
        let discountPercent = 0;
        let couponCode = null;
        if (body.couponCode) {
            const normalizedCode = String(body.couponCode).trim().toUpperCase();
            const coupon = await Coupon.findOne({ where: { code: normalizedCode } });
            if (!coupon) {
                throw new Error('Cupom inválido');
            }
            discountPercent = Number(coupon.discount || 0);
            couponCode = normalizedCode;
        }
        const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
        const finalTotal = Number(Math.max(0, subtotal - discountAmount).toFixed(2));
        return { subtotal, discountAmount, finalTotal, couponCode };
    }
    async salvarItens(orderId, items) {
        const promessas = items.map(it => OrderItem.create({
            order_id: orderId, product_id: Number(it.productId), product_name: it.productName || '',
            price_at_purchase: it.price || 0, quantity: it.quantity,
        }));
        await Promise.all(promessas);
    }
    async gerarPagamento(order, body) {
        if (!process.env.MERCADOPAGO_ACCESS_TOKEN)
            return this.gerarMockPreference(order.id);
        const preference = new Preference(client);
        try {
            const preferenceBody = this.montarCorpoPreferencia(order, body);
            console.debug('Enviando preferência MP:', JSON.stringify(preferenceBody));
            const res = await preference.create({ body: preferenceBody });
            return { orderId: order.id, init_point: res.init_point || null, preference_id: res.id || null };
        }
        catch (err) {
            // falha grave ao comunicar com Mercado Pago, vamos propagar para o handler
            // garantir que obtemos uma string útil em qualquer caso (objeto, array, etc.)
            let message;
            if (err instanceof Error) {
                message = err.message;
            }
            else if (typeof err === 'object') {
                try {
                    message = JSON.stringify(err);
                }
                catch {
                    message = String(err);
                }
            }
            else {
                message = String(err);
            }
            console.error('ERRO MERCADO PAGO:', message);
            throw new Error(message);
        }
    }
    gerarMockPreference(orderId) {
        return {
            orderId, preference_id: `SANDBOX-${orderId}-${Date.now()}`, mode: 'mock',
            init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?preference-id=SANDBOX-${orderId}`,
        };
    }
    montarCorpoPreferencia(order, body) {
        return {
            items: body.items.map(it => ({ id: String(it.productId), title: it.productName || 'Produto', quantity: Number(it.quantity) || 1, currency_id: 'BRL', unit_price: Number(it.price) })),
            payer: this.montarPagador(body), external_reference: String(order.id),
            back_urls: this.montarUrlsRetorno(order.id), auto_return: 'approved',
        };
    }
    montarPagador(body) {
        const parts = (body.customerName || '').trim().split(' ');
        return {
            email: body.customerEmail || 'teste@teste.com', // <-- Fallback de segurança adicionado aqui
            name: parts[0] || 'Cliente', surname: parts.slice(1).join(' ').trim() || 'Cliente',
            identification: body.customerCpf ? { type: 'CPF', number: body.customerCpf.replace(/\D/g, '') } : undefined,
        };
    }
    montarUrlsRetorno(orderId) {
        // garantimos sempre um base válido; se a variável estiver em branco ou
        // contiver apenas espaços, usamos http://localhost:3000
        let base = (process.env.FRONT_URL || '').trim();
        if (!base)
            base = 'http://localhost:3000';
        base = base.replace(/\/+$/g, '');
        if (!/^https?:\/\//i.test(base))
            base = 'http://' + base;
        const urls = {
            success: `${base}/order-success?order_id=${orderId}`,
            failure: `${base}/checkout`,
            pending: `${base}/checkout`,
        };
        // sanity check for logging/debug
        if (!urls.success || !urls.failure || !urls.pending) {
            console.warn('URLs de retorno inválidas geradas:', urls);
        }
        return urls;
    }
    tratarErroMP(orderId, err) {
        console.error('ERRO MERCADO PAGO:', err.message); // <-- Vai printar no terminal o erro exato
        return { orderId, preference_id: null, init_point: null, warning: `Erro MP: ${err.message}` };
    }
    async buscarPedidos(userId) {
        const where = userId ? { customer_id: userId } : {};
        return Order.findAll({ where, include: [{ model: OrderItem, as: 'order_items' }] });
    }
}

import { Coupon } from '../models/Coupon';
export class CouponController {
    getById = async (req, res) => {
        try {
            const item = await Coupon.findByPk(req.params.id);
            return item ? res.json(item) : res.status(404).json({ error: 'Cupom não encontrado' });
        }
        catch {
            return res.status(500).json({ error: 'Erro ao buscar cupom' });
        }
    };
    validate = async (req, res) => {
        try {
            return await this.validateInternal(req, res);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao validar cupom' });
        }
    };
    list = async (req, res) => {
        try {
            const limit = Number(req.query?.limit) || 10;
            const offset = Number(req.query?.offset) || 0;
            const { count, rows } = await Coupon.findAndCountAll({ limit, offset, order: [['id', 'DESC']] });
            return res.json({ data: rows, total: count, limit, offset });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao listar cupons' });
        }
    };
    create = async (req, res) => {
        try {
            const payload = this.getCouponPayload(req);
            if (!payload.code)
                return this.badRequest(res, 'Código obrigatório');
            return res.status(201).json(await Coupon.create(payload));
        }
        catch (error) {
            return this.handleWriteError(res, error, 'Erro ao criar cupom');
        }
    };
    update = async (req, res) => {
        try {
            return await this.updateInternal(req, res);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao atualizar cupom' });
        }
    };
    async validateInternal(req, res) {
        const rawCode = String(req.body?.code || '').trim().toUpperCase();
        if (!rawCode)
            return this.badRequest(res, 'Código obrigatório');
        const item = await Coupon.findOne({ where: { code: rawCode } });
        if (!item)
            return res.status(404).json({ error: 'Cupom inválido' });
        const discount = Number(item.discount || 0);
        return discount > 0 ? this.validCoupon(res, item.code, discount) : this.badRequest(res, 'Cupom sem desconto válido');
    }
    async updateInternal(req, res) {
        const item = await Coupon.findByPk(req.params.id);
        if (!item)
            return res.status(404).json({ error: 'Cupom não encontrado' });
        const payload = this.getCouponPayload(req);
        if (!payload.code)
            return this.badRequest(res, 'Código obrigatório');
        this.applyCouponPayload(item, payload);
        await item.save();
        return res.json(item);
    }
    delete = async (req, res) => {
        try {
            const rows = await Coupon.destroy({ where: { id: req.params.id } });
            if (!rows)
                return res.status(404).json({ error: 'Cupom não encontrado' });
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao excluir cupom' });
        }
    };
    getCouponPayload(req) {
        return {
            code: String(req.body?.code || '').trim().toUpperCase(),
            discount: Number(req.body?.discount || 0),
        };
    }
    applyCouponPayload(item, payload) {
        item.code = payload.code;
        item.discount = payload.discount;
    }
    handleWriteError(res, error, fallback) {
        if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
            return this.badRequest(res, 'Código já existe');
        }
        return res.status(500).json({ error: fallback });
    }
    validCoupon(res, code, discount) {
        return res.json({ code, discount });
    }
    badRequest(res, message) {
        return res.status(400).json({ error: message });
    }
}

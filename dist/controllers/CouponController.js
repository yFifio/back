import { Coupon } from '../models/Coupon';
export class CouponController {
    validate = async (req, res) => {
        try {
            const rawCode = String(req.body?.code || '').trim().toUpperCase();
            if (!rawCode)
                return res.status(400).json({ error: 'Código obrigatório' });
            const item = await Coupon.findOne({ where: { code: rawCode } });
            if (!item)
                return res.status(404).json({ error: 'Cupom inválido' });
            const discount = Number(item.discount || 0);
            if (discount <= 0)
                return res.status(400).json({ error: 'Cupom sem desconto válido' });
            return res.json({ code: item.code, discount });
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
            const code = String(req.body?.code || '').trim().toUpperCase();
            const discount = Number(req.body?.discount || 0);
            if (!code)
                return res.status(400).json({ error: 'Código obrigatório' });
            const item = await Coupon.create({ code, discount });
            return res.status(201).json(item);
        }
        catch (error) {
            if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ error: 'Código já existe' });
            }
            return res.status(500).json({ error: 'Erro ao criar cupom' });
        }
    };
    update = async (req, res) => {
        try {
            const item = await Coupon.findByPk(req.params.id);
            if (!item)
                return res.status(404).json({ error: 'Cupom não encontrado' });
            const code = String(req.body?.code || '').trim().toUpperCase();
            const discount = Number(req.body?.discount || 0);
            if (!code)
                return res.status(400).json({ error: 'Código obrigatório' });
            item.code = code;
            item.discount = discount;
            await item.save();
            return res.json(item);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao atualizar cupom' });
        }
    };
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
}

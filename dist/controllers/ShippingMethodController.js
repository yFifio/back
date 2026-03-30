import { ShippingMethod } from '../models/ShippingMethod';
export class ShippingMethodController {
    getById = async (req, res) => {
        try {
            const item = await ShippingMethod.findByPk(req.params.id);
            return item ? res.json(item) : this.notFound(res);
        }
        catch {
            return res.status(500).json({ error: 'Erro ao buscar método de envio' });
        }
    };
    list = async (req, res) => {
        try {
            const limit = Number(req.query?.limit) || 10;
            const offset = Number(req.query?.offset) || 0;
            const { count, rows } = await ShippingMethod.findAndCountAll({ limit, offset, order: [['id', 'DESC']] });
            return res.json({ data: rows, total: count, limit, offset });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao listar métodos de envio' });
        }
    };
    create = async (req, res) => {
        try {
            const { name, price } = req.body;
            if (!name)
                return res.status(400).json({ error: 'Nome obrigatório' });
            const item = await ShippingMethod.create({ name, price });
            return res.status(201).json(item);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao criar método de envio' });
        }
    };
    update = async (req, res) => {
        try {
            return await this.updateInternal(req, res);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao atualizar método de envio' });
        }
    };
    async updateInternal(req, res) {
        const item = await ShippingMethod.findByPk(req.params.id);
        if (!item)
            return this.notFound(res);
        const payload = this.getShippingPayload(req);
        if (!payload.name)
            return this.badRequest(res, 'Nome obrigatório');
        this.applyShippingPayload(item, payload);
        await item.save();
        return res.json(item);
    }
    delete = async (req, res) => {
        try {
            const rows = await ShippingMethod.destroy({ where: { id: req.params.id } });
            if (!rows)
                return res.status(404).json({ error: 'Método não encontrado' });
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao excluir método de envio' });
        }
    };
    getShippingPayload(req) {
        return { name: req.body?.name, price: req.body?.price };
    }
    applyShippingPayload(item, payload) {
        item.name = payload.name;
        item.price = payload.price;
    }
    badRequest(res, message) {
        return res.status(400).json({ error: message });
    }
    notFound(res) {
        return res.status(404).json({ error: 'Método não encontrado' });
    }
}

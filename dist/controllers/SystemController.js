import { System } from '../models/System';
export class SystemController {
    list = async (req, res) => {
        try {
            const type = req.query.type;
            const where = type ? { type } : {};
            const systems = await System.findAll({ where });
            return res.json(systems);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao listar sistemas' });
        }
    };
    create = async (req, res) => {
        try {
            const payload = this.getSystemPayload(req);
            if (!this.isValidSystemPayload(payload))
                return this.badRequest(res, 'Dados inválidos');
            return res.status(201).json(await System.create(payload));
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao criar sistema' });
        }
    };
    update = async (req, res) => {
        try {
            return await this.updateInternal(req, res);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao atualizar sistema' });
        }
    };
    async updateInternal(req, res) {
        const sys = await System.findByPk(req.params.id);
        if (!sys)
            return this.notFound(res);
        const payload = this.getSystemPayload(req);
        if (!payload.name)
            return this.badRequest(res, 'Nome obrigatório');
        sys.name = payload.name;
        await sys.save();
        return res.json(sys);
    }
    delete = async (req, res) => {
        try {
            const rows = await System.destroy({ where: { id: req.params.id } });
            if (!rows)
                return res.status(404).json({ error: 'Sistema não encontrado' });
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao excluir sistema' });
        }
    };
    getSystemPayload(req) {
        return { name: req.body?.name, type: req.body?.type };
    }
    isValidSystemPayload(payload) {
        return Boolean(payload.name && payload.type && ['A', 'B', 'C'].includes(payload.type));
    }
    badRequest(res, message) {
        return res.status(400).json({ error: message });
    }
    notFound(res) {
        return res.status(404).json({ error: 'Sistema não encontrado' });
    }
}

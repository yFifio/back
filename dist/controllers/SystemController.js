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
            const { name, type } = req.body;
            if (!name || !type || !['A', 'B', 'C'].includes(type)) {
                return res.status(400).json({ error: 'Dados inválidos' });
            }
            const sys = await System.create({ name, type });
            return res.status(201).json(sys);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao criar sistema' });
        }
    };
    update = async (req, res) => {
        try {
            const sys = await System.findByPk(req.params.id);
            if (!sys)
                return res.status(404).json({ error: 'Sistema não encontrado' });
            const { name } = req.body;
            if (!name)
                return res.status(400).json({ error: 'Nome obrigatório' });
            sys.name = name;
            await sys.save();
            return res.json(sys);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao atualizar sistema' });
        }
    };
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
}

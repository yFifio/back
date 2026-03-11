import { Supplier } from '../models/Supplier';
export class SupplierController {
    list = async (req, res) => {
        try {
            const limit = Number(req.query?.limit) || 10;
            const offset = Number(req.query?.offset) || 0;
            const { count, rows } = await Supplier.findAndCountAll({ limit, offset, order: [['id', 'DESC']] });
            return res.json({ data: rows, total: count, limit, offset });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao listar fornecedores' });
        }
    };
    create = async (req, res) => {
        try {
            const { name, email } = req.body;
            if (!name)
                return res.status(400).json({ error: 'Nome obrigatório' });
            const sup = await Supplier.create({ name, email });
            return res.status(201).json(sup);
        }
        catch (error) {
            if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ error: 'Email já cadastrado' });
            }
            return res.status(500).json({ error: 'Erro ao criar fornecedor' });
        }
    };
    update = async (req, res) => {
        try {
            const sup = await Supplier.findByPk(req.params.id);
            if (!sup)
                return res.status(404).json({ error: 'Fornecedor não encontrado' });
            const { name, email } = req.body;
            if (!name)
                return res.status(400).json({ error: 'Nome obrigatório' });
            sup.name = name;
            sup.email = email;
            await sup.save();
            return res.json(sup);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
        }
    };
    delete = async (req, res) => {
        try {
            const rows = await Supplier.destroy({ where: { id: req.params.id } });
            if (!rows)
                return res.status(404).json({ error: 'Fornecedor não encontrado' });
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao excluir fornecedor' });
        }
    };
}

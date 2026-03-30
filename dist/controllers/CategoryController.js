import { Category } from '../models/Category';
import { dbConnected } from '../utils/appState';
export class CategoryController {
    serviceUnavailable(res) {
        return res.status(503).json({ error: 'Serviço temporariamente indisponível' });
    }
    list = async (req, res) => {
        const limit = Number(req.query?.limit) || 10;
        const offset = Number(req.query?.offset) || 0;
        if (!dbConnected)
            return res.json({ data: [], total: 0, limit, offset });
        try {
            const { count, rows } = await Category.findAndCountAll({ limit, offset, order: [['id', 'DESC']] });
            return res.json({ data: rows, total: count, limit, offset });
        }
        catch (e) {
            return this.handleError(res, 'listar categorias', e);
        }
    };
    getById = async (req, res) => {
        if (!dbConnected)
            return this.serviceUnavailable(res);
        try {
            const category = await Category.findByPk(req.params.id);
            if (!category)
                return res.status(404).json({ error: 'Não encontrada' });
            return res.json(category);
        }
        catch (e) {
            return this.handleError(res, 'buscar', e);
        }
    };
    create = async (req, res) => {
        if (!req.body.name)
            return res.status(400).json({ error: 'Nome obrigatório' });
        if (!dbConnected)
            return this.serviceUnavailable(res);
        try {
            const cat = await Category.create({ name: req.body.name });
            return res.status(201).json(cat);
        }
        catch (e) {
            return this.handleError(res, 'criar', e);
        }
    };
    update = async (req, res) => {
        if (!dbConnected)
            return this.serviceUnavailable(res);
        try {
            const category = await Category.findByPk(req.params.id);
            if (!category)
                return res.status(404).json({ error: 'Não encontrada' });
            return res.json(await category.update(req.body));
        }
        catch (e) {
            return this.handleError(res, 'atualizar', e);
        }
    };
    delete = async (req, res) => {
        if (!dbConnected)
            return this.serviceUnavailable(res);
        try {
            const cat = await Category.findByPk(req.params.id);
            if (!cat)
                return res.status(404).json({ error: 'Não encontrada' });
            await cat.destroy();
            return res.json({ message: 'Deletada com sucesso' });
        }
        catch (e) {
            return this.handleError(res, 'deletar', e);
        }
    };
    handleError(res, action, err) {
        console.error(`Erro ao ${action}:`, err.message || err);
        return res.status(500).json({ error: `Erro interno ao ${action}` });
    }
}

import { Request, Response } from 'express';
import { Category } from '../models/Category';
import { dbConnected } from '../utils/appState';

export class CategoryController {
  private serviceUnavailable(res: Response) {
    return res.status(503).json({ error: 'Serviço temporariamente indisponível' });
  }

  list = async (req: Request, res: Response) => {
    const limit = Number(req.query?.limit) || 10;
    const offset = Number(req.query?.offset) || 0;
    if (!dbConnected) return res.json({ data: [], total: 0, limit, offset });
    try {
      const { count, rows } = await Category.findAndCountAll({ limit, offset, order: [['id', 'DESC']] });
      return res.json({ data: rows, total: count, limit, offset });
    } catch (e) { return this.handleError(res, 'listar categorias', e as Error); }
  }

  getById = async (req: Request, res: Response) => {
    if (!dbConnected) return this.serviceUnavailable(res);
    try {
      const category = await Category.findByPk(req.params.id);
      if (!category) return res.status(404).json({ error: 'Não encontrada' });
      return res.json(category);
    } catch (e) { return this.handleError(res, 'buscar', e as Error); }
  }

  create = async (req: Request, res: Response) => {
    if (!req.body.name) return res.status(400).json({ error: 'Nome obrigatório' });
    if (!dbConnected) return this.serviceUnavailable(res);
    try {
      const cat = await Category.create({ name: req.body.name });
      return res.status(201).json(cat);
    } catch (e) { return this.handleError(res, 'criar', e as Error); }
  }

  update = async (req: Request, res: Response) => {
    if (!dbConnected) return this.serviceUnavailable(res);
    try {
      const category = await Category.findByPk(req.params.id);
      if (!category) return res.status(404).json({ error: 'Não encontrada' });
      return res.json(await category.update(req.body));
    } catch (e) { return this.handleError(res, 'atualizar', e as Error); }
  }

  delete = async (req: Request, res: Response) => {
    if (!dbConnected) return this.serviceUnavailable(res);
    try {
      const cat = await Category.findByPk(req.params.id);
      if (!cat) return res.status(404).json({ error: 'Não encontrada' });
      await cat.destroy();
      return res.json({ message: 'Deletada com sucesso' });
    } catch (e) { return this.handleError(res, 'deletar', e as Error); }
  }

  private handleError(res: Response, action: string, err: Error) {
    console.error(`Erro ao ${action}:`, err.message || err);
    return res.status(500).json({ error: `Erro interno ao ${action}` });
  }
}
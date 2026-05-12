import { Request, Response } from 'express';
import { Supplier } from '../models/Supplier';

export class SupplierController {
  getById = async (req: Request, res: Response) => {
    try {
      const sup = await Supplier.findByPk(req.params.id);
      return sup ? res.json(sup) : this.notFound(res);
    } catch {
      return res.status(500).json({ error: 'Erro ao buscar fornecedor' });
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query?.limit) || 10;
      const offset = Number(req.query?.offset) || 0;
      const { count, rows } = await Supplier.findAndCountAll({ limit, offset, order: [['id', 'DESC']] });
      return res.json({ data: rows, total: count, limit, offset });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao listar fornecedores' });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const payload = this.getSupplierPayload(req);
      if (!payload.name) return this.badRequest(res, 'Nome obrigatório');
      return res.status(201).json(await Supplier.create(payload));
    } catch (error) {
      return this.handleCreateError(res, error as Error | string | number | boolean | object | null | undefined);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      return await this.updateInternal(req, res);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
    }
  };

  private async updateInternal(req: Request, res: Response) {
    const sup = await Supplier.findByPk(req.params.id);
    if (!sup) return this.notFound(res);
    const payload = this.getSupplierPayload(req);
    if (!payload.name) return this.badRequest(res, 'Nome obrigatório');
    this.applySupplierPayload(sup, payload);
    await sup.save();
    return res.json(sup);
  }

  delete = async (req: Request, res: Response) => {
    try {
      const rows = await Supplier.destroy({ where: { id: req.params.id } });
      if (!rows) return res.status(404).json({ error: 'Fornecedor não encontrado' });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao excluir fornecedor' });
    }
  };

  private getSupplierPayload(req: Request): { name: string; email?: string } {
    return { name: req.body?.name, email: req.body?.email };
  }

  private applySupplierPayload(sup: Supplier, payload: { name: string; email?: string }) {
    sup.name = payload.name;
    sup.email = payload.email;
  }

  private handleCreateError(res: Response, error: Error | string | number | boolean | object | null | undefined) {
    if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
      return this.badRequest(res, 'Email já cadastrado');
    }
    return res.status(500).json({ error: 'Erro ao criar fornecedor' });
  }

  private badRequest(res: Response, message: string) {
    return res.status(400).json({ error: message });
  }

  private notFound(res: Response) {
    return res.status(404).json({ error: 'Fornecedor não encontrado' });
  }
}

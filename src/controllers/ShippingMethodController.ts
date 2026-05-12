import { Request, Response } from 'express';
import { ShippingMethod } from '../models/ShippingMethod';

export class ShippingMethodController {
  getById = async (req: Request, res: Response) => {
    try {
      const item = await ShippingMethod.findByPk(req.params.id);
      return item ? res.json(item) : this.notFound(res);
    } catch {
      return res.status(500).json({ error: 'Erro ao buscar método de envio' });
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query?.limit) || 10;
      const offset = Number(req.query?.offset) || 0;
      const { count, rows } = await ShippingMethod.findAndCountAll({ limit, offset, order: [['id', 'DESC']] });
      return res.json({ data: rows, total: count, limit, offset });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao listar métodos de envio' });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { name, price } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
      const item = await ShippingMethod.create({ name, price });
      return res.status(201).json(item);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao criar método de envio' });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      return await this.updateInternal(req, res);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao atualizar método de envio' });
    }
  };

  private async updateInternal(req: Request, res: Response) {
    const item = await ShippingMethod.findByPk(req.params.id);
    if (!item) return this.notFound(res);
    const payload = this.getShippingPayload(req);
    if (!payload.name) return this.badRequest(res, 'Nome obrigatório');
    this.applyShippingPayload(item, payload);
    await item.save();
    return res.json(item);
  }

  delete = async (req: Request, res: Response) => {
    try {
      const rows = await ShippingMethod.destroy({ where: { id: req.params.id } });
      if (!rows) return res.status(404).json({ error: 'Método não encontrado' });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao excluir método de envio' });
    }
  };

  private getShippingPayload(req: Request): { name: string; price: number } {
    return { name: req.body?.name, price: req.body?.price };
  }

  private applyShippingPayload(item: ShippingMethod, payload: { name: string; price: number }) {
    item.name = payload.name;
    item.price = payload.price;
  }

  private badRequest(res: Response, message: string) {
    return res.status(400).json({ error: message });
  }

  private notFound(res: Response) {
    return res.status(404).json({ error: 'Método não encontrado' });
  }
}

import { Request, Response } from 'express';
import { System } from '../models/System';

export class SystemController {
  list = async (req: Request, res: Response) => {
    try {
      const type = req.query.type as string | undefined;
      const where = type ? { type } : {};
      const systems = await System.findAll({ where });
      return res.json(systems);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao listar sistemas' });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const payload = this.getSystemPayload(req);
      if (!this.isValidSystemPayload(payload)) return this.badRequest(res, 'Dados inválidos');
      return res.status(201).json(await System.create(payload));
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao criar sistema' });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      return await this.updateInternal(req, res);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao atualizar sistema' });
    }
  };

  private async updateInternal(req: Request, res: Response) {
    const sys = await System.findByPk(req.params.id);
    if (!sys) return this.notFound(res);
    const payload = this.getSystemPayload(req);
    if (!payload.name) return this.badRequest(res, 'Nome obrigatório');
    sys.name = payload.name;
    await sys.save();
    return res.json(sys);
  }

  delete = async (req: Request, res: Response) => {
    try {
      const rows = await System.destroy({ where: { id: req.params.id } });
      if (!rows) return res.status(404).json({ error: 'Sistema não encontrado' });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao excluir sistema' });
    }
  };

  private getSystemPayload(req: Request): { name: string; type: string } {
    return { name: req.body?.name, type: req.body?.type };
  }

  private isValidSystemPayload(payload: { name: string; type: string }) {
    return Boolean(payload.name && payload.type && ['A', 'B', 'C'].includes(payload.type));
  }

  private badRequest(res: Response, message: string) {
    return res.status(400).json({ error: message });
  }

  private notFound(res: Response) {
    return res.status(404).json({ error: 'Sistema não encontrado' });
  }
}

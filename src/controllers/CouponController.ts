import { Request, Response } from 'express';
import { Coupon } from '../models/Coupon';

export class CouponController {
  getById = async (req: Request, res: Response) => {
    try {
      const item = await Coupon.findByPk(req.params.id);
      return item ? res.json(item) : res.status(404).json({ error: 'Cupom não encontrado' });
    } catch {
      return res.status(500).json({ error: 'Erro ao buscar cupom' });
    }
  };

  validate = async (req: Request, res: Response) => {
    try {
      return await this.validateInternal(req, res);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao validar cupom' });
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query?.limit) || 10;
      const offset = Number(req.query?.offset) || 0;
      const { count, rows } = await Coupon.findAndCountAll({ limit, offset, order: [['id', 'DESC']] });
      return res.json({ data: rows, total: count, limit, offset });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao listar cupons' });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const payload = this.getCouponPayload(req);
      if (!payload.code) return this.badRequest(res, 'Código obrigatório');
      return res.status(201).json(await Coupon.create(payload));
    } catch (error) {
      return this.handleWriteError(res, error as Error | string | number | boolean | object | null | undefined, 'Erro ao criar cupom');
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      return await this.updateInternal(req, res);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao atualizar cupom' });
    }
  };

  private async validateInternal(req: Request, res: Response) {
    const rawCode = String(req.body?.code || '').trim().toUpperCase();
    if (!rawCode) return this.badRequest(res, 'Código obrigatório');
    const item = await Coupon.findOne({ where: { code: rawCode } });
    if (!item) return res.status(404).json({ error: 'Cupom inválido' });
    const discount = Number(item.discount || 0);
    return discount > 0 ? this.validCoupon(res, item.code, discount) : this.badRequest(res, 'Cupom sem desconto válido');
  }

  private async updateInternal(req: Request, res: Response) {
    const item = await Coupon.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Cupom não encontrado' });
    const payload = this.getCouponPayload(req);
    if (!payload.code) return this.badRequest(res, 'Código obrigatório');
    this.applyCouponPayload(item, payload);
    await item.save();
    return res.json(item);
  }

  delete = async (req: Request, res: Response) => {
    try {
      const rows = await Coupon.destroy({ where: { id: req.params.id } });
      if (!rows) return res.status(404).json({ error: 'Cupom não encontrado' });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao excluir cupom' });
    }
  };

  private getCouponPayload(req: Request): { code: string; discount: number } {
    return {
      code: String(req.body?.code || '').trim().toUpperCase(),
      discount: Number(req.body?.discount || 0),
    };
  }

  private applyCouponPayload(item: Coupon, payload: { code: string; discount: number }) {
    item.code = payload.code;
    item.discount = payload.discount;
  }

  private handleWriteError(res: Response, error: Error | string | number | boolean | object | null | undefined, fallback: string) {
    if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError') {
      return this.badRequest(res, 'Código já existe');
    }
    return res.status(500).json({ error: fallback });
  }

  private validCoupon(res: Response, code: string, discount: number) {
    return res.json({ code, discount });
  }

  private badRequest(res: Response, message: string) {
    return res.status(400).json({ error: message });
  }
}

import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { PaginationParams, ProductQueryResult } from '../types';
import { Product } from '../models/Produtos';

interface ProdutoRow {
  id: number;
  [key: string]: string | number | boolean | Date | null | undefined;
}

export class ProductController {
  list = async (req: Request, res: Response) => {
    try {
      return res.json(await this.montarListaProdutos(req));
    } catch (e) {
      return this.handleListError(res, e as Error | string | number | boolean | object | null | undefined);
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const item = await this.findById(req.params.id);
      return item ? res.json(item) : res.status(404).json({ error: 'Produto não encontrado' });
    } catch {
      return res.status(500).json({ error: 'Erro ao buscar produto' });
    }
  }

  create = async (req: Request, res: Response) => {
    try {
      return res.status(201).json(await this.createProduct(req.body));
    } catch {
      return res.status(500).json({ error: 'Erro ao criar produto' });
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      return (await this.updateProduct(req.params.id, req.body))
        ? res.json({ success: true })
        : res.status(404).json({ error: 'Produto não encontrado' });
    } catch {
      return res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      return (await this.deleteProduct(req.params.id))
        ? res.json({ success: true })
        : res.status(404).json({ error: 'Produto não encontrado' });
    } catch {
      return res.status(500).json({ error: 'Erro ao deletar produto' });
    }
  }

  private async montarListaProdutos(req: Request) {
    const params = this.getPaginationParams(req);
    const [products, total] = await Promise.all([this.fetchProducts(params), this.countProducts()]);
    return this.buildResponse(products as ProdutoRow[], total, params);
  }

  private handleListError(res: Response, error: Error | string | number | boolean | object | null | undefined) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar produtos' });
  }

  private async findById(id: string) {
    return Product.findByPk(id);
  }

  private async createProduct(payload: Request['body']) {
    return Product.create(payload);
  }

  private async updateProduct(id: string, payload: Request['body']) {
    const [affected] = await Product.update(payload, { where: { id } });
    return affected > 0;
  }

  private async deleteProduct(id: string) {
    return (await Product.destroy({ where: { id } })) > 0;
  }

  private getPaginationParams(req: Request): PaginationParams {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    return { limit, offset: (page - 1) * limit, page };
  }

  private async fetchProducts({ limit, offset }: PaginationParams) {
    return sequelize.query(
      `SELECT id, name, description, price, category, categoryId, book_category, image_url, age_range, is_active, discount_percent, is_featured, createdAt, updatedAt
       FROM products ORDER BY id DESC LIMIT :limit OFFSET :offset`,
      { replacements: { limit, offset }, type: QueryTypes.SELECT }
    );
  }

  private async countProducts(): Promise<number> {
    const result = await sequelize.query<ProductQueryResult>(
      `SELECT COUNT(*) as total FROM products`,
      { type: QueryTypes.SELECT }
    );
    return result[0]?.total || 0;
  }

  private buildResponse(data: ProdutoRow[], total: number, params: PaginationParams) {
    return {
      data,
      total,
      page: params.page,
      totalPages: Math.ceil(total / params.limit)
    };
  }
}
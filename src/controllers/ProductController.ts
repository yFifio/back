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
      const { name, price, categoryId } = req.body || {};
      if (!name || String(name).trim().length === 0) {
        return res.status(400).json({ error: 'Nome do produto é obrigatório' });
      }
      if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
        return res.status(400).json({ error: 'Preço inválido' });
      }
      
      // Se categoryId foi enviado, validar se existe
      if (categoryId && Number(categoryId) > 0) {
        const { Category } = await import('../models/Category');
        const catExists = await Category.findByPk(categoryId);
        if (!catExists) {
          return res.status(400).json({ error: `Categoria com ID ${categoryId} não existe` });
        }
      }
      
      return res.status(201).json(await this.createProduct(req.body));
    } catch (error) {
      console.error('❌ Erro ao criar produto:', error instanceof Error ? error.message : error);
      if (error instanceof Error && error.message.includes('Field')) {
        return res.status(400).json({ error: `Campo inválido: ${error.message}` });
      }
      return res.status(500).json({ error: 'Erro ao criar produto', details: error instanceof Error ? error.message : String(error) });
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
      const result = await this.deleteProduct(req.params.id);
      if (result === 'not_found') {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }
      return res.json({ success: true, action: result });
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
    try {
      console.log('📦 Creating product with payload:', JSON.stringify(payload, null, 2));
      return await Product.create(payload);
    } catch (error) {
      console.error('❌ Error in Product.create():', error instanceof Error ? error.message : error);
      if (this.isMissingDefaultIdError(error)) {
        const nextId = await this.getNextProductId();
        console.log('🔄 Retrying with ID:', nextId);
        return Product.create({ ...payload, id: nextId });
      }
      throw error;
    }
  }

  private async getNextProductId(): Promise<number> {
    const maxId = await Product.max('id');
    const numericMax = Number(maxId || 0);
    return Number.isFinite(numericMax) ? numericMax + 1 : 1;
  }

  private isMissingDefaultIdError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as {
      message?: string;
      parent?: { code?: string; sqlMessage?: string };
      original?: { code?: string; sqlMessage?: string };
    };
    const dbCode = maybeError.parent?.code || maybeError.original?.code;
    const dbMessage = String(
      maybeError.parent?.sqlMessage || maybeError.original?.sqlMessage || maybeError.message || ''
    );
    return dbCode === 'ER_NO_DEFAULT_FOR_FIELD' || dbMessage.includes("Field 'id' doesn't have a default value");
  }

  private async updateProduct(id: string, payload: Request['body']) {
    const [affected] = await Product.update(payload, { where: { id } });
    return affected > 0;
  }

  private async deleteProduct(id: string): Promise<'deleted' | 'deactivated' | 'not_found'> {
    try {
      const deleted = await Product.destroy({ where: { id } });
      return deleted > 0 ? 'deleted' : 'not_found';
    } catch (error) {
      if (!this.isForeignKeyConstraint(error)) {
        throw error;
      }

      const [affected] = await Product.update(
        { is_active: false },
        { where: { id, is_active: true } }
      );

      if (affected > 0) {
        return 'deactivated';
      }

      const existing = await Product.findByPk(id);
      return existing ? 'deactivated' : 'not_found';
    }
  }

  private isForeignKeyConstraint(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const maybeError = error as {
      name?: string;
      parent?: { code?: string };
      original?: { code?: string };
    };
    const dbCode = maybeError.parent?.code || maybeError.original?.code;
    return maybeError.name === 'SequelizeForeignKeyConstraintError' || dbCode === 'ER_ROW_IS_REFERENCED_2';
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
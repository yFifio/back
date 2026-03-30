import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
import { Product } from '../models/Produtos';
export class ProductController {
    list = async (req, res) => {
        try {
            return res.json(await this.montarListaProdutos(req));
        }
        catch (e) {
            return this.handleListError(res, e);
        }
    };
    getById = async (req, res) => {
        try {
            const item = await this.findById(req.params.id);
            return item ? res.json(item) : res.status(404).json({ error: 'Produto não encontrado' });
        }
        catch {
            return res.status(500).json({ error: 'Erro ao buscar produto' });
        }
    };
    create = async (req, res) => {
        try {
            return res.status(201).json(await this.createProduct(req.body));
        }
        catch {
            return res.status(500).json({ error: 'Erro ao criar produto' });
        }
    };
    update = async (req, res) => {
        try {
            return (await this.updateProduct(req.params.id, req.body))
                ? res.json({ success: true })
                : res.status(404).json({ error: 'Produto não encontrado' });
        }
        catch {
            return res.status(500).json({ error: 'Erro ao atualizar produto' });
        }
    };
    delete = async (req, res) => {
        try {
            return (await this.deleteProduct(req.params.id))
                ? res.json({ success: true })
                : res.status(404).json({ error: 'Produto não encontrado' });
        }
        catch {
            return res.status(500).json({ error: 'Erro ao deletar produto' });
        }
    };
    async montarListaProdutos(req) {
        const params = this.getPaginationParams(req);
        const [products, total] = await Promise.all([this.fetchProducts(params), this.countProducts()]);
        return this.buildResponse(products, total, params);
    }
    handleListError(res, error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao listar produtos' });
    }
    async findById(id) {
        return Product.findByPk(id);
    }
    async createProduct(payload) {
        return Product.create(payload);
    }
    async updateProduct(id, payload) {
        const [affected] = await Product.update(payload, { where: { id } });
        return affected > 0;
    }
    async deleteProduct(id) {
        return (await Product.destroy({ where: { id } })) > 0;
    }
    getPaginationParams(req) {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        return { limit, offset: (page - 1) * limit, page };
    }
    async fetchProducts({ limit, offset }) {
        return sequelize.query(`SELECT id, name, description, price, category, categoryId, book_category, image_url, age_range, is_active, discount_percent, is_featured, createdAt, updatedAt
       FROM products ORDER BY id DESC LIMIT :limit OFFSET :offset`, { replacements: { limit, offset }, type: QueryTypes.SELECT });
    }
    async countProducts() {
        const result = await sequelize.query(`SELECT COUNT(*) as total FROM products`, { type: QueryTypes.SELECT });
        return result[0]?.total || 0;
    }
    buildResponse(data, total, params) {
        return {
            data,
            total,
            page: params.page,
            totalPages: Math.ceil(total / params.limit)
        };
    }
}

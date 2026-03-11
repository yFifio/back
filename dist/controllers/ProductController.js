import { QueryTypes } from 'sequelize';
import sequelize from '../config/database';
export class ProductController {
    list = async (req, res) => {
        try {
            const params = this.getPaginationParams(req);
            const [products, total] = await Promise.all([
                this.fetchProducts(params),
                this.countProducts()
            ]);
            return res.json(this.buildResponse(products, total, params));
        }
        catch (e) {
            console.error(e);
            return res.status(500).json({ error: 'Erro ao listar produtos' });
        }
    };
    getPaginationParams(req) {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        return { limit, offset: (page - 1) * limit, page };
    }
    async fetchProducts({ limit, offset }) {
        return sequelize.query(`SELECT * FROM products ORDER BY id DESC LIMIT :limit OFFSET :offset`, { replacements: { limit, offset }, type: QueryTypes.SELECT });
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

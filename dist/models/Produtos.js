// server/src/models/Produtos.ts
import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
export class Product extends Model {
}
Product.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    category: {
        type: DataTypes.STRING,
        allowNull: true, // Permite nulo temporariamente para evitar erros com produtos antigos
    },
    book_category: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    image_url: {
        // MUDANÇA CRÍTICA: TEXT('long') gera uma coluna LONGTEXT no MySQL
        type: DataTypes.TEXT('long'),
        allowNull: true,
    },
    age_range: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    discount_percent: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    is_featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    sequelize,
    tableName: 'products',
});

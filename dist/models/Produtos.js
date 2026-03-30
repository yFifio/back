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
        allowNull: true,
    },
    categoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
            model: 'categories',
            key: 'id',
        },
    },
    book_category: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    image_url: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
    },
    pdf_url: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
    },
    pdf_file_name: {
        type: DataTypes.STRING,
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

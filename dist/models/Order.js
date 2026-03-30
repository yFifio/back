import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
export class Order extends Model {
}
Order.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    customer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    customer_email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    customer_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    customer_cpf: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    subtotal_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    coupon_code: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    discount_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
    },
    total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    delivery_address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    delivery_city: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    delivery_state: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    delivery_zip: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    delivery_phone: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled'),
        defaultValue: 'pending',
    },
}, {
    sequelize,
    tableName: 'orders',
});

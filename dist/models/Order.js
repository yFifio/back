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
    status: {
        type: DataTypes.ENUM('pending', 'paid', 'delivered', 'cancelled'),
        defaultValue: 'pending',
    },
}, {
    sequelize,
    // note: database uses lowercase plural 'orders' (see foreign key constraint error)
    tableName: 'orders',
});

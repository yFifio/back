import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
export class Payment extends Model {
    id;
    order_id;
    mercado_pago_id;
    status;
    amount;
    payment_method;
    payer_email;
    raw_data;
}
Payment.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    mercado_pago_id: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    payment_method: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    payer_email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    raw_data: {
        type: DataTypes.JSON,
        allowNull: true,
    },
}, {
    sequelize,
    tableName: 'payments',
    timestamps: false,
});

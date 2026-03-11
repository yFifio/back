import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
export class PaymentWebhook extends Model {
    id;
    order_id;
    mercado_pago_id;
    mercado_pago_status;
    mercado_pago_status_detail;
    amount;
    payment_method_id;
    payer_email;
    raw_data;
    processed;
}
PaymentWebhook.init({
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
        unique: true,
    },
    mercado_pago_status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    mercado_pago_status_detail: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    payment_method_id: {
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
    processed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    sequelize,
    tableName: 'payment_webhooks',
});

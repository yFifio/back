import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

export class PaymentWebhook extends Model {
  public id!: number;
  public order_id!: number;
  public mercado_pago_id!: string | null;
  public mercado_pago_status!: string;
  public mercado_pago_status_detail!: string | null;
  public amount!: number;
  public payment_method_id!: string | null;
  public payer_email!: string | null;
  public raw_data!: object | null;
  public processed!: boolean;
}

PaymentWebhook.init(
  {
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
  },
  {
    sequelize,
    tableName: 'payment_webhooks',
  }
);

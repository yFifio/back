import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

export class Payment extends Model {
  public id!: number;
  public order_id!: number;
  public mercado_pago_id!: string | null;
  public status!: string;
  public amount!: number;
  public payment_method!: string | null;
  public payer_email!: string | null;
  public raw_data!: object | null;
}

Payment.init(
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
  },
  {
    sequelize,
    tableName: 'payments',
    timestamps: false,
  }
);

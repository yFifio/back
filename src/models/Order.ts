import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

export class Order extends Model {
  declare id: number;
  declare customer_id: number | null;
  declare customer_email: string;
  declare customer_name: string | null;
  declare customer_cpf: string | null;
  declare subtotal_price: number | null;
  declare coupon_code: string | null;
  declare discount_amount: number | null;
  declare total_price: number;
  declare delivery_address: string | null;
  declare delivery_city: string | null;
  declare delivery_state: string | null;
  declare delivery_zip: string | null;
  declare delivery_phone: string | null;
  declare status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
}

Order.init(
  {
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
  },
  {
    sequelize,
    tableName: 'orders',
  }
);

import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

export class Order extends Model {
  declare id: number;
  declare customer_id: number | null;
  declare customer_email: string;
  declare customer_name: string | null;
  declare subtotal_price: number | null;
  declare coupon_code: string | null;
  declare discount_amount: number | null;
  declare total_price: number;
  declare status: 'pending' | 'paid' | 'delivered' | 'cancelled';
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
  },
  {
    sequelize,
    tableName: 'orders',
  }
);

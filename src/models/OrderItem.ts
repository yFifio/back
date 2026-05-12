import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

export class OrderItem extends Model {
  declare id: number;
  declare order_id: number;
  declare product_id: number;
  declare product_name: string;
  declare price_at_purchase: number;
  declare quantity: number;
}

OrderItem.init(
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
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    product_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price_at_purchase: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'order_items',
    timestamps: false,
  }
);

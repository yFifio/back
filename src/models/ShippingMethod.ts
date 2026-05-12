import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export class ShippingMethod extends Model {
  declare id: number;
  declare name: string;
  declare price: number;
}

ShippingMethod.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 }
}, { tableName: 'shipping_methods', sequelize, timestamps: false });

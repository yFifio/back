import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
export class Coupon extends Model {
}
Coupon.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    discount: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 }
}, { tableName: 'coupons', sequelize, timestamps: false });

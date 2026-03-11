import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
export class Supplier extends Model {
}
Supplier.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true, unique: true }
}, { tableName: 'suppliers', sequelize, timestamps: false });

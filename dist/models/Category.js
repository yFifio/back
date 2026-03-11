import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
export class Category extends Model {
}
Category.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false }
}, { tableName: 'categories', sequelize, timestamps: false });

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
export class User extends Model {
}
User.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    nome: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    senha: { type: DataTypes.STRING, allowNull: false },
    cpf: { type: DataTypes.STRING, allowNull: false, unique: true },
    isAdmin: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'users', sequelize, timestamps: true });

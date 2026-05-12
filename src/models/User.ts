import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface UserAttributes {
  id: number;
  nome: string;
  email: string;
  senha: string;
  cpf: string;
  isAdmin: boolean;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> {
  declare id: number;
  declare nome: string;
  declare email: string;
  declare senha: string;
  declare cpf: string;
  declare isAdmin: boolean;
}

User.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  nome: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  senha: { type: DataTypes.STRING, allowNull: false },
  cpf: { type: DataTypes.STRING, allowNull: false, unique: true },
  isAdmin: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'users', sequelize, timestamps: true });
import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

export class System extends Model {
  declare id: number;
  declare name: string;
  declare type: 'A' | 'B' | 'C';
}

System.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM('A','B','C'), allowNull: false },
  },
  { sequelize, tableName: 'systems', timestamps: true }
);

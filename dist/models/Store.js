"use strict";
// ARQUIVO DESATIVADO PARA EVITAR CONFLITO COM Produtos.ts e Category.ts
// Este arquivo estava sobrescrevendo a estrutura do banco de dados com um modelo incompleto.
// import { DataTypes, Model } from 'sequelize';
// import sequelize from '../config/database';
// export class Category extends Model {}
// Category.init({
//   id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
//   nome: { type: DataTypes.STRING, allowNull: false }
// }, { tableName: 'categories', sequelize, timestamps: false });
// export class Product extends Model {}
// Product.init({
//   id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
//   name: { type: DataTypes.STRING, allowNull: false },
//   price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
//   categoryId: { type: DataTypes.INTEGER.UNSIGNED }
// }, { tableName: 'products', sequelize });
// Product.belongsTo(Category, { foreignKey: 'categoryId' });

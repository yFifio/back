import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

export class Product extends Model {
  public declare id: number;
  public declare name: string;
  public declare description: string;
  public declare price: number;
  public declare category: string;
  public declare categoryId: number | null;
  public declare book_category: string | null;
  public declare image_url: string;
  public declare age_range: string;
  public declare is_active: boolean;
  public declare discount_percent: number;
  public declare is_featured: boolean;
}

Product.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
    },
    book_category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.TEXT('long'), 
      allowNull: true,
    },
    age_range: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    discount_percent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'products',
  }
);

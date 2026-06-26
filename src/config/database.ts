import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'biblioteca_brincar',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || 'admin',
  {
    host: process.env.DB_HOST === 'database' ? '127.0.0.1' : (process.env.DB_HOST || '127.0.0.1'),
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
  }
);

export default sequelize;
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const useMysql = Boolean(process.env.DB_HOST && process.env.DB_HOST !== '');

let sequelize: Sequelize;
if (useMysql) {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'biblioteca_brincar',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || 'admin',
    {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      dialect: 'mysql',
      logging: false,
    }
  );
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false,
  });
  console.log('⚠️ No DB_HOST defined, using SQLite file fallback');
}

export default sequelize;
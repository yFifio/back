import { existsSync } from 'node:fs';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const configuredHost = process.env.DB_HOST?.trim();
const isDockerRuntime = existsSync('/.dockerenv');
const host = configuredHost === 'database' && !isDockerRuntime
  ? '127.0.0.1'
  : configuredHost || '127.0.0.1';

const sequelize = new Sequelize(
  process.env.DB_NAME || 'biblioteca_brincar',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || 'admin',
  {
    host,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
  }
);

export default sequelize;
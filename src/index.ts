import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import sequelize from './config/database';
import apiRoutes from './routes/api.routes';
import { setDbConnected } from './utils/appState';
import { Category } from './models/Category';
import { Product } from './models/Produtos';
import { Order } from './models/Order';
import { OrderItem } from './models/OrderItem';
import { Payment } from './models/Payment';
import { PaymentWebhook } from './models/PaymentWebhook';

dotenv.config();
const app = express();

const configurarMiddlewares = () => {
  app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], allowedHeaders: ["Content-Type", "Authorization"] }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
};

const configurarRotas = () => {
  app.use('/api', apiRoutes);
};

const logRouteNotFound = (res: Response) => res.status(404).json({ error: 'Rota não existe' });
const logInternalError = (res: Response) => res.status(500).json({ error: 'Erro interno do servidor' });

const configurarErros = () => {
  app.use((req: Request, res: Response, next: NextFunction) => logRouteNotFound(res));
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.message);
    logInternalError(res);
  });
};

const bindCatalogRelations = () => {
  Category.hasMany(Product, { foreignKey: 'categoryId' });
  Product.belongsTo(Category, { foreignKey: 'categoryId' });
};

const bindOrderRelations = () => {
  Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'order_items' });
  Order.hasMany(Payment, { foreignKey: 'order_id', as: 'payments' });
  Order.hasMany(PaymentWebhook, { foreignKey: 'order_id', as: 'webhooks' });
  OrderItem.belongsTo(Order, { foreignKey: 'order_id' });
  OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'products' });
  Payment.belongsTo(Order, { foreignKey: 'order_id' });
  PaymentWebhook.belongsTo(Order, { foreignKey: 'order_id' });
};

const registrarRelacionamentos = () => {
  bindCatalogRelations();
  bindOrderRelations();
};

const conectarBanco = async () => {
  try {
    registrarRelacionamentos();
    await sequelize.authenticate();
    console.log('🔄 Sincronizando esquema do banco de dados (ajustando colunas)...');
    
    try {
      await sequelize.sync({ alter: true });
    } catch (alterError: any) {
      if (alterError?.parent?.code === 'ER_TOO_MANY_KEYS') {
        console.log('⚠️ Muitas chaves detectadas, recriando tabelas...');
        await sequelize.sync({ force: true });
      } else {
        throw alterError;
      }
    }
    
    setDbConnected(true);
    console.log('✅ Base de dados MySQL conectada e sincronizada com sucesso!');
    return true;
  } catch (erro) {
    console.error('⚠️ Falha ao conectar ao MySQL:', erro);
    return false;
  }
};

const start = async () => {
  configurarMiddlewares();
  configurarRotas();
  configurarErros();
  
  const dbLigado = await conectarBanco();
  const portaInicial = Number(process.env.PORT || 3001);
  const maxTentativas = 10;

  const iniciarServidor = (porta: number, tentativasRestantes: number) => {
    const server = http.createServer(app);

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && tentativasRestantes > 0) {
        console.warn(`⚠️ Porta ${porta} em uso. Tentando porta ${porta + 1}...`);
        iniciarServidor(porta + 1, tentativasRestantes - 1);
        return;
      }

      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Não foi possível iniciar a API. Portas de ${portaInicial} até ${porta} estão ocupadas.`);
        console.log(`💡 Verifique processos com: lsof -nP -iTCP:${portaInicial} -sTCP:LISTEN`);
        process.exit(1);
      }

      console.error('❌ Erro ao iniciar servidor:', err.message);
      process.exit(1);
    });

    server.listen(porta, () => {
      console.log(`🚀 API rodando na porta ${porta} ${dbLigado ? '' : '(Rodando SEM BANCO DE DADOS)'}`);
    });
  };

  iniciarServidor(portaInicial, maxTentativas);
};

start();
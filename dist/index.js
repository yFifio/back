import express from 'express';
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
    app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"], allowedHeaders: ["Content-Type", "Authorization"] }));
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    // Middleware de Log para Debug
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        next();
    });
};
const configurarRotas = () => {
    app.use('/api', apiRoutes);
};
const configurarErros = () => {
    // Middleware 404 para rotas não encontradas
    app.use((req, res, next) => {
        res.status(404).json({ error: "Rota não existe" });
    });
    // Middleware de tratamento de erros (deve ser o último)
    app.use((err, req, res, next) => {
        console.error(err.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    });
};
const conectarBanco = async () => {
    try {
        // Relacionamentos ativados conforme rubrica
        Category.hasMany(Product, { foreignKey: 'categoryId' });
        Product.belongsTo(Category, { foreignKey: 'categoryId' });
        // orders and payments
        Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'order_items' });
        Order.hasMany(Payment, { foreignKey: 'order_id', as: 'payments' });
        Order.hasMany(PaymentWebhook, { foreignKey: 'order_id', as: 'webhooks' });
        OrderItem.belongsTo(Order, { foreignKey: 'order_id' });
        Payment.belongsTo(Order, { foreignKey: 'order_id' });
        PaymentWebhook.belongsTo(Order, { foreignKey: 'order_id' });
        await sequelize.authenticate();
        // O 'alter: true' ajusta as colunas existentes (ex: muda image_url para LONGTEXT)
        console.log('🔄 Sincronizando esquema do banco de dados (ajustando colunas)...');
        await sequelize.sync({ alter: true });
        setDbConnected(true);
        console.log('✅ Base de dados MySQL conectada e sincronizada com sucesso!');
        return true;
    }
    catch (erro) {
        console.error('⚠️ Falha ao conectar ao MySQL:', erro);
        return false;
    }
};
const start = async () => {
    configurarMiddlewares();
    configurarRotas();
    configurarErros();
    const dbLigado = await conectarBanco();
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`🚀 API rodando na porta ${PORT} ${dbLigado ? '' : '(Rodando SEM BANCO DE DADOS)'}`);
    });
};
start();

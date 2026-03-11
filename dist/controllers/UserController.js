import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { validarCPF, validarEmail, validarSenha } from '../utils/validators';
export class UserController {
    register = async (req, res) => {
        try {
            if (!req.body.nome || !req.body.email || !req.body.senha || !req.body.cpf) {
                return res.status(400).json({ error: 'Nome, email, senha e CPF são obrigatórios' });
            }
            const erroValidacao = this.validarDados(req.body);
            if (erroValidacao)
                return res.status(400).json({ error: erroValidacao });
            const exists = await User.findOne({ where: { email: req.body.email } });
            if (exists)
                return res.status(400).json({ error: 'Usuário já existe' });
            // cabeça fria: CPF também deve ser exclusivo
            if (req.body.cpf) {
                const cpfExists = await User.findOne({ where: { cpf: req.body.cpf } });
                if (cpfExists)
                    return res.status(400).json({ error: 'CPF já cadastrado' });
            }
            const user = await this.criarUsuario(req.body);
            return res.status(201).json({ id: user.id, nome: user.nome, email: user.email });
        }
        catch (error) {
            return res.status(400).json({ error: 'Erro ao processar cadastro.' });
        }
    };
    login = async (req, res) => {
        try {
            const { email, senha } = req.body;
            if (!validarEmail(email || '')) {
                return res.status(400).json({ error: 'Email inválido' });
            }
            const user = await User.findOne({ where: { email } });
            if (!user || !(await bcrypt.compare(senha, user.senha))) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }
            return res.json(this.generateAuthResponse(user));
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro interno' });
        }
    };
    list = async (req, res) => {
        const limit = Number(req.query.limit) || 10;
        const offset = Number(req.query.offset) || 0;
        const { count, rows } = await User.findAndCountAll({
            limit, offset, attributes: { exclude: ['senha'] }
        });
        return res.json({ data: rows, total: count });
    };
    updateMe = async (req, res) => {
        try {
            const user = await User.findByPk(req.userId);
            if (!user)
                return res.status(404).json({ error: 'Usuário não encontrado' });
            if (!req.body.nome || String(req.body.nome).trim().length < 2) {
                return res.status(400).json({ error: 'Nome é obrigatório' });
            }
            const erroValidacao = this.validarEdicao(req.body);
            if (erroValidacao)
                return res.status(400).json({ error: erroValidacao });
            // se o body trouxe cpf diferente, garante exclusividade
            if (req.body.cpf && req.body.cpf !== user.cpf) {
                const cpfExists = await User.findOne({ where: { cpf: req.body.cpf } });
                if (cpfExists)
                    return res.status(400).json({ error: 'CPF já cadastrado' });
            }
            await this.processarAtualizacao(user, req.body);
            // reload to ensure we return fresh data without password
            const updated = await User.findByPk(user.id, { attributes: { exclude: ['senha'] } });
            return res.json({ user: updated });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro interno' });
        }
    };
    delete = async (req, res) => {
        try {
            const rows = await User.destroy({ where: { id: req.params.id } });
            if (!rows)
                return res.status(404).json({ error: 'Usuário não encontrado' });
            return res.json({ message: 'Usuário deletado' });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro ao deletar' });
        }
    };
    // --- Métodos Privados (com tipagem estrita) --
    validarDados(body) {
        if (!validarEmail(body.email || ''))
            return 'Email inválido';
        if (!validarCPF(body.cpf || ''))
            return 'CPF inválido';
        if (!validarSenha(body.senha || ''))
            return 'Senha muito fraca';
        return null;
    }
    validarEdicao(body) {
        if (body.cpf && !validarCPF(body.cpf))
            return 'CPF inválido';
        if (body.senha && !validarSenha(body.senha))
            return 'Senha fraca';
        return null;
    }
    async criarUsuario(body) {
        const hashed = await bcrypt.hash(body.senha || '', 10);
        return User.create({ ...body, senha: hashed, isAdmin: false });
    }
    generateAuthResponse(user) {
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
        return {
            token,
            user: { id: user.id, nome: user.nome, email: user.email, isAdmin: user.isAdmin, cpf: user.cpf }
        };
    }
    async processarAtualizacao(user, body) {
        // Cópia segura para manter tipagem estrita na desestruturação
        const dadosSeguros = { ...body };
        delete dadosSeguros.email; // Regra: Não permitir alteração de email
        delete dadosSeguros.cpf; // também não alterar cpf via atualização de perfil
        if (dadosSeguros.senha) {
            dadosSeguros.senha = await bcrypt.hash(dadosSeguros.senha, 10);
        }
        await user.update(dadosSeguros);
    }
    // permite que admins atualizem qualquer usuário (sem alterar email/cpf)
    updateById = async (req, res) => {
        try {
            // verifica se quem faz a requisição é admin
            const admin = await User.findByPk(req.userId);
            if (!admin || !admin.isAdmin) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            const user = await User.findByPk(req.params.id);
            if (!user)
                return res.status(404).json({ error: 'Usuário não encontrado' });
            const erroValidacao = this.validarEdicao(req.body);
            if (erroValidacao)
                return res.status(400).json({ error: erroValidacao });
            // não permitir alteração de email ou cpf na edição de outro usuário
            const dadosSeguros = { ...req.body };
            delete dadosSeguros.email;
            delete dadosSeguros.cpf;
            if (dadosSeguros.senha) {
                dadosSeguros.senha = await bcrypt.hash(dadosSeguros.senha, 10);
            }
            await user.update(dadosSeguros);
            const updated = await User.findByPk(user.id, { attributes: { exclude: ['senha'] } });
            return res.json({ user: updated });
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro interno' });
        }
    };
}

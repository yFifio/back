import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op, col, fn, where } from 'sequelize';
import { User } from '../models/User';
import { validarCPF, validarEmail, validarSenha } from '../utils/validators';
export class UserController {
    register = async (req, res) => {
        try {
            return await this.processarCadastro(req, res);
        }
        catch (error) {
            return res.status(400).json({ error: 'Erro ao processar cadastro.' });
        }
    };
    async processarCadastro(req, res) {
        const payload = this.normalizarCadastro(req.body);
        const camposErro = this.verificarCamposObrigatorios(payload);
        if (camposErro)
            return res.status(400).json({ error: camposErro });
        const erroValidacao = this.validarDados(payload);
        if (erroValidacao)
            return res.status(400).json({ error: erroValidacao });
        const erroDuplicidade = await this.verificarDuplicidade(payload.email, payload.cpf);
        if (erroDuplicidade)
            return res.status(400).json({ error: erroDuplicidade });
        const user = await this.criarUsuario(payload);
        return res.status(201).json({ id: user.id, nome: user.nome, email: user.email });
    }
    verificarCamposObrigatorios(body) {
        if (!body.nome || !body.email || !body.senha || !body.cpf)
            return 'Nome, email, senha e CPF são obrigatórios';
        return null;
    }
    async verificarDuplicidade(email, cpf) {
        if (await User.findOne({ where: { email } }))
            return 'Usuário já existe';
        if (await User.findOne({ where: { cpf } }))
            return 'CPF já cadastrado';
        return null;
    }
    login = async (req, res) => {
        try {
            return await this.loginInternal(req, res);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro interno' });
        }
    };
    async loginInternal(req, res) {
        const { email, senha } = req.body;
        const identifier = String(email || '').trim();
        const password = String(senha || '');
        if (!identifier || !password) {
            return this.badRequest(res, 'Email/CPF e senha são obrigatórios');
        }
        if (identifier.includes('@') && !this.emailValido(identifier)) {
            return this.badRequest(res, 'Email inválido');
        }
        const authResult = await this.autenticarUsuario(identifier, password);
        if (!authResult.user) {
            if (authResult.reason === 'not_found') {
                return this.unauthorized(res, 'Conta não encontrada. Crie sua conta primeiro.');
            }
            return this.unauthorized(res, 'Senha incorreta');
        }
        return res.json(this.generateAuthResponse(authResult.user));
    }
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
            return await this.processarAtualizacaoMe(req, res);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro interno' });
        }
    };
    async processarAtualizacaoMe(req, res) {
        const user = await User.findByPk(req.userId);
        if (!user)
            return this.notFound(res, 'Usuário não encontrado');
        const erro = await this.validarAtualizacao(req.body, user.cpf);
        if (erro)
            return this.badRequest(res, erro);
        await this.processarAtualizacao(user, req.body);
        const updated = await User.findByPk(user.id, { attributes: { exclude: ['senha'] } });
        return res.json({ user: updated });
    }
    validarCamposObrigatoriosEdicao(body) {
        if (body.nome !== undefined && String(body.nome).trim().length < 2)
            return 'Nome é obrigatório';
        if (body.cpf !== undefined && String(body.cpf).trim().length === 0)
            return 'CPF inválido';
        return null;
    }
    async verificarCpfUnico(cpf, cpfAtual) {
        if (!cpf || cpf === cpfAtual)
            return null;
        const cpfExists = await User.findOne({ where: { cpf } });
        return cpfExists ? 'CPF já cadastrado' : null;
    }
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
        const token = jwt.sign({ id: user.id, isAdmin: user.isAdmin }, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
        return {
            token,
            user: { id: user.id, nome: user.nome, email: user.email, isAdmin: user.isAdmin, cpf: user.cpf }
        };
    }
    async processarAtualizacao(user, body) {
        const dadosSeguros = { ...body };
        delete dadosSeguros.email;
        if (dadosSeguros.senha) {
            dadosSeguros.senha = await bcrypt.hash(dadosSeguros.senha, 10);
        }
        await user.update(dadosSeguros);
    }
    updateById = async (req, res) => {
        try {
            return await this.processarAtualizacaoAdmin(req, res);
        }
        catch (error) {
            return res.status(500).json({ error: 'Erro interno' });
        }
    };
    async processarAtualizacaoAdmin(req, res) {
        if (!req.isAdmin)
            return this.forbidden(res, 'Apenas administradores podem editar usuários');
        const user = await User.findByPk(req.params.id);
        if (!user)
            return this.notFound(res, 'Usuário não encontrado');
        const erro = await this.validarAtualizacao(req.body, user.cpf);
        if (erro)
            return this.badRequest(res, erro);
        await this.processarAtualizacao(user, req.body);
        const updated = await User.findByPk(user.id, { attributes: { exclude: ['senha'] } });
        return res.json({ user: updated });
    }
    async autenticarUsuario(identifier, senha) {
        const normalizedIdentifier = identifier.trim();
        const isEmail = normalizedIdentifier.includes('@');
        const user = isEmail
            ? await User.findOne({
                where: where(fn('LOWER', fn('TRIM', col('email'))), normalizedIdentifier.toLowerCase()),
            })
            : await this.buscarUsuarioPorCpf(normalizedIdentifier);
        if (!user)
            return { user: null, reason: 'not_found' };
        const ok = await bcrypt.compare(senha, user.senha);
        if (!ok)
            return { user: null, reason: 'wrong_password' };
        return { user };
    }
    async buscarUsuarioPorCpf(cpfInput) {
        const cpfNormalizado = cpfInput.replace(/\D/g, '');
        return User.findOne({
            where: {
                [Op.or]: [
                    { cpf: cpfInput },
                    { cpf: cpfNormalizado },
                    where(fn('REPLACE', fn('REPLACE', fn('REPLACE', fn('REPLACE', fn('TRIM', col('cpf')), '.', ''), '-', ''), '/', ''), ' ', ''), cpfNormalizado),
                ],
            },
        });
    }
    normalizarCadastro(body) {
        return {
            ...body,
            email: String(body.email || '').trim().toLowerCase(),
            cpf: String(body.cpf || '').replace(/\D/g, ''),
        };
    }
    async validarAtualizacao(body, cpfAtual) {
        const erroCampos = this.validarCamposObrigatoriosEdicao(body);
        if (erroCampos)
            return erroCampos;
        const erroValidacao = this.validarEdicao(body);
        if (erroValidacao)
            return erroValidacao;
        if (body.cpf) {
            return this.verificarCpfUnico(body.cpf, cpfAtual);
        }
        return null;
    }
    isSelfUpdate(req) {
        return Boolean(req.userId && req.userId === Number(req.params.id));
    }
    emailValido(email) {
        return validarEmail(email || '');
    }
    badRequest(res, message) {
        return res.status(400).json({ error: message });
    }
    unauthorized(res, message) {
        return res.status(401).json({ error: message });
    }
    forbidden(res, message) {
        return res.status(403).json({ error: message });
    }
    notFound(res, message) {
        return res.status(404).json({ error: message });
    }
}

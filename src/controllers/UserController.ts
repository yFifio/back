import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Op, col, fn, where } from 'sequelize';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { validarCPF, validarEmail, validarSenha } from '../utils/validators';

export class UserController {
  register = async (req: Request, res: Response) => {
    try {
      return await this.processarCadastro(req, res);
    } catch (error) {
      return res.status(400).json({ error: 'Erro ao processar cadastro.' });
    }
  }

  private async processarCadastro(req: Request, res: Response) {
    const payload = this.normalizarCadastro(req.body as Partial<User> & { senha?: string });
    const camposErro = this.verificarCamposObrigatorios(payload);
    if (camposErro) return res.status(400).json({ error: camposErro });
    const erroValidacao = this.validarDados(payload);
    if (erroValidacao) return res.status(400).json({ error: erroValidacao });
    const erroDuplicidade = await this.verificarDuplicidade(payload.email, payload.cpf);
    if (erroDuplicidade) return res.status(400).json({ error: erroDuplicidade });
    const user = await this.criarUsuario(payload);
    return res.status(201).json({ id: user.id, nome: user.nome, email: user.email });
  }

  private verificarCamposObrigatorios(body: Partial<User> & { senha?: string }): string | null {
    if (!body.nome || !body.email || !body.senha || !body.cpf)
      return 'Nome, email, senha e CPF são obrigatórios';
    return null;
  }

  private async verificarDuplicidade(email: string, cpf: string): Promise<string | null> {
    if (await User.findOne({ where: { email } })) return 'Usuário já existe';
    if (await User.findOne({ where: { cpf } })) return 'CPF já cadastrado';
    return null;
  }

  login = async (req: Request, res: Response) => {
    try {
      return await this.loginInternal(req, res);
    } catch (error) {
      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  private async loginInternal(req: Request, res: Response) {
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

  list = async (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 10;
    const offset = Number(req.query.offset) || 0;
    const { count, rows } = await User.findAndCountAll({ 
      limit, offset, attributes: { exclude: ['senha'] } 
    });
    return res.json({ data: rows, total: count });
  }

  updateMe = async (req: AuthRequest, res: Response) => {
    try {
      return await this.processarAtualizacaoMe(req, res);
    } catch (error) {
      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  private async processarAtualizacaoMe(req: AuthRequest, res: Response) {
    const user = await User.findByPk(req.userId);
    if (!user) return this.notFound(res, 'Usuário não encontrado');
    const erro = await this.validarAtualizacao(req.body, user.cpf);
    if (erro) return this.badRequest(res, erro);
    await this.processarAtualizacao(user, req.body);
    const updated = await User.findByPk(user.id, { attributes: { exclude: ['senha'] } });
    return res.json({ user: updated });
  }

  private validarCamposObrigatoriosEdicao(body: Partial<User> & { senha?: string }): string | null {
    if (body.nome !== undefined && String(body.nome).trim().length < 2) return 'Nome é obrigatório';
    if (body.cpf !== undefined && String(body.cpf).trim().length === 0) return 'CPF inválido';
    return null;
  }

  private async verificarCpfUnico(cpf: string, cpfAtual: string): Promise<string | null> {
    if (!cpf || cpf === cpfAtual) return null;
    const cpfExists = await User.findOne({ where: { cpf } });
    return cpfExists ? 'CPF já cadastrado' : null;
  }

  delete = async (req: Request, res: Response) => {
    try {
      const rows = await User.destroy({ where: { id: req.params.id } });
      if (!rows) return res.status(404).json({ error: 'Usuário não encontrado' });
      return res.json({ message: 'Usuário deletado' });
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao deletar' });
    }
  }

  private validarDados(body: Partial<User> & { senha?: string }) {
    if (!validarEmail(body.email || '')) return 'Email inválido';
    if (!validarCPF(body.cpf || '')) return 'CPF inválido';
    if (!validarSenha(body.senha || '')) return 'Senha muito fraca';
    return null;
  }

  private validarEdicao(body: Partial<User> & { senha?: string }) {
    if (body.cpf && !validarCPF(body.cpf)) return 'CPF inválido';
    if (body.senha && !validarSenha(body.senha)) return 'Senha fraca';
    return null;
  }

  private async criarUsuario(body: Partial<User> & { senha?: string }) {
    const hashed = await bcrypt.hash(body.senha || '', 10);
    return User.create({ ...body, senha: hashed, isAdmin: false } as User);
  }

  private generateAuthResponse(user: User) {
    const token = jwt.sign({ id: user.id , isAdmin: user.isAdmin}, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });
    return {
      token,
      user: { id: user.id, nome: user.nome, email: user.email, isAdmin: user.isAdmin, cpf: user.cpf }
    };
  }

  private async processarAtualizacao(user: User, body: Partial<User> & { senha?: string }) {
    const dadosSeguros = { ...body };
    delete dadosSeguros.email;
    
    if (dadosSeguros.senha) {
      dadosSeguros.senha = await bcrypt.hash(dadosSeguros.senha, 10);
    }
    await user.update(dadosSeguros);
  }

  updateById = async (req: AuthRequest, res: Response) => {
    try {
      return await this.processarAtualizacaoAdmin(req, res);
    } catch (error) {
      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  private async processarAtualizacaoAdmin(req: AuthRequest, res: Response) {
    if (!req.isAdmin) return this.forbidden(res, 'Apenas administradores podem editar usuários');
    const user = await User.findByPk(req.params.id);
    if (!user) return this.notFound(res, 'Usuário não encontrado');
    const erro = await this.validarAtualizacao(req.body, user.cpf);
    if (erro) return this.badRequest(res, erro);
    await this.processarAtualizacao(user, req.body);
    const updated = await User.findByPk(user.id, { attributes: { exclude: ['senha'] } });
    return res.json({ user: updated });
  }

  private async autenticarUsuario(identifier: string, senha: string): Promise<{ user: User | null; reason?: 'not_found' | 'wrong_password' }> {
    const normalizedIdentifier = identifier.trim();
    const isEmail = normalizedIdentifier.includes('@');

    const user = isEmail
      ? await User.findOne({
          where: where(fn('LOWER', fn('TRIM', col('email'))), normalizedIdentifier.toLowerCase()),
        })
      : await this.buscarUsuarioPorCpf(normalizedIdentifier);

    if (!user) return { user: null, reason: 'not_found' };

    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) return { user: null, reason: 'wrong_password' };

    return { user };
  }

  private async buscarUsuarioPorCpf(cpfInput: string): Promise<User | null> {
    const cpfNormalizado = cpfInput.replace(/\D/g, '');

    return User.findOne({
      where: {
        [Op.or]: [
          { cpf: cpfInput },
          { cpf: cpfNormalizado },
          where(
            fn(
              'REPLACE',
              fn(
                'REPLACE',
                fn('REPLACE', fn('REPLACE', fn('TRIM', col('cpf')), '.', ''), '-', ''),
                '/',
                ''
              ),
              ' ',
              ''
            ),
            cpfNormalizado
          ),
        ],
      },
    });
  }

  private normalizarCadastro(body: Partial<User> & { senha?: string }) {
    return {
      ...body,
      email: String(body.email || '').trim().toLowerCase(),
      cpf: String(body.cpf || '').replace(/\D/g, ''),
    };
  }

  private async validarAtualizacao(body: Partial<User> & { senha?: string }, cpfAtual: string) {
    const erroCampos = this.validarCamposObrigatoriosEdicao(body);
    if (erroCampos) return erroCampos;
    const erroValidacao = this.validarEdicao(body);
    if (erroValidacao) return erroValidacao;
    if (body.cpf) {
      return this.verificarCpfUnico(body.cpf, cpfAtual);
    }
    return null;
  }

  private isSelfUpdate(req: AuthRequest) {
    return Boolean(req.userId && req.userId === Number(req.params.id));
  }

  private emailValido(email: string) {
    return validarEmail(email || '');
  }

  private badRequest(res: Response, message: string) {
    return res.status(400).json({ error: message });
  }

  private unauthorized(res: Response, message: string) {
    return res.status(401).json({ error: message });
  }

  private forbidden(res: Response, message: string) {
    return res.status(403).json({ error: message });
  }

  private notFound(res: Response, message: string) {
    return res.status(404).json({ error: message });
  }
}

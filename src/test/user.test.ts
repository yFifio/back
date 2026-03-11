import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { UserController } from '../controllers/UserController';
import { Request, Response } from 'express';
import { User } from '../models/User';
import bcrypt from 'bcrypt';

type TestRequest = Partial<Request> & {
  body?: { nome?: string; email?: string; senha?: string; cpf?: string };
  params?: { id?: string };
  userId?: number;
};

type TestResponse = Response & { status: Mock; json: Mock };

const makeReq = (data: TestRequest): Request => data as Request;
const makeRes = (): TestResponse => ({ status: vi.fn().mockReturnThis(), json: vi.fn() } as TestResponse);

interface MockUserData {
  id?: number;
  nome?: string;
  email?: string;
  cpf?: string;
  senha?: string;
  isAdmin?: boolean;
  update?: (dados: Partial<MockUserData>) => MockUserData;
}

vi.mock('../models/User', () => {
  const findByPk = vi.fn();
  const create = vi.fn().mockResolvedValue({ id: 2, nome: 'Novo', email: 'novo@teste.com' });
  const findOne = vi.fn();
  const destroy = vi.fn();
  const findAndCountAll = vi.fn();
  return { User: { findByPk, create, findOne, destroy, findAndCountAll } };
});


describe('Regras de Negócio do UserController', () => {
  const userCtrl = new UserController();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Não deve permitir o cadastro de um e-mail inválido', async () => {
    const req = makeReq({ body: { nome: 'Teste', email: 'invalido', senha: '12345678', cpf: '12345678901' } });
    const res = makeRes();

    await userCtrl.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email inválido' });
  });

  it('Não deve permitir o cadastro de um CPF inválido', async () => {
    const req = makeReq({ body: { nome: 'Teste', email: 'teste@ok.com', senha: '12345678', cpf: '111' } });
    const res = makeRes();

    await userCtrl.register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'CPF inválido' });
  });

  it('Falha registro quando email já está em uso', async () => {
    (User.findOne as Mock).mockResolvedValueOnce({ id: 1 });
    const req = makeReq({ body: { nome: 'X', email: 'dup@teste.com', senha: 'SenhaSegura1', cpf: '52998224725' } });
    const res = makeRes();

    await userCtrl.register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuário já existe' });
  });

  it('Falha registro quando CPF já está em uso', async () => {
    (User.findOne as Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 2 });

    const req = makeReq({ body: { nome: 'X', email: 'novo@teste.com', senha: 'SenhaSegura1', cpf: '52998224725' } });
    const res = makeRes();

    await userCtrl.register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'CPF já cadastrado' });
  });

  it('updateMe retorna o usuário atualizado e não altera email ou cpf', async () => {
    const fakeUser: MockUserData = {
      id: 1,
      nome: 'Lucas',
      email: 'lucas@original.com',
      cpf: '52998224725',
      isAdmin: false,
      update: vi.fn().mockImplementation(function(this: MockUserData, novosDados: MockUserData) {
        Object.assign(this, novosDados);
        return this;
      })
    };
    (User.findByPk as Mock).mockResolvedValueOnce(fakeUser).mockResolvedValueOnce(fakeUser);

    const req = makeReq({
      userId: 1,
      body: { nome: 'Nome Atualizado', email: 'hacker@tentativa.com', cpf: '52998224725' }
    });
    const res = makeRes();

    await userCtrl.updateMe(req, res);

    const jsonMock = res.json as Mock;
    const responseJson = jsonMock.mock.calls[0] && jsonMock.mock.calls[0][0];

    expect(responseJson?.user?.nome).toBe('Nome Atualizado');
    expect(responseJson?.user?.email).toBe('lucas@original.com');
    expect(responseJson?.user?.cpf).toBe('52998224725');
  });

  it('updateMe falha se tenta mudar cpf para existente', async () => {
    (User.findByPk as Mock)
      .mockResolvedValueOnce({ id: 1, cpf: '11122233344', update: vi.fn() })
      .mockResolvedValueOnce({ id: 1, cpf: '11122233344' });

    (User.findOne as Mock).mockResolvedValueOnce({ id: 2 });

    const req = makeReq({ userId: 1, body: { nome: 'Lucas', cpf: '52998224725' } });
    const res = makeRes();

    await userCtrl.updateMe(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'CPF já cadastrado' });
  });

  it('Permite updateById apenas quando o id é do próprio usuário', async () => {
    const target: MockUserData = {
      id: 1,
      nome: 'Cliente',
      email: 'cliente@orig.com',
      cpf: '52998224725',
      update: vi.fn().mockImplementation(function(this: MockUserData, novosDados: MockUserData) {
        Object.assign(this, novosDados);
        return this;
      })
    };
    (User.findByPk as Mock)
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(target);

    const req = makeReq({
      userId: 1,
      params: { id: '1' },
      body: { nome: 'Novo Nome', cpf: '52998224725', email: 'hacker@teste.com' }
    });
    const res = makeRes();

    await userCtrl.updateById(req, res);

    const jsonMock = res.json as Mock;
    const responseJson = jsonMock.mock.calls[0] && jsonMock.mock.calls[0][0];
    expect(responseJson?.user?.nome).toBe('Novo Nome');
    expect(responseJson?.user?.email).toBe('cliente@orig.com');
    expect(responseJson?.user?.cpf).toBe('52998224725');
  });

  it('Não permite que usuário edite outro usuário via updateById', async () => {
    const req = makeReq({ userId: 1, params: { id: '2' }, body: { nome: 'x' } });
    const res = makeRes();

    await userCtrl.updateById(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Você só pode editar o próprio usuário' });
  });

  it('Login com credenciais válidas retorna JWT e user', async () => {
    const hashed = await bcrypt.hash('SenhaSegura1', 10);
    (User.findOne as Mock).mockResolvedValueOnce({
      id: 10,
      nome: 'Lucas',
      email: 'lucas@teste.com',
      cpf: '52998224725',
      isAdmin: false,
      senha: hashed,
    });

    const req = makeReq({ body: { email: 'lucas@teste.com', senha: 'SenhaSegura1' } });
    const res = makeRes();
    await userCtrl.login(req, res);

    const payload = (res.json as Mock).mock.calls[0][0];
    expect(payload.token).toBeTypeOf('string');
    expect(payload.user.email).toBe('lucas@teste.com');
  });

  it('Login falha com usuário inexistente', async () => {
    (User.findOne as Mock).mockResolvedValueOnce(null);
    const req = makeReq({ body: { email: 'nao@existe.com', senha: 'SenhaSegura1' } });
    const res = makeRes();
    await userCtrl.login(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

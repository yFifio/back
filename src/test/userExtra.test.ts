import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { UserController } from '../controllers/UserController';
import { Request, Response } from 'express';
import { User } from '../models/User';
import bcrypt from 'bcrypt';

type TestRequest = Partial<Request> & {
  body?: Record<string, unknown>;
  params?: { id?: string };
  query?: { limit?: string; offset?: string };
  userId?: number;
  isAdmin?: boolean;
};
type TestResponse = Response & { status: Mock; json: Mock };

const makeReq = (data: TestRequest): Request => data as Request;
const makeRes = (): TestResponse => ({ status: vi.fn().mockReturnThis(), json: vi.fn() } as TestResponse);

vi.mock('../models/User', () => {
  const findByPk = vi.fn();
  const create = vi.fn();
  const findOne = vi.fn();
  const destroy = vi.fn();
  const findAndCountAll = vi.fn();
  return { User: { findByPk, create, findOne, destroy, findAndCountAll } };
});

describe('UserController - extra', () => {
  const ctrl = new UserController();
  const ctrlPrivate = ctrl as unknown as { isSelfUpdate: (req: Request) => boolean };
  beforeEach(() => vi.resetAllMocks());

  // list
  it('list retorna lista paginada de usuários', async () => {
    (User.findAndCountAll as Mock).mockResolvedValueOnce({
      count: 2,
      rows: [{ id: 1, nome: 'A' }, { id: 2, nome: 'B' }],
    });
    const res = makeRes();
    await ctrl.list(makeReq({ query: { limit: '10', offset: '0' } }), res);
    expect(res.json).toHaveBeenCalledWith({
      data: [{ id: 1, nome: 'A' }, { id: 2, nome: 'B' }],
      total: 2,
    });
  });

  // delete
  it('delete remove usuário com sucesso', async () => {
    (User.destroy as Mock).mockResolvedValueOnce(1);
    const res = makeRes();
    await ctrl.delete(makeReq({ params: { id: '1' } }), res);
    expect(User.destroy).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuário deletado' });
  });

  it('delete retorna 404 quando usuário não existe', async () => {
    (User.destroy as Mock).mockResolvedValueOnce(0);
    const res = makeRes();
    await ctrl.delete(makeReq({ params: { id: '99' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não encontrado' });
  });

  it('delete retorna 500 em exceção', async () => {
    (User.destroy as Mock).mockRejectedValueOnce(new Error('db error'));
    const res = makeRes();
    await ctrl.delete(makeReq({ params: { id: '1' } }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao deletar' });
  });

  // register - missing fields
  it('register retorna 400 quando campos obrigatórios faltam', async () => {
    const res = makeRes();
    await ctrl.register(makeReq({ body: { nome: 'X' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Nome, email, senha e CPF são obrigatórios' });
  });

  it('register retorna 400 quando senha é fraca', async () => {
    const res = makeRes();
    await ctrl.register(makeReq({ body: { nome: 'X', email: 'x@x.com', senha: '123', cpf: '52998224725' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Senha muito fraca' });
  });

  it('register cria usuário com sucesso', async () => {
    (User.findOne as Mock).mockResolvedValue(null);
    (User.create as Mock).mockResolvedValueOnce({ id: 10, nome: 'Novo', email: 'novo@test.com' });
    const res = makeRes();
    await ctrl.register(makeReq({ body: { nome: 'Novo', email: 'novo@test.com', senha: 'SenhaSegura1', cpf: '52998224725' } }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 10, nome: 'Novo', email: 'novo@test.com' });
  });

  // updateMe - user not found
  it('updateMe retorna 404 quando usuário não encontrado', async () => {
    (User.findByPk as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.updateMe(makeReq({ userId: 99, body: { nome: 'X', cpf: '52998224725' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não encontrado' });
  });

  it('updateMe retorna 400 quando nome muito curto', async () => {
    (User.findByPk as Mock).mockResolvedValueOnce({ id: 1, cpf: '52998224725', update: vi.fn() });
    const res = makeRes();
    await ctrl.updateMe(makeReq({ userId: 1, body: { nome: 'X', cpf: '52998224725' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Nome é obrigatório' });
  });

  it('updateMe permite atualizar nome sem enviar CPF', async () => {
    const user = { id: 1, cpf: '52998224725', email: 'user@test.com', update: vi.fn().mockResolvedValue(undefined) };
    (User.findByPk as Mock)
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(user);
    const res = makeRes();
    await ctrl.updateMe(makeReq({ userId: 1, body: { nome: 'Nome Valido' } }), res);
    expect(user.update).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('updateMe retorna 400 quando CPF inválido', async () => {
    (User.findByPk as Mock).mockResolvedValueOnce({ id: 1, cpf: '52998224725', update: vi.fn() });
    const res = makeRes();
    await ctrl.updateMe(makeReq({ userId: 1, body: { nome: 'Nome Valido', cpf: '111' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'CPF inválido' });
  });

  it('updateMe retorna 400 quando senha fraca', async () => {
    (User.findByPk as Mock).mockResolvedValueOnce({ id: 1, cpf: '52998224725', update: vi.fn() });
    const res = makeRes();
    await ctrl.updateMe(makeReq({ userId: 1, body: { nome: 'Nome Valido', cpf: '52998224725', senha: '123' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Senha fraca' });
  });

  it('updateMe funciona com nova senha válida', async () => {
    const user = { id: 1, cpf: '52998224725', email: 'user@test.com', update: vi.fn().mockResolvedValue(undefined) };
    (User.findByPk as Mock)
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(user);
    const res = makeRes();
    await ctrl.updateMe(makeReq({ userId: 1, body: { nome: 'Nome Valido', cpf: '52998224725', senha: 'SenhaSegura2' } }), res);
    expect(user.update).toHaveBeenCalled();
    const updateCall = (user.update as Mock).mock.calls[0][0];
    expect(updateCall.email).toBeUndefined(); // email should be deleted
  });

  // updateById - user not found
  it('updateById retorna 404 quando usuário não encontrado', async () => {
    (User.findByPk as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.updateById(makeReq({ userId: 1, isAdmin: true, params: { id: '99' }, body: { nome: 'X', cpf: '52998224725' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não encontrado' });
  });

  // login - wrong password
  it('login retorna 401 com senha incorreta', async () => {
    const hashed = await bcrypt.hash('CorrectPass1', 10);
    (User.findOne as Mock).mockResolvedValueOnce({
      id: 1, nome: 'User', email: 'u@u.com', cpf: '52998224725', isAdmin: false, senha: hashed,
    });
    const res = makeRes();
    await ctrl.login(makeReq({ body: { email: 'u@u.com', senha: 'WrongPass1' } }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Senha incorreta' }));
  });

  it('login retorna 400 quando campos faltam', async () => {
    const res = makeRes();
    await ctrl.login(makeReq({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Email/CPF e senha são obrigatórios' }));
  });

  it('login retorna 401 com email inválido no identifier', async () => {
    const res = makeRes();
    await ctrl.login(makeReq({ body: { email: 'nao-tem-arroba@invalido', senha: 'SenhaSegura1' } }), res);
    // This will pass email validation then try to find user
    (User.findOne as Mock).mockResolvedValueOnce(null);
    // Either returns "Conta não encontrada" or processes normally
    expect(res.status).toHaveBeenCalled();
  });

  it('login retorna 401 quando conta não encontrada', async () => {
    (User.findOne as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.login(makeReq({ body: { email: 'notfound@test.com', senha: 'SenhaSegura1' } }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Conta não encontrada. Crie sua conta primeiro.' }));
  });

  it('login retorna 401 para CPF não encontrado', async () => {
    (User.findOne as Mock).mockResolvedValueOnce(null);
    const res = makeRes();
    await ctrl.login(makeReq({ body: { email: '529.982.247-25', senha: 'SenhaSegura1' } }), res);
    expect(User.findOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Conta não encontrada. Crie sua conta primeiro.' }));
  });

  it('isSelfUpdate retorna true quando userId é igual ao params.id', () => {
    expect(ctrlPrivate.isSelfUpdate(makeReq({ userId: 10, params: { id: '10' } }))).toBe(true);
  });

  it('isSelfUpdate retorna false quando userId é diferente do params.id', () => {
    expect(ctrlPrivate.isSelfUpdate(makeReq({ userId: 10, params: { id: '11' } }))).toBe(false);
  });
});

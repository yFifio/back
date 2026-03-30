import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserController } from '../controllers/UserController';
import { User } from '../models/User';
import bcrypt from 'bcrypt';
const makeReq = (data) => data;
const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
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
        User.findOne.mockResolvedValueOnce({ id: 1 });
        const req = makeReq({ body: { nome: 'X', email: 'dup@teste.com', senha: 'SenhaSegura1', cpf: '52998224725' } });
        const res = makeRes();
        await userCtrl.register(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Usuário já existe' });
    });
    it('Falha registro quando CPF já está em uso', async () => {
        User.findOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 2 });
        const req = makeReq({ body: { nome: 'X', email: 'novo@teste.com', senha: 'SenhaSegura1', cpf: '52998224725' } });
        const res = makeRes();
        await userCtrl.register(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'CPF já cadastrado' });
    });
    it('updateMe retorna o usuário atualizado e não altera email ou cpf', async () => {
        const fakeUser = {
            id: 1,
            nome: 'Lucas',
            email: 'lucas@original.com',
            cpf: '52998224725',
            isAdmin: false,
            update: vi.fn().mockImplementation(function (novosDados) {
                Object.assign(this, novosDados);
                return this;
            })
        };
        User.findByPk.mockResolvedValueOnce(fakeUser).mockResolvedValueOnce(fakeUser);
        const req = makeReq({
            userId: 1,
            body: { nome: 'Nome Atualizado', email: 'hacker@tentativa.com', cpf: '52998224725' }
        });
        const res = makeRes();
        await userCtrl.updateMe(req, res);
        const jsonMock = res.json;
        const responseJson = jsonMock.mock.calls[0] && jsonMock.mock.calls[0][0];
        expect(responseJson?.user?.nome).toBe('Nome Atualizado');
        expect(responseJson?.user?.email).toBe('lucas@original.com');
        expect(responseJson?.user?.cpf).toBe('52998224725');
    });
    it('updateMe falha se tenta mudar cpf para existente', async () => {
        User.findByPk
            .mockResolvedValueOnce({ id: 1, cpf: '11122233344', update: vi.fn() })
            .mockResolvedValueOnce({ id: 1, cpf: '11122233344' });
        User.findOne.mockResolvedValueOnce({ id: 2 });
        const req = makeReq({ userId: 1, body: { nome: 'Lucas', cpf: '52998224725' } });
        const res = makeRes();
        await userCtrl.updateMe(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'CPF já cadastrado' });
    });
    it('Permite updateById quando é admin', async () => {
        const target = {
            id: 1,
            nome: 'Cliente',
            email: 'cliente@orig.com',
            cpf: '52998224725',
            update: vi.fn().mockImplementation(function (novosDados) {
                Object.assign(this, novosDados);
                return this;
            })
        };
        User.findByPk
            .mockResolvedValueOnce(target)
            .mockResolvedValueOnce(target);
        const req = makeReq({
            userId: 1,
            isAdmin: true,
            params: { id: '1' },
            body: { nome: 'Novo Nome', cpf: '52998224725', email: 'hacker@teste.com' }
        });
        const res = makeRes();
        await userCtrl.updateById(req, res);
        const jsonMock = res.json;
        const responseJson = jsonMock.mock.calls[0] && jsonMock.mock.calls[0][0];
        expect(responseJson?.user?.nome).toBe('Novo Nome');
        expect(responseJson?.user?.email).toBe('cliente@orig.com');
        expect(responseJson?.user?.cpf).toBe('52998224725');
    });
    it('Não permite updateById sem ser admin', async () => {
        const req = makeReq({ userId: 1, isAdmin: false, params: { id: '2' }, body: { nome: 'x' } });
        const res = makeRes();
        await userCtrl.updateById(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Apenas administradores podem editar usuários' });
    });
    it('Login com credenciais válidas retorna JWT e user', async () => {
        const hashed = await bcrypt.hash('SenhaSegura1', 10);
        User.findOne.mockResolvedValueOnce({
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
        const payload = res.json.mock.calls[0][0];
        expect(payload.token).toBeTypeOf('string');
        expect(payload.user.email).toBe('lucas@teste.com');
    });
    it('Login falha com usuário inexistente', async () => {
        User.findOne.mockResolvedValueOnce(null);
        const req = makeReq({ body: { email: 'nao@existe.com', senha: 'SenhaSegura1' } });
        const res = makeRes();
        await userCtrl.login(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
    });
});

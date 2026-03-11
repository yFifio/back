import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserController } from '../controllers/UserController';
import { User } from '../models/User';
// mock flexível do modelo
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
        // reset implementation and call history so each spec starts fresh
        vi.resetAllMocks();
    });
    it('Não deve permitir o cadastro de um e-mail inválido', async () => {
        const req = { body: { nome: 'Teste', email: 'invalido', senha: '12345678', cpf: '12345678901' } };
        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        await userCtrl.register(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Email inválido' });
    });
    it('Não deve permitir o cadastro de um CPF inválido', async () => {
        const req = { body: { nome: 'Teste', email: 'teste@ok.com', senha: '12345678', cpf: '111' } };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await userCtrl.register(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'CPF inválido' });
    });
    it('Falha registro quando email já está em uso', async () => {
        User.findOne.mockResolvedValueOnce({ id: 1 }); // simula email existente
        const req = { body: { nome: 'X', email: 'dup@teste.com', senha: 'SenhaSegura1', cpf: '52998224725' } }; // CPF válido
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await userCtrl.register(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Usuário já existe' });
    });
    it('Falha registro quando CPF já está em uso', async () => {
        // primeiro procura email, retorna null
        User.findOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 2 }); // cpf duplicado
        const req = { body: { nome: 'X', email: 'novo@teste.com', senha: 'SenhaSegura1', cpf: '52998224725' } }; // CPF válido, mas encarregado como duplicado
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await userCtrl.register(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'CPF já cadastrado' });
    });
    it('updateMe retorna o usuário atualizado e não altera email ou cpf', async () => {
        const fakeUser = {
            id: 1,
            nome: 'Lucas',
            email: 'lucas@original.com',
            cpf: '52998224725', // valid CPF example
            isAdmin: false,
            update: vi.fn().mockImplementation(function (novosDados) {
                Object.assign(this, novosDados);
                return this;
            })
        };
        User.findByPk.mockResolvedValueOnce(fakeUser).mockResolvedValueOnce(fakeUser);
        const req = {
            userId: 1,
            // cpf provided but same as existing to avoid validation error
            body: { nome: 'Nome Atualizado', email: 'hacker@tentativa.com', cpf: '52998224725' }
        };
        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        await userCtrl.updateMe(req, res);
        const jsonMock = res.json;
        const responseJson = jsonMock.mock.calls[0] && jsonMock.mock.calls[0][0];
        expect(responseJson?.user?.nome).toBe('Nome Atualizado');
        expect(responseJson?.user?.email).toBe('lucas@original.com');
        expect(responseJson?.user?.cpf).toBe('52998224725');
    });
    it('updateMe falha se tenta mudar cpf para existente', async () => {
        // Setup existing user and another with same cpf
        User.findByPk
            .mockResolvedValueOnce({ id: 1, cpf: '11122233344', update: vi.fn() })
            .mockResolvedValueOnce({ id: 1, cpf: '11122233344' });
        User.findOne.mockResolvedValueOnce({ id: 2 }); // someone else has this cpf
        const req = { userId: 1, body: { nome: 'Lucas', cpf: '52998224725' } }; // valid format but duplicates in DB
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await userCtrl.updateMe(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'CPF já cadastrado' });
    });
    it('Admin pode atualizar outros usuários, mas email e cpf não mudam', async () => {
        // admin auth check
        const adminObj = { id: 1, isAdmin: true };
        const target = {
            id: 2,
            nome: 'Cliente',
            email: 'cliente@orig.com',
            cpf: '99988877766',
            update: vi.fn().mockImplementation(function (novosDados) {
                Object.assign(this, novosDados);
                return this;
            })
        };
        // três chamadas: admin check, load target, reload target after update
        User.findByPk
            .mockResolvedValueOnce(adminObj)
            .mockResolvedValueOnce(target)
            .mockResolvedValueOnce(target);
        const req = { userId: 1, params: { id: '2' }, body: { nome: 'Novo Nome', email: 'hacker@teste.com' } };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await userCtrl.updateById(req, res);
        const jsonMock = res.json;
        const responseJson = jsonMock.mock.calls[0] && jsonMock.mock.calls[0][0];
        expect(responseJson?.user?.nome).toBe('Novo Nome');
        expect(responseJson?.user?.email).toBe('cliente@orig.com');
        expect(responseJson?.user?.cpf).toBe('99988877766');
    });
    it('Não permite que usuário não-admin use updateById', async () => {
        User.findByPk.mockResolvedValueOnce({ id: 1, isAdmin: false });
        const req = { userId: 1, params: { id: '2' }, body: { nome: 'x' } };
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
        await userCtrl.updateById(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado' });
    });
});

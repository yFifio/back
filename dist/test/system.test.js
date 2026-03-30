import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemController } from '../controllers/SystemController';
import { System } from '../models/System';
const makeReq = (data) => data;
const makeRes = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
});
vi.mock('../models/System', () => {
    const findAll = vi.fn();
    const create = vi.fn();
    const findByPk = vi.fn();
    const destroy = vi.fn();
    return { System: { findAll, create, findByPk, destroy } };
});
describe('SystemController', () => {
    const ctrl = new SystemController();
    beforeEach(() => vi.resetAllMocks());
    it('lista todos quando não informo type', async () => {
        System.findAll.mockResolvedValueOnce([{ id: 1, name: 'X', type: 'A' }]);
        const req = makeReq({ query: {} });
        const res = makeRes();
        await ctrl.list(req, res);
        expect(System.findAll).toHaveBeenCalledWith({ where: {} });
        expect(res.json).toHaveBeenCalledWith([{ id: 1, name: 'X', type: 'A' }]);
    });
    it('filtra por type quando fornecido', async () => {
        System.findAll.mockResolvedValueOnce([]);
        const req = makeReq({ query: { type: 'B' } });
        const res = makeRes();
        await ctrl.list(req, res);
        expect(System.findAll).toHaveBeenCalledWith({ where: { type: 'B' } });
    });
    it('retorna erro em exceção no list', async () => {
        System.findAll.mockRejectedValueOnce(new Error('boom'));
        const res = makeRes();
        await ctrl.list(makeReq({ query: {} }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao listar sistemas' });
    });
    it('cria novo sistema com dados válidos', async () => {
        System.create.mockResolvedValueOnce({ id: 10, name: 'Teste', type: 'C' });
        const req = makeReq({ body: { name: 'Teste', type: 'C' } });
        const res = makeRes();
        await ctrl.create(req, res);
        expect(System.create).toHaveBeenCalledWith({ name: 'Teste', type: 'C' });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: 10, name: 'Teste', type: 'C' });
    });
    it('recusa criação com dados invalidos', async () => {
        const res = makeRes();
        await ctrl.create(makeReq({ body: { name: '', type: 'X' } }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
    it('atualiza sistema existente', async () => {
        const sysObj = { id: 5, name: 'Old', save: vi.fn() };
        System.findByPk.mockResolvedValueOnce(sysObj).mockResolvedValueOnce(sysObj);
        const req = makeReq({ params: { id: '5' }, body: { name: 'Novo' } });
        const res = makeRes();
        await ctrl.update(req, res);
        expect(sysObj.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(sysObj);
    });
    it('retorna 404 se não encontrado para update', async () => {
        System.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { name: 'x' } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
    it('deleta sistema existente', async () => {
        System.destroy.mockResolvedValueOnce(1);
        const req = makeReq({ params: { id: '8' } });
        const res = makeRes();
        await ctrl.delete(req, res);
        expect(System.destroy).toHaveBeenCalledWith({ where: { id: '8' } });
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
    it('retorna 404 se não existe ao deletar', async () => {
        System.destroy.mockResolvedValueOnce(0);
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '9' } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

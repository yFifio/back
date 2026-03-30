import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CategoryController } from '../controllers/CategoryController';
import { Category } from '../models/Category';
import * as appState from '../utils/appState';
const makeReq = (data) => data;
const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
vi.mock('../models/Category', () => {
    const findAndCountAll = vi.fn();
    const findByPk = vi.fn();
    const create = vi.fn();
    return { Category: { findAndCountAll, findByPk, create } };
});
describe('CategoryController', () => {
    const ctrl = new CategoryController();
    beforeEach(() => {
        vi.resetAllMocks();
        appState.setDbConnected(true);
    });
    afterEach(() => {
        appState.setDbConnected(false);
    });
    // list
    it('retorna lista vazia quando db não conectado', async () => {
        appState.setDbConnected(false);
        const res = makeRes();
        await ctrl.list(makeReq({ query: {} }), res);
        expect(res.json).toHaveBeenCalledWith({ data: [], total: 0, limit: 10, offset: 0 });
    });
    it('list retorna categorias quando db conectado', async () => {
        Category.findAndCountAll.mockResolvedValueOnce({ count: 2, rows: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] });
        const res = makeRes();
        await ctrl.list(makeReq({ query: { limit: '2', offset: '0' } }), res);
        expect(res.json).toHaveBeenCalledWith({ data: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], total: 2, limit: 2, offset: 0 });
    });
    it('list retorna 500 em exceção', async () => {
        Category.findAndCountAll.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.list(makeReq({ query: {} }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro interno ao listar categorias' });
    });
    // getById
    it('getById retorna 503 quando db não conectado', async () => {
        appState.setDbConnected(false);
        const res = makeRes();
        await ctrl.getById(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(503);
    });
    it('getById retorna categoria existente', async () => {
        Category.findByPk.mockResolvedValueOnce({ id: 1, name: 'Livros' });
        const res = makeRes();
        await ctrl.getById(makeReq({ params: { id: '1' } }), res);
        expect(res.json).toHaveBeenCalledWith({ id: 1, name: 'Livros' });
    });
    it('getById retorna 404 quando não existe', async () => {
        Category.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.getById(makeReq({ params: { id: '99' } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Não encontrada' });
    });
    it('getById retorna 500 em exceção', async () => {
        Category.findByPk.mockRejectedValueOnce(new Error('db fail'));
        const res = makeRes();
        await ctrl.getById(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
    // create
    it('create retorna 400 quando nome faltando', async () => {
        const res = makeRes();
        await ctrl.create(makeReq({ body: {} }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Nome obrigatório' });
    });
    it('create retorna 503 quando db não conectado', async () => {
        appState.setDbConnected(false);
        const res = makeRes();
        await ctrl.create(makeReq({ body: { name: 'Test' } }), res);
        expect(res.status).toHaveBeenCalledWith(503);
    });
    it('create cria categoria com sucesso', async () => {
        Category.create.mockResolvedValueOnce({ id: 5, name: 'Nova' });
        const res = makeRes();
        await ctrl.create(makeReq({ body: { name: 'Nova' } }), res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: 5, name: 'Nova' });
    });
    it('create retorna 500 em exceção', async () => {
        Category.create.mockRejectedValueOnce(new Error('fail'));
        const res = makeRes();
        await ctrl.create(makeReq({ body: { name: 'X' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
    // update
    it('update retorna 503 quando db não conectado', async () => {
        appState.setDbConnected(false);
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { name: 'Y' } }), res);
        expect(res.status).toHaveBeenCalledWith(503);
    });
    it('update retorna 404 quando não encontrada', async () => {
        Category.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { name: 'Y' } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
    it('update atualiza categoria com sucesso', async () => {
        const cat = { id: 1, name: 'Old', update: vi.fn().mockResolvedValue({ id: 1, name: 'New' }) };
        Category.findByPk.mockResolvedValueOnce(cat);
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { name: 'New' } }), res);
        expect(cat.update).toHaveBeenCalledWith({ name: 'New' });
        expect(res.json).toHaveBeenCalled();
    });
    it('update retorna 500 em exceção', async () => {
        Category.findByPk.mockRejectedValueOnce(new Error('fail'));
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { name: 'X' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
    // delete
    it('delete retorna 503 quando db não conectado', async () => {
        appState.setDbConnected(false);
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(503);
    });
    it('delete retorna 404 quando não encontrada', async () => {
        Category.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
    it('delete exclui categoria com sucesso', async () => {
        const cat = { id: 1, name: 'X', destroy: vi.fn().mockResolvedValue(undefined) };
        Category.findByPk.mockResolvedValueOnce(cat);
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(cat.destroy).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ message: 'Deletada com sucesso' });
    });
    it('delete retorna 500 em exceção', async () => {
        Category.findByPk.mockRejectedValueOnce(new Error('fail'));
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

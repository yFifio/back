import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupplierController } from '../controllers/SupplierController';
import { Supplier } from '../models/Supplier';
vi.mock('../models/Supplier', () => {
    const findAndCountAll = vi.fn();
    const create = vi.fn();
    const findByPk = vi.fn();
    const destroy = vi.fn();
    return { Supplier: { findAndCountAll, create, findByPk, destroy } };
});
describe('SupplierController', () => {
    const ctrl = new SupplierController();
    beforeEach(() => vi.resetAllMocks());
    function makeRes() {
        return {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
    }
    it('lista fornecedores', async () => {
        Supplier.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [{ id: 1, name: 'X' }] });
        const res = makeRes();
        await ctrl.list({}, res);
        expect(Supplier.findAndCountAll).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ data: [{ id: 1, name: 'X' }], total: 1, limit: 10, offset: 0 });
    });
    it('cria fornecedor valido', async () => {
        Supplier.create.mockResolvedValueOnce({ id: 2, name: 'Y' });
        const res = makeRes();
        await ctrl.create({ body: { name: 'Y' } }, res);
        expect(Supplier.create).toHaveBeenCalledWith({ name: 'Y', email: undefined });
        expect(res.status).toHaveBeenCalledWith(201);
    });
    it('recusa criação sem nome', async () => {
        const res = makeRes();
        await ctrl.create({ body: { name: '' } }, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
    it('atualiza existente', async () => {
        const item = { id: 3, name: 'old', save: vi.fn() };
        Supplier.findByPk.mockResolvedValueOnce(item);
        const res = makeRes();
        await ctrl.update({ params: { id: '3' }, body: { name: 'new' } }, res);
        expect(item.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(item);
    });
    it('404 update se não existe', async () => {
        Supplier.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.update({ params: { id: '5' }, body: { name: 'a' } }, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
    it('deleta com sucesso', async () => {
        Supplier.destroy.mockResolvedValueOnce(1);
        const res = makeRes();
        await ctrl.delete({ params: { id: '7' } }, res);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
    it('404 delete se não existe', async () => {
        Supplier.destroy.mockResolvedValueOnce(0);
        const res = makeRes();
        await ctrl.delete({ params: { id: '8' } }, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

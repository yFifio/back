import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShippingMethodController } from '../controllers/ShippingMethodController';
import { ShippingMethod } from '../models/ShippingMethod';
vi.mock('../models/ShippingMethod', () => {
    const findAndCountAll = vi.fn();
    const create = vi.fn();
    const findByPk = vi.fn();
    const destroy = vi.fn();
    return { ShippingMethod: { findAndCountAll, create, findByPk, destroy } };
});
describe('ShippingMethodController', () => {
    const ctrl = new ShippingMethodController();
    beforeEach(() => vi.resetAllMocks());
    function makeRes() { return { status: vi.fn().mockReturnThis(), json: vi.fn() }; }
    it('lista metodos', async () => {
        ShippingMethod.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [{ id: 1, name: 'x', price: 0 }] });
        const res = makeRes();
        await ctrl.list({}, res);
        expect(ShippingMethod.findAndCountAll).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ data: [{ id: 1, name: 'x', price: 0 }], total: 1, limit: 10, offset: 0 });
    });
    it('cria valido', async () => {
        ShippingMethod.create.mockResolvedValueOnce({ id: 2, name: 'y', price: 10 });
        const res = makeRes();
        await ctrl.create({ body: { name: 'y', price: 10 } }, res);
        expect(ShippingMethod.create).toHaveBeenCalledWith({ name: 'y', price: 10 });
        expect(res.status).toHaveBeenCalledWith(201);
    });
    it('atualiza existente', async () => {
        const item = { id: 3, name: 'old', price: 5, save: vi.fn() };
        ShippingMethod.findByPk.mockResolvedValueOnce(item);
        const res = makeRes();
        await ctrl.update({ params: { id: '3' }, body: { name: 'new', price: 7 } }, res);
        expect(item.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(item);
    });
    it('delete 404 se nao', async () => {
        ShippingMethod.destroy.mockResolvedValueOnce(0);
        const res = makeRes();
        await ctrl.delete({ params: { id: '5' } }, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

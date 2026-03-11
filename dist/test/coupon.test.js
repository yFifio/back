import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CouponController } from '../controllers/CouponController';
import { Coupon } from '../models/Coupon';
vi.mock('../models/Coupon', () => {
    const findAndCountAll = vi.fn();
    const findOne = vi.fn();
    const create = vi.fn();
    const findByPk = vi.fn();
    const destroy = vi.fn();
    return { Coupon: { findAndCountAll, findOne, create, findByPk, destroy } };
});
describe('CouponController', () => {
    const ctrl = new CouponController();
    beforeEach(() => vi.resetAllMocks());
    function makeRes() { return { status: vi.fn().mockReturnThis(), json: vi.fn() }; }
    it('lista cupons', async () => {
        Coupon.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [{ id: 1, code: 'X', discount: 5 }] });
        const res = makeRes();
        await ctrl.list({}, res);
        expect(res.json).toHaveBeenCalledWith({ data: [{ id: 1, code: 'X', discount: 5 }], total: 1, limit: 10, offset: 0 });
    });
    it('cria cupom', async () => {
        Coupon.create.mockResolvedValueOnce({ id: 2, code: 'Y', discount: 10 });
        const res = makeRes();
        await ctrl.create({ body: { code: 'Y', discount: 10 } }, res);
        expect(res.status).toHaveBeenCalledWith(201);
    });
    it('atualiza existente', async () => {
        const item = { id: 3, code: 'old', discount: 1, save: vi.fn() };
        Coupon.findByPk.mockResolvedValueOnce(item);
        const res = makeRes();
        await ctrl.update({ params: { id: '3' }, body: { code: 'new', discount: 2 } }, res);
        expect(item.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(item);
    });
    it('delete nao encontrado', async () => {
        Coupon.destroy.mockResolvedValueOnce(0);
        const res = makeRes();
        await ctrl.delete({ params: { id: '4' } }, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

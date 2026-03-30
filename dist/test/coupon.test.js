import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CouponController } from '../controllers/CouponController';
import { Coupon } from '../models/Coupon';
const makeReq = (data) => data;
const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
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
    it('lista cupons', async () => {
        Coupon.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [{ id: 1, code: 'X', discount: 5 }] });
        const res = makeRes();
        await ctrl.list(makeReq({}), res);
        expect(res.json).toHaveBeenCalledWith({ data: [{ id: 1, code: 'X', discount: 5 }], total: 1, limit: 10, offset: 0 });
    });
    it('cria cupom', async () => {
        Coupon.create.mockResolvedValueOnce({ id: 2, code: 'Y', discount: 10 });
        const res = makeRes();
        await ctrl.create(makeReq({ body: { code: 'Y', discount: 10 } }), res);
        expect(res.status).toHaveBeenCalledWith(201);
    });
    it('atualiza existente', async () => {
        const item = { id: 3, code: 'old', discount: 1, save: vi.fn() };
        Coupon.findByPk.mockResolvedValueOnce(item);
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '3' }, body: { code: 'new', discount: 2 } }), res);
        expect(item.save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(item);
    });
    it('busca cupom por id', async () => {
        Coupon.findByPk.mockResolvedValueOnce({ id: 7, code: 'SAVE7', discount: 7 });
        const res = makeRes();
        await ctrl.getById(makeReq({ params: { id: '7' } }), res);
        expect(Coupon.findByPk).toHaveBeenCalledWith('7');
        expect(res.json).toHaveBeenCalledWith({ id: 7, code: 'SAVE7', discount: 7 });
    });
    it('retorna 404 no getById quando cupom não existe', async () => {
        Coupon.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.getById(makeReq({ params: { id: '404' } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
    it('delete nao encontrado', async () => {
        Coupon.destroy.mockResolvedValueOnce(0);
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '4' } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

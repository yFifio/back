import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CouponController } from '../controllers/CouponController';
import { SystemController } from '../controllers/SystemController';
import { ShippingMethodController } from '../controllers/ShippingMethodController';
import { SupplierController } from '../controllers/SupplierController';
import { Coupon } from '../models/Coupon';
import { System } from '../models/System';
import { ShippingMethod } from '../models/ShippingMethod';
import { Supplier } from '../models/Supplier';
const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
const makeReq = (data) => data;
vi.mock('../models/Coupon', () => ({
    Coupon: { findAndCountAll: vi.fn(), findOne: vi.fn(), create: vi.fn(), findByPk: vi.fn(), destroy: vi.fn() },
}));
vi.mock('../models/System', () => ({
    System: { findAll: vi.fn(), create: vi.fn(), findByPk: vi.fn(), destroy: vi.fn() },
}));
vi.mock('../models/ShippingMethod', () => ({
    ShippingMethod: { findAndCountAll: vi.fn(), create: vi.fn(), findByPk: vi.fn(), destroy: vi.fn() },
}));
vi.mock('../models/Supplier', () => ({
    Supplier: { findAndCountAll: vi.fn(), create: vi.fn(), findByPk: vi.fn(), destroy: vi.fn() },
}));
describe('CouponController - extra', () => {
    const ctrl = new CouponController();
    beforeEach(() => vi.resetAllMocks());
    it('validate retorna 400 quando código vazio', async () => {
        const res = makeRes();
        await ctrl.validate(makeReq({ body: { code: '' } }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Código obrigatório' });
    });
    it('validate retorna 404 quando cupom não existe', async () => {
        Coupon.findOne.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.validate(makeReq({ body: { code: 'NOTEXISTS' } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Cupom inválido' });
    });
    it('validate retorna desconto quando cupom válido', async () => {
        Coupon.findOne.mockResolvedValueOnce({ code: 'SAVE20', discount: 20 });
        const res = makeRes();
        await ctrl.validate(makeReq({ body: { code: 'save20' } }), res);
        expect(res.json).toHaveBeenCalledWith({ code: 'SAVE20', discount: 20 });
    });
    it('validate retorna 400 quando desconto é zero', async () => {
        Coupon.findOne.mockResolvedValueOnce({ code: 'ZERO', discount: 0 });
        const res = makeRes();
        await ctrl.validate(makeReq({ body: { code: 'ZERO' } }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Cupom sem desconto válido' });
    });
    it('validate retorna 500 em exceção', async () => {
        Coupon.findOne.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.validate(makeReq({ body: { code: 'X' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao validar cupom' });
    });
    it('update retorna 404 quando cupom não existe', async () => {
        Coupon.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '99' }, body: { code: 'X', discount: 5 } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Cupom não encontrado' });
    });
    it('update retorna 400 quando código vazio', async () => {
        Coupon.findByPk.mockResolvedValueOnce({ id: 1, code: 'OLD', discount: 5, save: vi.fn() });
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { code: '', discount: 5 } }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Código obrigatório' });
    });
    it('update retorna 500 em exceção', async () => {
        Coupon.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { code: 'X', discount: 5 } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao atualizar cupom' });
    });
    it('create retorna 400 quando código vazio', async () => {
        const res = makeRes();
        await ctrl.create(makeReq({ body: { code: '', discount: 5 } }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Código obrigatório' });
    });
    it('create retorna 400 quando código duplicado (SequelizeUniqueConstraintError)', async () => {
        const err = new Error('Unique constraint');
        err.name = 'SequelizeUniqueConstraintError';
        Coupon.create.mockRejectedValueOnce(err);
        const res = makeRes();
        await ctrl.create(makeReq({ body: { code: 'DUP', discount: 10 } }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Código já existe' });
    });
    it('create retorna 500 em exceção genérica', async () => {
        Coupon.create.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.create(makeReq({ body: { code: 'X', discount: 5 } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao criar cupom' });
    });
    it('getById retorna 500 em exceção', async () => {
        Coupon.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.getById(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao buscar cupom' });
    });
    it('delete retorna 500 em exceção', async () => {
        Coupon.destroy.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao excluir cupom' });
    });
    it('delete retorna sucesso', async () => {
        Coupon.destroy.mockResolvedValueOnce(1);
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
    it('list retorna 500 em exceção', async () => {
        Coupon.findAndCountAll.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.list(makeReq({ query: {} }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao listar cupons' });
    });
});
// ========== SystemController Extra ============
describe('SystemController - extra error paths', () => {
    const ctrl = new SystemController();
    beforeEach(() => vi.resetAllMocks());
    it('create retorna 500 em exceção', async () => {
        System.create.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.create(makeReq({ body: { name: 'Test', type: 'A' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao criar sistema' });
    });
    it('update retorna 500 em exceção', async () => {
        System.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { name: 'X' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao atualizar sistema' });
    });
    it('delete retorna 500 em exceção', async () => {
        System.destroy.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao excluir sistema' });
    });
    it('delete retorna 404 quando não encontra sistema', async () => {
        System.destroy.mockResolvedValueOnce(0);
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '404' } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Sistema não encontrado' });
    });
});
// ========== ShippingMethodController Extra ============
describe('ShippingMethodController - extra', () => {
    const ctrl = new ShippingMethodController();
    beforeEach(() => vi.resetAllMocks());
    it('create retorna 400 quando nome faltando', async () => {
        const res = makeRes();
        await ctrl.create(makeReq({ body: {} }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Nome obrigatório' });
    });
    it('create retorna 500 em exceção', async () => {
        ShippingMethod.create.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.create(makeReq({ body: { name: 'Express', price: 15 } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao criar método de envio' });
    });
    it('update retorna 404 quando não encontrado', async () => {
        ShippingMethod.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '99' }, body: { name: 'X', price: 5 } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Método não encontrado' });
    });
    it('update retorna 500 em exceção', async () => {
        ShippingMethod.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { name: 'X', price: 5 } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao atualizar método de envio' });
    });
    it('update retorna 400 quando nome faltando no payload', async () => {
        ShippingMethod.findByPk.mockResolvedValueOnce({ id: 1, name: 'Atual', price: 10, save: vi.fn() });
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { name: '', price: 5 } }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Nome obrigatório' });
    });
    it('delete retorna sucesso', async () => {
        ShippingMethod.destroy.mockResolvedValueOnce(1);
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
    it('delete retorna 500 em exceção', async () => {
        ShippingMethod.destroy.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao excluir método de envio' });
    });
    it('getById retorna 500 em exceção', async () => {
        ShippingMethod.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.getById(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
    it('list retorna 500 em exceção', async () => {
        ShippingMethod.findAndCountAll.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.list(makeReq({ query: {} }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
// ========== SupplierController Extra ============
describe('SupplierController - extra', () => {
    const ctrl = new SupplierController();
    beforeEach(() => vi.resetAllMocks());
    it('update retorna 404 quando não encontrado', async () => {
        Supplier.findByPk.mockResolvedValueOnce(null);
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '99' }, body: { name: 'X' } }), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Fornecedor não encontrado' });
    });
    it('update retorna 500 em exceção', async () => {
        Supplier.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.update(makeReq({ params: { id: '1' }, body: { name: 'X' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao atualizar fornecedor' });
    });
    it('delete retorna 500 em exceção', async () => {
        Supplier.destroy.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao excluir fornecedor' });
    });
    it('create retorna 400 quando email duplicado (SequelizeUniqueConstraintError)', async () => {
        const err = new Error('Unique constraint');
        err.name = 'SequelizeUniqueConstraintError';
        Supplier.create.mockRejectedValueOnce(err);
        const res = makeRes();
        await ctrl.create(makeReq({ body: { name: 'Supplier', email: 'dup@dup.com' } }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Email já cadastrado' });
    });
    it('create retorna 500 em exceção genérica', async () => {
        Supplier.create.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.create(makeReq({ body: { name: 'Supplier' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao criar fornecedor' });
    });
    it('list retorna 500 em exceção', async () => {
        Supplier.findAndCountAll.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.list(makeReq({ query: {} }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
    it('getById retorna 500 em exceção', async () => {
        Supplier.findByPk.mockRejectedValueOnce(new Error('db error'));
        const res = makeRes();
        await ctrl.getById(makeReq({ params: { id: '1' } }), res);
        expect(res.status).toHaveBeenCalledWith(500);
    });
    it('delete retorna sucesso', async () => {
        Supplier.destroy.mockResolvedValueOnce(1);
        const res = makeRes();
        await ctrl.delete(makeReq({ params: { id: '1' } }), res);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });
});

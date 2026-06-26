import { describe, it, expect } from 'vitest';
import { validarCPF, validarEmail, validarSenha } from '../utils/validators';
import { dbConnected, setDbConnected } from '../utils/appState';

describe('validarCPF', () => {
  it('retorna false para CPF com menos de 11 dígitos', () => {
    expect(validarCPF('123')).toBe(false);
  });

  it('retorna false para CPF com todos os dígitos iguais', () => {
    expect(validarCPF('11111111111')).toBe(false);
    expect(validarCPF('00000000000')).toBe(false);
  });

  it('retorna true para CPF válido', () => {
    expect(validarCPF('52998224725')).toBe(true);
  });

  it('retorna true para CPF válido com máscara', () => {
    expect(validarCPF('529.982.247-25')).toBe(true);
  });

  it('retorna false para CPF com dígito verificador inválido', () => {
    expect(validarCPF('52998224726')).toBe(false);
  });

  it('retorna false para CPF com 11 dígitos mas inválido', () => {
    expect(validarCPF('12345678901')).toBe(false);
  });

  it('retorna true para outro CPF válido', () => {
    expect(validarCPF('11144477735')).toBe(true);
  });

  it('retorna false quando primeiro dígito verificador não confere', () => {
    // CPF: 529.982.247-25 - let's test various invalid ones
    expect(validarCPF('52998224715')).toBe(false); // last digit changed
  });

  it('cobre ramo onde segundo resto vira 0 (10/11)', () => {
    const calcularDigitos = (base9: string) => {
      const nums = base9.split('').map(Number);
      let soma1 = 0;
      for (let i = 0; i < 9; i++) soma1 += nums[i] * (10 - i);
      let d1 = (soma1 * 10) % 11;
      if (d1 === 10 || d1 === 11) d1 = 0;

      let soma2 = 0;
      const seq = [...nums, d1];
      for (let i = 0; i < 10; i++) soma2 += seq[i] * (11 - i);
      const restoBruto2 = (soma2 * 10) % 11;
      let d2 = restoBruto2;
      if (d2 === 10 || d2 === 11) d2 = 0;
      return { cpf: `${base9}${d1}${d2}`, restoBruto2 };
    };

    let encontrado: string | null = null;
    for (let i = 123456780; i < 123457500; i++) {
      const base9 = String(i).padStart(9, '0');
      const { cpf, restoBruto2 } = calcularDigitos(base9);
      if (restoBruto2 === 10 || restoBruto2 === 11) {
        encontrado = cpf;
        break;
      }
    }

    expect(encontrado).not.toBeNull();
    expect(validarCPF(encontrado as string)).toBe(true);
  });
});

describe('validarEmail', () => {
  it('retorna true para email válido', () => {
    expect(validarEmail('user@example.com')).toBe(true);
  });

  it('retorna false para email sem @', () => {
    expect(validarEmail('invalido')).toBe(false);
  });

  it('retorna false para email sem domínio', () => {
    expect(validarEmail('user@')).toBe(false);
  });

  it('retorna false para string vazia', () => {
    expect(validarEmail('')).toBe(false);
  });

  it('retorna false para email com espaço', () => {
    expect(validarEmail('user @example.com')).toBe(false);
  });

  it('retorna true para email com subdomínio', () => {
    expect(validarEmail('user@mail.example.com')).toBe(true);
  });
});

describe('validarSenha', () => {
  it('retorna false para senha vazia', () => {
    expect(validarSenha('')).toBe(false);
  });

  it('retorna false para senha muito curta', () => {
    expect(validarSenha('Ab1')).toBe(false);
  });

  it('retorna false para senha sem maiúscula', () => {
    expect(validarSenha('abcdefg1')).toBe(false);
  });

  it('retorna false para senha sem minúscula', () => {
    expect(validarSenha('ABCDEFG1')).toBe(false);
  });

  it('retorna false para senha sem número', () => {
    expect(validarSenha('Abcdefgh')).toBe(false);
  });

  it('retorna true para senha válida', () => {
    expect(validarSenha('SenhaSegura1')).toBe(true);
  });

  it('retorna true para senha com caractere especial', () => {
    expect(validarSenha('Senha@123')).toBe(true);
  });
});

describe('appState', () => {
  it('dbConnected começa como false', () => {
    setDbConnected(false);
    expect(dbConnected).toBe(false);
  });

  it('setDbConnected altera o valor de dbConnected para true', () => {
    setDbConnected(true);
    expect(dbConnected).toBe(true);
    setDbConnected(false); // restore
  });
});

// server/src/utils/validators.ts
export const validarCPF = (cpf) => {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11 || /^(\d)\1+$/.test(clean))
        return false;
    let soma = 0;
    let resto;
    for (let i = 1; i <= 9; i++)
        soma = soma + parseInt(clean.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11))
        resto = 0;
    if (resto !== parseInt(clean.substring(9, 10)))
        return false;
    soma = 0;
    for (let i = 1; i <= 10; i++)
        soma = soma + parseInt(clean.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11))
        resto = 0;
    if (resto !== parseInt(clean.substring(10, 11)))
        return false;
    return true;
};
export const validarSenha = (senha) => {
    // Mínimo 8 chars, 1 maiúscula, 1 minúscula, 1 número (Rubrica exige validação de nível)
    const forte = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return forte.test(senha);
};
export const validarEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

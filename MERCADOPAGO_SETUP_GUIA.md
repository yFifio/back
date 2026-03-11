# 🎯 Guia Completo: Configurar Mercado Pago Real ou Teste

## ⚠️ Problema Atual
Os tokens no `.env` estão **inválidos ou expirados**:
- ❌ `TEST-5021775477117996-022419-...` (Backend)
- ❌ `TEST-0afb0cce-be7f-49f0-a8a4-...` (Frontend)

---

## 🚀 Opção 1: Usar Tokens de Teste VÁLIDOS (Recomendado)

### Passo 1: Criar Conta no Mercado Pago
1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Faça login ou crie uma conta gratuita

### Passo 2: Gerar Novos Tokens
1. No painel, vá para **Credenciais de Teste**
2. Copie os dois tokens:
   - **Access Token** (começa com TEST-)
   - **Public Key** (começa com TEST-)

### Passo 3: Atualizar Arquivos .env

**Arquivo: `/server/.env`**
```dotenv
MERCADOPAGO_ACCESS_TOKEN=SEU_ACCESS_TOKEN_AQUI
MERCADOPAGO_REFRESH_TOKEN=SEU_REFRESH_TOKEN_AQUI (opcional)
FRONT_URL=http://localhost:3000
```

**Arquivo: `/front/.env`**
```dotenv
VITE_MERCADOPAGO_PUBLIC_KEY=SUA_PUBLIC_KEY_AQUI
```

---

## 🧪 Opção 2: Mock/Teste SEM Token Real (Para Desenvolvimento)

Se você não tiver uma conta Mercado Pago ainda, pode usar este modo de teste simulado:

### Passo 1: Atualizar Backend para Modo Mock
Edit `/server/src/routes/api.routes.ts` (linha ~120):

```typescript
// Toggle: Modo de teste
const USE_MERCADOPAGO_MOCK = process.env.USE_MOCK === 'true'; // Mude para false quando tiver tokens reais

// DENTRO da route POST /orders:
if (USE_MERCADOPAGO_MOCK) {
  // Simula resposta do Mercado Pago
  return res.json({
    orderId: order.id,
    preference_id: `MOCK-${order.id}-${Date.now()}`,
    init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?preference-id=MOCK-${order.id}`,
  });
}
```

### Passo 2: Adicionar Flag no `.env`
```dotenv
USE_MOCK=true
```

---

## 🧠 Como Testar o Fluxo Completo

### Com Tokens Reais:
1. Vá para: `http://localhost:8081/checkout`
2. Preea dados do cliente
3. Clique em "Pagar"
4. Use cartão de teste: `4111 1111 1111 1111`
   - Data: `12/25`
   - CVV: `123`
5. Veja a confirmação em `order-success`

### Com Mock Mode:
1. Mesmo fluxo acima
2. Será simulado sem chamar API real do Mercado Pago
3. Perfeito para testes UI/UX

---

## 📋 Cartões de Teste do Mercado Pago

| Cenário | Número | Data | CVV |
|---------|--------|------|-----|
| ✅ Pagamento Aprovado | 4111 1111 1111 1111 | 12/25 | 123 |
| ⏳ Pagamento Pendente | 4514 4514 4514 4514 | 12/25 | 123 |
| ❌ Pagamento Recusado | 4000 0000 0000 0002 | 12/25 | 123 |

---

## 🔍 Validar Configuração

Depois de atualizar os tokens, execute este teste:

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Tester
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": 1, "productName": "Prod Teste", "price": 100, "quantity": 1}],
    "customerEmail": "test@test.com",
    "customerName": "Test User",
    "totalPrice": 100
  }' | jq .

# Resultado esperado:
{
  "orderId": 1,
  "preference_id": "68521234567890",    ← NOT NULL agora!
  "init_point": "https://www.mercadopago.com.br/..."
}
```

---

## 🚀 Endpoints para Teste

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/orders` | Criar pedido e preferência MP |
| GET | `/api/orders` | Listar pedidos |
| GET | `/api/orders/:id/payment-status` | Status do pagamento |
| GET | `/api/mercadopago/check` | Verifica se o token MP é válido (health-check) |
| POST | `/api/notifications/mercadopago` | Webhook do MP |

---

## ❓ Troubleshooting
#### Como executar o checkup
```bash
curl http://localhost:3001/api/mercadopago/check
```
Retorna `{ ok: true }` se o token estiver ok ou erro detalhado caso contrário.

### "Token inválido ou revogado"
- [ ] Verificar se copiou token com espaços
- [ ] Verificar validade do token (pede gerar novo)
- [ ] Tentar modo MOCK enquanto obtém token real

### "Wallet não aparece"
- [ ] Verificar `VITE_MERCADOPAGO_PUBLIC_KEY` no frontend
- [ ] Abrir console do navegador (F12) para erros
- [ ] Verificar CORS habilitado no backend

### "Webhook não funciona"
- [ ] Configurar URL pública (ngrok, vercel, etc.)
- [ ] Registrar URL no painel Mercado Pago
- [ ] Testar com: `curl -X POST http://localhost:3001/api/notifications/mercadopago ...`

---

## 📞 Suporte
- Docs Mercado Pago: https://www.mercadopago.com.br/developers/pt
- Status do servidor: `http://localhost:3001/api/welcome`
- Status do frontend: `http://localhost:8081/`

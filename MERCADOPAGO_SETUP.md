# Integração Avançada do Mercado Pago - Guia de Configuração

## 📋 Resumo das Melhorias

A integração do Mercado Pago foi evoluída com:

1. ✅ **Webhook completo** para sincronizar pagamentos em tempo real
2. ✅ **Polling automático** na página de sucesso (cliente)
3. ✅ **Tratamento robusto** de erros e exceções
4. ✅ **Auditoria** de transações com `PaymentWebhook`
5. ✅ **UI responsiva** com status em tempo real

---

## 🔧 Configuração do Backend

### 1. Modelos Criados

#### `PaymentWebhook` - Auditoria de Transações
```typescript
- id: numero único
- order_id: FK para Order
- mercado_pago_id: ID único do pagamento MP
- mercado_pago_status: 'approved', 'pending', 'rejected', 'cancelled'
- mercado_pago_status_detail: descrição adicional
- payer_email: email de quem pagou
- amount: valor da transação
- payment_method_id: cartão, Pix, boleto, etc.
- raw_data: JSON completo da resposta MP
- processed: flag booleana
```

### 2. Controller `PaymentNotificationController`

Responsável por:
- **`handleNotification()`**: Recebe webhook do MP
  - Valida a notificação
  - Busca detalhes completos do pagamento na API do MP
  - Processa e atualiza `Order` e `Payment`
  - Armazena histórico em `PaymentWebhook`
  
- **`getPaymentStatus()`**: Endpoint para consultar status
  - Retorna status atual da order
  - Inclui dados do webhook mais recente
  - Usado pelo front-end para polling

### 3. Rotas Adicionadas

```typescript
POST /api/notifications/mercadopago
  └─ Recebe notificações do Mercado Pago

GET /api/orders/:id/payment-status
  └─ Consulta status do pagamento e sincroniza com webhook
```

---

## 🎨 Melhorias do Frontend

### `Checkout.tsx`
- ✅ Inicialização segura do SDK (verifica se chave existe)
- ✅ Armazena `orderId` durante criação da preferência
- ✅ Exibição de erro na UI caso haja falha ao criar preferência
- ✅ Wallet do MP renderizado condicionalmente
- ✅ Feedback visual melhorado (botão muda para "Aguarde...")

### `OrderSuccess.tsx`
- ✅ **Polling automático** a cada 3 segundos (durante 30 segundos)
- ✅ Display de **status do pagamento** em tempo real
- ✅ **Ícone e cor** dinâmicos baseados no status
- ✅ Detalhes do pagamento (email, ID, valor)
- ✅ Botão **"Atualizar Status"** manual
- ✅ Auto-marca como pago se webhook aprovar

---

## 🔑 Variáveis de Ambiente

### Servidor (`.env`)
```dotenv
MERCADOPAGO_ACCESS_TOKEN=seu_access_token_aqui
FRONT_URL=http://localhost:3000
```

### Frontend (`.env`)
```dotenv
VITE_MERCADOPAGO_PUBLIC_KEY=sua_chave_publica_aqui
```

---

## 🚀 Como Configurar o Webhook no Mercado Pago

1. **Acesse o Painel do Mercado Pago**:
   - https://www.mercadopago.com.br/developers/panel

2. **Vá para "Notificações"** (IPN/Webhooks)

3. **Adicione uma URL de Notificação**:
   ```
   https://seu-dominio.com/api/notifications/mercadopago
   ```

4. **Selecione os eventos**:
   - `payment` (recomendado)
   - `merchant_order` (opcional)

5. **Teste a configuração**:
   ```bash
   curl -X POST http://localhost:3001/api/notifications/mercadopago \
     -H "Content-Type: application/json" \
     -d '{"topic":"payment","id":123456,"resource":{id":123456}}'
   ```

---

## 📊 Fluxo de Pagamento Completo

```
┌──────────────────┐
│   Usuário clica  │
│  "Pagar"         │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│ POST /orders             │
│ ├─ Cria Order            │
│ ├─ Cria OrderItems       │
│ └─ Gera preferência MP   │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│   Retorna                │
│ preference_id +          │
│ init_point               │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Renderiza Wallet MP      │
│ (ou redireciona)         │
└────────┬─────────────────┘
         │
         ▼ (usuário aprova)
┌──────────────────────────┐
│ Mercado Pago             │
│ processa pagamento       │
└────────┬─────────────────┘
         │
         ├──────────┬──────────┐
         │          │          │
         ▼          ▼          ▼
      aprovado  pendente  recusado
         │          │          │
         └────┬─────┴─────┬────┘
              │           │
              ▼           ▼
         Redireciona para /order-success
              │
              ▼
    ┌─────────────────────────┐
    │ Frontend inicia polling  │
    │ /orders/:id/payment-status
    └────────────┬────────────┘
                 │
    ┌────────────┴──────────────┐
    │ A cada 3 segundos (30s)   │
    │ Webhook recebido?         │
    └────────────┬──────────────┘
                 │
                 ▼
    ┌─────────────────────────┐
    │ Atualizar UI com status │
    │ Se approved → "Pago ✅" │
    └─────────────────────────┘
```

---

## 🧪 Testes de Integração

### Teste 1: Criar Pedido
```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "productId": 1,
      "productName": "Produto Teste",
      "price": 99.90,
      "quantity": 1
    }],
    "customerEmail": "teste@example.com",
    "customerName": "Teste User",
    "customerId": null,
    "totalPrice": 99.90
  }'
```

### Teste 2: Simular Webhook
```bash
curl -X POST http://localhost:3001/api/notifications/mercadopago \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "payment",
    "id": 123456789,
    "resource": {"id": 123456789}
  }'
```

### Teste 3: Consultar Status
```bash
curl http://localhost:3001/api/orders/1/payment-status
```

---

## 🔐 Segurança

- ✅ **Webhook sempre retorna 200** (evita retry infinito)
- ✅ **Validação de idempotência** (evita duplicação)
- ✅ **Raw data armazenado** para auditoria
- ✅ **Logs detalhados** com `[WebhookMP]` prefix
- ✅ **Nunca expõe token** de acesso no frontend

---

## 📈 Próximas Evoluções (Opcional)

1. **Assinatura (Subscriptions)**
   - Renovar pedidos automaticamente
   - Gerenciar planos

2. **Reembolsos (Refunds)**
   - Endpoint para reverter pagamento
   - Atualizar status de Order para `refunded`

3. **Relatórios**
   - Download de transações
   - Dashboard de vendas

4. **Retry de Webhook**
   - Implementar fila (Bull, RabbitMQ)
   - Reprocessar webhooks falhados

5. **Validação de Assinatura**
   - Validar `X-Signature` do MP
   - Confirmar autenticidade da notificação

---

## 🆘 Troubleshooting

### Webhook não chega
- [ ] Verifique se a URL está acessível (não localhost)
- [ ] Confirme firewall/NAT
- [ ] Teste com `ngrok` em desenvolvimento

### Pedido não atualiza após pagamento
- [ ] Verifique logs do servidor: `[WebhookMP]`
- [ ] Confirme que `MERCADOPAGO_ACCESS_TOKEN` está configurado
- [ ] Teste manualmente: `GET /orders/:id/payment-status`

### Wallet não renderiza
- [ ] Verifique `VITE_MERCADOPAGO_PUBLIC_KEY` no frontend
- [ ] Abra console (F12) e procure erros de SDK
- [ ] Confirme que o `preference_id` foi retornado

---

## 📞 Referências

- [API do Mercado Pago](https://www.mercadopago.com.br/developers/pt/reference)
- [IPN/Webhook Guide](https://www.mercadopago.com.br/developers/pt/guides/notifications/ipn)
- [SDK React](https://github.com/mercadopago/sdk-react)


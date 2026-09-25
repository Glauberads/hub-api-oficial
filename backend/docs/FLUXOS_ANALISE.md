# Análise do Sistema de Fluxos - Primeiro Contato vs Contatos Existentes

## Visão Geral

O sistema implementa dois tipos de fluxos automáticos baseados no status do contato:

1. **Fluxo de Boas-vindas (flowIdWelcome)** - Para contatos existentes
2. **Fluxo de Primeiro Contato (flowIdNotPhrase)** - Para novos contatos

## Estrutura do Banco de Dados

### Tabela `Whatsapps`
```sql
-- Colunas relacionadas aos fluxos
flowIdWelcome     INTEGER  -- Fluxo para contatos existentes
flowIdNotPhrase   INTEGER  -- Fluxo para novos contatos
flowIdInactiveTime INTEGER -- Fluxo para tempo inativo
```

### Tabela `FlowDefaults`
```sql
-- Configurações padrão por empresa
companyId         INTEGER
flowIdWelcome     INTEGER
flowIdNotPhrase   INTEGER
flowIdInactiveTime INTEGER
```

## Lógica de Detecção

### 1. Contagem de Mensagens
```typescript
// Conta apenas mensagens do cliente (fromMe: false)
const messageCount = await Message.count({
  where: {
    ticketId: ticket.id,
    fromMe: false
  }
});
```

### 2. Verificação de Primeiro Contato
```typescript
// Condições para fluxo de primeiro contato:
if (
  !hasAnyPhraseMatch(listPhrase, body, whatsapp.id) &&  // Sem match de campanha
  whatsapp.flowIdNotPhrase &&                           // Fluxo configurado
  messageCount === 1                                     // Primeira mensagem
) {
  // Executa flowIdNotPhrase
}
```

### 3. Verificação de Contato Existente
```typescript
// Para Facebook (lógica similar no WhatsApp):
if (!isFirstMsg) {  // Se já existe ticket anterior
  // Executa flowIdWelcome
}
```

## Fluxo de Execução

### Cenário 1: Novo Contato
1. **Contato envia primeira mensagem**
2. **Sistema verifica**: `messageCount === 1`
3. **Sistema verifica**: Não há match com campanhas
4. **Sistema executa**: `flowIdNotPhrase`
5. **Log**: `[FIRST CONTACT] 🚀 Iniciando flowIdNotPhrase`

### Cenário 2: Contato Existente
1. **Contato envia mensagem**
2. **Sistema verifica**: `messageCount > 1` OU `isFirstMsg` existe
3. **Sistema executa**: `flowIdWelcome`
4. **Log**: Execução do fluxo de boas-vindas

## Configuração no Frontend

### Modal de Conexão (`WhatsAppModal`)
```javascript
// Estados para configuração
const [flowIdNotPhrase, setFlowIdNotPhrase] = useState();
const [flowIdWelcome, setFlowIdWelcome] = useState();
const [flowIdInactiveTime, setFlowIdInactiveTime] = useState();

// Busca fluxos disponíveis
useEffect(() => {
  api.get("/flowbuilder").then(res => {
    setWebhooks(res.data.flows);
  });
}, []);
```

### Página de Fluxos Padrão (`FlowDefault`)
```javascript
// Configuração global por empresa
const [flowSelectedWelcome, setFlowSelectedWelcome] = useState(null);
const [flowSelectedPhrase, setFlowSelectedPhrase] = useState(null);
const [flowSelectedInactiveTime, setFlowSelectedInactiveTime] = useState(null);
```

## Diferenças entre os Fluxos

| Aspecto | flowIdWelcome | flowIdNotPhrase |
|---------|---------------|-----------------|
| **Quando executa** | Contatos existentes | Primeira mensagem |
| **Condição** | `!isFirstMsg` | `messageCount === 1` |
| **Prioridade** | Baixa (após campanhas) | Alta (primeira interação) |
| **Uso típico** | Reengajamento | Onboarding |
| **Configuração** | Por conexão | Por conexão |

## Logs de Debug

### Primeiro Contato
```
[FIRST CONTACT] 🚀 Iniciando flowIdNotPhrase (123) - PRIMEIRA mensagem sem match de campanha
[FIRST CONTACT] ✅ Fluxo flowIdNotPhrase executado com sucesso na primeira mensagem!
```

### Contato Existente
```
[FLOW INTEGRATION] Executando fluxo de boas-vindas para contato existente
```

### Pulando Execução
```
[FIRST CONTACT] ℹ️ Pulando flowIdNotPhrase - NÃO é primeira mensagem (count: 3)
```

## Considerações Técnicas

### 1. Verificação de Campanhas
- Antes de executar qualquer fluxo, o sistema verifica se há campanhas ativas
- Se houver match com campanha, os fluxos automáticos são ignorados

### 2. Mutex para Thread Safety
```typescript
const mutex = new Mutex();
const ticket = await mutex.runExclusive(async () => {
  return await FindOrCreateTicketService(...);
});
```

### 3. Estado do Ticket
```typescript
// Controle de execução de fluxos
if (ticket.flowWebhook && ticket.lastFlowId) {
  // Já está executando um fluxo
  return false;
}
```

## Configuração Recomendada

### Para Primeiro Contato (flowIdNotPhrase)
- **Objetivo**: Onboarding de novos usuários
- **Conteúdo**: Apresentação da empresa, opções de menu
- **Duração**: Curto e direto

### Para Contatos Existentes (flowIdWelcome)
- **Objetivo**: Reengajamento e suporte
- **Conteúdo**: Opções de suporte, FAQ, transferência para atendente
- **Duração**: Mais detalhado

## Troubleshooting

### Problema: Fluxo não executa
1. Verificar se `flowIdNotPhrase` ou `flowIdWelcome` estão configurados
2. Verificar se `messageCount` está sendo calculado corretamente
3. Verificar se há campanhas ativas fazendo match

### Problema: Fluxo executa múltiplas vezes
1. Verificar controle de `flowWebhook` e `lastFlowId`
2. Verificar se mutex está funcionando corretamente

### Problema: Fluxo errado sendo executado
1. Verificar lógica de detecção de primeiro contato
2. Verificar configuração de `isFirstMsg`

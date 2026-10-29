# CaloteOff — Controle de Vendas Fiadas e Cobrança Ativa

O **CaloteOff** é um aplicativo móvel *offline-first* desenvolvido em React Native e Expo com SQLite local, criado para substituir cadernos de papel e anotações informais de microcomerciantes, feirantes, revendedores e comércios de bairro.

---

## 1. Princípios do Produto & A "Regra das Duas Caras"

- **Dentro do App (Visão do Lojista):** Linguagem 100% popular, direta e sem termos contábeis engessados:
  - *"Pendurar"* (Novo fiado / débito).
  - *"Passar a régua"* (Baixa total ou amortização parcial).
  - *"Abater"* (Pagamento parcial).
  - *"Cobrar no Zap"* (Disparo direto de cobrança amigável ou vencida).
  - *"Tá devendo"* / *"Tá em dia"* / *"Tá com crédito"*.
- **Fora do App (Mensagens, Recibos e PDFs ao Cliente Final):** Comunicação 100% polida, educada e profissional:
  - O nome "CaloteOff" **nunca** alcança o cliente.
  - A identidade visual, logotipo, cores e chaves Pix da loja credora assumem o protagonismo (*White Label*).

---

## 2. Modelo de Acesso e Monetização (Freemium)

| Nível | Recursos Disponíveis | Preço | Gatilho |
| :--- | :--- | :--- | :--- |
| **Gratuito** | Até 5 clientes ativos com saldo devedor; lançamentos e baixas ilimitados; mensagens em texto no WhatsApp. | R$ 0 | Degustação imediata. |
| **Pro Mensal** | Clientes ilimitados; extratos e comprovantes em PDF White Label; modo privacidade avançado; backup em nuvem; todos os temas premium. | R$ 24,90 / mês | Disparado ao tentar cadastrar o 6º cliente ativo. |
| **Pro Anual** | Todos os benefícios do Pro com 40% de desconto. | R$ 179,00 / ano | Destaque prioritário de maior valor. |

---

## 3. Arquitetura e Invariantes Contábeis

1. **Equação Contínua de Saldo:**
   $$\text{Saldo} = \sum(\text{Débitos Pendentes}) - \text{Saldo Credor}$$
   - **Saldo Devedor (Vermelho):** $\text{Saldo} > 0$.
   - **Saldo Zerado (Verde/Cinza):** $\text{Saldo} = 0$.
   - **Saldo Credor / A Favor (Azul):** $\text{Saldo} < 0$. Novos fiados abatem automaticamente desse crédito antes de negativarem.
2. **Snapshot Imutável em Liquidações ("Passar a Régua"):**
   - Cada baixa registra `saldo_anterior`, `valor_liquidado`, `saldo_posterior`, `data_hora_registro` na tabela `payments`.
   - Permite reenviar recibos idênticos ao momento exato do acerto.
3. **Limite de Fiado e Políticas de Estouro:**
   - `AVISAR_E_PERMITIR`: Alerta sobre o estouro da cota, mas permite salvar se confirmado.
   - `BLOQUEAR_TOTAL`: Desabilita novas compras fiadas que ultrapassem o teto estipulado.
4. **Modo Privacidade:**
   - Mascaramento inteligente no balcão (ex: `Bru***************aes`) ou ocultação total (`••••••••••`), acionável com 1 toque no ícone de olho.
5. **Segurança por Biometria:**
   - Bloqueio nativo por impressão digital ou PIN/desenho (`expo-local-authentication`).

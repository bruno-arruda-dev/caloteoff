# Regras de Negócio e Arquitetura — CaloteOff

## 1. Visão Geral do Sistema
O **CaloteOff** é uma solução móvel *offline-first* para registro de crédito rotativo de clientes e cobrança ativa via WhatsApp. O sistema opera 100% no dispositivo do usuário através do SQLite (`expo-sqlite`).

## 2. Modelagem Contábil e Regras de Saldo
* **Débitos Pendentes (`entries`):**
  - Cada entrada possui `amount`, `due_date`, `description`, `receipt_image_uri` e `status` ('pending' ou 'paid').
* **Saldo Atual:**
  - $\text{Saldo} = \sum(\text{entries WHERE status = 'pending'}) - \text{clients.credit_balance}$.
* **Liquidação ("Passar a Régua"):**
  - Quando o usuário confirma um pagamento de valor $P$:
    - **Caso 1 ($P = \text{Saldo}$):** Todos os débitos são marcados como quitados (`status = 'paid'`, `paid_at = now`) e `credit_balance = 0`.
    - **Caso 2 ($P < \text{Saldo}$):** O valor é amortizado a partir dos débitos pendentes mais antigos. Se o valor restante cobrir parcialmente uma compra, o montante daquela compra é reduzido para a diferença e seu status permanece pendente.
    - **Caso 3 ($P > \text{Saldo}$):** Todas as compras pendentes são quitadas e a diferença $(P - \text{Saldo})$ é creditada em `clients.credit_balance` como saldo a favor para consumo futuro.
  - Gravação de snapshot imutável em `payments` com `previous_balance`, `amount_paid`, `resulting_balance`, `payment_type`.

## 3. Limite de Fiado e Políticas de Estouro
* Se `credit_limit` estiver preenchido:
  - $\text{Consumo} = \text{current_balance} + \text{novo\_debito}$.
  - Indicador circular:
    - Verde: $0\% \le \text{Consumo} < 80\%$
    - Amarelo: $80\% \le \text{Consumo} < 100\%$
    - Vermelho: $\ge 100\%$ (estouro)
  - Política `BLOQUEAR_TOTAL`: Bloqueia o salvamento e impede o avanço da dívida.
  - Política `AVISAR_E_PERMITIR`: Emite alerta explícito do montante excedido, permitindo ao lojista confirmar se desejar assumir o risco.

## 4. White Label e Comunicação
* Todo envio para o cliente (WhatsApp e PDF) consulta `business_profile` e `pix_keys`.
* O nome "CaloteOff" é estritamente de uso interno do comerciante.

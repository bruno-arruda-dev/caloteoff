import * as Crypto from 'expo-crypto';
import { PaymentRecord, PaymentType } from '../types';
import { calculateSettlement } from '../utils/balanceCalculator';
import { getClientById, updateClient } from './clientRepository';
import { getClientDebits } from './entryRepository';
import { getDatabase } from './schema';

export async function processPayment(
  clientId: string,
  amountPaid: number,
  notes: string = ''
): Promise<PaymentRecord> {
  const db = await getDatabase();
  const client = await getClientById(clientId);
  if (!client) throw new Error('Cliente não encontrado');

  const previousBalance = client.current_balance;
  const settlement = calculateSettlement(previousBalance, amountPaid);
  const now = new Date().toISOString();
  const paymentId = `pay-${Crypto.randomUUID()}`;

  const pendingDebits = await getClientDebits(clientId, 'pending');
  // Ordena do mais antigo para o mais recente para abater
  pendingDebits.sort((a, b) => a.due_date.localeCompare(b.due_date));

  if (settlement.paymentType === 'FULL' || settlement.paymentType === 'EXCESS') {
    // Quita todos os débitos pendentes
    await db.runAsync(
      `UPDATE entries SET status = 'paid', paid_at = ?, updated_at = ? WHERE client_id = ? AND status = 'pending'`,
      [now, now, clientId]
    );

    // Atualiza saldo credor no cliente
    await updateClient(clientId, {
      credit_balance: settlement.newCreditBalance,
    });
  } else {
    // Abatimento parcial: amortiza sequencialmente dos débitos mais antigos
    let remainingPaid = amountPaid;

    for (const debit of pendingDebits) {
      if (remainingPaid <= 0) break;

      if (remainingPaid >= debit.amount) {
        // Quita este débito por inteiro
        await db.runAsync(
          `UPDATE entries SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?`,
          [now, now, debit.id]
        );
        remainingPaid = Math.round((remainingPaid - debit.amount) * 100) / 100;
      } else {
        // Abate parcialmente este débito: reduz seu valor para a diferença restante
        const newDebitAmount = Math.round((debit.amount - remainingPaid) * 100) / 100;
        await db.runAsync(
          `UPDATE entries SET amount = ?, updated_at = ? WHERE id = ?`,
          [newDebitAmount, now, debit.id]
        );
        remainingPaid = 0;
      }
    }

    await updateClient(clientId, {
      credit_balance: 0,
    });
  }

  // Grava o Snapshot Imutável na tabela payments
  await db.runAsync(
    `INSERT INTO payments (
      id, client_id, amount_paid, previous_balance, resulting_balance,
      payment_type, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      paymentId,
      clientId,
      amountPaid,
      previousBalance,
      settlement.resultingBalance,
      settlement.paymentType,
      notes,
      now,
    ]
  );

  return {
    id: paymentId,
    client_id: clientId,
    amount_paid: amountPaid,
    previous_balance: previousBalance,
    resulting_balance: settlement.resultingBalance,
    payment_type: settlement.paymentType,
    notes,
    created_at: now,
  };
}

export async function getClientPayments(clientId: string): Promise<PaymentRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM payments WHERE client_id = ? ORDER BY created_at DESC',
    [clientId]
  );

  return rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    amount_paid: Number(r.amount_paid),
    previous_balance: Number(r.previous_balance),
    resulting_balance: Number(r.resulting_balance),
    payment_type: r.payment_type as PaymentType,
    notes: r.notes || '',
    created_at: r.created_at,
  }));
}

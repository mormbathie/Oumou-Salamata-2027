import { t } from '../i18n';
import { printFinancialDocument } from './financialPrint';
type ReceiptRecord = {
  payment: {
    cancelledAt?: string | null;
    paymentNumber: string;
    paymentDate: string | Date;
    amount: number;
    paymentMethod: string;
    reference?: string | null;
    receivedBy?: string | null;
    receivedByRole?: string | null;
  };
  invoice: {
    cancelledAt?: string | null;
    academicYear?: { name?: string };
    academicYearId?: string;
    invoiceNumber: string;
    title: string;
    amount: number;
    paidAmount: number;
    balance: number;
    status: string;
    student?: {
      firstName?: string;
      lastName?: string;
      matricule?: string;
      parent?: { firstName?: string; lastName?: string; phone?: string } | null;
      enrollments?: Array<{ academicYearId?: string; classroom?: { name?: string } }>;
    };
  };
};

export const printPaymentReceipt = (receipt: ReceiptRecord) => {
  if (receipt.payment.cancelledAt || receipt.invoice.cancelledAt) { window.alert(t('Cette écriture est annulée. Elle ne peut plus servir de justificatif de paiement.')); return; }
  printFinancialDocument(receipt.invoice, receipt.payment);
};

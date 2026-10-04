type ReceiptRecord = {
  payment: {
    paymentNumber: string;
    paymentDate: string | Date;
    amount: number;
    paymentMethod: string;
    reference?: string | null;
    receivedBy?: string | null;
    receivedByRole?: string | null;
  };
  invoice: {
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
      parent?: { firstName?: string; lastName?: string } | null;
      enrollments?: Array<{ classroom?: { name?: string } }>;
    };
  };
};

const escapeHtml = (value: unknown) => {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
};

const money = (value: number) =>
  new Intl.NumberFormat('fr-FR').format(Number(value) || 0) + ' FCFA';

export const printPaymentReceipt = (receipt: ReceiptRecord) => {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    window.alert('Autorisez les fenêtres contextuelles pour imprimer le reçu.');
    return;
  }
  printWindow.opener = null;

  const { payment, invoice } = receipt;
  const student = invoice.student || {};
  const parent = student.parent || {};
  const studentName = (student.firstName || '') + ' ' + (student.lastName || '');
  const parentName = ((parent.firstName || '') + ' ' + (parent.lastName || '')).trim();
  const classroom = student.enrollments?.[0]?.classroom?.name || '—';
  const date = new Date(payment.paymentDate).toLocaleDateString('fr-FR');
  const paymentMethods: Record<string, string> = {
    CASH: 'Espèces',
    WAVE: 'Wave',
    ORANGE_MONEY: 'Orange Money',
    BANK_TRANSFER: 'Virement bancaire',
    CHECK: 'Chèque',
  };
  const statuses: Record<string, string> = {
    PAID: 'Payée',
    PARTIAL: 'Partiellement payée',
    UNPAID: 'Impayée',
    OVERDUE: 'En retard',
  };

  const content = [
    '<!doctype html><html lang="fr"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Reçu ', escapeHtml(payment.paymentNumber), '</title>',
    '<style>',
    '@page{size:A4;margin:18mm}*{box-sizing:border-box}',
    'body{margin:0;color:#172033;font:14px/1.5 Arial,Helvetica,sans-serif}',
    'main{max-width:760px;margin:0 auto}',
    'header{text-align:center;padding:0 0 22px;border-bottom:2px dashed #cbd5e1}',
    '.mark{width:48px;height:48px;display:inline-grid;place-items:center;margin-bottom:8px;border-radius:12px;background:#059669;color:#fff;font-size:22px;font-weight:700}',
    'h1{margin:0;font-size:21px;letter-spacing:.04em;text-transform:uppercase}',
    'header p{margin:3px 0;color:#64748b;font-size:12px}',
    '.badge{display:inline-block;margin-top:12px;padding:5px 14px;border:1px solid #a7f3d0;border-radius:6px;background:#ecfdf5;color:#047857;font-size:11px;font-weight:700;letter-spacing:.08em}',
    '.meta{display:flex;justify-content:space-between;gap:20px;margin:22px 0}',
    '.label{display:block;margin-bottom:3px;color:#64748b;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}',
    '.value{font-weight:700}.mono{font-family:Consolas,"Courier New",monospace}',
    '.details{padding:14px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc}',
    '.row{display:flex;justify-content:space-between;gap:22px;padding:7px 0;border-bottom:1px solid #e2e8f0}',
    '.row:last-child{border-bottom:0}.row span:first-child{color:#475569}.row span:last-child{text-align:right;font-weight:600}',
    '.amount{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding:17px;border-radius:8px;background:#059669;color:#fff}',
    '.amount strong{font-size:22px}.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}',
    '.total{padding:10px;border:1px solid #e2e8f0;border-radius:6px}',
    '.signatures{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:48px;text-align:center}',
    '.signature{min-height:85px;border-top:1px dashed #94a3b8;padding-top:8px;color:#64748b;font-size:11px}',
    'footer{margin-top:26px;color:#64748b;text-align:center;font-size:10px}',
    '@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}',
    '</style></head><body><main>',
    '<header><div class="mark">AS</div><h1>École As Sakina</h1>',
    '<p>Enseignement élémentaire · Dakar, Sénégal</p>',
    '<p>Tél. +221 33 800 00 00</p>',
    '<div class="badge">REÇU DE CAISSE SCOLAIRE</div></header>',
    '<section class="meta"><div><span class="label">Numéro du reçu</span><span class="value mono">',
    escapeHtml(payment.paymentNumber), '</span></div><div style="text-align:right">',
    '<span class="label">Date du paiement</span><span class="value">', escapeHtml(date),
    '</span></div></section>',
    '<section class="details">',
    '<div class="row"><span>Élève</span><span>', escapeHtml(studentName.trim()), '</span></div>',
    '<div class="row"><span>Matricule</span><span class="mono">', escapeHtml(student.matricule), '</span></div>',
    '<div class="row"><span>Classe</span><span>', escapeHtml(classroom), '</span></div>',
    '<div class="row"><span>Parent / payeur</span><span>', escapeHtml(parentName || 'Non renseigné'), '</span></div>',
    '<div class="row"><span>Facture</span><span class="mono">', escapeHtml(invoice.invoiceNumber), '</span></div>',
    '<div class="row"><span>Motif</span><span>', escapeHtml(invoice.title), '</span></div>',
    '<div class="row"><span>Mode de paiement</span><span>',
    escapeHtml(paymentMethods[payment.paymentMethod] || payment.paymentMethod),
    payment.reference ? ' · Réf. ' + escapeHtml(payment.reference) : '', '</span></div></section>',
    '<p><span class="label">Paiement enregistré par</span><strong>', escapeHtml(payment.receivedBy || 'Non renseigné'),
    payment.receivedByRole ? ' · ' + escapeHtml(payment.receivedByRole) : '', '</strong></p>',
    '<section class="amount"><span>Montant encaissé</span><strong>', money(payment.amount), '</strong></section>',
    '<section class="totals"><div class="total"><span class="label">Montant facture</span><strong>',
    money(invoice.amount), '</strong></div><div class="total"><span class="label">Total payé</span><strong>',
    money(invoice.paidAmount), '</strong></div><div class="total"><span class="label">Reste à payer</span><strong>',
    money(invoice.balance), '</strong></div></section>',
    '<p><span class="label">Statut de la facture</span><strong>',
    escapeHtml(statuses[invoice.status] || invoice.status), '</strong></p>',
    '<section class="signatures"><div class="signature">Signature du parent / payeur</div>',
    '<div class="signature">Cachet et signature de la caisse</div></section>',
    '<footer>Merci de conserver ce reçu comme preuve de paiement.</footer>',
    '</main><script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},250)});</script>',
    '</body></html>',
  ].join('');

  printWindow.document.open();
  printWindow.document.write(content);
  printWindow.document.close();
};

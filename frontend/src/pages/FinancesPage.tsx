import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Plus,
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Receipt,
  Layers,
  X,
  Building,
  School,
  Sparkles
} from 'lucide-react';
import { financesApi, classesApi, studentsApi } from '../services/api';
import { printPaymentReceipt } from '../utils/receipt';

export const FinancesPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentReceiptPayment, setCurrentReceiptPayment] = useState<any>(null);

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Batch Invoice Form
  const [batchClassId, setBatchClassId] = useState('');
  const [batchMonth, setBatchMonth] = useState('Novembre 2026');
  const [batchDueDate, setBatchDueDate] = useState('2026-11-10');

  const loadFinances = async () => {
    try {
      setLoading(true);
      const [statsRes, invoicesRes, classesRes, studentsRes] = await Promise.all([
        financesApi.getStats(),
        financesApi.getInvoices({ status: statusFilter || undefined, classroomId: classFilter || undefined }),
        classesApi.getAll(),
        studentsApi.getAll(),
      ]);
      setStats(statsRes);
      setInvoices(invoicesRes);
      setClasses(classesRes);
      setStudents(studentsRes);
      if (classesRes.length > 0 && !batchClassId) {
        setBatchClassId(classesRes[0].id);
      }
    } catch (err) {
      console.error('Failed to load finances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinances();
  }, [statusFilter, classFilter]);

  const handleOpenPayment = (inv: any) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.balance);
    setPaymentRef('');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    try {
      const updatedInv = await financesApi.recordPayment({
        invoiceId: selectedInvoice.id,
        amount: Number(paymentAmount),
        paymentMethod,
        reference: paymentRef,
        notes: paymentNotes,
      });

      setShowPaymentModal(false);
      // Select this payment explicitly; a backdated payment may not sort first.
      const receiptPayment = updatedInv.createdPayment || updatedInv.payments?.[0];
      if (receiptPayment) {
        setCurrentReceiptPayment({ payment: receiptPayment, invoice: updatedInv });
        setShowReceiptModal(true);
      }

      loadFinances();
    } catch (err: any) {
      alert(`Erreur de paiement: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await financesApi.generateBatch({
        classroomId: batchClassId,
        monthName: batchMonth,
        dueDate: batchDueDate,
      });
      alert(res.message);
      setShowBatchModal(false);
      loadFinances();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleViewReceipt = (inv: any, pay: any) => {
    setCurrentReceiptPayment({ payment: pay, invoice: inv });
    setShowReceiptModal(true);
  };

  const handlePrintReceipt = () => {
    if (currentReceiptPayment) printPaymentReceipt(currentReceiptPayment);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gestion Financière & Facturation</h2>
          <p className="text-xs text-slate-500">
            Facturation des scolarités, enregistrement des versements et édition des reçus
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowBatchModal(true)}
            className="inline-flex items-center space-x-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3.5 py-2 rounded-xl text-xs font-semibold border border-indigo-200 transition"
          >
            <Layers className="w-4 h-4" />
            <span>Générer Mensualités Classe</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Facturé
          </span>
          <div className="text-2xl font-bold text-slate-800">
            {(stats?.totalInvoiced || 0).toLocaleString()} <span className="text-xs text-slate-400">FCFA</span>
          </div>
          <span className="text-[11px] text-slate-500">{stats?.invoiceCount || 0} factures émises</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Recouvré (Encaissé)
          </span>
          <div className="text-2xl font-bold text-emerald-600">
            {(stats?.totalCollected || 0).toLocaleString()} <span className="text-xs text-emerald-700/60">FCFA</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">
            Taux de recouvrement : {stats?.recoveryRate || 0}%
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Reste à recouvrer
          </span>
          <div className="text-2xl font-bold text-amber-600">
            {(stats?.totalOutstanding || 0).toLocaleString()} <span className="text-xs text-amber-700/60">FCFA</span>
          </div>
          <span className="text-[11px] text-amber-600 font-medium">Créances en cours</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Statut des Factures
          </span>
          <div className="flex items-center space-x-2 text-xs mt-2">
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              {stats?.byStatus?.PAID || 0} Payées
            </span>
            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
              {stats?.byStatus?.PARTIAL || 0} Partielles
            </span>
            <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
              {stats?.byStatus?.UNPAID || 0} Impayées
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-600">Statut :</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Tous les statuts</option>
              <option value="PAID">Payée</option>
              <option value="PARTIAL">Partielle</option>
              <option value="UNPAID">Impayée</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-600">Classe :</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-slate-400">
          Affichage de <span className="font-bold text-slate-700">{invoices.length}</span> facture(s)
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">N° Facture & Date</th>
                <th className="px-4 py-3.5">Élève & Classe</th>
                <th className="px-4 py-3.5">Libellé</th>
                <th className="px-4 py-3.5">Montant Total</th>
                <th className="px-4 py-3.5">Déjà Réglé</th>
                <th className="px-4 py-3.5">Reste à Payer</th>
                <th className="px-4 py-3.5">Statut</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Chargement des factures...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Aucune facture trouvée.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const studentClass = inv.student?.enrollments?.[0]?.classroom?.name || 'CI';
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-slate-800">{inv.invoiceNumber}</span>
                        <p className="text-[10px] text-slate-400">
                          {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                        {inv.createdByName && <p className="text-[10px] text-slate-500">Créée par {inv.createdByName} · {inv.createdByRole}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">
                          {inv.student?.firstName} {inv.student?.lastName}
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {studentClass}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">{inv.title}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">{inv.amount.toLocaleString()} F</td>
                      <td className="px-4 py-3.5 text-emerald-600 font-semibold">{inv.paidAmount.toLocaleString()} F</td>
                      <td className="px-4 py-3.5 text-amber-600 font-bold">{inv.balance.toLocaleString()} F</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'PARTIAL'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.status === 'PAID' ? 'Payée' : inv.status === 'PARTIAL' ? 'Partielle' : 'Impayée'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {inv.balance > 0 && (
                          <button
                            onClick={() => handleOpenPayment(inv)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-medium transition"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Régler</span>
                          </button>
                        )}
                        {inv.payments && inv.payments.length > 0 && (
                          <button
                            onClick={() => handleViewReceipt(inv, inv.payments[0])}
                            title="Voir le reçu du dernier paiement"
                            className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition"
                          >
                            <Receipt className="w-3 h-3 text-slate-500" />
                            <span>Reçu</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Enregistrer un Paiement */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-800">Enregistrer un Versement</h3>
                <p className="text-xs text-slate-400">Émission instantanée du reçu de paiement</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Élève :</span>
                  <span className="font-bold text-slate-800">
                    {selectedInvoice.student?.firstName} {selectedInvoice.student?.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Facture :</span>
                  <span className="font-mono text-slate-700">{selectedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Solde restant :</span>
                  <span className="font-bold text-amber-600">{selectedInvoice.balance.toLocaleString()} FCFA</span>
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Montant à verser (FCFA) *</label>
                <input
                  type="number"
                  min="100"
                  max={selectedInvoice.balance}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full text-sm font-bold p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Mode de règlement *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">Espèces (Caisse école)</option>
                  <option value="WAVE">Wave Mobile Money</option>
                  <option value="ORANGE_MONEY">Orange Money</option>
                  <option value="BANK_TRANSFER">Virement Bancaire</option>
                  <option value="CHECK">Chèque</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Référence transaction (Wave / Chèque / ID)</label>
                <input
                  type="text"
                  placeholder="Ex: WAVE-9923842 ou N° Chèque"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Observations</label>
                <input
                  type="text"
                  placeholder="Ex: Versement du mois d'octobre"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-md"
                >
                  Confirmer l'encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Générer Mensualités de Classe */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-800">Génération Groupée de Mensualités</h3>
                <p className="text-xs text-slate-400">Émission automatique des factures pour tous les élèves d'une classe</p>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateBatch} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Classe concernée *</label>
                <select
                  required
                  value={batchClassId}
                  onChange={(e) => setBatchClassId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - Mensualité : {c.monthlyTuition.toLocaleString()} FCFA
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Mois / Libellé *</label>
                <input
                  type="text"
                  required
                  value={batchMonth}
                  onChange={(e) => setBatchMonth(e.target.value)}
                  placeholder="Ex: Novembre 2026"
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Date d'échéance *</label>
                <input
                  type="date"
                  required
                  value={batchDueDate}
                  onChange={(e) => setBatchDueDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md"
                >
                  Lancer la génération
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reçu de Paiement Imprimable */}
      {showReceiptModal && currentReceiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Printable Receipt Box */}
            <div id="school-receipt" className="p-8 space-y-6">
              {/* Header */}
              <div className="border-b-2 border-dashed border-slate-200 pb-5 text-center relative">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-600 text-white font-bold mb-2 shadow-md">
                  <School className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-black tracking-wide uppercase text-slate-800">
                  École As Sakina
                </h2>
                <p className="text-xs text-slate-500">Enseignement Élémentaire - Dakar, Sénégal</p>
                <p className="text-[11px] text-slate-400">Tél: +221 33 800 00 00</p>

                <div className="mt-4 bg-emerald-50 border border-emerald-200 py-1.5 px-4 rounded-lg inline-block">
                  <span className="text-xs font-black text-emerald-800 tracking-wider uppercase">
                    REÇU DE CAISSE SCOLAIRE
                  </span>
                </div>
              </div>

              {/* Receipt Info */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">N° Reçu :</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {currentReceiptPayment.payment.paymentNumber}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Date :</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(currentReceiptPayment.payment.paymentDate).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>

              {/* Student and Invoice Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nom de l'élève :</span>
                  <span className="font-bold text-slate-800">
                    {currentReceiptPayment.invoice.student?.firstName} {currentReceiptPayment.invoice.student?.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Matricule :</span>
                  <span className="font-mono text-emerald-700">
                    {currentReceiptPayment.invoice.student?.matricule}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Motif :</span>
                  <span className="font-semibold text-slate-800">{currentReceiptPayment.invoice.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mode de paiement :</span>
                  <span className="font-semibold text-slate-800">
                    {currentReceiptPayment.payment.paymentMethod} {currentReceiptPayment.payment.reference ? `(${currentReceiptPayment.payment.reference})` : ''}
                  </span>
                </div>
              </div>

              {/* Amount Highlight */}
              <div className="bg-emerald-600 text-white p-4 rounded-xl flex items-center justify-between shadow-md">
                <span className="text-xs font-semibold uppercase tracking-wider">Montant Encaissé :</span>
                <span className="text-xl font-black">
                  {currentReceiptPayment.payment.amount.toLocaleString()} FCFA
                </span>
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Reste à payer : <strong className="text-slate-800">{currentReceiptPayment.invoice.balance.toLocaleString()} FCFA</strong></span>
                <span>Statut facture : <strong className="text-emerald-700">{currentReceiptPayment.invoice.status}</strong></span>
              </div>

              {/* Signatures */}
              <div className="pt-6 grid grid-cols-2 text-center text-xs border-t border-dashed border-slate-200">
                <div>
                  <p className="text-[11px] text-slate-400 mb-10">Signature du Parent / Payeur</p>
                  <p className="text-[10px] text-slate-300">....................................</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-10">Cachet & Signature Caisse</p>
                  <p className="text-xs font-semibold text-emerald-700">{currentReceiptPayment.payment.receivedBy || 'Service comptable'}{currentReceiptPayment.payment.receivedByRole ? ` · ${currentReceiptPayment.payment.receivedByRole}` : ''}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-white"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer / enregistrer PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

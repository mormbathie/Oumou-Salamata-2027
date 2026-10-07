import { printInvoice } from '../utils/schoolDocuments';
import { SchoolHeader } from '../components/SchoolHeader';
import { t, locale, roleLabel } from "../i18n/index";
import React, { useEffect, useRef, useState } from 'react';
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

  const requestVersion = useRef(0);
  const requestPending = useRef(false);

  const loadFinances = async (background = false) => {
    if (background && requestPending.current) return;
    const version = ++requestVersion.current;
    requestPending.current = true;
    try {
      if (!background) setLoading(true);
      const [statsRes, invoicesRes, classesRes, studentsRes] = await Promise.all([
        financesApi.getStats(),
        financesApi.getInvoices({ status: statusFilter || undefined, classroomId: classFilter || undefined }),
        classesApi.getAll(),
        studentsApi.getAll(),
      ]);
      if (version !== requestVersion.current) return;
      setStats(statsRes);
      setInvoices(invoicesRes);
      setClasses(classesRes);
      setStudents(studentsRes);
      if (classesRes.length > 0) setBatchClassId(current => current || classesRes[0].id);
    } catch (err) {
      console.error('Failed to load finances:', err);
    } finally {
      if (version === requestVersion.current) {
        requestPending.current = false;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadFinances();
    return () => { ++requestVersion.current; requestPending.current = false; };
  }, [statusFilter, classFilter]);

  useEffect(() => {
    // Keep open forms and receipts stable; refresh only while this tab is visible.
    if (showPaymentModal || showBatchModal || showReceiptModal) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadFinances(true);
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [statusFilter, classFilter, showPaymentModal, showBatchModal, showReceiptModal]);

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
      alert(t("Payment error: {0}", [err.response?.data?.message || err.message]));
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
      alert(t("Error: {0}", [err.message]));
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
          <h2 className="text-xl font-bold text-slate-800">{t("Finances & Billing")}</h2>
          <p className="text-xs text-slate-500">
            {t("Manage tuition invoices, payments, and receipts")}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowBatchModal(true)}
            className="inline-flex items-center space-x-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3.5 py-2 rounded-xl text-xs font-semibold border border-indigo-200 transition"
          >
            <Layers className="w-4 h-4" />
            <span>{t("Generate Class Tuition Invoices")}</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            {t("Total Invoiced")}</span>
          <div className="text-2xl font-bold text-slate-800">
            {(stats?.totalInvoiced || 0).toLocaleString()} <span className="text-xs text-slate-400">{t("FCFA")}</span>
          </div>
          <span className="text-[11px] text-slate-500">{stats?.invoiceCount || 0} {t("invoices issued")}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            {t("Total Collected")}</span>
          <div className="text-2xl font-bold text-emerald-600">
            {(stats?.totalCollected || 0).toLocaleString()} <span className="text-xs text-emerald-700/60">{t("FCFA")}</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">
            {t("Taux de recouvrement :")}{stats?.recoveryRate || 0}%
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            {t("Outstanding Balance")}</span>
          <div className="text-2xl font-bold text-amber-600">
            {(stats?.totalOutstanding || 0).toLocaleString()} <span className="text-xs text-amber-700/60">{t("FCFA")}</span>
          </div>
          <span className="text-[11px] text-amber-600 font-medium">{t("Outstanding payments")}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            {t("Invoice Status")}</span>
          <div className="flex items-center space-x-2 text-xs mt-2">
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              {stats?.byStatus?.PAID || 0} {t("Paids")}</span>
            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
              {stats?.byStatus?.PARTIAL || 0} {t("Partielles")}</span>
            <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
              {stats?.byStatus?.UNPAID || 0} {t("Unpaids")}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-600">{t("Status :")}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{t("All statuses")}</option>
              <option value="PAID">{t("Paid")}</option>
              <option value="PARTIAL">{t("Partielle")}</option>
              <option value="UNPAID">{t("Unpaid")}</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-600">{t("Class:")}</span>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{t("All classes")}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-slate-400">
          {t("Showing")}<span className="font-bold text-slate-700">{invoices.length}</span> {t("invoices")}</div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">{t("Invoice No. & Date")}</th>
                <th className="px-4 py-3.5">{t("Student & Class")}</th>
                <th className="px-4 py-3.5">{t("Description")}</th>
                <th className="px-4 py-3.5">{t("Total Amount")}</th>
                <th className="px-4 py-3.5">{t("Already Paid")}</th>
                <th className="px-4 py-3.5">{t("Balance Due")}</th>
                <th className="px-4 py-3.5">{t("Status")}</th>
                <th className="px-5 py-3.5 text-right">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    {t("Loading invoices…")}</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    {t("No invoices found.")}</td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const studentClass = inv.student?.enrollments?.[0]?.classroom?.name || 'CI';
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-slate-800">{inv.invoiceNumber}</span>
                        <p className="text-[10px] text-slate-400">
                          {new Date(inv.createdAt).toLocaleDateString(locale())}
                        </p>
                        {inv.createdByName && <p className="text-[10px] text-slate-500">{t("Created by")}{inv.createdByName} · {roleLabel(inv.createdByRole)}</p>}
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
                      <td className="px-4 py-3.5 font-bold text-slate-800">{inv.amount.toLocaleString()} {t("F")}</td>
                      <td className="px-4 py-3.5 text-emerald-600 font-semibold">{inv.paidAmount.toLocaleString()} {t("F")}</td>
                      <td className="px-4 py-3.5 text-amber-600 font-bold">{inv.balance.toLocaleString()} {t("F")}</td>
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
                          {inv.status === 'PAID' ? t("Paid") : inv.status === 'PARTIAL' ? 'Partielle' : t("Unpaid")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {inv.balance > 0 && (
                          <button
                            onClick={() => handleOpenPayment(inv)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-medium transition"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>{t("Pay")}</span>
                          </button>
                        )}
                          <button onClick={() => printInvoice(inv)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50" title={t('Print invoice')}><Printer className="h-4 w-4" /></button>
                        {inv.payments && inv.payments.length > 0 && (
                          <button
                            onClick={() => handleViewReceipt(inv, inv.payments[0])}
                            title={t("View the latest payment receipt")}
                            className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition"
                          >
                            <Receipt className="w-3 h-3 text-slate-500" />
                            <span>{t("Receipt")}</span>
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

      {/* Modal: Save un Paiement */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-800">{t("Record a Payment")}</h3>
                <p className="text-xs text-slate-400">{t("Generate a payment receipt immediately")}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t("Student :")}</span>
                  <span className="font-bold text-slate-800">
                    {selectedInvoice.student?.firstName} {selectedInvoice.student?.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t("Invoice:")}</span>
                  <span className="font-mono text-slate-700">{selectedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t("Solde restant :")}</span>
                  <span className="font-bold text-amber-600">{selectedInvoice.balance.toLocaleString()} {t("FCFA")}</span>
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">{t("Amount to pay (FCFA) *")}</label>
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
                <label className="font-medium text-slate-700 block mb-1">{t("Payment method *")}</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">{t("Cash (school office)")}</option>
                  <option value="WAVE">{t("Wave Mobile Money")}</option>
                  <option value="ORANGE_MONEY">{t("Orange Money")}</option>
                  <option value="BANK_TRANSFER">{t("Virement Bancaire")}</option>
                  <option value="CHECK">{t("Check")}</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">{t("Transaction reference (Wave / check / ID)")}</label>
                <input
                  type="text"
                  placeholder={t("Example: WAVE-9923842 or check number")}
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">{t("Observations")}</label>
                <input
                  type="text"
                  placeholder={t("Example: October payment")}
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
                  {t("Cancel")}</button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-md"
                >
                  {t("Confirmer l'encaissement")}</button>
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
                <h3 className="font-bold text-base text-slate-800">{t("Batch Tuition Invoices")}</h3>
                <p className="text-xs text-slate-400">{t("Automatically create invoices for every student in a class")}</p>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateBatch} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">{t("Selected class *")}</label>
                <select
                  required
                  value={batchClassId}
                  onChange={(e) => setBatchClassId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {t("- Monthly tuition:")}{c.monthlyTuition.toLocaleString()} {t("FCFA")}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">{t("Month / Description *")}</label>
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
                <label className="font-medium text-slate-700 block mb-1">{t("Due date *")}</label>
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
                  {t("Cancel")}</button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md"
                >
                  {t("Generate invoices")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Receipt de Paiement Imprimable */}
      {showReceiptModal && currentReceiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Printable Receipt Box */}
            <div id="school-receipt" className="p-8 space-y-6">
              {/* Header */}
              <SchoolHeader title={t('SCHOOL PAYMENT RECEIPT')} />

              {/* Receipt Info */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{t("Receipt no.:")}</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {currentReceiptPayment.payment.paymentNumber}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{t("Date :")}</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(currentReceiptPayment.payment.paymentDate).toLocaleDateString(locale())}
                  </span>
                </div>
              </div>

              {/* Student and Invoice Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("Student name:")}</span>
                  <span className="font-bold text-slate-800">
                    {currentReceiptPayment.invoice.student?.firstName} {currentReceiptPayment.invoice.student?.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("Matricule :")}</span>
                  <span className="font-mono text-emerald-700">
                    {currentReceiptPayment.invoice.student?.matricule}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("Motif :")}</span>
                  <span className="font-semibold text-slate-800">{currentReceiptPayment.invoice.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("Payment method:")}</span>
                  <span className="font-semibold text-slate-800">
                    {currentReceiptPayment.payment.paymentMethod} {currentReceiptPayment.payment.reference ? `(${currentReceiptPayment.payment.reference})` : ''}
                  </span>
                </div>
              </div>

              {/* Amount Highlight */}
              <div className="bg-emerald-600 text-white p-4 rounded-xl flex items-center justify-between shadow-md">
                <span className="text-xs font-semibold uppercase tracking-wider">{t("Montant Collected :")}</span>
                <span className="text-xl font-black">
                  {currentReceiptPayment.payment.amount.toLocaleString()} {t("FCFA")}</span>
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>{t("Balance due :")}<strong className="text-slate-800">{currentReceiptPayment.invoice.balance.toLocaleString()} {t("FCFA")}</strong></span>
                <span>{t("Invoice status:")}<strong className="text-emerald-700">{currentReceiptPayment.invoice.status}</strong></span>
              </div>

              {/* Signatures */}
              <div className="pt-6 grid grid-cols-2 text-center text-xs border-t border-dashed border-slate-200">
                <div>
                  <p className="text-[11px] text-slate-400 mb-10">{t("Parent / Payer Signature")}</p>
                  <p className="text-[10px] text-slate-300">....................................</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 mb-10">{t("Cachet & Signature Caisse")}</p>
                  <p className="text-xs font-semibold text-emerald-700">{currentReceiptPayment.payment.receivedBy || 'Service comptable'}{currentReceiptPayment.payment.receivedByRole ? ` · ${roleLabel(currentReceiptPayment.payment.receivedByRole)}` : ''}</p>
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
                {t("Close")}</button>
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{t("Imprimer / enregistrer PDF")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

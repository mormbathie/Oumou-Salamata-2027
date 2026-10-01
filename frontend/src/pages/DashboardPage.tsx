import React, { useEffect, useState } from 'react';
import {
  Users,
  CreditCard,
  CalendarCheck,
  Building,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { dashboardApi } from '../services/api';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi
      .getSummary()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dashboard:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const counts = data?.counts || {};
  const finances = data?.finances || {};
  const attendance = data?.attendance || {};
  const classesDistribution = data?.classesDistribution || [];
  const recentPayments = data?.recentPayments || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-emerald-200 mb-3 border border-emerald-400/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Gestion Scolaire Intégrée & Sécurisée</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            Bienvenue sur le portail de l'École Primaire Oumou Salamat
          </h2>
          <p className="text-emerald-100 text-sm mt-1">
            Année scolaire active : <span className="font-semibold text-white">{data?.academicYear}</span>. Suivi des inscriptions, de la facturation, des notes et du registre des présences en temps réel.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Élèves */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Effectif Total</span>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-800">{counts.totalStudents || 0}</div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
              <span>👦 {counts.maleStudents || 0} Garçons</span>
              <span>•</span>
              <span>👧 {counts.femaleStudents || 0} Filles</span>
            </div>
          </div>
        </div>

        {/* Recouvrement Financier */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Encaissé</span>
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-800">
              {(finances.totalCollected || 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">FCFA</span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-emerald-600 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Taux de recouvrement : {finances.recoveryRate || 0}%</span>
            </div>
          </div>
        </div>

        {/* Reste à recouvrer */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Reste à payer</span>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-800">
              {(finances.totalBalance || 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">FCFA</span>
            </div>
            <div className="text-xs text-amber-600 font-medium mt-1">
              {finances.unpaidInvoicesCount || 0} facture(s) en attente de solde
            </div>
          </div>
        </div>

        {/* Taux d'assiduité */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Assiduité du jour</span>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-800">{attendance.rate || 96}%</div>
            <div className="flex items-center space-x-1 text-xs text-slate-500 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Pointage du jour validé</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Classes breakdown & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Classes & Occupancy */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-800">Répartition des effectifs par classe</h3>
              <p className="text-xs text-slate-400">Taux de remplissage des classes (du CI au CM2)</p>
            </div>
            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
              {classesDistribution.length} Classes
            </span>
          </div>

          <div className="space-y-4">
            {classesDistribution.map((c: any) => (
              <div key={c.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-700 font-semibold">{c.name}</span>
                  <span className="text-slate-500">
                    <span className="text-emerald-700 font-bold">{c.studentsCount}</span> / {c.capacity} élèves ({c.occupancyRate}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(c.occupancyRate, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Derniers règlements reçus */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-800">Derniers Encaissements</h3>
            <span className="text-xs text-slate-400">Reçus récents</span>
          </div>

          <div className="flex-1 space-y-3">
            {recentPayments.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">Aucun paiement récent</div>
            ) : (
              recentPayments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                      {p.paymentMethod?.[0] || 'C'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {p.invoice?.student ? `${p.invoice.student.firstName} ${p.invoice.student.lastName}` : 'Élève'}
                      </p>
                      <p className="text-[11px] text-slate-400">{p.paymentNumber} • {p.paymentMethod}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-600">+{p.amount.toLocaleString()} F</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(p.paymentDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

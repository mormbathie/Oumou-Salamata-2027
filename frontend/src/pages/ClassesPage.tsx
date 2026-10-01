import React, { useEffect, useState } from 'react';
import {
  Settings,
  BookOpen,
  School,
  Plus,
  Users,
  CheckCircle2,
  X
} from 'lucide-react';
import { classesApi } from '../services/api';
import { useAuth } from '../auth/AuthContext';

export const ClassesPage: React.FC = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole(['ADMIN', 'DIRECTEUR']);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClassModal, setShowClassModal] = useState(false);
  const [savingClass, setSavingClass] = useState(false);
  const [classForm, setClassForm] = useState({
    name: '',
    level: 'CI',
    capacity: 30,
    monthlyTuition: 25000,
    registrationFee: 50000,
    teacherId: '',
  });

  // Subject Modal
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subCoeff, setSubCoeff] = useState(1.0);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cls, subs, teacherList] = await Promise.all([
        classesApi.getAll(), classesApi.getSubjects(), canManage ? classesApi.getTeachers() : Promise.resolve([]),
      ]);
      setClasses(cls);
      setSubjects(subs);
      setTeachers(teacherList);
    } catch (err) {
      console.error('Failed to load classes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignTeacher = async (classId: string, teacherId: string) => {
    try {
      await classesApi.update(classId, { teacherId: teacherId || null });
      await loadData();
    } catch (err: any) {
      alert(`Impossible d’affecter l’enseignant : ${err.response?.data?.message || err.message}`);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await classesApi.createSubject({
        name: subName,
        code: subCode,
        coefficient: Number(subCoeff),
      });
      setShowSubjectModal(false);
      setSubName('');
      setSubCode('');
      setSubCoeff(1.0);
      loadData();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingClass(true);
    try {
      await classesApi.create({
        ...classForm,
        name: classForm.name.trim(),
        capacity: Number(classForm.capacity),
        monthlyTuition: Number(classForm.monthlyTuition),
        registrationFee: Number(classForm.registrationFee),
        teacherId: classForm.teacherId || null,
      });
      setShowClassModal(false);
      setClassForm({
        name: '',
        level: 'CI',
        capacity: 30,
        monthlyTuition: 25000,
        registrationFee: 50000,
        teacherId: '',
      });
      await loadData();
    } catch (err: any) {
      alert('Erreur lors de la création de la classe: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingClass(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Classes & Matières Enseignées</h2>
          <p className="text-xs text-slate-500">
            Structure pédagogique du cycle élémentaire (CI, CP, CE1, CE2, CM1, CM2)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && <button
            onClick={() => setShowClassModal(true)}
            className="inline-flex items-center space-x-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-medium text-sm transition"
          >
            <School className="w-4 h-4" />
            <span>Créer une classe</span>
          </button>}
          {canManage && <button
            onClick={() => setShowSubjectModal(true)}
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une Matière</span>
          </button>}
        </div>
      </div>

      {/* Primary Classes Cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">
          Classes de l'Enseignement Primaire
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-8 text-center">
              <School className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-800">Aucune classe n'est encore créée.</p>
              <p className="text-xs text-slate-500 mt-1">Crée une classe pour pouvoir y affecter les élèves.</p>
              {canManage && <button
                type="button"
                onClick={() => setShowClassModal(true)}
                className="mt-4 inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                <span>Créer la première classe</span>
              </button>}
            </div>
          ) : classes.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded">
                  Niveau {c.level}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {c._count?.enrollments || 0} / {c.capacity} Élèves
                </span>
              </div>

              <div>
                <h4 className="font-bold text-base text-slate-800">{c.name}</h4>
                <p className="text-xs text-slate-500">
                  Maître titulaire : {c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}` : 'Aucun enseignant affecté'}
                </p>
              </div>

              {canManage && <label className="block text-xs font-medium text-slate-600">Affecter un enseignant<select value={c.teacherId || ''} onChange={(event) => void handleAssignTeacher(c.id, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"><option value="">Aucun enseignant</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName} · {teacher.email}</option>)}</select></label>}

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Frais d'inscription :</span>
                  <span className="font-bold text-slate-800">{c.registrationFee.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mensualité scolarité :</span>
                  <span className="font-bold text-emerald-700">{c.monthlyTuition.toLocaleString()} FCFA / mois</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subjects Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">Matières et Coefficients Pédagogiques</h3>
          <span className="text-xs text-slate-500">{subjects.length} matières configurées</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Code</th>
              <th className="px-4 py-3">Matière</th>
              <th className="px-4 py-3 text-center">Coefficient Officiel</th>
              <th className="px-5 py-3 text-right">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subjects.map((sub) => (
              <tr key={sub.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono font-bold text-emerald-800">{sub.code}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{sub.name}</td>
                <td className="px-4 py-3 text-center font-bold text-slate-700">{sub.coefficient}</td>
                <td className="px-5 py-3 text-right">
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Actif</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Créer une classe */}
      {showClassModal && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-800">Créer une classe</h3>
                <p className="text-xs text-slate-500 mt-1">La classe sera rattachée à l'année scolaire en cours.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowClassModal(false)}
                className="text-slate-400 hover:bg-slate-100 p-1 rounded-lg"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="font-medium text-slate-700 block mb-1">Nom de la classe *</label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    placeholder="Ex : CI A"
                    value={classForm.name}
                    onChange={(e) => setClassForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Niveau *</label>
                  <select
                    required
                    value={classForm.level}
                    onChange={(e) => setClassForm((prev) => ({ ...prev, level: e.target.value }))}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="CI">CI</option>
                    <option value="CP">CP</option>
                    <option value="CE1">CE1</option>
                    <option value="CE2">CE2</option>
                    <option value="CM1">CM1</option>
                    <option value="CM2">CM2</option>
                  </select>
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Effectif maximal *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={classForm.capacity}
                    onChange={(e) => setClassForm((prev) => ({ ...prev, capacity: Number(e.target.value) }))}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-medium text-slate-700 block mb-1">Enseignant responsable</label>
                  <select value={classForm.teacherId} onChange={(e) => setClassForm((prev) => ({ ...prev, teacherId: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 focus:ring-2 focus:ring-emerald-500">
                    <option value="">Affecter plus tard</option>
                    {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName} · {teacher.email}</option>)}
                  </select>
                  {teachers.length === 0 && <p className="mt-1 text-[11px] text-slate-400">Crée un compte avec le rôle ENSEIGNANT dans la gestion des utilisateurs.</p>}
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Frais d'inscription (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    value={classForm.registrationFee}
                    onChange={(e) => setClassForm((prev) => ({ ...prev, registrationFee: Number(e.target.value) }))}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-700 block mb-1">Mensualité (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    value={classForm.monthlyTuition}
                    onChange={(e) => setClassForm((prev) => ({ ...prev, monthlyTuition: Number(e.target.value) }))}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Si aucune année scolaire n'existe encore, elle sera créée automatiquement à la création de la première classe.
              </p>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingClass}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-md disabled:opacity-50"
                >
                  {savingClass ? 'Création...' : 'Créer la classe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ajouter Matière */}
      {showSubjectModal && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-800">Ajouter une Matière</h3>
              <button onClick={() => setShowSubjectModal(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-medium text-slate-700 block mb-1">Nom de la matière *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Éveil Scientifique"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Code abrégé *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: EVEIL"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Coefficient *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="10"
                  required
                  value={subCoeff}
                  onChange={(e) => setSubCoeff(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-md"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

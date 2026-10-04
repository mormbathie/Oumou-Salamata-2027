import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertTriangle, CheckCircle2, Download, Eye, FilePlus2, FileText, Pencil, Phone,
  Search, ShieldCheck, Trash2, UserPlus, Users, X, Save, QrCode,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { classesApi, parentsApi, studentsApi } from '../services/api';

const studentDocuments: { value: string; label: string; accept: string }[] = [
  { value: 'BIRTH_CERTIFICATE', label: 'Extrait de naissance', accept: '.pdf,.jpg,.jpeg,.png,.webp' },
  { value: 'STUDENT_PHOTO', label: 'Photo d’identité', accept: '.jpg,.jpeg,.png,.webp' },
  { value: 'VACCINATION_BOOK', label: 'Carnet de vaccination', accept: '.pdf,.jpg,.jpeg,.png,.webp' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Certificat médical', accept: '.pdf,.jpg,.jpeg,.png,.webp' },
  { value: 'PREVIOUS_REPORT', label: 'Bulletin précédent', accept: '.pdf,.jpg,.jpeg,.png,.webp' },
];
const parentDocuments: { value: string; label: string; accept: string }[] = [
  { value: 'NATIONAL_ID_CARD', label: 'Carte nationale d’identité', accept: '.pdf,.jpg,.jpeg,.png,.webp' },
  { value: 'PASSPORT', label: 'Passeport', accept: '.pdf,.jpg,.jpeg,.png,.webp' },
];

const formatError = (error: any) => {
  const message = error?.response?.data?.message || error?.message || 'Une erreur est survenue.';
  return Array.isArray(message) ? message.join(', ') : message;
};
const inputClass = 'mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

export const StudentsPage: React.FC = () => {
  const { user } = useAuth();
  const roles = (user?.roles || []).map((role) => role.toUpperCase());
  const manager = roles.includes('ADMIN') || roles.includes('DIRECTEUR');
  const canRegister = manager || roles.includes('COMPTABLE');
  const canSeeFinances = manager || (!roles.includes('ENSEIGNANT') && (roles.includes('COMPTABLE') || roles.includes('PARENT')));
  const parentPortal = roles.includes('PARENT') && !roles.some((role) => ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT'].includes(role));

  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const attendanceSummary = selectedStudent?.attendanceSummary || { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'overview' | 'documents'>('overview');
  const [editingDetails, setEditingDetails] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [studentPhoto, setStudentPhoto] = useState('');
  const [photoReloadKey, setPhotoReloadKey] = useState(0);
  const [studentQrCode, setStudentQrCode] = useState('');
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', gender: 'MALE', dateOfBirth: '2019-01-01',
    placeOfBirth: '', bloodGroup: '', address: '', classroomId: '',
    parentChoice: 'new', parentId: '', parentFirstName: '', parentLastName: '',
    parentPhone: '', parentEmail: '', parentAddress: '', parentProfession: '',
    parentRelation: 'Père', generateInvoice: true,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [studentsRes, classesRes, parentsRes] = await Promise.all([
        studentsApi.getAll({ search, classId: selectedClass || undefined }),
        parentPortal ? Promise.resolve([]) : classesApi.getAll(),
        canRegister ? parentsApi.getAll() : Promise.resolve([]),
      ]);
      setStudents(studentsRes);
      setClasses(classesRes);
      setParents(parentsRes);
      if (classesRes.length > 0 && !formData.classroomId) {
        setFormData((prev) => ({ ...prev, classroomId: classesRes[0].id }));
      }
    } catch (error) {
      console.error('Erreur de chargement des dossiers élèves:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [selectedClass]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (showDetailsModal && selectedStudent?.id) {
      studentsApi.getPhoto(selectedStudent.id)
        .then((blob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setStudentPhoto(objectUrl);
        })
        .catch(() => { if (active) setStudentPhoto(''); });
    } else setStudentPhoto('');
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [showDetailsModal, selectedStudent?.id, photoReloadKey]);

  useEffect(() => {
    let active = true;
    setStudentQrCode('');
    if (showDetailsModal && selectedStudent?.id) {
      QRCode.toDataURL('OSATT1:' + selectedStudent.id, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 240,
      }).then((dataUrl) => { if (active) setStudentQrCode(dataUrl); });
    }
    return () => { active = false; };
  }, [showDetailsModal, selectedStudent?.id]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void loadData();
  };

  const handleOpenDetails = async (studentId: string, tab: 'overview' | 'documents' = 'overview') => {
    try {
      const details = await studentsApi.getOne(studentId);
      setSelectedStudent(details);
      setDetailsTab(tab);
      setEditingDetails(false);
      setDocumentError('');
      setShowDetailsModal(true);
    } catch (error) {
      alert(`Impossible d’ouvrir le dossier : ${formatError(error)}`);
    }
  };

  const beginEdit = () => {
    if (!selectedStudent) return;
    const parent = selectedStudent.parent || {};
    setEditData({
      firstName: selectedStudent.firstName || '',
      lastName: selectedStudent.lastName || '',
      gender: selectedStudent.gender || 'MALE',
      dateOfBirth: selectedStudent.dateOfBirth ? new Date(selectedStudent.dateOfBirth).toISOString().slice(0, 10) : '',
      placeOfBirth: selectedStudent.placeOfBirth || '',
      bloodGroup: selectedStudent.bloodGroup || '',
      address: selectedStudent.address || '',
      classroomId: selectedStudent.enrollments?.[0]?.classroomId || '',
      parentData: {
        firstName: parent.firstName || '', lastName: parent.lastName || '',
        phone: parent.phone || '', email: parent.email || '', address: parent.address || '',
        profession: parent.profession || '', relation: parent.relation || 'Tuteur',
      },
    });
    setEditingDetails(true);
    setDetailsTab('overview');
  };

  const handleSaveDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStudent || !editData) return;
    setSavingDetails(true);
    try {
      const updated = await studentsApi.update(selectedStudent.id, editData);
      setSelectedStudent(updated);
      setEditingDetails(false);
      await loadData();
    } catch (error) {
      alert(`Impossible de modifier le dossier : ${formatError(error)}`);
    } finally {
      setSavingDetails(false);
    }
  };

  const handleDeleteStudent = async (student: any) => {
    if (!window.confirm(`Supprimer définitivement le dossier de ${student.firstName} ${student.lastName} (${student.matricule}) ?`)) return;
    try {
      await studentsApi.delete(student.id);
      setShowDetailsModal(false);
      setSelectedStudent(null);
      await loadData();
    } catch (error) {
      alert(`Suppression impossible : ${formatError(error)}`);
    }
  };

  const handleSubmitNewStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload: any = {
        firstName: formData.firstName.trim(), lastName: formData.lastName.trim(),
        gender: formData.gender, dateOfBirth: formData.dateOfBirth,
        placeOfBirth: formData.placeOfBirth, bloodGroup: formData.bloodGroup,
        address: formData.address, classroomId: formData.classroomId,
        generateInvoice: formData.generateInvoice,
      };
      if (formData.parentChoice === 'existing' && formData.parentId) {
        payload.parentId = formData.parentId;
      } else if (formData.parentFirstName.trim() && formData.parentPhone.trim()) {
        payload.parentData = {
          firstName: formData.parentFirstName.trim(),
          lastName: formData.parentLastName.trim() || formData.lastName.trim(),
          phone: formData.parentPhone.trim(), email: formData.parentEmail.trim() || undefined,
          profession: formData.parentProfession.trim() || undefined,
          relation: formData.parentRelation,
          address: formData.parentAddress.trim() || undefined,
        };
      }
      const created = await studentsApi.create(payload);
      setShowAddModal(false);
      setFormData((previous) => ({ ...previous, firstName: '', lastName: '', parentFirstName: '', parentLastName: '', parentPhone: '', parentEmail: '', parentAddress: '', parentProfession: '' }));
      await loadData();
      await handleOpenDetails(created.id, manager ? 'documents' : 'overview');
    } catch (error: any) {
      const message = error.response?.status === 401
        ? 'Votre session Keycloak a expiré. Reconnectez-vous avant de continuer.'
        : formatError(error);
      alert(`Erreur d’inscription : ${message}`);
    }
  };

  const uploadDocument = async (owner: 'student' | 'parent', ownerId: string, category: string, file?: File) => {
    if (!file || !selectedStudent) return;
    setUploadingCategory(`${owner}-${category}`);
    setDocumentError('');
    try {
      if (owner === 'student') {
        await studentsApi.uploadDocument(ownerId, category, file);
        if (category === 'STUDENT_PHOTO') setPhotoReloadKey((current) => current + 1);
      } else await parentsApi.uploadDocument(ownerId, category, file);
      await handleOpenDetails(selectedStudent.id, 'documents');
    } catch (error) {
      setDocumentError(formatError(error));
    } finally {
      setUploadingCategory('');
    }
  };

  const downloadDocument = async (owner: 'student' | 'parent', ownerId: string, document: any) => {
    try {
      const blob = owner === 'student'
        ? await studentsApi.downloadDocument(ownerId, document.id)
        : await parentsApi.downloadDocument(ownerId, document.id);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.originalName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDocumentError(formatError(error));
    }
  };

  const deleteDocument = async (owner: 'student' | 'parent', ownerId: string, document: any) => {
    if (!window.confirm(`Supprimer le document « ${document.originalName} » ?`)) return;
    try {
      if (owner === 'student') await studentsApi.deleteDocument(ownerId, document.id);
      else await parentsApi.deleteDocument(ownerId, document.id);
      await handleOpenDetails(selectedStudent.id, 'documents');
    } catch (error) {
      setDocumentError(formatError(error));
    }
  };

  const renderDocumentSection = (owner: 'student' | 'parent', ownerId: string, definitions: { value: string; label: string; accept: string }[], documents: any[] = []) => (
    <div className="space-y-3">
      {definitions.map((definition) => {
        const existing = documents.filter((document) => document.category === definition.value);
        const key = `${owner}-${definition.value}`;
        return (
          <div key={key} className="rounded-xl border border-slate-200 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-800">{definition.label}</p>
                {existing.length === 0 && <p className="mt-1 text-xs text-slate-400">Aucun fichier ajouté</p>}
              </div>
              {manager && (
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                  <FilePlus2 className="h-4 w-4" />
                  {uploadingCategory === key ? 'Envoi…' : 'Ajouter un fichier'}
                  <input type="file" accept={definition.accept} className="sr-only" disabled={uploadingCategory === key}
                    onChange={(event) => { void uploadDocument(owner, ownerId, definition.value, event.target.files?.[0]); event.target.value = ''; }} />
                </label>
              )}
            </div>
            {existing.map((document) => (
              <div key={document.id} className="mt-2 flex flex-col gap-2 rounded-lg bg-slate-50 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2 text-xs text-slate-700">
                  <FileText className="h-4 w-4 shrink-0 text-emerald-700" />
                  <span className="truncate">{document.originalName}</span>
                  <span className="shrink-0 text-slate-400">{(document.size / 1024 / 1024).toFixed(1)} Mo</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => void downloadDocument(owner, ownerId, document)} className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-white" title="Télécharger" aria-label="Télécharger le document"><Download className="h-4 w-4" /></button>
                  {manager && <button type="button" onClick={() => void deleteDocument(owner, ownerId, document)} className="rounded-md border border-rose-200 p-2 text-rose-600 hover:bg-rose-50" title="Supprimer" aria-label="Supprimer le document"><Trash2 className="h-4 w-4" /></button>}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Inscriptions & Dossiers Élèves</h2>
          <p className="text-xs text-slate-500">Suivi individuel et pièces administratives</p>
        </div>
        {canRegister && <button onClick={() => setShowAddModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:bg-emerald-700"><UserPlus className="h-4 w-4" /><span>Nouvelle inscription</span></button>}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:max-w-sm">
          <input type="search" placeholder="Rechercher un nom ou matricule…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        </form>
        {classes.length > 0 && (
          <label className="flex w-full items-center gap-2 text-xs text-slate-500 sm:w-auto">
            <span className="shrink-0">Classe :</span>
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:flex-none">
              <option value="">Toutes les classes</option>{classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-600"><tr>
              <th className="px-5 py-3.5">Matricule & élève</th><th className="px-4 py-3.5">Classe</th><th className="px-4 py-3.5">Genre</th><th className="px-4 py-3.5">Parent / tuteur</th>{canSeeFinances && <th className="px-4 py-3.5">Situation financière</th>}<th className="px-5 py-3.5 text-right">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={canSeeFinances ? 6 : 5} className="p-8 text-center text-slate-400">Chargement des dossiers…</td></tr>
                : students.length === 0 ? <tr><td colSpan={canSeeFinances ? 6 : 5} className="p-8 text-center text-slate-400">Aucun élève trouvé.</td></tr>
                  : students.map((student) => {
                    const classroom = student.enrollments?.[0]?.classroom;
                    const balance = student.invoices?.reduce((total: number, invoice: any) => total + invoice.balance, 0) || 0;
                    return <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">{student.firstName?.[0]}{student.lastName?.[0]}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{student.firstName} {student.lastName}</p><span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">{student.matricule}</span></div></div></td>
                      <td className="px-4 py-3.5"><span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{classroom?.name || 'Non affecté'}</span></td>
                      <td className="px-4 py-3.5 text-slate-600">{student.gender === 'MALE' ? 'Garçon' : 'Fille'}</td>
                      <td className="px-4 py-3.5">{student.parent ? <><p className="font-medium text-slate-700">{student.parent.firstName} {student.parent.lastName}</p><p className="text-[11px] text-slate-400">{student.parent.phone}</p></> : <span className="italic text-slate-400">Non renseigné</span>}</td>
                      {canSeeFinances && <td className="px-4 py-3.5">{balance === 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800"><CheckCircle2 className="h-3 w-3" />À jour</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800"><AlertTriangle className="h-3 w-3" />Solde : {balance.toLocaleString()} F</span>}</td>}
                      <td className="px-5 py-3.5 text-right"><button onClick={() => void handleOpenDetails(student.id)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"><Eye className="h-3.5 w-3.5" /><span>Dossier</span></button></td>
                    </tr>;
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && canRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 backdrop-blur-sm sm:p-4">
          <div className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-4 sm:p-6"><div><h3 className="font-bold text-lg text-slate-800">Nouvelle inscription</h3><p className="text-xs text-slate-500">Les pièces seront ajoutées dans le dossier après l’inscription.</p></div><button onClick={() => setShowAddModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Fermer"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmitNewStudent} className="space-y-6 p-4 sm:p-6">
              <section><h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-700">1. État civil de l’élève</h4><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-700">Prénom(s) *<input required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-700">Nom *<input required value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-700">Genre<select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className={inputClass}><option value="MALE">Garçon</option><option value="FEMALE">Fille</option></select></label>
                <label className="text-xs font-medium text-slate-700">Date de naissance<input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-700">Lieu de naissance<input value={formData.placeOfBirth} onChange={(e) => setFormData({ ...formData, placeOfBirth: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-700">Groupe sanguin<select value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} className={inputClass}><option value="">Non renseigné</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group}>{group}</option>)}</select></label>
                <label className="text-xs font-medium text-slate-700 sm:col-span-2">Adresse de l’élève<input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-700 sm:col-span-2">Classe d’affectation *<select required value={formData.classroomId} onChange={(e) => setFormData({ ...formData, classroomId: e.target.value })} disabled={!classes.length} className={inputClass}><option value="">{classes.length ? 'Choisir une classe…' : 'Aucune classe créée'}</option>{classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name} — inscription {classroom.registrationFee?.toLocaleString()} F</option>)}</select>{!classes.length && <span className="mt-1 block text-amber-700">Crée une classe dans <Link className="underline" to="/classes">Classes & Matières</Link>.</span>}</label>
              </div></section>

              <section className="border-t border-slate-100 pt-5"><h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-700">2. Parent / tuteur légal</h4><div className="mb-4 flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2"><input type="radio" name="parentChoice" checked={formData.parentChoice === 'new'} onChange={() => setFormData({ ...formData, parentChoice: 'new' })} />Nouveau parent</label>
                <label className="flex items-center gap-2"><input type="radio" name="parentChoice" checked={formData.parentChoice === 'existing'} onChange={() => setFormData({ ...formData, parentChoice: 'existing' })} />Parent existant</label>
              </div>
              {formData.parentChoice === 'existing' ? <label className="text-xs font-medium text-slate-700">Choisir un parent<select value={formData.parentId} onChange={(e) => setFormData({ ...formData, parentId: e.target.value })} className={inputClass}><option value="">Sélectionner…</option>{parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.firstName} {parent.lastName} — {parent.phone}</option>)}</select></label> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-700">Prénom du parent *<input required value={formData.parentFirstName} onChange={(e) => setFormData({ ...formData, parentFirstName: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-700">Nom du parent<input value={formData.parentLastName} onChange={(e) => setFormData({ ...formData, parentLastName: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-700">Téléphone *<input required value={formData.parentPhone} onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-700">E-mail du parent<input type="email" value={formData.parentEmail} onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-700">Lien de parenté<select value={formData.parentRelation} onChange={(e) => setFormData({ ...formData, parentRelation: e.target.value })} className={inputClass}><option>Père</option><option>Mère</option><option>Tuteur</option></select></label>
                <label className="text-xs font-medium text-slate-700">Profession<input value={formData.parentProfession} onChange={(e) => setFormData({ ...formData, parentProfession: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-medium text-slate-700 sm:col-span-2">Adresse du parent<input value={formData.parentAddress} onChange={(e) => setFormData({ ...formData, parentAddress: e.target.value })} className={inputClass} /></label>
              </div>}</section>

              <label className="flex items-start gap-2 border-t border-slate-100 pt-4 text-xs text-slate-700"><input type="checkbox" checked={formData.generateInvoice} onChange={(e) => setFormData({ ...formData, generateInvoice: e.target.checked })} className="mt-0.5 rounded text-emerald-600" />Générer automatiquement la facture des frais d’inscription</label>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600">Annuler</button><button type="submit" disabled={!classes.length} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Confirmer l’inscription</button></div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 backdrop-blur-sm sm:p-4">
          <div className="max-h-[95dvh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-20 flex flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white">{selectedStudent.firstName?.[0]}{selectedStudent.lastName?.[0]}</div><div className="min-w-0"><h3 className="truncate font-bold text-slate-800">{selectedStudent.firstName} {selectedStudent.lastName}</h3><p className="font-mono text-xs text-emerald-700">Matricule : {selectedStudent.matricule}</p></div></div>
              <div className="flex items-center justify-end gap-2">{manager && <><button onClick={beginEdit} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Modifier</button><button onClick={() => void handleDeleteStudent(selectedStudent)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />Supprimer</button></>}<button onClick={() => setShowDetailsModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Fermer le dossier"><X className="h-5 w-5" /></button></div>
            </div>
            <div className="border-b border-slate-100 px-4 sm:px-6"><div className="flex gap-5"><button onClick={() => { setDetailsTab('overview'); setEditingDetails(false); }} className={`border-b-2 py-3 text-xs font-semibold ${detailsTab === 'overview' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'}`}>Informations</button>{manager && <button onClick={() => { setDetailsTab('documents'); setEditingDetails(false); }} className={`border-b-2 py-3 text-xs font-semibold ${detailsTab === 'documents' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'}`}>Pièces du dossier</button>}</div></div>

            {detailsTab === 'overview' && <div className="space-y-5 p-4 sm:p-6">
              {editingDetails && editData ? <form onSubmit={handleSaveDetails} className="space-y-5">
                <section><h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-700">Informations de l’élève</h4><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-700">Prénom(s)<input required value={editData.firstName} onChange={(e) => setEditData({ ...editData, firstName: e.target.value })} className={inputClass} /></label><label className="text-xs font-medium text-slate-700">Nom<input required value={editData.lastName} onChange={(e) => setEditData({ ...editData, lastName: e.target.value })} className={inputClass} /></label>
                  <label className="text-xs font-medium text-slate-700">Genre<select value={editData.gender} onChange={(e) => setEditData({ ...editData, gender: e.target.value })} className={inputClass}><option value="MALE">Garçon</option><option value="FEMALE">Fille</option></select></label><label className="text-xs font-medium text-slate-700">Date de naissance<input type="date" value={editData.dateOfBirth} onChange={(e) => setEditData({ ...editData, dateOfBirth: e.target.value })} className={inputClass} /></label>
                  <label className="text-xs font-medium text-slate-700">Lieu de naissance<input value={editData.placeOfBirth} onChange={(e) => setEditData({ ...editData, placeOfBirth: e.target.value })} className={inputClass} /></label><label className="text-xs font-medium text-slate-700">Groupe sanguin<select value={editData.bloodGroup} onChange={(e) => setEditData({ ...editData, bloodGroup: e.target.value })} className={inputClass}><option value="">Non renseigné</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group}>{group}</option>)}</select></label>
                  <label className="text-xs font-medium text-slate-700 sm:col-span-2">Adresse<input value={editData.address} onChange={(e) => setEditData({ ...editData, address: e.target.value })} className={inputClass} /></label><label className="text-xs font-medium text-slate-700 sm:col-span-2">Classe actuelle<select value={editData.classroomId} onChange={(e) => setEditData({ ...editData, classroomId: e.target.value })} className={inputClass}><option value="">Ne pas changer</option>{classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}</select></label>
                </div></section>
                <section className="border-t border-slate-100 pt-4"><h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-700">Parent / tuteur</h4><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(['firstName', 'lastName', 'phone', 'email', 'relation', 'profession', 'address'] as const).map((field) => <label key={field} className="text-xs font-medium capitalize text-slate-700">{{firstName:'Prénom',lastName:'Nom',phone:'Téléphone',email:'E-mail',relation:'Lien de parenté',profession:'Profession',address:'Adresse'}[field]}<input type={field === 'email' ? 'email' : 'text'} value={editData.parentData[field]} onChange={(e) => setEditData({ ...editData, parentData: { ...editData.parentData, [field]: e.target.value } })} required={['firstName', 'lastName', 'phone'].includes(field)} className={inputClass} /></label>)}
                </div></section>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setEditingDetails(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600">Annuler</button><button type="submit" disabled={savingDetails} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{savingDetails ? 'Enregistrement…' : 'Enregistrer les modifications'}</button></div>
              </form> : <>
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-4"><div><span className="block text-slate-400">Naissance</span><b className="text-slate-800">{new Date(selectedStudent.dateOfBirth).toLocaleDateString('fr-FR')}</b></div><div><span className="block text-slate-400">Lieu</span><b className="text-slate-800">{selectedStudent.placeOfBirth || 'Non renseigné'}</b></div><div><span className="block text-slate-400">Classe</span><b className="text-emerald-700">{selectedStudent.enrollments?.[0]?.classroom?.name || 'Non affecté'}</b></div><div><span className="block text-slate-400">Groupe sanguin</span><b className="text-slate-800">{selectedStudent.bloodGroup || 'Non renseigné'}</b></div></div>
                {manager && <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600"><p>Inscrit par : <strong>{selectedStudent.createdByName || 'Historique indisponible'}</strong>{selectedStudent.createdByRole ? ` · ${selectedStudent.createdByRole}` : ''}</p><p className="mt-1">Affectation de classe par : <strong>{selectedStudent.enrollments?.[0]?.registeredByName || 'Historique indisponible'}</strong></p>{selectedStudent.updatedByName && <p className="mt-1">Dernière modification par : <strong>{selectedStudent.updatedByName}</strong></p>}</div>}
                {selectedStudent.parent && <div className="rounded-xl border border-slate-200 p-4"><h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Parent / responsable légal</h4><div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{selectedStudent.parent.firstName} {selectedStudent.parent.lastName} · {selectedStudent.parent.relation || 'Parent'}</p><p className="text-slate-500">{selectedStudent.parent.profession || 'Profession non renseignée'}</p><p className="text-slate-500">{selectedStudent.parent.email || ''}</p></div><span className="inline-flex items-center gap-1 text-slate-600"><Phone className="h-3.5 w-3.5 text-emerald-600" />{selectedStudent.parent.phone}</span></div></div>}
              </>}
              <section className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_190px]">
                <div className="flex min-w-0 items-center gap-4">
                  {studentPhoto ? <img src={studentPhoto} alt={"Photo de " + selectedStudent.firstName + ' ' + selectedStudent.lastName} className="h-28 w-24 shrink-0 rounded-xl border border-slate-200 object-cover" /> : <div className="grid h-28 w-24 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400"><Users className="h-9 w-9" /></div>}
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-800">Carte de l’élève</h4>
                    <p className="mt-1 text-xs text-slate-500">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                    <p className="font-mono text-xs text-emerald-700">{selectedStudent.matricule}</p>
                    <p className="mt-2 text-[11px] text-slate-500">{selectedStudent.enrollments?.[0]?.classroom?.name || 'Classe non affectée'}</p>
                    {!studentPhoto && manager && <button type="button" onClick={() => setDetailsTab('documents')} className="mt-2 text-xs font-semibold text-emerald-700 hover:underline">Ajouter sa photo d’identité</button>}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 p-3 text-center">
                  {studentQrCode ? <img src={studentQrCode} alt={"QR code de " + selectedStudent.matricule} className="h-32 w-32 mix-blend-multiply" /> : <div className="grid h-32 w-32 place-items-center text-slate-300"><QrCode className="h-14 w-14" /></div>}
                  <p className="mt-1 text-[10px] font-semibold text-slate-600">QR de présence</p>
                  {studentQrCode && <a href={studentQrCode} download={"QR-" + selectedStudent.matricule + '.png'} className="mt-1 text-[11px] font-semibold text-emerald-700 hover:underline">Télécharger le QR</a>}
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Bilan de présence — {attendanceSummary.total} jour(s)</h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-emerald-50 p-3 text-center"><span className="block text-[10px] font-bold uppercase text-emerald-700">Présences</span><b className="text-lg text-emerald-800">{attendanceSummary.present}</b></div>
                  <div className="rounded-lg bg-rose-50 p-3 text-center"><span className="block text-[10px] font-bold uppercase text-rose-700">Absences</span><b className="text-lg text-rose-800">{attendanceSummary.absent}</b></div>
                  <div className="rounded-lg bg-amber-50 p-3 text-center"><span className="block text-[10px] font-bold uppercase text-amber-700">Retards</span><b className="text-lg text-amber-800">{attendanceSummary.late}</b></div>
                  <div className="rounded-lg bg-sky-50 p-3 text-center"><span className="block text-[10px] font-bold uppercase text-sky-700">Excusé</span><b className="text-lg text-sky-800">{attendanceSummary.excused}</b></div>
                </div>
              </section>

              <section>
                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Notes & bulletins</h4>
                {selectedStudent.reportCards?.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{selectedStudent.reportCards.map((card: any) => <span key={card.id} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">{card.term.replace('_', ' ')} · moyenne <b>{Number(card.overallAverage).toFixed(2)}/20</b>{card.rank ? ' · rang ' + card.rank : ''}</span>)}</div>}
                {!selectedStudent.grades?.length ? <p className="text-xs text-slate-400">Aucune note enregistrée</p> : <div className="max-h-56 space-y-2 overflow-auto">{selectedStudent.grades.map((grade: any) => <div key={grade.id} className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{grade.subject?.name || 'Matière'}</p><p className="text-[11px] text-slate-500">{grade.term.replace('_', ' ')} · {grade.examType} · {new Date(grade.date).toLocaleDateString('fr-FR')}</p></div><b className="text-emerald-700">{Number(grade.score).toFixed(2)} / {Number(grade.maxScore).toFixed(2)}</b></div>)}</div>}
              </section>

              <section>
                <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Historique des présences & absences</h4>
                {!selectedStudent.attendances?.length ? <p className="text-xs text-slate-400">Aucun pointage enregistré</p> : <div className="max-h-56 space-y-2 overflow-auto">{selectedStudent.attendances.map((attendance: any) => <div key={attendance.id} className="flex flex-col gap-1 rounded-lg border border-slate-100 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"><div><b className="text-slate-800">{new Date(attendance.date).toLocaleDateString('fr-FR')}</b><span className="ml-2 text-slate-500">{attendance.classroom?.name || ''}</span>{attendance.reason && <p className="text-[11px] text-slate-500">{attendance.reason}{attendance.justified ? ' · justifiée' : ''}</p>}</div><span className="font-semibold text-slate-700">{attendance.status === 'PRESENT' ? 'Présent' : attendance.status === 'ABSENT' ? 'Absent' : attendance.status === 'LATE' ? 'En retard' : 'Excusé'}{attendance.checkInAt ? ' · arrivée à ' + new Date(attendance.checkInAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</span></div>)}</div>}
              </section>

              {canSeeFinances && <section><h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Historique financier & factures</h4><div className="space-y-2">{!selectedStudent.invoices?.length ? <p className="text-xs text-slate-400">Aucune facture enregistrée</p> : selectedStudent.invoices.map((invoice: any) => <div key={invoice.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{invoice.title}</p><p className="text-[11px] text-slate-400">{invoice.invoiceNumber} · Échéance : {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</p></div><div className="sm:text-right"><p className="font-bold text-slate-800">{invoice.amount.toLocaleString()} FCFA</p><span className="inline-block rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">{invoice.status === 'PAID' ? 'Payée' : invoice.status === 'PARTIAL' ? `Reste : ${invoice.balance.toLocaleString()} F` : 'Impayée'}</span></div></div>)}</div></section>}
            </div>}

            {detailsTab === 'documents' && manager && <div className="space-y-6 p-4 sm:p-6">
              <div><h4 className="mb-3 text-sm font-bold text-slate-800">Pièces de l’élève</h4>{renderDocumentSection('student', selectedStudent.id, studentDocuments, selectedStudent.documents || [])}</div>
              {selectedStudent.parent && <div className="border-t border-slate-100 pt-5"><h4 className="mb-3 text-sm font-bold text-slate-800">Pièces du parent — {selectedStudent.parent.firstName} {selectedStudent.parent.lastName}</h4>{renderDocumentSection('parent', selectedStudent.parent.id, parentDocuments, selectedStudent.parent.documents || [])}</div>}
              {documentError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{documentError}</div>}
              <p className="text-xs text-slate-400">Formats : PDF, JPG, PNG, WEBP · 10 Mo maximum par fichier. Les fichiers sont stockés dans le volume privé de l’application.</p>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
};

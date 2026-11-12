import React, { useState } from 'react';
import { useHealthRecord, PrescriptionItem } from '../../context/HealthRecordContext';
import { checkAllergySafety, checkDrugInteractions, AllergyConflict, DrugInteractionWarning } from '../../services/ClinicalSafetyEngine';
import {
  LayoutDashboard, Stethoscope, Plus, Trash2, AlertTriangle, ShieldAlert, CheckCircle2, UserPlus, Search
} from 'lucide-react';
import confetti from 'canvas-confetti';

const API_BASE = 'https://unified-health-record.onrender.com';

export const DoctorPortalAdvanced: React.FC = () => {
  const { consultations, appointments, addConsultation, currentUser, doctorStats, refreshData } = useHealthRecord();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'consultations' | 'new-patient'>('dashboard');

  // Valid Patient Email Verification State
  const [patientEmail, setPatientEmail] = useState('');
  const [verifiedPatient, setVerifiedPatient] = useState<{
    id: number;
    full_name: string;
    blood_group: string;
    allergies: string;
    email: string;
  } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  // Consultation Fields
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [labTestName, setLabTestName] = useState('');
  const [labResultSummary, setLabResultSummary] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingConsult, setSavingConsult] = useState(false);

  const [meds, setMeds] = useState<PrescriptionItem[]>([
    { id: '1', medicine: '', dosage: '', frequency: 'Once Daily', duration: '7 Days', instructions: '' }
  ]);

  const [allergyAlert, setAllergyAlert] = useState<AllergyConflict | null>(null);
  const [interactionAlert, setInteractionAlert] = useState<DrugInteractionWarning | null>(null);

  // New Patient Registration State
  const [newPatName, setNewPatName] = useState('');
  const [newPatEmail, setNewPatEmail] = useState('');
  const [newPatPassword, setNewPatPassword] = useState('');
  const [newPatDob, setNewPatDob] = useState('1995-01-01');
  const [newPatGender, setNewPatGender] = useState('male');
  const [newPatBlood, setNewPatBlood] = useState('O+');
  const [newPatPhone, setNewPatPhone] = useState('');
  const [newPatAllergies, setNewPatAllergies] = useState('');
  const [patCreateStatus, setPatCreateStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [creatingPat, setCreatingPat] = useState(false);

  const doctorName = currentUser?.doctor?.full_name || currentUser?.name || 'Doctor';
  const doctorSpec = currentUser?.doctor?.specialization || 'Medical Specialist';
  const doctorLicense = currentUser?.doctor?.license_number || 'Verified';
  const doctorHospital = currentUser?.doctor?.hospital_affiliation || 'Hospital Network';

  const verifyPatientEmail = async (emailToVerify?: string) => {
    const target = (emailToVerify ?? patientEmail).trim();
    if (!target) {
      setLookupError('Enter a patient email ID first.');
      setVerifiedPatient(null);
      return;
    }
    setVerifyingEmail(true);
    setLookupError(null);
    setVerifiedPatient(null);
    try {
      const token = localStorage.getItem('uhr_jwt_token');
      const res = await fetch(`${API_BASE}/api/doctor/patient-lookup?email=${encodeURIComponent(target)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.message || 'Patient email does not exist.');
      } else {
        setVerifiedPatient(data.patient);
      }
    } catch {
      setLookupError('Unable to verify patient email right now.');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const addMed = () => {
    setMeds(prev => [...prev, { id: Date.now().toString(), medicine: '', dosage: '', frequency: 'Once Daily', duration: '7 Days', instructions: '' }]);
  };

  const removeMed = (id: string) => {
    setMeds(prev => prev.filter(m => m.id !== id));
  };

  const updateMed = (id: string, field: keyof PrescriptionItem, val: string) => {
    setMeds(prev => prev.map(m => (m.id === id ? { ...m, [field]: val } : m)));

    if (field === 'medicine' && val.trim().length > 2) {
      const patientAllergyList = verifiedPatient?.allergies
        ? verifiedPatient.allergies.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const allergyCheck = checkAllergySafety(patientAllergyList, val);
      setAllergyAlert(allergyCheck || null);

      const activeList = meds.filter(m => m.id !== id).map(m => m.medicine);
      const interactionCheck = checkDrugInteractions(activeList, val);
      setInteractionAlert(interactionCheck || null);
    }
  };

  const handleCommitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);

    if (!verifiedPatient) {
      setSaveMessage({ type: 'err', text: 'You must verify an existing patient email ID before adding records.' });
      return;
    }

    if (allergyAlert) {
      setSaveMessage({ type: 'err', text: `CRITICAL ALLERGY BLOCK: ${allergyAlert.clinicalRationale}` });
      return;
    }

    setSavingConsult(true);
    const result = await addConsultation({
      patientEmail: verifiedPatient.email,
      diagnosis,
      symptoms: chiefComplaint,
      clinicalNotes,
      treatmentPlan: treatment,
      followUpDate: followUp || null,
      prescriptionItems: meds.filter(m => m.medicine.trim() !== ''),
      labTestName,
      labResultSummary
    });

    setSavingConsult(false);
    if (!result.ok) {
      setSaveMessage({ type: 'err', text: result.message });
      return;
    }

    confetti({ particleCount: 75, spread: 80, origin: { y: 0.5 } });
    setSaveMessage({ type: 'ok', text: result.message });
    setDiagnosis('');
    setChiefComplaint('');
    setClinicalNotes('');
    setTreatment('');
    setLabTestName('');
    setLabResultSummary('');
    setMeds([{ id: '1', medicine: '', dosage: '', frequency: 'Once Daily', duration: '7 Days', instructions: '' }]);
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingPat(true);
    setPatCreateStatus(null);
    try {
      const token = localStorage.getItem('uhr_jwt_token');
      const res = await fetch(`${API_BASE}/api/doctor/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: newPatName,
          email: newPatEmail,
          password: newPatPassword,
          dob: newPatDob,
          gender: newPatGender,
          bloodGroup: newPatBlood,
          phone: newPatPhone,
          allergies: newPatAllergies
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setPatCreateStatus({ type: 'err', text: data.message || 'Could not create patient account.' });
      } else {
        setPatCreateStatus({ type: 'ok', text: data.message });
        confetti({ particleCount: 60, spread: 70 });
        setPatientEmail(newPatEmail);
        setNewPatName('');
        setNewPatEmail('');
        setNewPatPassword('');
        setNewPatPhone('');
        setNewPatAllergies('');
        await refreshData();
      }
    } catch {
      setPatCreateStatus({ type: 'err', text: 'Network error connecting to backend.' });
    } finally {
      setCreatingPat(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/60 p-4 shrink-0">
        <div className="px-3 py-3 mb-4 flex items-center space-x-2 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-white text-xs">
            DR
          </div>
          <div>
            <div className="text-xs font-bold text-white">{doctorName}</div>
            <div className="text-[10px] text-teal-400 font-mono">{doctorSpec} ({doctorLicense})</div>
          </div>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold ${
              activeTab === 'dashboard' ? 'bg-teal-600/30 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Appointments & Roster</span>
          </button>
          <button
            onClick={() => setActiveTab('consultations')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold ${
              activeTab === 'consultations' ? 'bg-teal-600/30 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Add Patient Report / Rx</span>
          </button>
          <button
            onClick={() => setActiveTab('new-patient')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold ${
              activeTab === 'new-patient' ? 'bg-teal-600/30 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Patient</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-6xl mx-auto space-y-6 w-full">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h1 className="text-2xl font-black text-white">Welcome, {doctorName}</h1>
                <p className="text-xs text-slate-400 mt-1">{doctorHospital} • Live Patient Appointments</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('new-patient')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Patient</span>
                </button>
                <button
                  onClick={() => setActiveTab('consultations')}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Clinical Report</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Registered Patients</span>
                <div className="text-2xl font-black text-white mt-1">{doctorStats.totalPatients}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Booked Appointments</span>
                <div className="text-2xl font-black text-cyan-400 mt-1">{appointments.length}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Issued Reports</span>
                <div className="text-2xl font-black text-emerald-400 mt-1">{consultations.length}</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white">Your Scheduled Patient Appointments</h2>
              {appointments.length === 0 ? (
                <p className="text-xs text-slate-400">No appointments booked yet.</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {appointments.map(a => (
                    <div key={a.id} className="py-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white">
                          {a.patientName} <span className="text-cyan-400 font-mono">({a.patientEmail})</span>
                        </div>
                        <div className="text-slate-400">
                          {a.date} at {a.time} • {a.type} • Status: <strong className="text-emerald-400">{a.status}</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (a.patientEmail) {
                            setPatientEmail(a.patientEmail);
                            verifyPatientEmail(a.patientEmail);
                          }
                          setChiefComplaint(a.type);
                          setActiveTab('consultations');
                        }}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold text-[11px] self-start sm:self-center"
                      >
                        Add Report for Patient
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'new-patient' && (
          <form onSubmit={handleCreatePatient} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Register New Real Patient Account</h2>
              <p className="text-xs text-slate-400">Creates a real login for the patient so they can view their reports and book appointments.</p>
            </div>

            {patCreateStatus && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                patCreateStatus.type === 'ok'
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
              }`}>
                {patCreateStatus.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{patCreateStatus.text}</span>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Patient Full Name *</label>
                <input required value={newPatName} onChange={e => setNewPatName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Patient Email ID *</label>
                <input required type="email" value={newPatEmail} onChange={e => setNewPatEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Initial Password *</label>
                <input required type="password" value={newPatPassword} onChange={e => setNewPatPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Date of Birth</label>
                <input type="date" value={newPatDob} onChange={e => setNewPatDob(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Gender & Blood Group</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={newPatGender} onChange={e => setNewPatGender(e.target.value)} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  <select value={newPatBlood} onChange={e => setNewPatBlood(e.target.value)} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white">
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Phone Number</label>
                <input value={newPatPhone} onChange={e => setNewPatPhone(e.target.value)} placeholder="+91 98..." className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
              </div>
            </div>

            <div className="text-xs">
              <label className="block text-slate-400 mb-1">Known Allergies (comma-separated)</label>
              <input value={newPatAllergies} onChange={e => setNewPatAllergies(e.target.value)} placeholder="e.g. Penicillin, Aspirin" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
            </div>

            <button
              type="submit"
              disabled={creatingPat}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {creatingPat ? 'Creating Patient Account...' : 'Create Real Patient Account'}
            </button>
          </form>
        )}

        {activeTab === 'consultations' && (
          <form onSubmit={handleCommitConsultation} className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold">Add Medical Report & e-Prescription</h1>
                <p className="text-xs text-slate-400">Requires a valid registered patient email ID in the hospital database</p>
              </div>
              <button
                type="submit"
                disabled={!verifiedPatient || Boolean(allergyAlert) || savingConsult}
                className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 text-white font-bold rounded-xl text-xs shadow-lg disabled:opacity-40"
              >
                {savingConsult ? 'Saving...' : 'Save Report to Patient Account'}
              </button>
            </div>

            {saveMessage && (
              <div className={`p-4 rounded-2xl text-xs flex items-center gap-2 border ${
                saveMessage.type === 'ok'
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                  : 'bg-rose-950 border-rose-500 text-rose-200'
              }`}>
                {saveMessage.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{saveMessage.text}</span>
              </div>
            )}

            {/* Step 1: Mandatory Patient Email Verification */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
              <label className="block text-slate-300 font-bold uppercase tracking-wider">
                1. Verify Registered Patient Email ID *
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="Enter patient's registered email (e.g. rahul@gmail.com)"
                  value={patientEmail}
                  onChange={e => {
                    setPatientEmail(e.target.value);
                    setVerifiedPatient(null);
                    setLookupError(null);
                  }}
                  className="flex-1 bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => verifyPatientEmail()}
                  disabled={verifyingEmail}
                  className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{verifyingEmail ? 'Checking...' : 'Verify Email'}</span>
                </button>
              </div>

              {lookupError && (
                <div className="p-3 bg-rose-950/70 border border-rose-500/40 text-rose-300 rounded-xl flex items-center justify-between">
                  <span>{lookupError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPatEmail(patientEmail);
                      setActiveTab('new-patient');
                    }}
                    className="underline font-bold text-white ml-2"
                  >
                    Create Patient Now
                  </button>
                </div>
              )}

              {verifiedPatient && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 rounded-xl flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <span className="font-bold text-white">Verified Patient: {verifiedPatient.full_name}</span>
                    <span className="ml-2 font-mono text-[11px]">({verifiedPatient.email})</span>
                  </div>
                  <div className="text-[11px]">
                    Blood Group: <strong>{verifiedPatient.blood_group}</strong> • Allergies:{' '}
                    <strong className="text-amber-300">{verifiedPatient.allergies || 'None'}</strong>
                  </div>
                </div>
              )}
            </div>

            {allergyAlert && (
              <div className="p-4 bg-rose-950 border border-rose-600 rounded-2xl flex items-start space-x-3 text-xs text-rose-200">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black text-rose-400 uppercase block">CRITICAL ALLERGY BLOCK</span>
                  <p>{allergyAlert.clinicalRationale}</p>
                </div>
              </div>
            )}

            {interactionAlert && (
              <div className="p-4 bg-amber-950 border border-amber-600 rounded-2xl flex items-start space-x-3 text-xs text-amber-200">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black text-amber-400 uppercase block">DRUG INTERACTION ({interactionAlert.severity})</span>
                  <p>{interactionAlert.mechanism}</p>
                </div>
              </div>
            )}

            {/* Clinical Report & Prescription Details */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Diagnosis *</label>
                  <input required placeholder="e.g. Acute Viral Bronchitis" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-cyan-300 font-bold" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Symptoms / Chief Complaint</label>
                  <input placeholder="Fever, cough, fatigue" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Clinical Examination Notes</label>
                  <textarea rows={2} placeholder="Clinical observations..." value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Treatment Plan & Advice</label>
                  <textarea rows={2} placeholder="Rest, hydration, follow-up instructions..." value={treatment} onChange={e => setTreatment(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Lab Test Name (Optional)</label>
                  <input placeholder="e.g. Complete Blood Count (CBC)" value={labTestName} onChange={e => setLabTestName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Lab Result Summary</label>
                  <input placeholder="e.g. Hb 14.2 g/dL, WBC 7,800/uL" value={labResultSummary} onChange={e => setLabResultSummary(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Follow-up Date</label>
                  <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white uppercase">e-Prescription Medicines</span>
                  <button type="button" onClick={addMed} className="text-teal-400 font-bold flex items-center space-x-1">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Medicine</span>
                  </button>
                </div>

                {meds.map(med => (
                  <div key={med.id} className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <input placeholder="Medicine Name" value={med.medicine} onChange={e => updateMed(med.id, 'medicine', e.target.value)} className="col-span-4 bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                    <input placeholder="Dosage (500mg)" value={med.dosage} onChange={e => updateMed(med.id, 'dosage', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                    <input placeholder="Frequency" value={med.frequency} onChange={e => updateMed(med.id, 'frequency', e.target.value)} className="col-span-3 bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                    <input placeholder="Duration" value={med.duration} onChange={e => updateMed(med.id, 'duration', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                    <button type="button" onClick={() => removeMed(med.id)} className="col-span-1 text-rose-400 hover:text-rose-300">
                      <Trash2 className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};

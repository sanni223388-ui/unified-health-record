import React, { useState } from 'react';
import { useHealthRecord, PrescriptionItem } from '../../context/HealthRecordContext';
import { checkAllergySafety, checkDrugInteractions, AllergyConflict, DrugInteractionWarning } from '../../services/ClinicalSafetyEngine';
import {
  LayoutDashboard, Users, Calendar, Stethoscope, Plus, Trash2, AlertTriangle, ShieldAlert, CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const DoctorPortalAdvanced: React.FC = () => {
  const { consultations, appointments, addConsultation, profile } = useHealthRecord();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'consultations'>('dashboard');

  const [patientName, setPatientName] = useState('John Doe');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [bp, setBp] = useState('135/85 mmHg');
  const [hr, setHr] = useState('74 bpm');
  const [temp, setTemp] = useState('98.6 °F');
  const [spo2, setSpo2] = useState('98%');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [followUp, setFollowUp] = useState('2026-11-15');

  // Dynamic Multi-Item Prescription List
  const [meds, setMeds] = useState<PrescriptionItem[]>([
    { id: '1', medicine: 'Lisinopril', dosage: '10mg', frequency: 'Once Daily', duration: '90 Days', instructions: 'Take in morning with food' }
  ]);

  // Clinical Safety Interceptors
  const [allergyAlert, setAllergyAlert] = useState<AllergyConflict | null>(null);
  const [interactionAlert, setInteractionAlert] = useState<DrugInteractionWarning | null>(null);

  const addMed = () => {
    setMeds(prev => [...prev, { id: Date.now().toString(), medicine: '', dosage: '', frequency: 'Once Daily', duration: '30 Days', instructions: '' }]);
  };

  const removeMed = (id: string) => {
    setMeds(prev => prev.filter(m => m.id !== id));
  };

  const updateMed = (id: string, field: keyof PrescriptionItem, val: string) => {
    setMeds(prev => prev.map(m => m.id === id ? { ...m, [field]: val } : m));

    // Immediate real-time safety inspection
    if (field === 'medicine' && val.trim().length > 3) {
      const allergyCheck = checkAllergySafety(profile.allergies, val);
      if (allergyCheck) {
        setAllergyAlert(allergyCheck);
      } else {
        setAllergyAlert(null);
      }

      const activeList = meds.filter(m => m.id !== id).map(m => m.medicine);
      const interactionCheck = checkDrugInteractions(activeList, val);
      if (interactionCheck) {
        setInteractionAlert(interactionCheck);
      } else {
        setInteractionAlert(null);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Enforce safety hard-block
    if (allergyAlert) {
      alert(`CLINICAL HARD BLOCK: Cannot commit order. ${allergyAlert.clinicalRationale}`);
      return;
    }

    if (!diagnosis || !chiefComplaint) return;

    addConsultation({
      patientId: 'PAT-1',
      patientName,
      doctorId: 'DOC-1',
      doctorName: 'Dr. Ananya Sharma',
      chiefComplaint,
      symptoms: ['Morning headache', 'Exertional fatigue'],
      vitals: { bloodPressure: bp, heartRate: hr, temperature: temp, oxygenSaturation: spo2 },
      clinicalFindings: 'Heart auscultation S1/S2 regular, bilateral chest clear, no peripheral edema.',
      diagnosis,
      treatment,
      prescriptions: meds.filter(m => m.medicine.trim() !== ''),
      followUpDate: followUp
    });

    confetti({ particleCount: 75, spread: 80, origin: { y: 0.5 } });
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 shrink-0">
        <div className="px-3 py-3 mb-4 flex items-center space-x-2 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-white text-xs">
            AS
          </div>
          <div>
            <div className="text-xs font-bold text-white">Dr. Ananya Sharma</div>
            <div className="text-[10px] text-teal-400 font-mono">Cardiology (MCI-78192)</div>
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
            <span>Clinical Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('consultations')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold ${
              activeTab === 'consultations' ? 'bg-teal-600/30 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Consultation Suite</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto space-y-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-black text-white">Good Morning, Dr. Ananya 👋</h1>
                <p className="text-xs text-slate-400 mt-1">Hospital Station: Apollo Heart Center • Clinical Ward Roster</p>
              </div>
              <button
                onClick={() => setActiveTab('consultations')}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start New Consultation</span>
              </button>
            </div>

            {/* Metric counters matching presentation */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Patients</span>
                <div className="text-2xl font-black text-white mt-1">128</div>
                <span className="text-[10px] text-teal-400">Total in ledger</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Today's Queue</span>
                <div className="text-2xl font-black text-cyan-400 mt-1">{appointments.length}</div>
                <span className="text-[10px] text-slate-500">Scheduled slots</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Pending</span>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  {appointments.filter(a => a.status === 'Pending').length || 5}
                </div>
                <span className="text-[10px] text-amber-500">Awaiting consult</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Completed</span>
                <div className="text-2xl font-black text-emerald-400 mt-1">{consultations.length}</div>
                <span className="text-[10px] text-emerald-500">Signed encounters</span>
              </div>
            </div>

            {/* Live Queue with one-click consultation trigger */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white">Today's Clinical Roster</h2>
              <div className="divide-y divide-slate-800">
                {appointments.map(a => (
                  <div key={a.id} className="py-3 flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-cyan-400 font-bold">{a.time}</span>
                      <span className="font-bold text-white">{a.patientName}</span>
                      <span className="text-slate-400">({a.type})</span>
                    </div>
                    <button
                      onClick={() => {
                        setPatientName(a.patientName);
                        setChiefComplaint(a.type);
                        setActiveTab('consultations');
                      }}
                      className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold text-[11px]"
                    >
                      [Open Consult]
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CLINICAL CONSULTATION SUITE WITH SAFETY ENGINES */}
        {activeTab === 'consultations' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold">Clinical Examination & Differential Diagnosis Suite</h1>
                <p className="text-xs text-slate-400">Commits directly to Patient Health Ledger & Admin Audit Trail</p>
              </div>
              <button
                type="submit"
                disabled={Boolean(allergyAlert)}
                className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 text-white font-bold rounded-xl text-xs shadow-lg disabled:opacity-40"
              >
                Commit to Unified Ledger
              </button>
            </div>

            {/* REAL-TIME ALLERGY HARD-BLOCK BANNER */}
            {allergyAlert && (
              <div className="p-4 bg-rose-950 border border-rose-600 rounded-2xl flex items-start space-x-3 text-xs text-rose-200 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-black text-rose-400 uppercase tracking-wider block">
                    CRITICAL ALLERGY HARD-BLOCK DETECTED
                  </span>
                  <p>{allergyAlert.clinicalRationale}</p>
                  <p className="text-[11px] text-rose-300 font-bold">
                    Order cannot be signed until the contraindicated drug is removed.
                  </p>
                </div>
              </div>
            )}

            {/* DRUG-DRUG INTERACTION WARNING */}
            {interactionAlert && (
              <div className="p-4 bg-amber-950 border border-amber-600 rounded-2xl flex items-start space-x-3 text-xs text-amber-200 animate-in fade-in">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-black text-amber-400 uppercase tracking-wider block">
                    POTENTIAL DRUG-TO-DRUG INTERACTION ({interactionAlert.severity})
                  </span>
                  <p>{interactionAlert.mechanism}</p>
                </div>
              </div>
            )}

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Patient Identity</label>
                  <input value={patientName} onChange={e => setPatientName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Chief Complaint</label>
                  <input required placeholder="Reason for encounter..." value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-white" />
                </div>
              </div>

              {/* Vitals */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Physiological Vitals</span>
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <input placeholder="BP (135/85)" value={bp} onChange={e => setBp(e.target.value)} className="bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                  <input placeholder="HR (74 bpm)" value={hr} onChange={e => setHr(e.target.value)} className="bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                  <input placeholder="Temp (98.6 F)" value={temp} onChange={e => setTemp(e.target.value)} className="bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                  <input placeholder="SpO2 (98%)" value={spo2} onChange={e => setSpo2(e.target.value)} className="bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Differential Diagnosis</label>
                  <input required placeholder="e.g. Stage 1 Essential Hypertension" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-white font-bold text-cyan-300" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Scheduled Follow-up Date</label>
                  <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-white" />
                </div>
              </div>

              <div className="text-xs">
                <label className="block text-slate-400 mb-1">Treatment Plan & Clinical Notes</label>
                <textarea rows={2} placeholder="Dietary restrictions, exercise regimens, precautions..." value={treatment} onChange={e => setTreatment(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-white" />
              </div>

              {/* Dynamic e-Prescription List */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-white uppercase">e-Prescription Items (Clinical Safety Protected)</span>
                  <button type="button" onClick={addMed} className="text-xs text-teal-400 font-bold flex items-center space-x-1">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {meds.map(med => (
                  <div key={med.id} className="grid grid-cols-12 gap-2 text-xs items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <input placeholder="Medicine Name (e.g. Lisinopril)" value={med.medicine} onChange={e => updateMed(med.id, 'medicine', e.target.value)} className="col-span-4 bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                    <input placeholder="Dosage (10mg)" value={med.dosage} onChange={e => updateMed(med.id, 'dosage', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                    <input placeholder="Frequency" value={med.frequency} onChange={e => updateMed(med.id, 'frequency', e.target.value)} className="col-span-3 bg-slate-900 border border-slate-800 p-2 rounded text-white" />
                    <input placeholder="Duration (90 Days)" value={med.duration} onChange={e => updateMed(med.id, 'duration', e.target.value)} className="col-span-2 bg-slate-900 border border-slate-800 p-2 rounded text-white" />
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

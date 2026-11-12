import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = 'https://unified-health-record.onrender.com';

export interface Vitals {
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  oxygenSaturation: string;
}

export interface PrescriptionItem {
  id: string;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface ConsultationRecord {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  doctorId: string;
  doctorName: string;
  date: string;
  chiefComplaint: string;
  symptoms: string[];
  vitals: Vitals;
  clinicalFindings: string;
  diagnosis: string;
  treatment: string;
  prescriptions: PrescriptionItem[];
  followUpDate: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  time: string;
  date: string;
  type: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
}

export interface LabReport {
  id: string;
  testName: string;
  category: string;
  date: string;
  laboratory: string;
  result: string;
  status: 'Normal' | 'Borderline' | 'Critical';
  fileSize: string;
}

export interface Vaccination {
  id: string;
  vaccineName: string;
  batchNumber: string;
  dateAdministered: string;
  clinic: string;
  nextDose?: string;
}

export interface HealthDocument {
  id: string;
  title: string;
  type: string;
  uploadedAt: string;
  size: string;
}

export interface PatientProfile {
  fullName: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  allergies: string[];
  chronicConditions: string[];
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
    alternatePhone: string;
  };
}

export interface DoctorUser {
  id: string;
  numericId: number;
  name: string;
  email?: string;
  specialty: string;
  hospital: string;
  area: string;
  phone: string;
  licenseNumber: string;
  lat: number;
  lng: number;
  radiusKm: number;
  fee: string;
  status: 'Verified' | 'Pending Verification' | 'Suspended';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: 'Patient' | 'Doctor' | 'Admin';
  action: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
}

interface HealthRecordContextType {
  activeRole: 'patient' | 'doctor' | 'admin';
  setActiveRole: (role: 'patient' | 'doctor' | 'admin') => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
  currentUser: any;
  setCurrentUser: (usr: any) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  profile: PatientProfile;
  updateProfile: (updated: Partial<PatientProfile>) => void;
  consultations: ConsultationRecord[];
  appointments: Appointment[];
  labReports: LabReport[];
  vaccinations: Vaccination[];
  documents: HealthDocument[];
  addDocument: (doc: Omit<HealthDocument, 'id' | 'uploadedAt'>) => void;
  doctors: DoctorUser[];
  auditLogs: AuditLog[];
  adminStats: { totalPatients: number; totalDoctors: number; totalRecords: number; totalAppointments: number };
  doctorStats: { totalPatients: number };
  addConsultation: (record: any) => Promise<{ ok: boolean; message: string }>;
  bookAppointment: (appt: Omit<Appointment, 'id' | 'status'>) => Promise<{ ok: boolean; message: string }>;
  cancelAppointment: (id: string) => void;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  verifyDoctor: (id: string, status: DoctorUser['status']) => void;
  refreshData: () => Promise<void>;
  logout: () => void;
}

const emptyProfile: PatientProfile = {
  fullName: 'Patient',
  dob: '',
  gender: '',
  bloodGroup: 'O+',
  phone: '',
  email: '',
  address: '',
  allergies: [],
  chronicConditions: [],
  emergencyContact: {
    name: 'Not Configured',
    relationship: 'Emergency Contact',
    phone: '',
    alternatePhone: ''
  }
};

const HealthRecordContext = createContext<HealthRecordContextType | undefined>(undefined);

export const HealthRecordProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('uhr_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeRole, setActiveRole] = useState<'patient' | 'doctor' | 'admin'>(() => {
    const saved = localStorage.getItem('uhr_user');
    return saved ? JSON.parse(saved).role : 'patient';
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('uhr_jwt_token'));
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('uhr_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('uhr_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const [profile, setProfile] = useState<PatientProfile>(emptyProfile);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [vaccinations] = useState<Vaccination[]>([]);
  const [documents, setDocuments] = useState<HealthDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [adminStats, setAdminStats] = useState({ totalPatients: 0, totalDoctors: 0, totalRecords: 0, totalAppointments: 0 });
  const [doctorStats, setDoctorStats] = useState({ totalPatients: 0 });

  const refreshData = async () => {
    const token = localStorage.getItem('uhr_jwt_token');

    try {
      // Always fetch real doctors from MySQL
      const docsRes = await fetch(`${API_BASE}/api/doctors`);
      if (docsRes.ok) {
        const docList = await docsRes.json();
        setDoctors(
          docList.map((d: any) => ({
            id: `DOC-${d.id}`,
            numericId: d.id,
            name: d.full_name,
            email: d.email,
            specialty: d.specialization,
            hospital: d.hospital_affiliation || 'Hospital',
            area: d.area || 'Bengaluru',
            phone: d.phone || '',
            licenseNumber: d.license_number || `MCI-${d.id}`,
            lat: Number(d.latitude) || 12.9716,
            lng: Number(d.longitude) || 77.5946,
            radiusKm: Number(d.consultation_radius_km) || 15,
            fee: d.consultation_fee || '₹700',
            status: d.is_active ? 'Verified' : 'Suspended'
          }))
        );
      }

      if (!token) return;

      if (activeRole === 'patient') {
        const res = await fetch(`${API_BASE}/api/patient/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const pName = data.patient?.full_name || currentUser?.name || 'Patient';
          if (data.patient) {
            setProfile({
              fullName: pName,
              dob: data.patient.date_of_birth ? data.patient.date_of_birth.split('T')[0] : '',
              gender: data.patient.gender || '',
              bloodGroup: data.patient.blood_group || 'O+',
              phone: data.patient.phone || '',
              email: data.email || currentUser?.email || '',
              address: data.patient.address || '',
              allergies: data.patient.allergies ? data.patient.allergies.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
              chronicConditions: data.patient.chronic_conditions ? data.patient.chronic_conditions.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
              emergencyContact: {
                name: data.emergencyContact?.contact_name || 'Not Configured',
                relationship: data.emergencyContact?.relationship || 'Emergency',
                phone: data.emergencyContact?.phone_number || '',
                alternatePhone: ''
              }
            });
          }

          setAppointments(
            (data.appointments || []).map((a: any) => ({
              id: `APT-${a.id}`,
              patientId: String(a.patient_id),
              patientName: pName,
              doctorId: `DOC-${a.doctor_id}`,
              doctorName: a.doctor_name,
              doctorSpecialty: a.specialization,
              time: a.appointment_time,
              date: a.appointment_date ? a.appointment_date.split('T')[0] : '',
              type: a.reason,
              status: (a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : 'Confirmed') as Appointment['status']
            }))
          );

          const prescMap: Record<number, PrescriptionItem[]> = {};
          for (const pr of data.prescriptions || []) {
            if (pr.medical_record_id) {
              prescMap[pr.medical_record_id] = (pr.items || []).map((it: any) => ({
                id: `RX-${it.id}`,
                medicine: it.medicine_name,
                dosage: it.dosage,
                frequency: it.frequency,
                duration: it.duration,
                instructions: it.special_notes || ''
              }));
            }
          }

          setConsultations(
            (data.records || []).map((r: any) => ({
              id: `ENC-${r.id}`,
              patientId: String(r.patient_id),
              patientName: pName,
              doctorId: `DOC-${r.doctor_id}`,
              doctorName: r.doctor_name,
              date: r.record_date ? r.record_date.split('T')[0] : '',
              chiefComplaint: r.diagnosis,
              symptoms: r.symptoms ? r.symptoms.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
              vitals: { bloodPressure: 'Recorded', heartRate: 'Recorded', temperature: 'Recorded', oxygenSaturation: 'Recorded' },
              clinicalFindings: r.clinical_notes || '',
              diagnosis: r.diagnosis,
              treatment: r.treatment_plan || '',
              prescriptions: prescMap[r.id] || [],
              followUpDate: r.follow_up_date ? r.follow_up_date.split('T')[0] : 'As Advised'
            }))
          );

          setLabReports(
            (data.labReports || []).map((l: any) => ({
              id: `LAB-${l.id}`,
              testName: l.test_name,
              category: l.test_type || 'Clinical Lab',
              date: l.test_date ? l.test_date.split('T')[0] : '',
              laboratory: l.laboratory_name || 'Hospital Diagnostics',
              result: l.result_summary,
              status: 'Normal',
              fileSize: 'Verified'
            }))
          );
        }
      } else if (activeRole === 'doctor') {
        const res = await fetch(`${API_BASE}/api/doctor/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setDoctorStats({ totalPatients: data.totalPatients || 0 });
          setAppointments(
            (data.appointments || []).map((a: any) => ({
              id: `APT-${a.id}`,
              patientId: String(a.patient_id),
              patientName: a.patient_name,
              patientEmail: a.patient_email,
              doctorId: `DOC-${a.doctor_id}`,
              doctorName: data.doctor?.full_name || currentUser?.name || 'Doctor',
              doctorSpecialty: data.doctor?.specialization || 'Specialist',
              time: a.appointment_time,
              date: a.appointment_date ? a.appointment_date.split('T')[0] : '',
              type: a.reason,
              status: (a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : 'Confirmed') as Appointment['status']
            }))
          );
          setConsultations(
            (data.consultations || []).map((r: any) => ({
              id: `ENC-${r.id}`,
              patientId: String(r.patient_id),
              patientName: r.patient_name,
              patientEmail: r.patient_email,
              doctorId: `DOC-${r.doctor_id}`,
              doctorName: data.doctor?.full_name || 'Doctor',
              date: r.record_date ? r.record_date.split('T')[0] : '',
              chiefComplaint: r.diagnosis,
              symptoms: r.symptoms ? r.symptoms.split(',') : [],
              vitals: { bloodPressure: '', heartRate: '', temperature: '', oxygenSaturation: '' },
              clinicalFindings: r.clinical_notes || '',
              diagnosis: r.diagnosis,
              treatment: r.treatment_plan || '',
              prescriptions: [],
              followUpDate: r.follow_up_date ? r.follow_up_date.split('T')[0] : ''
            }))
          );
        }
      } else if (activeRole === 'admin') {
        const res = await fetch(`${API_BASE}/api/admin/telemetry`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.stats) setAdminStats(data.stats);
          setAuditLogs(
            (data.recentAudit || []).map((l: any) => ({
              id: `LOG-${l.id}`,
              timestamp: new Date(l.created_at).toLocaleTimeString(),
              actor: l.email,
              role: (l.role ? l.role.charAt(0).toUpperCase() + l.role.slice(1) : 'System') as AuditLog['role'],
              action: l.action,
              severity: 'INFO'
            }))
          );
        }
      }
    } catch (err) {
      console.error('Live sync error:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [activeRole, isAuthenticated]);

  const updateProfile = async (updated: Partial<PatientProfile>) => {
    setProfile(prev => ({ ...prev, ...updated }));
    const token = localStorage.getItem('uhr_jwt_token');
    if (token) {
      await fetch(`${API_BASE}/api/patient/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: updated.phone ?? profile.phone, address: updated.address ?? profile.address })
      });
    }
  };

  const addDocument = (doc: Omit<HealthDocument, 'id' | 'uploadedAt'>) => {
    setDocuments(prev => [
      { ...doc, id: `DOC-${Date.now().toString().slice(-4)}`, uploadedAt: new Date().toISOString().split('T')[0] },
      ...prev
    ]);
  };

  const addConsultation = async (rec: any): Promise<{ ok: boolean; message: string }> => {
    const token = localStorage.getItem('uhr_jwt_token');
    if (!token) return { ok: false, message: 'Not authenticated.' };

    try {
      const res = await fetch(`${API_BASE}/api/doctor/consultation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(rec)
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.message || 'Failed to save consultation.' };
      }
      await refreshData();
      return { ok: true, message: data.message };
    } catch {
      return { ok: false, message: 'Network error connecting to server.' };
    }
  };

  const bookAppointment = async (appt: Omit<Appointment, 'id' | 'status'>): Promise<{ ok: boolean; message: string }> => {
    const token = localStorage.getItem('uhr_jwt_token');
    if (!token) return { ok: false, message: 'Please log in as a patient first.' };

    try {
      const res = await fetch(`${API_BASE}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          doctorId: appt.doctorId,
          appointmentDate: appt.date,
          appointmentTime: appt.time,
          reason: appt.type
        })
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, message: data.message || 'Booking failed.' };
      await refreshData();
      return { ok: true, message: data.message };
    } catch {
      return { ok: false, message: 'Network error booking appointment.' };
    }
  };

  const cancelAppointment = async (id: string) => {
    setAppointments(prev => prev.map(a => (a.id === id ? { ...a, status: 'Cancelled' } : a)));
    const token = localStorage.getItem('uhr_jwt_token');
    const numericId = id.replace('APT-', '');
    if (token) {
      await fetch(`${API_BASE}/api/appointments/${numericId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
    }
  };

  const updateAppointmentStatus = (id: string, status: Appointment['status']) => {
    setAppointments(prev => prev.map(a => (a.id === id ? { ...a, status } : a)));
  };

  const verifyDoctor = () => {};

  const logout = () => {
    localStorage.removeItem('uhr_jwt_token');
    localStorage.removeItem('uhr_user');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setProfile(emptyProfile);
    setAppointments([]);
    setConsultations([]);
    setLabReports([]);
  };

  return (
    <HealthRecordContext.Provider
      value={{
        activeRole,
        setActiveRole,
        isAuthenticated,
        setIsAuthenticated,
        currentUser,
        setCurrentUser,
        theme,
        toggleTheme,
        profile,
        updateProfile,
        consultations,
        appointments,
        labReports,
        vaccinations,
        documents,
        addDocument,
        doctors,
        auditLogs,
        adminStats,
        doctorStats,
        addConsultation,
        bookAppointment,
        cancelAppointment,
        updateAppointmentStatus,
        verifyDoctor,
        refreshData,
        logout
      }}
    >
      {children}
    </HealthRecordContext.Provider>
  );
};

export const useHealthRecord = () => {
  const context = useContext(HealthRecordContext);
  if (!context) throw new Error('useHealthRecord must be used within a HealthRecordProvider');
  return context;
};

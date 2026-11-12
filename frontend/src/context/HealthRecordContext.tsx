import React, { createContext, useContext, useState, useEffect } from 'react';

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
  name: string;
  specialty: string;
  hospital: string;
  licenseNumber: string;
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
  currentUser: { email: string; name: string; role: 'patient' | 'doctor' | 'admin' } | null;
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
  addConsultation: (record: Omit<ConsultationRecord, 'id' | 'date'>) => void;
  bookAppointment: (appt: Omit<Appointment, 'id' | 'status'>) => void;
  cancelAppointment: (id: string) => void;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  verifyDoctor: (id: string, status: DoctorUser['status']) => void;
  refreshData: () => void;
  logout: () => void;
}

const defaultProfile: PatientProfile = {
  fullName: 'John Doe',
  dob: '1992-05-14',
  gender: 'Male',
  bloodGroup: 'O+',
  phone: '+91 98765 43210',
  email: 'patient@example.com',
  address: '742 Evergreen Terrace, Bengaluru, Karnataka, India',
  allergies: ['Penicillin (Severe Anaphylaxis)', 'Shellfish / Crustaceans', 'Dust Mites'],
  chronicConditions: ['Stage 1 Essential Hypertension', 'Mild Intermittent Asthma'],
  emergencyContact: {
    name: 'Mary Doe',
    relationship: 'Spouse',
    phone: '+91 98765 43211',
    alternatePhone: '+91 80 2345 6789'
  }
};

const HealthRecordContext = createContext<HealthRecordContextType | undefined>(undefined);

export const HealthRecordProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<'patient' | 'doctor' | 'admin'>('patient');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('uhr_jwt_token'));
  });
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('uhr_user');
    return saved ? JSON.parse(saved) : { email: 'patient@example.com', name: 'John Doe', role: 'patient' };
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

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const [profile, setProfile] = useState<PatientProfile>(defaultProfile);
  const [doctors, setDoctors] = useState<DoctorUser[]>([
    { id: 'DOC-1', name: 'Dr. Ananya Sharma', specialty: 'Cardiologist', hospital: 'Apollo Heart Center', licenseNumber: 'MCI-78192', status: 'Verified' },
    { id: 'DOC-2', name: 'Dr. Rajesh Patel', specialty: 'Endocrinologist', hospital: 'Apex Health Institute', licenseNumber: 'MCI-55219', status: 'Verified' },
    { id: 'DOC-3', name: 'Dr. Vikram Malhotra', specialty: 'Pulmonologist', hospital: 'Metro Clinic', licenseNumber: 'MCI-99014', status: 'Verified' },
  ]);

  const [appointments, setAppointments] = useState<Appointment[]>([
    { id: 'APT-101', patientId: 'PAT-1', patientName: 'John Doe', doctorId: 'DOC-1', doctorName: 'Dr. Ananya Sharma', doctorSpecialty: 'Cardiologist', time: '09:00 AM', date: '2026-10-15', type: 'Cardiology Review', status: 'Confirmed' },
    { id: 'APT-102', patientId: 'PAT-1', patientName: 'John Doe', doctorId: 'DOC-2', doctorName: 'Dr. Rajesh Patel', doctorSpecialty: 'Endocrinologist', time: '02:30 PM', date: '2026-11-05', type: 'HbA1c Follow-up', status: 'Pending' },
  ]);

  const [consultations, setConsultations] = useState<ConsultationRecord[]>([
    {
      id: 'ENC-9001',
      patientId: 'PAT-1',
      patientName: 'John Doe',
      doctorId: 'DOC-1',
      doctorName: 'Dr. Ananya Sharma',
      date: '2026-06-12',
      chiefComplaint: 'Morning occipital headaches and mild exertional fatigue',
      symptoms: ['Headache', 'Dizziness', 'Palpitations'],
      vitals: { bloodPressure: '138/88 mmHg', heartRate: '78 bpm', temperature: '98.4 °F', oxygenSaturation: '99%' },
      clinicalFindings: 'Bilateral lung clear, S1/S2 heard, no peripheral edema.',
      diagnosis: 'Stage 1 Essential Hypertension',
      treatment: 'Low-sodium diet (<2g/day), aerobic exercise, initiate ACE inhibitor.',
      prescriptions: [
        { id: 'RX-1', medicine: 'Lisinopril', dosage: '10mg', frequency: 'Once Daily', duration: '90 Days', instructions: 'Take in morning with water' },
        { id: 'RX-2', medicine: 'Amlodipine', dosage: '5mg', frequency: 'Once Daily', duration: '30 Days', instructions: 'Take at bedtime' }
      ],
      followUpDate: '2026-10-15'
    }
  ]);

  const [labReports, setLabReports] = useState<LabReport[]>([
    { id: 'LAB-501', testName: 'Comprehensive Metabolic Panel (CMP)', category: 'Biochemistry', date: '2026-06-10', laboratory: 'Apex Diagnostics Lab', result: 'Glucose: 94 mg/dL, BUN: 14 mg/dL, Creatinine: 0.9 mg/dL.', status: 'Normal', fileSize: '1.4 MB' },
    { id: 'LAB-502', testName: 'Lipid Profile (Full Serum)', category: 'Biochemistry', date: '2026-06-10', laboratory: 'Apex Diagnostics Lab', result: 'Total Cholesterol: 195 mg/dL, LDL: 118 mg/dL, HDL: 52 mg/dL.', status: 'Borderline', fileSize: '850 KB' }
  ]);

  const [vaccinations, setVaccinations] = useState<Vaccination[]>([
    { id: 'VAC-01', vaccineName: 'COVID-19 Bivalent mRNA Booster', batchNumber: 'MD-88190-X', dateAdministered: '2025-09-14', clinic: 'Apollo Health Immunization Center' },
    { id: 'VAC-02', vaccineName: 'Influenza Quadrivalent Vaccine (2025-2026)', batchNumber: 'FL-44021-Q', dateAdministered: '2025-10-02', clinic: 'Metro Community Clinic', nextDose: 'October 2026' }
  ]);

  const [documents, setDocuments] = useState<HealthDocument[]>([
    { id: 'DOC-01', title: 'Cardiology 12-Lead ECG Tracing Report.pdf', type: 'ECG / Cardiology', uploadedAt: '2026-06-12', size: '2.4 MB' },
    { id: 'DOC-02', title: 'Medical Health Insurance Policy Schedule.pdf', type: 'Insurance', uploadedAt: '2026-01-05', size: '4.2 MB' }
  ]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    { id: 'LOG-1', timestamp: '14:22:10', actor: 'Dr. Ananya Sharma', role: 'Doctor', action: 'Accessed Patient Record #PAT-1', severity: 'INFO' },
    { id: 'LOG-2', timestamp: '14:25:30', actor: 'Dr. Ananya Sharma', role: 'Doctor', action: 'Issued e-Prescription (Lisinopril 10mg)', severity: 'INFO' }
  ]);

  // LIVE API SYNC FUNCTION
  const refreshData = async () => {
    const token = localStorage.getItem('uhr_jwt_token');
    if (!token) return;

    try {
      // 1. Fetch live Patient Dashboard if patient role
      if (activeRole === 'patient') {
        const res = await fetch('http://localhost:5001/api/patient/dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.patient) {
            setProfile(prev => ({
              ...prev,
              fullName: data.patient.full_name || prev.fullName,
              dob: data.patient.date_of_birth ? data.patient.date_of_birth.split('T')[0] : prev.dob,
              gender: data.patient.gender || prev.gender,
              bloodGroup: data.patient.blood_group || prev.bloodGroup,
              phone: data.patient.phone || prev.phone,
              address: data.patient.address || prev.address,
              allergies: data.patient.allergies ? data.patient.allergies.split(', ') : prev.allergies
            }));
          }

          if (data.emergencyContact) {
            setProfile(prev => ({
              ...prev,
              emergencyContact: {
                name: data.emergencyContact.contact_name || prev.emergencyContact.name,
                relationship: data.emergencyContact.relationship || prev.emergencyContact.relationship,
                phone: data.emergencyContact.phone || prev.emergencyContact.phone,
                alternatePhone: prev.emergencyContact.alternatePhone
              }
            }));
          }

          if (data.appointments && data.appointments.length > 0) {
            setAppointments(data.appointments.map((a: any) => ({
              id: `APT-${a.id}`,
              patientId: String(a.patient_id),
              patientName: 'John Doe',
              doctorId: String(a.doctor_id),
              doctorName: a.doctor_name || 'Dr. Ananya Sharma',
              doctorSpecialty: a.specialization || 'General',
              time: a.appointment_time || '10:00 AM',
              date: a.appointment_date ? a.appointment_date.split('T')[0] : '2026-10-15',
              type: a.reason || 'Checkup',
              status: a.status || 'Confirmed'
            })));
          }

          if (data.records && data.records.length > 0) {
            setConsultations(data.records.map((r: any) => ({
              id: `ENC-${r.id}`,
              patientId: String(r.patient_id),
              patientName: 'John Doe',
              doctorId: String(r.doctor_id),
              doctorName: r.doctor_name || 'Dr. Ananya Sharma',
              date: r.record_date ? r.record_date.split('T')[0] : '2026-06-12',
              chiefComplaint: r.diagnosis || 'Clinical Encounter',
              symptoms: r.symptoms ? r.symptoms.split(',') : ['Review'],
              vitals: { bloodPressure: '130/84 mmHg', heartRate: '75 bpm', temperature: '98.6 °F', oxygenSaturation: '99%' },
              clinicalFindings: r.clinical_notes || 'All vitals documented within normal limits.',
              diagnosis: r.diagnosis || 'Unspecified Encounter',
              treatment: r.treatment_plan || 'Continue prescribed routine.',
              prescriptions: [],
              followUpDate: r.follow_up_date ? r.follow_up_date.split('T')[0] : 'As Advised'
            })));
          }

          if (data.labReports && data.labReports.length > 0) {
            setLabReports(data.labReports.map((l: any) => ({
              id: `LAB-${l.id}`,
              testName: l.test_name || 'Diagnostic Panel',
              category: l.category || 'Biochemistry',
              date: l.test_date ? l.test_date.split('T')[0] : '2026-06-10',
              laboratory: 'Apex Diagnostics Lab',
              result: l.result_summary || 'Normal physiological values.',
              status: l.status || 'Normal',
              fileSize: '1.2 MB'
            })));
          }
        }
      }

      // 2. Fetch Doctors Directory
      const docsRes = await fetch('http://localhost:5001/api/doctors');
      if (docsRes.ok) {
        const docList = await docsRes.json();
        if (docList.length > 0) {
          setDoctors(docList.map((d: any) => ({
            id: `DOC-${d.id}`,
            name: d.full_name,
            specialty: d.specialization,
            hospital: d.hospital_affiliation || 'Apollo Hospital',
            licenseNumber: `MCI-${d.id * 1892}`,
            status: 'Verified'
          })));
        }
      }
    } catch (err) {
      console.warn('Backend fetch failed, relying on context cache:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [activeRole, isAuthenticated]);

  const updateProfile = async (updated: Partial<PatientProfile>) => {
    setProfile(prev => ({ ...prev, ...updated }));
    const token = localStorage.getItem('uhr_jwt_token');
    if (token) {
      try {
        await fetch('http://localhost:5001/api/patient/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ phone: updated.phone, address: updated.address })
        });
      } catch (err) {
        console.error('Profile update failed:', err);
      }
    }
  };

  const addDocument = (doc: Omit<HealthDocument, 'id' | 'uploadedAt'>) => {
    const newDoc: HealthDocument = {
      ...doc,
      id: `DOC-${Date.now().toString().slice(-4)}`,
      uploadedAt: new Date().toISOString().split('T')[0]
    };
    setDocuments(prev => [newDoc, ...prev]);
  };

  const addConsultation = (rec: Omit<ConsultationRecord, 'id' | 'date'>) => {
    const newRecord: ConsultationRecord = {
      ...rec,
      id: `ENC-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0]
    };
    setConsultations(prev => [newRecord, ...prev]);
  };

  const bookAppointment = async (appt: Omit<Appointment, 'id' | 'status'>) => {
    const newAppt: Appointment = {
      ...appt,
      id: `APT-${Date.now().toString().slice(-4)}`,
      status: 'Confirmed'
    };
    setAppointments(prev => [newAppt, ...prev]);

    const token = localStorage.getItem('uhr_jwt_token');
    if (token) {
      try {
        await fetch('http://localhost:5001/api/appointments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            doctorId: 1,
            appointmentDate: appt.date,
            appointmentTime: appt.time,
            reason: appt.type
          })
        });
      } catch (err) {
        console.error('Booking sync failed:', err);
      }
    }
  };

  const cancelAppointment = async (id: string) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'Cancelled' } : a));
    const token = localStorage.getItem('uhr_jwt_token');
    const numericId = id.replace('APT-', '');
    if (token) {
      try {
        await fetch(`http://localhost:5001/api/appointments/${numericId}/cancel`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Cancel sync failed:', err);
      }
    }
  };

  const updateAppointmentStatus = (id: string, status: Appointment['status']) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'Completed' } : a));
  };

  const verifyDoctor = (id: string, status: DoctorUser['status']) => {};

  const logout = () => {
    localStorage.removeItem('uhr_jwt_token');
    localStorage.removeItem('uhr_user');
    setIsAuthenticated(false);
    setCurrentUser(null);
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

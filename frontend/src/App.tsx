import React from 'react';
import { HealthRecordProvider, useHealthRecord } from './context/HealthRecordContext';
import { VFXNavbar } from './components/VFXNavbar';
import { UniversalLoginPage } from './pages/UniversalLoginPage';
import { PatientPortalAdvanced } from './pages/patient/PatientPortalAdvanced';
import { DoctorPortalAdvanced } from './pages/doctor/DoctorPortalAdvanced';
import { AdminPortalAdvanced } from './pages/admin/AdminPortalAdvanced';
import { ClinicalAIChatbot } from './components/ClinicalAIChatbot';

const MainDispatcher: React.FC = () => {
  const { isAuthenticated, activeRole } = useHealthRecord();

  if (!isAuthenticated) {
    return <UniversalLoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative">
      <VFXNavbar />
      <div className="flex-1">
        {activeRole === 'patient' && <PatientPortalAdvanced />}
        {activeRole === 'doctor' && <DoctorPortalAdvanced />}
        {activeRole === 'admin' && <AdminPortalAdvanced />}
      </div>
      {/* Universal Floating Clinical AI Bot */}
      <ClinicalAIChatbot />
    </div>
  );
};

export default function App() {
  return (
    <HealthRecordProvider>
      <MainDispatcher />
    </HealthRecordProvider>
  );
}

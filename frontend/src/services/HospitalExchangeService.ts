export interface ExternalHospitalReport {
  accessionId: string;
  hospitalName: string;
  hospitalBranch: string;
  department: string;
  doctorName: string;
  patientName: string;
  patientUHR: string;
  testDate: string;
  diagnosis: string;
  summary: string;
  vitals: {
    bloodPressure: string;
    heartRate: string;
    spo2: string;
    bloodSugar: string;
  };
  metrics: { name: string; value: string; unit: string; flag: 'Normal' | 'High' | 'Low' }[];
  pdfName: string;
  pdfSize: string;
}

export const HOSPITAL_EXCHANGE_REGISTRY: Record<string, ExternalHospitalReport> = {
  'APOLLO-CARD-9942': {
    accessionId: 'APOLLO-CARD-9942',
    hospitalName: 'Apollo Hospitals',
    hospitalBranch: 'Bannerghatta Road, Bengaluru',
    department: 'Interventional Cardiology',
    doctorName: 'Dr. Ananya Sharma',
    patientName: 'John Doe',
    patientUHR: 'UHR-883902',
    testDate: '2026-09-28',
    diagnosis: 'Mild Sinus Bradycardia with Grade-1 LV Diastolic Dysfunction',
    summary: '2D Echocardiogram shows normal ejection fraction (62%). No regional wall motion abnormality. Resting ECG within standard limits.',
    vitals: {
      bloodPressure: '124/80 mmHg',
      heartRate: '58 bpm',
      spo2: '99%',
      bloodSugar: '92 mg/dL'
    },
    metrics: [
      { name: 'Ejection Fraction (EF)', value: '62', unit: '%', flag: 'Normal' },
      { name: 'Left Atrium Diameter', value: '38', unit: 'mm', flag: 'Normal' },
      { name: 'Serum Troponin-T', value: '<0.01', unit: 'ng/mL', flag: 'Normal' },
      { name: 'Aortic Root Dimension', value: '32', unit: 'mm', flag: 'Normal' }
    ],
    pdfName: 'Apollo_2D_Echo_Clinical_Evaluation_9942.pdf',
    pdfSize: '3.4 MB'
  },
  'MANIPAL-LAB-4401': {
    accessionId: 'MANIPAL-LAB-4401',
    hospitalName: 'Manipal Hospital',
    hospitalBranch: 'Old Airport Road, Bengaluru',
    department: 'Clinical Biochemistry & Pathology',
    doctorName: 'Dr. S. K. Nambiar',
    patientName: 'John Doe',
    patientUHR: 'UHR-883902',
    testDate: '2026-09-15',
    diagnosis: 'Pre-Diabetic Glycemic Index with Borderline Hypercholesterolemia',
    summary: 'Elevated Glycated Hemoglobin (HbA1c: 6.2%). Low-density lipoprotein slightly elevated. Liver enzymes within normal limits.',
    vitals: {
      bloodPressure: '130/84 mmHg',
      heartRate: '76 bpm',
      spo2: '98%',
      bloodSugar: '118 mg/dL'
    },
    metrics: [
      { name: 'Glycated Hemoglobin (HbA1c)', value: '6.2', unit: '%', flag: 'High' },
      { name: 'Total Serum Cholesterol', value: '208', unit: 'mg/dL', flag: 'High' },
      { name: 'Serum Creatinine', value: '0.88', unit: 'mg/dL', flag: 'Normal' },
      { name: 'Estimated GFR (eGFR)', value: '102', unit: 'mL/min/1.73m²', flag: 'Normal' }
    ],
    pdfName: 'Manipal_Automated_Biochemistry_Panel_4401.pdf',
    pdfSize: '1.8 MB'
  },
  'NARAYANA-PULM-7712': {
    accessionId: 'NARAYANA-PULM-7712',
    hospitalName: 'Narayana Health City',
    hospitalBranch: 'Bommasandra, Bengaluru',
    department: 'Pulmonary & Respiratory Medicine',
    doctorName: 'Dr. Vikram Malhotra',
    patientName: 'John Doe',
    patientUHR: 'UHR-883902',
    testDate: '2026-08-10',
    diagnosis: 'Post-Viral Bronchial Hyperreactivity',
    summary: 'High-Resolution Computed Tomography (HRCT) of thorax reveals clear parenchyma with no infiltrates.',
    vitals: {
      bloodPressure: '120/78 mmHg',
      heartRate: '72 bpm',
      spo2: '99%',
      bloodSugar: '88 mg/dL'
    },
    metrics: [
      { name: 'FEV1 / FVC Ratio', value: '84', unit: '%', flag: 'Normal' },
      { name: 'Peak Expiratory Flow Rate', value: '480', unit: 'L/min', flag: 'Normal' }
    ],
    pdfName: 'Narayana_HRCT_Thorax_Digital_Scan_7712.pdf',
    pdfSize: '8.2 MB'
  },
  'FORTIS-MR-2089': {
    accessionId: 'FORTIS-MR-2089',
    hospitalName: 'Fortis Hospital',
    hospitalBranch: 'Cunningham Road, Bengaluru',
    department: 'Orthopaedics & Sports Trauma',
    doctorName: 'Dr. Rajesh Patel',
    patientName: 'John Doe',
    patientUHR: 'UHR-883902',
    testDate: '2026-07-04',
    diagnosis: 'Subacute Rotator Cuff Tendinopathy',
    summary: 'Ultrasound shows focal supraspinatus tendon thickening without full-thickness tear.',
    vitals: {
      bloodPressure: '122/80 mmHg',
      heartRate: '70 bpm',
      spo2: '98%',
      bloodSugar: '95 mg/dL'
    },
    metrics: [
      { name: 'Supraspinatus Tendon Thickness', value: '7.1', unit: 'mm', flag: 'High' }
    ],
    pdfName: 'Fortis_Shoulder_USG_Trauma_2089.pdf',
    pdfSize: '4.1 MB'
  }
};

export const fetchHospitalReportById = async (accessionId: string): Promise<ExternalHospitalReport | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const cleanId = accessionId.trim().toUpperCase();
      const report = HOSPITAL_EXCHANGE_REGISTRY[cleanId];
      resolve(report || null);
    }, 600);
  });
};

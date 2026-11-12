USE unified_health_record;

INSERT INTO users (id, email, password_hash, role) VALUES
(1, 'admin@example.com', '$2a$10$wTfkQ7d82PqH6z6Hsp4jCO9aA0yO/V8UsqhVw9/eX9Q8lQe8k7C2G', 'admin'),
(2, 'dr.smith@example.com', '$2a$10$wTfkQ7d82PqH6z6Hsp4jCO9aA0yO/V8UsqhVw9/eX9Q8lQe8k7C2G', 'doctor'),
(3, 'dr.chen@example.com', '$2a$10$wTfkQ7d82PqH6z6Hsp4jCO9aA0yO/V8UsqhVw9/eX9Q8lQe8k7C2G', 'doctor'),
(4, 'patient@example.com', '$2a$10$wTfkQ7d82PqH6z6Hsp4jCO9aA0yO/V8UsqhVw9/eX9Q8lQe8k7C2G', 'patient'),
(5, 'sarah.connor@example.com', '$2a$10$wTfkQ7d82PqH6z6Hsp4jCO9aA0yO/V8UsqhVw9/eX9Q8lQe8k7C2G', 'patient');

INSERT INTO doctors (id, user_id, full_name, specialization, license_number, hospital_affiliation, phone, bio) VALUES
(1, 2, 'Dr. Robert Smith, MD', 'Cardiology', 'LIC-MED-77491', 'Metropolitan Health Center', '+1 555-019-2831', 'Cardiovascular specialist.'),
(2, 3, 'Dr. Emily Chen, MD', 'General Medicine', 'LIC-MED-88320', 'St. Jude Hospital', '+1 555-014-9922', 'Primary care physician.');

INSERT INTO patients (id, user_id, full_name, date_of_birth, gender, blood_group, phone, address, allergies, chronic_conditions) VALUES
(1, 4, 'John Doe', '1992-05-14', 'male', 'O+', '+1 555-492-8811', '742 Evergreen Terrace', 'Penicillin, Shellfish', 'Mild Asthma, Hypertension Stage 1'),
(2, 5, 'Sarah Connor', '1988-11-23', 'female', 'A+', '+1 555-381-0022', '124 Conch Street', 'Sulfa Drugs', 'None');

INSERT INTO emergency_contacts (patient_id, contact_name, relationship, phone_number) VALUES
(1, 'Mary Doe', 'Spouse', '+1 555-492-8812'),
(2, 'John Connor', 'Son', '+1 555-381-0023');

INSERT INTO appointments (id, patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES
(1, 1, 1, '2026-10-15', '10:30:00', 'Annual cardiovascular checkup', 'confirmed'),
(2, 1, 2, '2026-11-05', '14:00:00', 'Routine glucose follow-up', 'pending'),
(3, 2, 2, '2026-10-10', '09:00:00', 'Annual checkup', 'confirmed');

INSERT INTO medical_records (id, patient_id, doctor_id, appointment_id, record_date, diagnosis, symptoms, clinical_notes, treatment_plan, follow_up_date) VALUES
(1, 1, 1, 1, '2026-06-12', 'Essential Hypertension', 'Mild headaches, elevated BP (142/90)', 'Advised sodium restriction and 30 mins cardio daily.', 'Lisinopril 10mg once daily.', '2026-10-15');

INSERT INTO prescriptions (id, medical_record_id, patient_id, doctor_id, prescribed_date, status, instructions) VALUES
(1, 1, 1, 1, '2026-06-12', 'active', 'Take with water in the morning with food.');

INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, special_notes) VALUES
(1, 'Lisinopril', '10mg', 'Once Daily', '90 Days', 'Avoid potassium-rich supplements.');

INSERT INTO lab_reports (id, patient_id, doctor_id, test_name, test_type, test_date, laboratory_name, result_summary, document_url) VALUES
(1, 1, 1, 'Comprehensive Metabolic Panel (CMP)', 'Biochemistry', '2026-06-10', 'Apex Diagnostics Lab', 'Glucose: 94 mg/dL (Normal), BUN: 14 mg/dL. All normal.', '/uploads/cmp_sample.pdf');

INSERT INTO notifications (user_id, title, message) VALUES
(4, 'Appointment Confirmed', 'Your appointment with Dr. Robert Smith on Oct 15, 2026 is confirmed.');

INSERT INTO audit_logs (user_id, action, entity_affected, record_id) VALUES
(1, 'SYSTEM_INIT', 'system', 0);

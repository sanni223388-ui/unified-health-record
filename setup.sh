#!/bin/bash
set -e

echo "Creating full project file tree..."

mkdir -p database \
         backend/config \
         backend/controllers \
         backend/middleware \
         backend/uploads \
         frontend/src/context \
         frontend/src/types \
         frontend/src/pages/patient \
         frontend/src/pages/doctor \
         frontend/src/pages/admin

# ==========================================
# 1. DATABASE FILES
# ==========================================
cat << 'EOF' > database/schema.sql
CREATE DATABASE IF NOT EXISTS unified_health_record CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE unified_health_record;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS lab_reports;
DROP TABLE IF EXISTS prescription_items;
DROP TABLE IF EXISTS prescriptions;
DROP TABLE IF EXISTS medical_records;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS emergency_contacts;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('patient', 'doctor', 'admin') NOT NULL DEFAULT 'patient',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role)
) ENGINE=InnoDB;

CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('male', 'female', 'other') NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    allergies TEXT,
    chronic_conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_patient_name (full_name),
    INDEX idx_patient_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE emergency_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    contact_name VARCHAR(150) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    license_number VARCHAR(100) NOT NULL UNIQUE,
    hospital_affiliation VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_doc_specialization (specialization)
) ENGINE=InnoDB;

CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
    consultation_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    INDEX idx_appt_date (appointment_date),
    INDEX idx_appt_status (status)
) ENGINE=InnoDB;

CREATE TABLE medical_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_id INT NULL,
    record_date DATE NOT NULL,
    diagnosis VARCHAR(255) NOT NULL,
    symptoms TEXT NOT NULL,
    clinical_notes TEXT NOT NULL,
    treatment_plan TEXT NOT NULL,
    follow_up_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    INDEX idx_record_patient (patient_id),
    INDEX idx_record_date (record_date)
) ENGINE=InnoDB;

CREATE TABLE prescriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medical_record_id INT NULL,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    prescribed_date DATE NOT NULL,
    status ENUM('active', 'completed', 'discontinued') DEFAULT 'active',
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE SET NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE prescription_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prescription_id INT NOT NULL,
    medicine_name VARCHAR(150) NOT NULL,
    dosage VARCHAR(50) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    duration VARCHAR(50) NOT NULL,
    special_notes VARCHAR(255),
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE lab_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NULL,
    test_name VARCHAR(150) NOT NULL,
    test_type VARCHAR(100) NOT NULL,
    test_date DATE NOT NULL,
    laboratory_name VARCHAR(150) NOT NULL,
    result_summary TEXT NOT NULL,
    document_url VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_affected VARCHAR(100) NOT NULL,
    record_id INT NOT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
EOF

cat << 'EOF' > database/seed.sql
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
EOF

# ==========================================
# 2. BACKEND FILES
# ==========================================
cat << 'EOF' > backend/package.json
{
  "name": "uhr-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "mysql2": "^3.6.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
EOF

cat << 'EOF' > backend/.env.example
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=unified_health_record
DB_PORT=3306
JWT_SECRET=super_secret_health_security_key_2026
JWT_EXPIRES_IN=24h
CLIENT_URL=http://localhost:5173
EOF

cp backend/.env.example backend/.env

cat << 'EOF' > backend/config/db.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'unified_health_record',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
EOF

cat << 'EOF' > backend/middleware/auth.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_health_security_key_2026');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient privileges.' });
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRoles };
EOF

cat << 'EOF' > backend/controllers/authController.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  const { email, password, role, fullName, phone, dob, gender, bloodGroup, address, emergencyName, emergencyPhone, specialization, licenseNumber, hospitalAffiliation } = req.body;
  if (!email || !password || !role || !fullName) return res.status(400).json({ message: 'Missing fields.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'User already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const [userRes] = await conn.execute('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)', [email, passwordHash, role]);
    const userId = userRes.insertId;

    if (role === 'patient') {
      const [patRes] = await conn.execute(
        'INSERT INTO patients (user_id, full_name, date_of_birth, gender, blood_group, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, fullName, dob || '1990-01-01', gender || 'other', bloodGroup || 'O+', phone || '', address || '']
      );
      if (emergencyName && emergencyPhone) {
        await conn.execute('INSERT INTO emergency_contacts (patient_id, contact_name, relationship, phone_number) VALUES (?, ?, ?, ?)',
          [patRes.insertId, emergencyName, 'Family', emergencyPhone]);
      }
    } else if (role === 'doctor') {
      await conn.execute(
        'INSERT INTO doctors (user_id, full_name, specialization, license_number, hospital_affiliation, phone) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, fullName, specialization || 'General Medicine', licenseNumber || `LIC-${Date.now()}`, hospitalAffiliation || 'General Hospital', phone || '']
      );
    }
    await conn.commit();
    res.status(201).json({ message: 'Registration successful.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

    let profile = { id: user.id, email: user.email, role: user.role };
    if (user.role === 'patient') {
      const [p] = await pool.execute('SELECT * FROM patients WHERE user_id = ?', [user.id]);
      if (p.length) profile.patient = p[0];
    } else if (user.role === 'doctor') {
      const [d] = await pool.execute('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
      if (d.length) profile.doctor = d[0];
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, patientId: profile.patient?.id || null, doctorId: profile.doctor?.id || null, email: user.email },
      process.env.JWT_SECRET || 'super_secret_health_security_key_2026',
      { expiresIn: '24h' }
    );
    res.json({ token, user: profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json(req.user);
};
EOF

cat << 'EOF' > backend/controllers/patientController.js
const pool = require('../config/db');

exports.getDashboardSummary = async (req, res) => {
  const patientId = req.user.patientId;
  if (!patientId) return res.status(403).json({ message: 'No patient record found.' });

  try {
    const [patient] = await pool.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
    const [appointments] = await pool.execute(
      `SELECT a.*, d.full_name AS doctor_name, d.specialization 
       FROM appointments a JOIN doctors d ON a.doctor_id = d.id 
       WHERE a.patient_id = ? AND a.appointment_date >= CURDATE() AND a.status != 'cancelled'
       ORDER BY a.appointment_date ASC LIMIT 3`, [patientId]);
    const [recentRecords] = await pool.execute(
      `SELECT mr.*, d.full_name as doctor_name 
       FROM medical_records mr JOIN doctors d ON mr.doctor_id = d.id 
       WHERE mr.patient_id = ? ORDER BY mr.record_date DESC LIMIT 3`, [patientId]);
    const [activePrescriptions] = await pool.execute(
      `SELECT p.*, d.full_name as doctor_name 
       FROM prescriptions p JOIN doctors d ON p.doctor_id = d.id 
       WHERE p.patient_id = ? AND p.status = 'active'`, [patientId]);

    res.json({
      patient: patient[0],
      upcomingAppointments: appointments,
      recentRecords,
      activePrescriptions
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
EOF

cat << 'EOF' > backend/controllers/appointmentController.js
const pool = require('../config/db');

exports.bookAppointment = async (req, res) => {
  const patientId = req.user.patientId;
  const { doctorId, appointmentDate, appointmentTime, reason } = req.body;
  try {
    const [result] = await pool.execute(
      'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, "confirmed")',
      [patientId, doctorId, appointmentDate, appointmentTime, reason]
    );
    res.status(201).json({ message: 'Appointment booked.', appointmentId: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAppointments = async (req, res) => {
  const { role, patientId, doctorId } = req.user;
  try {
    let query = '';
    let params = [];
    if (role === 'patient') {
      query = `SELECT a.*, d.full_name as doctor_name, d.specialization FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.patient_id = ? ORDER BY a.appointment_date DESC`;
      params = [patientId];
    } else if (role === 'doctor') {
      query = `SELECT a.*, p.full_name as patient_name FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE a.doctor_id = ? ORDER BY a.appointment_date DESC`;
      params = [doctorId];
    } else {
      query = `SELECT a.*, p.full_name as patient_name, d.full_name as doctor_name FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN doctors d ON a.doctor_id = d.id ORDER BY a.appointment_date DESC`;
    }
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
EOF

cat << 'EOF' > backend/controllers/recordController.js
const pool = require('../config/db');

exports.getRecords = async (req, res) => {
  const { role, patientId } = req.user;
  const targetId = role === 'patient' ? patientId : req.query.patientId;
  try {
    const [records] = await pool.execute(
      `SELECT mr.*, d.full_name as doctor_name, d.specialization 
       FROM medical_records mr JOIN doctors d ON mr.doctor_id = d.id 
       WHERE mr.patient_id = ? ORDER BY mr.record_date DESC`, [targetId]);
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createRecord = async (req, res) => {
  const doctorId = req.user.doctorId;
  const { patientId, diagnosis, symptoms, clinicalNotes, treatmentPlan, followUpDate, prescriptionItems, prescriptionInstructions } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rec] = await conn.execute(
      'INSERT INTO medical_records (patient_id, doctor_id, record_date, diagnosis, symptoms, clinical_notes, treatment_plan, follow_up_date) VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?)',
      [patientId, doctorId, diagnosis, symptoms || '', clinicalNotes, treatmentPlan || '', followUpDate || null]
    );

    if (prescriptionItems && prescriptionItems.length > 0) {
      const [pRes] = await conn.execute(
        'INSERT INTO prescriptions (medical_record_id, patient_id, doctor_id, prescribed_date, status, instructions) VALUES (?, ?, ?, CURDATE(), "active", ?)',
        [rec.insertId, patientId, doctorId, prescriptionInstructions || '']
      );
      for (const item of prescriptionItems) {
        await conn.execute(
          'INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, special_notes) VALUES (?, ?, ?, ?, ?, ?)',
          [pRes.insertId, item.name, item.dosage, item.frequency, item.duration, item.notes || '']
        );
      }
    }
    await conn.commit();
    res.status(201).json({ message: 'Record saved successfully.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};
EOF

cat << 'EOF' > backend/controllers/adminController.js
const pool = require('../config/db');

exports.getStats = async (req, res) => {
  try {
    const [[{ totalPatients }]] = await pool.execute('SELECT COUNT(*) as totalPatients FROM patients');
    const [[{ totalDoctors }]] = await pool.execute('SELECT COUNT(*) as totalDoctors FROM doctors');
    const [[{ totalRecords }]] = await pool.execute('SELECT COUNT(*) as totalRecords FROM medical_records');
    const [[{ activeUsers }]] = await pool.execute('SELECT COUNT(*) as activeUsers FROM users WHERE is_active = TRUE');
    const [recentAudit] = await pool.execute('SELECT a.*, u.email FROM audit_logs a JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 8');

    res.json({
      stats: { totalPatients, totalDoctors, totalRecords, activeUsers },
      recentAudit
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
EOF

cat << 'EOF' > backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const { verifyToken, authorizeRoles } = require('./middleware/auth');
const auth = require('./controllers/authController');
const patient = require('./controllers/patientController');
const appointment = require('./controllers/appointmentController');
const record = require('./controllers/recordController');
const admin = require('./controllers/adminController');
const pool = require('./config/db');

app.get('/api/health', (req, res) => res.json({ status: 'ok', sdg: 'SDG 3: Good Health and Well-Being' }));

app.post('/api/auth/register', auth.register);
app.post('/api/auth/login', auth.login);
app.get('/api/auth/me', verifyToken, auth.getMe);

app.get('/api/patient/dashboard', verifyToken, authorizeRoles('patient'), patient.getDashboardSummary);
app.post('/api/appointments', verifyToken, authorizeRoles('patient'), appointment.bookAppointment);
app.get('/api/appointments', verifyToken, appointment.getAppointments);
app.get('/api/records', verifyToken, record.getRecords);
app.post('/api/records', verifyToken, authorizeRoles('doctor'), record.createRecord);

app.get('/api/doctors', async (req, res) => {
  const [docs] = await pool.execute('SELECT id, full_name, specialization, hospital_affiliation FROM doctors');
  res.json(docs);
});

app.get('/api/prescriptions', verifyToken, async (req, res) => {
  const targetId = req.user.role === 'patient' ? req.user.patientId : req.query.patientId;
  const [rows] = await pool.execute('SELECT p.*, d.full_name as doctor_name FROM prescriptions p JOIN doctors d ON p.doctor_id = d.id WHERE p.patient_id = ?', [targetId]);
  for (let p of rows) {
    const [items] = await pool.execute('SELECT * FROM prescription_items WHERE prescription_id = ?', [p.id]);
    p.items = items;
  }
  res.json(rows);
});

app.get('/api/admin/stats', verifyToken, authorizeRoles('admin'), admin.getStats);

app.listen(PORT, () => console.log(`Backend server running at http://localhost:${PORT}`));
EOF

# ==========================================
# 3. FRONTEND FILES
# ==========================================
cat << 'EOF' > frontend/package.json
{
  "name": "uhr-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  },
  "dependencies": {
    "clsx": "^2.1.0",
    "lucide-react": "^0.344.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.64",
    "@types/react-dom": "^18.2.21",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.4"
  }
}
EOF

cat << 'EOF' > frontend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
EOF

cat << 'EOF' > frontend/tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
EOF

cat << 'EOF' > frontend/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

cat << 'EOF' > frontend/index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Unified Health Record System | SDG 3 Platform</title>
  </head>
  <body class="bg-slate-50 text-slate-900 font-sans">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

cat << 'EOF' > frontend/src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

cat << 'EOF' > frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
EOF

cat << 'EOF' > frontend/src/types/index.ts
export interface User {
  id: number;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  patient?: any;
  doctor?: any;
}
EOF

cat << 'EOF' > frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('uhr_token'));

  useEffect(() => {
    const saved = localStorage.getItem('uhr_user');
    if (token && saved) setUser(JSON.parse(saved));
  }, [token]);

  const login = (tok: string, usr: User) => {
    localStorage.setItem('uhr_token', tok);
    localStorage.setItem('uhr_user', JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
};
EOF

cat << 'EOF' > frontend/src/pages/LandingPage.tsx
import React from 'react';
import { Activity, ShieldCheck, Heart, Users, FileText, ArrowRight } from 'lucide-react';

export const LandingPage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white/90 backdrop-blur-md sticky top-0 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center text-white"><Activity className="w-6 h-6"/></div>
          <span className="text-xl font-bold">Health<span className="text-cyan-600">Unified</span></span>
        </div>
        <div className="space-x-3">
          <button onClick={() => onNavigate('login')} className="px-4 py-2 text-sm font-semibold text-slate-700">Sign In</button>
          <button onClick={() => onNavigate('register')} className="px-4 py-2 text-sm font-semibold bg-cyan-600 text-white rounded-lg">Get Started</button>
        </div>
      </nav>

      <section className="py-20 text-center max-w-4xl mx-auto px-4">
        <span className="bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold px-3 py-1 rounded-full">UN SDG 3: Good Health and Well-Being</span>
        <h1 className="text-5xl font-extrabold text-slate-900 mt-6 leading-tight">Your Health Records.<br/><span className="text-cyan-600">Unified. Secure. Accessible.</span></h1>
        <p className="text-slate-600 mt-4 text-base max-w-2xl mx-auto">Eliminate fragmented paper files, avoid repeated tests, and give doctors continuous clinical history on one verified portal.</p>
        <div className="mt-8 flex justify-center gap-4">
          <button onClick={() => onNavigate('register')} className="px-6 py-3 bg-cyan-600 text-white font-semibold rounded-xl flex items-center space-x-2"><span>Create Patient Account</span><ArrowRight className="w-4 h-4"/></button>
          <button onClick={() => onNavigate('login')} className="px-6 py-3 bg-white border border-slate-300 font-semibold rounded-xl">Demo Credentials</button>
        </div>
      </section>

      <section className="bg-teal-700 text-white py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="text-2xl font-bold flex items-center space-x-2"><Heart className="text-rose-300 w-6 h-6"/><span>SDG 3 Impact Architecture</span></h3>
            <p className="text-teal-100 text-sm mt-2 max-w-xl">Enables universal access to digital healthcare records, prevents prescription overlaps, and delivers critical allergy histories during emergencies.</p>
          </div>
          <div className="bg-white/10 p-4 rounded-xl text-xs space-y-1">
            <div>✓ Continuous patient electronic health records</div>
            <div>✓ Safe, traceable e-prescriptions</div>
            <div>✓ Rapid diagnostic laboratory data accessibility</div>
          </div>
        </div>
      </section>
    </div>
  );
};
EOF

cat << 'EOF' > frontend/src/pages/Login.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, AlertCircle } from 'lucide-react';

export const Login: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      login(data.token, data.user);
      if (data.user.role === 'patient') onNavigate('patient-dashboard');
      else if (data.user.role === 'doctor') onNavigate('doctor-dashboard');
      else onNavigate('admin-dashboard');
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const setDemo = (eMail: string) => {
    setEmail(eMail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-6">Portal Sign In</h2>
        {err && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg mb-4">{err}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full border p-2.5 rounded-lg text-sm" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required/>
          <input className="w-full border p-2.5 rounded-lg text-sm" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required/>
          <button className="w-full py-2.5 bg-cyan-600 text-white rounded-lg font-semibold text-sm">Sign In</button>
        </form>
        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-xs text-slate-500 mb-2">Demo Logins (Password: Password123!)</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button onClick={() => setDemo('patient@example.com')} className="p-1.5 bg-slate-100 rounded">Patient</button>
            <button onClick={() => setDemo('dr.smith@example.com')} className="p-1.5 bg-slate-100 rounded">Doctor</button>
            <button onClick={() => setDemo('admin@example.com')} className="p-1.5 bg-slate-100 rounded">Admin</button>
          </div>
        </div>
      </div>
    </div>
  );
};
EOF

cat << 'EOF' > frontend/src/pages/Register.tsx
import React, { useState } from 'react';

export const Register: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, fullName, email, password })
    });
    if (res.ok) {
      setMsg('Account created! Redirecting to login...');
      setTimeout(() => onNavigate('login'), 1200);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Register Account</h2>
        {msg && <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded mb-4">{msg}</div>}
        <div className="flex bg-slate-100 p-1 rounded-lg mb-4 text-xs font-semibold">
          <button type="button" onClick={() => setRole('patient')} className={`flex-1 py-1.5 rounded ${role==='patient'?'bg-white shadow':''}`}>Patient</button>
          <button type="button" onClick={() => setRole('doctor')} className={`flex-1 py-1.5 rounded ${role==='doctor'?'bg-white shadow':''}`}>Doctor</button>
        </div>
        <form onSubmit={handleRegister} className="space-y-3 text-sm">
          <input className="w-full border p-2.5 rounded-lg" placeholder="Full Name" value={fullName} onChange={e=>setFullName(e.target.value)} required/>
          <input className="w-full border p-2.5 rounded-lg" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>
          <input className="w-full border p-2.5 rounded-lg" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/>
          <button className="w-full py-2.5 bg-cyan-600 text-white rounded-lg font-semibold">Create Account</button>
        </form>
        <button onClick={() => onNavigate('login')} className="mt-4 text-xs text-cyan-600 block text-center w-full">Back to Login</button>
      </div>
    </div>
  );
};
EOF

cat << 'EOF' > frontend/src/pages/patient/PatientDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Heart, Activity, Plus } from 'lucide-react';

export const PatientDashboard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { token, logout } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/patient/dashboard', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => res.json()).then(setData);
  }, []);

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Good morning, {data?.patient?.full_name || 'Patient'}</h1>
          <p className="text-xs text-slate-500">Unified Medical Record ID: #{data?.patient?.id || '1'}</p>
        </div>
        <div className="space-x-3">
          <button onClick={() => onNavigate('book-appointment')} className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold">+ Book Visit</button>
          <button onClick={logout} className="px-3 py-2 text-rose-600 text-sm font-semibold">Sign Out</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-5 bg-white border rounded-xl"><span className="text-xs text-slate-400">Blood Group</span><div className="text-2xl font-bold">{data?.patient?.blood_group || 'O+'}</div></div>
        <div className="p-5 bg-white border rounded-xl"><span className="text-xs text-slate-400">Allergies</span><div className="text-sm font-bold text-amber-600">{data?.patient?.allergies || 'None logged'}</div></div>
        <div className="p-5 bg-white border rounded-xl"><span className="text-xs text-slate-400">Active Prescriptions</span><div className="text-2xl font-bold text-teal-600">{data?.activePrescriptions?.length || 0}</div></div>
      </div>

      <div className="bg-white border rounded-xl p-6">
        <h3 className="font-bold text-base mb-4">Medical Record History</h3>
        <div className="space-y-3 text-sm">
          {data?.recentRecords?.map((r: any) => (
            <div key={r.id} className="p-3 bg-slate-50 rounded-lg">
              <div className="font-semibold">{r.diagnosis} - <span className="text-slate-500 text-xs">{r.record_date}</span></div>
              <p className="text-xs text-slate-600 mt-1">{r.clinical_notes}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
EOF

cat << 'EOF' > frontend/src/pages/patient/BookAppointment.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export const BookAppointment: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetch('http://localhost:5000/api/doctors').then(r => r.json()).then(d => {
      setDoctors(d);
      if (d.length) setDoctorId(d[0].id.toString());
    });
  }, []);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('http://localhost:5000/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ doctorId, appointmentDate, appointmentTime, reason })
    });
    onNavigate('patient-dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white border p-6 rounded-xl max-w-md w-full">
        <h2 className="text-lg font-bold mb-4">Book Appointment</h2>
        <form onSubmit={handleBook} className="space-y-3 text-sm">
          <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className="w-full border p-2 rounded">
            {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.specialization})</option>)}
          </select>
          <input type="date" value={appointmentDate} onChange={e=>setAppointmentDate(e.target.value)} required className="w-full border p-2 rounded"/>
          <input type="time" value={appointmentTime} onChange={e=>setAppointmentTime(e.target.value)} required className="w-full border p-2 rounded"/>
          <textarea placeholder="Reason" value={reason} onChange={e=>setReason(e.target.value)} required className="w-full border p-2 rounded"/>
          <button className="w-full py-2 bg-cyan-600 text-white rounded font-semibold">Confirm Booking</button>
        </form>
      </div>
    </div>
  );
};
EOF

cat << 'EOF' > frontend/src/pages/doctor/DoctorDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const DoctorDashboard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { token, logout } = useAuth();
  const [appts, setAppts] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/appointments', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(setAppts);
  }, []);

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Physician Consultation Ledger</h1>
        <button onClick={logout} className="text-rose-600 font-semibold text-sm">Sign Out</button>
      </div>
      <div className="bg-white border rounded-xl p-6">
        <h3 className="font-bold text-sm mb-4">Assigned Consultations</h3>
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b"><th className="pb-2">Patient</th><th className="pb-2">Date</th><th className="pb-2">Reason</th></tr></thead>
          <tbody className="divide-y">
            {appts.map(a => (
              <tr key={a.id}><td className="py-2.5 font-bold">{a.patient_name}</td><td>{a.appointment_date}</td><td>{a.reason}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
EOF

cat << 'EOF' > frontend/src/pages/admin/AdminDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const AdminDashboard: React.FC<{ onNavigate: (page: string) => void }> = () => {
  const { token, logout } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(setData);
  }, []);

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">System Administration (SDG 3 Governance)</h1>
        <button onClick={logout} className="text-rose-600 font-semibold text-sm">Sign Out</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white border rounded-xl"><span className="text-xs text-slate-400">Total Patients</span><div className="text-2xl font-bold">{data?.stats?.totalPatients || 0}</div></div>
        <div className="p-4 bg-white border rounded-xl"><span className="text-xs text-slate-400">Total Doctors</span><div className="text-2xl font-bold text-teal-600">{data?.stats?.totalDoctors || 0}</div></div>
        <div className="p-4 bg-white border rounded-xl"><span className="text-xs text-slate-400">Medical Encounters</span><div className="text-2xl font-bold text-cyan-600">{data?.stats?.totalRecords || 0}</div></div>
      </div>
    </div>
  );
};
EOF

cat << 'EOF' > frontend/src/App.tsx
import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { PatientDashboard } from './pages/patient/PatientDashboard';
import { BookAppointment } from './pages/patient/BookAppointment';
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';

const MainNavigator: React.FC = () => {
  const [page, setPage] = useState('home');
  if (page === 'login') return <Login onNavigate={setPage}/>;
  if (page === 'register') return <Register onNavigate={setPage}/>;
  if (page === 'patient-dashboard') return <PatientDashboard onNavigate={setPage}/>;
  if (page === 'book-appointment') return <BookAppointment onNavigate={setPage}/>;
  if (page === 'doctor-dashboard') return <DoctorDashboard onNavigate={setPage}/>;
  if (page === 'admin-dashboard') return <AdminDashboard onNavigate={setPage}/>;
  return <LandingPage onNavigate={setPage}/>;
};

export default function App() {
  return <AuthProvider><MainNavigator/></AuthProvider>;
}
EOF

echo "All files successfully created."

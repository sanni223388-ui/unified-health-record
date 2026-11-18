const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('./config/db');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_health_mesh_key_2026';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// --- MIDDLEWARE ---
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing token.' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ message: 'Expired or invalid token.' });
  }
};

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) return res.status(403).json({ message: 'Access Denied.' });
  next();
};

const logAudit = async (userId, action, entity, recordId) => {
  try {
    await pool.execute('INSERT INTO audit_logs (user_id, action, entity_affected, record_id) VALUES (?, ?, ?, ?)', [userId, action, entity, recordId]);
  } catch (e) {}
};

function generateUHRId() {
  return 'UHR-' + new Date().getFullYear() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// --- HEALTH & SYSTEM STATUS ---
app.get('/api/health', async (req, res) => {
  try {
    const [[{ adminCount }]] = await pool.query(`SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'`);
    res.json({ status: 'ok', hasAdmin: adminCount > 0 });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// --- AUTHENTICATION (NO 2FA) ---
app.post('/api/auth/register', async (req, res) => {
  const { email, password, accountType, fullName, dob, gender, bloodGroup, phone, address, allergies } = req.body;
  if (!email || !password || password.length < 6) return res.status(400).json({ message: 'Email and valid password (min 6 chars) required.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'Email already registered.' });
    }

    let roleToCreate = 'patient';
    if (accountType === 'admin') {
      const [[{ adminCount }]] = await conn.execute(`SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'`);
      if (adminCount > 0) {
        await conn.rollback();
        return res.status(403).json({ message: 'Only ONE Hospital Admin is allowed globally.' });
      }
      roleToCreate = 'admin';
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userRes] = await conn.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, TRUE)',
      [email.trim().toLowerCase(), passwordHash, roleToCreate]
    );
    const userId = userRes.insertId;

    if (roleToCreate === 'patient') {
      const uhrId = generateUHRId();
      await conn.execute(
        `INSERT INTO patients (user_id, uhr_id, full_name, date_of_birth, gender, blood_group, phone, address, allergies, consent_pin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '0000')`,
        [userId, uhrId, fullName, dob || '2000-01-01', gender || 'other', bloodGroup || 'O+', phone || '', address || '', allergies || '']
      );
    }

    await conn.commit();
    await logAudit(userId, `REGISTER_${roleToCreate.toUpperCase()}`, 'users', userId);
    res.status(201).json({ message: 'Account created successfully! You can now sign in.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, expectedRole } = req.body;
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [cleanEmail]);
    if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials.' });

    const user = users[0];
    if (expectedRole && user.role !== expectedRole) return res.status(403).json({ message: `Account is registered as ${user.role}.` });
    
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

    let profile = { id: user.id, email: user.email, role: user.role, name: user.email };
    if (user.role === 'patient') {
      const [patients] = await pool.execute('SELECT * FROM patients WHERE user_id = ?', [user.id]);
      if (patients.length) {
        profile.patient = patients[0];
        profile.name = patients[0].full_name;
      }
    } else if (user.role === 'doctor') {
      const [doctors] = await pool.execute('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
      if (doctors.length) {
        profile.doctor = doctors[0];
        profile.name = doctors[0].full_name;
      }
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, patientId: profile.patient?.id, doctorId: profile.doctor?.id, email: user.email },
      JWT_SECRET, { expiresIn: '24h' }
    );
    
    await logAudit(user.id, 'LOGIN_SUCCESS', 'users', user.id);
    res.json({ token, user: profile, message: 'Login successful' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- PATIENT ROUTES ---
app.get('/api/patient/dashboard', verifyToken, authorize('patient'), async (req, res) => {
  const patientId = req.user.patientId;
  try {
    const [patients] = await pool.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
    const [appointments] = await pool.execute('SELECT a.*, d.full_name AS doctor_name, d.specialization FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.patient_id = ? ORDER BY a.appointment_date DESC', [patientId]);
    const [records] = await pool.execute('SELECT mr.*, d.full_name AS doctor_name FROM medical_records mr JOIN doctors d ON mr.doctor_id = d.id WHERE mr.patient_id = ? ORDER BY mr.record_date DESC', [patientId]);
    const [labReports] = await pool.execute('SELECT * FROM lab_reports WHERE patient_id = ? ORDER BY test_date DESC', [patientId]);
    res.json({ patient: patients[0], appointments, records, labReports });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/patient/profile', verifyToken, authorize('patient'), async (req, res) => {
  const { phone, address, allergies } = req.body;
  try {
    await pool.execute('UPDATE patients SET phone = ?, address = ?, allergies = ? WHERE id = ?', [phone, address, allergies, req.user.patientId]);
    res.json({ message: 'Personal details updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/patient/reports', verifyToken, authorize('patient'), async (req, res) => {
  const { testName, laboratoryName, resultSummary } = req.body;
  try {
    await pool.execute(
      `INSERT INTO lab_reports (patient_id, test_name, test_type, test_date, laboratory_name, result_summary, document_url) VALUES (?, ?, 'Patient Upload', CURDATE(), ?, ?, 'user-uploaded')`,
      [req.user.patientId, testName, laboratoryName, resultSummary]
    );
    res.json({ message: 'Report added successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/appointments', verifyToken, authorize('patient'), async (req, res) => {
  const { doctorId, appointmentDate, appointmentTime, reason } = req.body;
  try {
    await pool.execute(`INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, 'confirmed')`, [req.user.patientId, doctorId, appointmentDate, appointmentTime, reason]);
    res.json({ message: 'Appointment confirmed.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- DOCTOR ROUTES (PRIVACY ENFORCED) ---
app.get('/api/doctor/dashboard', verifyToken, authorize('doctor'), async (req, res) => {
  try {
    const [appointments] = await pool.execute(
      `SELECT a.*, p.full_name AS patient_name, p.uhr_id FROM appointments a JOIN patients p ON a.patient_id = p.id WHERE a.doctor_id = ? ORDER BY a.appointment_date DESC`,
      [req.user.doctorId]
    );
    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/doctor/patient/:uhr_id', verifyToken, authorize('doctor'), async (req, res) => {
  try {
    const [patients] = await pool.execute('SELECT * FROM patients WHERE uhr_id = ?', [req.params.uhr_id]);
    if (patients.length === 0) return res.status(404).json({ message: 'Patient not found.' });
    
    const [access] = await pool.execute('SELECT id FROM appointments WHERE patient_id = ? AND doctor_id = ? LIMIT 1', [patients[0].id, req.user.doctorId]);
    if (access.length === 0) return res.status(403).json({ message: 'Access Denied: You cannot view this patient without an active appointment/consent.' });

    const [records] = await pool.execute('SELECT * FROM medical_records WHERE patient_id = ? ORDER BY record_date DESC', [patients[0].id]);
    res.json({ patient: patients[0], records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/doctor/consultation', verifyToken, authorize('doctor'), async (req, res) => {
  const { patientId, diagnosis, treatmentPlan } = req.body;
  try {
    await pool.execute(`INSERT INTO medical_records (patient_id, doctor_id, record_date, diagnosis, symptoms, clinical_notes, treatment_plan) VALUES (?, ?, CURDATE(), ?, '', '', ?)`, [patientId, req.user.doctorId, diagnosis, treatmentPlan]);
    res.json({ message: 'Medical record added securely.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- ADMIN ROUTES ---
app.get('/api/doctors', async (req, res) => {
  try {
    const [docs] = await pool.execute('SELECT d.*, u.email, u.is_active FROM doctors d JOIN users u ON d.user_id = u.id WHERE u.is_active = TRUE');
    res.json(docs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/admin/doctors', verifyToken, authorize('admin'), async (req, res) => {
  const { fullName, email, password, specialization, licenseNumber } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const passHash = await bcrypt.hash(password, 10);
    const [u] = await conn.execute(`INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'doctor')`, [email, passHash]);
    await conn.execute(`INSERT INTO doctors (user_id, full_name, specialization, license_number, hospital_affiliation, phone) VALUES (?, ?, ?, ?, 'UHR Hospital', '')`, [u.insertId, fullName, specialization, licenseNumber]);
    await conn.commit();
    res.json({ message: 'Real Doctor added successfully.' });
  } catch (err) { await conn.rollback(); res.status(500).json({ message: err.message }); } finally { conn.release(); }
});

app.delete('/api/admin/doctors/:id', verifyToken, authorize('admin'), async (req, res) => {
  try {
    const [doc] = await pool.execute('SELECT user_id FROM doctors WHERE id = ?', [req.params.id]);
    if(doc.length > 0) {
       await pool.execute('DELETE FROM users WHERE id = ?', [doc[0].user_id]);
       res.json({ message: 'Doctor removed from network.' });
    } else {
       res.status(404).json({ message: 'Doctor not found.' });
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- AURA MEDICAL AI CHATBOT ROUTE ---
app.post('/api/chat', verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.json({ reply: 'Aura AI is currently offline. Missing API Key.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `You are Aura Clinical AI, a professional medical assistant for the Unified Health Record (UHR) system. 
    Answer the following medical query safely, accurately, and concisely. 
    Use plain text. DO NOT use markdown formatting like asterisks (**). 
    Always add a brief, polite disclaimer advising them to consult their registered doctor for an official diagnosis.
    
    User Query: ${message}`;
    
    const result = await model.generateContent(prompt);
    const replyText = result.response.text().replace(/\*/g, ''); 
    
    res.json({ reply: replyText });
  } catch (err) {
    console.error("Aura AI Error:", err);
    res.status(500).json({ reply: 'Aura AI connection error. Please try again later.' });
  }
});

// --- AUTO MIGRATE DB SCHEMA ---
(async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(191) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role ENUM('patient', 'doctor', 'admin') NOT NULL, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
    await pool.query(`CREATE TABLE IF NOT EXISTS patients (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL UNIQUE, uhr_id VARCHAR(50) UNIQUE, full_name VARCHAR(150), date_of_birth DATE, gender VARCHAR(20), blood_group VARCHAR(10), phone VARCHAR(20), address TEXT, allergies TEXT, consent_pin VARCHAR(4), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB`);
    try { await pool.query('ALTER TABLE patients ADD COLUMN uhr_id VARCHAR(50) UNIQUE'); } catch(e){}
    console.log('✅ Streamlined Production schema ready.');
  } catch (err) { console.error('DB init error:', err.message); }
})();

app.listen(PORT, () => console.log(`API running at port ${PORT}`));

const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./config/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_health_mesh_key_2026';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- AUTH & RBAC MIDDLEWARE ---
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Missing or malformed authentication token.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Forbidden: Expired or invalid token.' });
  }
};

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: `Forbidden: Requires [${allowedRoles.join(', ')}] role.` });
  }
  next();
};

const logAudit = async (userId, action, entity, recordId) => {
  try {
    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, entity_affected, record_id) VALUES (?, ?, ?, ?)',
      [userId || 1, action, entity, recordId || 0]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

// --- AUTHENTICATION ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials.' });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

    let profile = { id: user.id, email: user.email, role: user.role };

    if (user.role === 'patient') {
      const [patients] = await pool.execute('SELECT * FROM patients WHERE user_id = ?', [user.id]);
      if (patients.length) profile.patient = patients[0];
    } else if (user.role === 'doctor') {
      const [doctors] = await pool.execute('SELECT * FROM doctors WHERE user_id = ?', [user.id]);
      if (doctors.length) profile.doctor = doctors[0];
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        patientId: profile.patient?.id || null,
        doctorId: profile.doctor?.id || null,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAudit(user.id, 'AUTHENTICATE_LOGIN', 'users', user.id);
    res.json({ token, user: profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- PATIENT ROUTES ---
app.get('/api/patient/dashboard', verifyToken, authorize('patient'), async (req, res) => {
  const patientId = req.user.patientId;
  try {
    const [patients] = await pool.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
    const [appointments] = await pool.execute(
      `SELECT a.*, d.full_name AS doctor_name, d.specialization 
       FROM appointments a JOIN doctors d ON a.doctor_id = d.id 
       WHERE a.patient_id = ? ORDER BY a.appointment_date DESC`,
      [patientId]
    );
    const [records] = await pool.execute(
      `SELECT mr.*, d.full_name as doctor_name 
       FROM medical_records mr JOIN doctors d ON mr.doctor_id = d.id 
       WHERE mr.patient_id = ? ORDER BY mr.record_date DESC`,
      [patientId]
    );
    const [prescriptions] = await pool.execute(
      `SELECT p.*, d.full_name as doctor_name 
       FROM prescriptions p JOIN doctors d ON p.doctor_id = d.id 
       WHERE p.patient_id = ? ORDER BY p.prescribed_date DESC`,
      [patientId]
    );

    for (let p of prescriptions) {
      const [items] = await pool.execute('SELECT * FROM prescription_items WHERE prescription_id = ?', [p.id]);
      p.items = items;
    }

    const [labReports] = await pool.execute('SELECT * FROM lab_reports WHERE patient_id = ? ORDER BY test_date DESC', [patientId]);
    const [emergency] = await pool.execute('SELECT * FROM emergency_contacts WHERE patient_id = ?', [patientId]);

    res.json({
      patient: patients[0],
      emergencyContact: emergency[0] || null,
      appointments,
      records,
      prescriptions,
      labReports
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/patient/profile', verifyToken, authorize('patient'), async (req, res) => {
  const patientId = req.user.patientId;
  const { phone, address } = req.body;
  try {
    await pool.execute('UPDATE patients SET phone = ?, address = ? WHERE id = ?', [phone, address, patientId]);
    await logAudit(req.user.id, 'UPDATE_PROFILE', 'patients', patientId);
    res.json({ message: 'Profile updated securely.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- APPOINTMENTS (PATIENT & DOCTOR) ---
app.post('/api/appointments', verifyToken, authorize('patient'), async (req, res) => {
  const { doctorId, appointmentDate, appointmentTime, reason } = req.body;
  try {
    const [result] = await pool.execute(
      'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, "Confirmed")',
      [req.user.patientId, doctorId, appointmentDate, appointmentTime, reason]
    );
    await logAudit(req.user.id, 'BOOK_APPOINTMENT', 'appointments', result.insertId);
    res.status(201).json({ message: 'Appointment booked.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/appointments/:id/cancel', verifyToken, async (req, res) => {
  try {
    await pool.execute('UPDATE appointments SET status = "Cancelled" WHERE id = ?', [req.params.id]);
    await logAudit(req.user.id, 'CANCEL_APPOINTMENT', 'appointments', req.params.id);
    res.json({ message: 'Appointment cancelled.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- DOCTOR CONSULTATION & RECORD COMMITS ---
app.post('/api/doctor/consultation', verifyToken, authorize('doctor'), async (req, res) => {
  const doctorId = req.user.doctorId;
  const { patientId, diagnosis, symptoms, clinicalNotes, treatmentPlan, followUpDate, prescriptionItems, prescriptionInstructions } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rec] = await conn.execute(
      `INSERT INTO medical_records (patient_id, doctor_id, record_date, diagnosis, symptoms, clinical_notes, treatment_plan, follow_up_date) 
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?)`,
      [patientId, doctorId, diagnosis, symptoms || '', clinicalNotes || '', treatmentPlan || '', followUpDate || null]
    );
    const recordId = rec.insertId;

    if (prescriptionItems && prescriptionItems.length > 0) {
      const [presc] = await conn.execute(
        `INSERT INTO prescriptions (medical_record_id, patient_id, doctor_id, prescribed_date, status, instructions) 
         VALUES (?, ?, ?, CURDATE(), 'active', ?)`,
        [recordId, patientId, doctorId, prescriptionInstructions || '']
      );
      for (const item of prescriptionItems) {
        await conn.execute(
          `INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, special_notes) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [presc.insertId, item.medicine, item.dosage, item.frequency, item.duration, item.instructions || '']
        );
      }
    }

    await conn.commit();
    await logAudit(req.user.id, 'COMMIT_CONSULTATION', 'medical_records', recordId);
    res.status(201).json({ message: 'Consultation & prescription saved to patient ledger.', recordId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

app.get('/api/doctors', async (req, res) => {
  try {
    const [docs] = await pool.execute('SELECT id, full_name, specialization, hospital_affiliation, phone FROM doctors');
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- ADMIN TELEMETRY & CONTROLS ---
app.get('/api/admin/telemetry', verifyToken, authorize('admin'), async (req, res) => {
  try {
    const [[{ totalPatients }]] = await pool.execute('SELECT COUNT(*) as totalPatients FROM patients');
    const [[{ totalDoctors }]] = await pool.execute('SELECT COUNT(*) as totalDoctors FROM doctors');
    const [[{ totalRecords }]] = await pool.execute('SELECT COUNT(*) as totalRecords FROM medical_records');
    const [[{ totalAppointments }]] = await pool.execute('SELECT COUNT(*) as totalAppointments FROM appointments');
    const [doctors] = await pool.execute('SELECT * FROM doctors');
    const [recentAudit] = await pool.execute(
      `SELECT a.*, u.email, u.role FROM audit_logs a JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 15`
    );

    res.json({
      stats: { totalPatients, totalDoctors, totalRecords, totalAppointments },
      doctors,
      recentAudit
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, () => console.log(`Secure Healthcare Backend running at http://localhost:${PORT}`));

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

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Missing authentication token.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
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

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Unified Health Record Production API' });
});

// --- AUTHENTICATION & REAL REGISTRATION ---
app.post('/api/auth/register', async (req, res) => {
  const { email, password, fullName, dob, gender, bloodGroup, phone, address, allergies } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ message: 'Full name, email, and password are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userRes] = await conn.execute(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, "patient")',
      [email.trim().toLowerCase(), passwordHash]
    );
    const userId = userRes.insertId;

    const [patRes] = await conn.execute(
      `INSERT INTO patients (user_id, full_name, date_of_birth, gender, blood_group, phone, address, allergies)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        fullName.trim(),
        dob || '1995-01-01',
        (gender || 'other').toLowerCase(),
        bloodGroup || 'O+',
        phone || '+91 00000 00000',
        address || 'Bengaluru, Karnataka',
        allergies || ''
      ]
    );

    await conn.commit();
    await logAudit(userId, 'REGISTER_PATIENT', 'patients', patRes.insertId);
    res.status(201).json({ message: 'Patient account created successfully. Please sign in.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, expectedRole } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email.trim().toLowerCase()]);
    if (users.length === 0) return res.status(401).json({ message: 'No active account found with this email.' });

    const user = users[0];
    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({ message: `This email is registered as a ${user.role.toUpperCase()}, not ${expectedRole.toUpperCase()}.` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password.' });

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
    } else {
      profile.name = 'Hospital System Admin';
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

// --- PATIENT ROUTES (STRICTLY ISOLATED TO LOGGED-IN PATIENT) ---
app.get('/api/patient/dashboard', verifyToken, authorize('patient'), async (req, res) => {
  const patientId = req.user.patientId;
  try {
    const [patients] = await pool.execute('SELECT * FROM patients WHERE id = ?', [patientId]);
    const [appointments] = await pool.execute(
      `SELECT a.*, d.full_name AS doctor_name, d.specialization, d.hospital_affiliation, d.area
       FROM appointments a JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = ? ORDER BY a.appointment_date DESC`,
      [patientId]
    );
    const [records] = await pool.execute(
      `SELECT mr.*, d.full_name AS doctor_name, d.specialization
       FROM medical_records mr JOIN doctors d ON mr.doctor_id = d.id
       WHERE mr.patient_id = ? ORDER BY mr.record_date DESC`,
      [patientId]
    );
    const [prescriptions] = await pool.execute(
      `SELECT p.*, d.full_name AS doctor_name
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
      patient: patients[0] || null,
      email: req.user.email,
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

// --- APPOINTMENTS ---
app.post('/api/appointments', verifyToken, authorize('patient'), async (req, res) => {
  const { doctorId, appointmentDate, appointmentTime, reason } = req.body;
  const numericDoctorId = Number(String(doctorId).replace('DOC-', ''));
  if (!numericDoctorId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ message: 'Valid doctor, date, and time are required.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, "confirmed")',
      [req.user.patientId, numericDoctorId, appointmentDate, appointmentTime, reason || 'General Consultation']
    );
    await logAudit(req.user.id, 'BOOK_APPOINTMENT', 'appointments', result.insertId);
    res.status(201).json({ message: 'Appointment booked with real doctor.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/appointments/:id/cancel', verifyToken, async (req, res) => {
  try {
    await pool.execute('UPDATE appointments SET status = "cancelled" WHERE id = ?', [req.params.id]);
    await logAudit(req.user.id, 'CANCEL_APPOINTMENT', 'appointments', req.params.id);
    res.json({ message: 'Appointment cancelled.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- DOCTOR PORTAL: DASHBOARD, CREATE PATIENT, VALID EMAIL LOOKUP & CONSULTATION ---
app.get('/api/doctor/dashboard', verifyToken, authorize('doctor'), async (req, res) => {
  const doctorId = req.user.doctorId;
  try {
    const [doctorRows] = await pool.execute('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    const [[{ totalPatients }]] = await pool.execute('SELECT COUNT(*) AS totalPatients FROM patients');
    const [appointments] = await pool.execute(
      `SELECT a.*, p.full_name AS patient_name, u.email AS patient_email, p.blood_group, p.allergies
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE a.doctor_id = ?
       ORDER BY a.appointment_date DESC`,
      [doctorId]
    );
    const [consultations] = await pool.execute(
      `SELECT mr.*, p.full_name AS patient_name, u.email AS patient_email
       FROM medical_records mr
       JOIN patients p ON mr.patient_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE mr.doctor_id = ?
       ORDER BY mr.record_date DESC`,
      [doctorId]
    );

    res.json({
      doctor: doctorRows[0] || null,
      totalPatients,
      appointments,
      consultations
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Doctor creates a real patient account in the hospital
app.post('/api/doctor/patients', verifyToken, authorize('doctor', 'admin'), async (req, res) => {
  const { email, password, fullName, dob, gender, bloodGroup, phone, address, allergies } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ message: 'Patient full name, email, and temporary password are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'A patient account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userRes] = await conn.execute(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, "patient")',
      [email.trim().toLowerCase(), passwordHash]
    );

    const [patRes] = await conn.execute(
      `INSERT INTO patients (user_id, full_name, date_of_birth, gender, blood_group, phone, address, allergies)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userRes.insertId,
        fullName.trim(),
        dob || '1995-01-01',
        (gender || 'other').toLowerCase(),
        bloodGroup || 'O+',
        phone || '+91 00000 00000',
        address || 'Bengaluru, Karnataka',
        allergies || ''
      ]
    );

    await conn.commit();
    await logAudit(req.user.id, 'DOCTOR_CREATED_PATIENT', 'patients', patRes.insertId);
    res.status(201).json({
      message: `Patient ${fullName} registered (${email.trim().toLowerCase()}).`,
      patient: { id: patRes.insertId, fullName, email: email.trim().toLowerCase() }
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// Verify patient email exists before adding medical record
app.get('/api/doctor/patient-lookup', verifyToken, authorize('doctor', 'admin'), async (req, res) => {
  const email = (req.query.email || '').toString().trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'Please enter a patient email ID.' });

  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.full_name, p.blood_group, p.gender, p.allergies, u.email
       FROM patients p JOIN users u ON p.user_id = u.id
       WHERE u.email = ? AND u.role = 'patient'`,
      [email]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: `No registered patient found with email "${email}". Please register the patient first.` });
    }
    res.json({ patient: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Doctor saves consultation strictly against an existing patient email
app.post('/api/doctor/consultation', verifyToken, authorize('doctor'), async (req, res) => {
  const doctorId = req.user.doctorId;
  const {
    patientEmail,
    diagnosis,
    symptoms,
    clinicalNotes,
    treatmentPlan,
    followUpDate,
    prescriptionItems,
    prescriptionInstructions,
    labTestName,
    labResultSummary
  } = req.body;

  if (!patientEmail || !diagnosis) {
    return res.status(400).json({ message: 'Valid patient email and diagnosis are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [patRows] = await conn.execute(
      `SELECT p.id, p.full_name FROM patients p JOIN users u ON p.user_id = u.id
       WHERE u.email = ? AND u.role = 'patient'`,
      [patientEmail.trim().toLowerCase()]
    );

    if (patRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        message: `Invalid Patient Email: No patient account exists for "${patientEmail}". Create the patient account first.`
      });
    }

    const targetPatientId = patRows[0].id;

    const [rec] = await conn.execute(
      `INSERT INTO medical_records (patient_id, doctor_id, record_date, diagnosis, symptoms, clinical_notes, treatment_plan, follow_up_date)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?)`,
      [targetPatientId, doctorId, diagnosis, symptoms || '', clinicalNotes || '', treatmentPlan || '', followUpDate || null]
    );
    const recordId = rec.insertId;

    if (prescriptionItems && prescriptionItems.length > 0) {
      const [presc] = await conn.execute(
        `INSERT INTO prescriptions (medical_record_id, patient_id, doctor_id, prescribed_date, status, instructions)
         VALUES (?, ?, ?, CURDATE(), 'active', ?)`,
        [recordId, targetPatientId, doctorId, prescriptionInstructions || '']
      );
      for (const item of prescriptionItems) {
        if (item.medicine && item.medicine.trim()) {
          await conn.execute(
            `INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, special_notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [presc.insertId, item.medicine, item.dosage || '', item.frequency || '', item.duration || '', item.instructions || '']
          );
        }
      }
    }

    if (labTestName && labTestName.trim()) {
      await conn.execute(
        `INSERT INTO lab_reports (patient_id, doctor_id, test_name, test_type, test_date, laboratory_name, result_summary, document_url)
         VALUES (?, ?, ?, 'Clinical Lab', CURDATE(), 'Hospital Central Diagnostics', ?, 'verified-ledger')`,
        [targetPatientId, doctorId, labTestName.trim(), labResultSummary || 'Normal']
      );
    }

    await conn.commit();
    await logAudit(req.user.id, `COMMIT_RECORD_FOR_${patientEmail}`, 'medical_records', recordId);
    res.status(201).json({
      message: `Consultation & report saved directly to ${patRows[0].full_name} (${patientEmail}).`,
      recordId,
      patientName: patRows[0].full_name
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// --- REAL DOCTORS DIRECTORY (WITH LOCATION & RADIUS) ---
app.get('/api/doctors', async (req, res) => {
  try {
    const [docs] = await pool.execute(
      `SELECT d.id, d.full_name, d.specialization, d.license_number, d.hospital_affiliation,
              d.phone, d.area, d.latitude, d.longitude, d.consultation_radius_km, d.consultation_fee,
              u.email, u.is_active
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE u.is_active = TRUE
       ORDER BY d.id DESC`
    );
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- ADMIN: CREATE REAL DOCTORS & TELEMETRY ---
app.post('/api/admin/doctors', verifyToken, authorize('admin'), async (req, res) => {
  const {
    fullName,
    email,
    password,
    specialization,
    licenseNumber,
    hospitalAffiliation,
    phone,
    area,
    latitude,
    longitude,
    consultationRadiusKm,
    consultationFee
  } = req.body;

  if (!fullName || !email || !password || !specialization || !licenseNumber) {
    return res.status(400).json({ message: 'Name, email, password, specialization, and license number are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userRes] = await conn.execute(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, "doctor")',
      [email.trim().toLowerCase(), passwordHash]
    );

    const [docRes] = await conn.execute(
      `INSERT INTO doctors (user_id, full_name, specialization, license_number, hospital_affiliation, phone, area, latitude, longitude, consultation_radius_km, consultation_fee)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userRes.insertId,
        fullName.trim(),
        specialization.trim(),
        licenseNumber.trim(),
        hospitalAffiliation || 'City General Hospital',
        phone || '+91 80 4000 1000',
        area || 'Bengaluru Central',
        latitude || 12.9716,
        longitude || 77.5946,
        Number(consultationRadiusKm) || 15,
        consultationFee || '₹700'
      ]
    );

    await conn.commit();
    await logAudit(req.user.id, `ADMIN_CREATED_DOCTOR_${licenseNumber}`, 'doctors', docRes.insertId);
    res.status(201).json({ message: `Doctor ${fullName} registered and active in directory.` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

app.get('/api/admin/telemetry', verifyToken, authorize('admin'), async (req, res) => {
  try {
    const [[{ totalPatients }]] = await pool.execute('SELECT COUNT(*) as totalPatients FROM patients');
    const [[{ totalDoctors }]] = await pool.execute('SELECT COUNT(*) as totalDoctors FROM doctors');
    const [[{ totalRecords }]] = await pool.execute('SELECT COUNT(*) as totalRecords FROM medical_records');
    const [[{ totalAppointments }]] = await pool.execute('SELECT COUNT(*) as totalAppointments FROM appointments');
    const [doctors] = await pool.execute(
      `SELECT d.*, u.email, u.is_active FROM doctors d JOIN users u ON d.user_id = u.id ORDER BY d.id DESC`
    );
    const [recentAudit] = await pool.execute(
      `SELECT a.*, u.email, u.role FROM audit_logs a JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 20`
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

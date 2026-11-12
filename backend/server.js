const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns').promises;
const crypto = require('crypto');
const tls = require('tls');
const net = require('net');
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

// --- REAL EMAIL VALIDATION (ANTI-FAKE, ANTI-DUPLICATE, LIVE DNS MX CHECK) ---
const BLOCKED_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net', 'test.com', 'fake.com',
  'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'dispostable.com',
  'uhrhospital.in'
]);

async function isRealDeliverableEmail(rawEmail) {
  const email = (rawEmail || '').trim().toLowerCase();
  const basicRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  if (!basicRegex.test(email)) {
    return { valid: false, reason: 'Enter a valid email format (e.g., name@gmail.com).' };
  }
  const domain = email.split('@')[1];
  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, reason: `Fake or disposable domain "@${domain}" is blocked.` };
  }
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: `Domain "@${domain}" cannot receive emails (no MX record).` };
    }
    return { valid: true, email };
  } catch {
    return { valid: false, reason: `Email domain "@${domain}" does not exist.` };
  }
}

// --- ZERO-DEPENDENCY TLS SMTP CLIENT FOR GMAIL (NO NODEMAILER CRASHES) ---
function sendGmailSmtp(toEmail, subject, htmlBody) {
  return new Promise((resolve, reject) => {
    const smtpUser = (process.env.SMTP_USER || '').trim();
    const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    if (!smtpUser || !smtpPass) {
      return reject(new Error('Set SMTP_USER and SMTP_PASS in Render Environment Variables to send 2FA emails.'));
    }

    const socket = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' }, () => {});
    socket.setTimeout(12000);

    let step = 0;
    let buffer = '';

    const sendCmd = (cmd) => {
      socket.write(cmd + '\r\n');
    };

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      if (!buffer.endsWith('\r\n')) return;
      const lines = buffer.trim().split('\r\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine[3] === '-') return; // multiline response still incoming
      const code = parseInt(lastLine.slice(0, 3), 10);
      buffer = '';

      if (step === 0 && code === 220) {
        step = 1;
        sendCmd('EHLO unifiedhealth.app');
      } else if (step === 1 && code === 250) {
        step = 2;
        sendCmd('AUTH LOGIN');
      } else if (step === 2 && code === 334) {
        step = 3;
        sendCmd(Buffer.from(smtpUser).toString('base64'));
      } else if (step === 3 && code === 334) {
        step = 4;
        sendCmd(Buffer.from(smtpPass).toString('base64'));
      } else if (step === 4) {
        if (code !== 235) {
          socket.destroy();
          return reject(new Error('Gmail SMTP authentication failed. Check SMTP_USER and 16-char App Password in Render.'));
        }
        step = 5;
        sendCmd(`MAIL FROM:<${smtpUser}>`);
      } else if (step === 5 && code === 250) {
        step = 6;
        sendCmd(`RCPT TO:<${toEmail}>`);
      } else if (step === 6 && code === 250) {
        step = 7;
        sendCmd('DATA');
      } else if (step === 7 && code === 354) {
        step = 8;
        const msg = [
          `From: "Unified Health Security" <${smtpUser}>`,
          `To: <${toEmail}>`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          '',
          htmlBody,
          '.'
        ].join('\r\n');
        sendCmd(msg);
      } else if (step === 8 && code === 250) {
        step = 9;
        sendCmd('QUIT');
        socket.end();
        resolve(true);
      } else if (code >= 400) {
        socket.destroy();
        reject(new Error(`SMTP Error (${code}): ${lastLine}`));
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Email server connection timed out.'));
    });

    socket.on('error', (err) => {
      reject(new Error(`Email delivery failed: ${err.message}`));
    });
  });
}

async function sendSecurityOtpEmail(toEmail, otpCode, purposeLabel) {
  const subject = `${otpCode} is your Unified Health ${purposeLabel} Code`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #0d9488; margin-top: 0;">Unified Health Record • 2-Step Verification</h2>
      <p style="color: #334155; font-size: 14px;">Enter this 6-digit security code to complete your <strong>${purposeLabel}</strong>:</p>
      <div style="background: #f1f5f9; padding: 16px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">
        ${otpCode}
      </div>
      <p style="color: #64748b; font-size: 12px; margin-top: 16px;">Expires in 10 minutes. Never share this code with anyone.</p>
    </div>
  `;
  await sendGmailSmtp(toEmail, subject, html);
}

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Missing token.' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch {
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

// --- HEALTH & SYSTEM STATUS ---
app.get('/api/health', async (req, res) => {
  try {
    const [[{ adminCount }]] = await pool.query('SELECT COUNT(*) AS adminCount FROM users WHERE role = ?', ['admin']);
    res.json({
      status: 'ok',
      hasAdmin: adminCount > 0,
      email2faConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// --- STEP 1 OF REGISTRATION: SEND EMAIL OTP ---
app.post('/api/auth/request-register-otp', async (req, res) => {
  const { email } = req.body;
  const check = await isRealDeliverableEmail(email);
  if (!check.valid) return res.status(400).json({ message: check.reason });

  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [check.email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'This email ID is already registered. Duplicate accounts are not allowed.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.execute('DELETE FROM email_otps WHERE email = ? AND purpose = ?', [check.email, 'register']);
    await pool.execute(
      'INSERT INTO email_otps (email, otp_hash, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [check.email, otpHash, 'register', expiresAt]
    );

    await sendSecurityOtpEmail(check.email, otp, 'Account Registration');
    res.json({ message: `6-digit verification code sent to ${check.email}. Check your inbox.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- STEP 2 OF REGISTRATION: VERIFY OTP & CREATE ACCOUNT ---
app.post('/api/auth/register', async (req, res) => {
  const { email, password, otp, accountType, fullName, dob, gender, bloodGroup, phone, address, allergies } = req.body;
  const check = await isRealDeliverableEmail(email);
  if (!check.valid) return res.status(400).json({ message: check.reason });
  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }
  if (!otp || otp.trim().length !== 6) {
    return res.status(400).json({ message: 'Enter the 6-digit verification code sent to your email.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [check.email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'This email ID is already registered.' });
    }

    const [otpRows] = await conn.execute(
      'SELECT * FROM email_otps WHERE email = ? AND purpose = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [check.email, 'register']
    );
    if (otpRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Verification code expired or not requested. Click Send OTP first.' });
    }

    const otpValid = await bcrypt.compare(otp.trim(), otpRows[0].otp_hash);
    if (!otpValid) {
      await conn.rollback();
      return res.status(401).json({ message: 'Incorrect 6-digit verification code.' });
    }

    let roleToCreate = 'patient';
    if (accountType === 'admin') {
      const [[{ adminCount }]] = await conn.execute('SELECT COUNT(*) AS adminCount FROM users WHERE role = ?', ['admin']);
      if (adminCount > 0) {
        await conn.rollback();
        return res.status(403).json({ message: 'Primary Hospital Admin already exists.' });
      }
      roleToCreate = 'admin';
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userRes] = await conn.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, TRUE)',
      [check.email, passwordHash, roleToCreate]
    );
    const userId = userRes.insertId;

    if (roleToCreate === 'patient') {
      if (!fullName || !fullName.trim()) {
        await conn.rollback();
        return res.status(400).json({ message: 'Patient full name is required.' });
      }
      await conn.execute(
        `INSERT INTO patients (user_id, full_name, date_of_birth, gender, blood_group, phone, address, allergies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          fullName.trim(),
          dob || '1995-01-01',
          (gender || 'other').toLowerCase(),
          bloodGroup || 'O+',
          phone || '',
          address || '',
          allergies || ''
        ]
      );
    }

    await conn.execute('DELETE FROM email_otps WHERE email = ? AND purpose = ?', [check.email, 'register']);
    await conn.commit();
    await logAudit(userId, `VERIFIED_REGISTER_${roleToCreate.toUpperCase()}`, 'users', userId);

    res.status(201).json({
      message: `${roleToCreate === 'admin' ? 'Hospital Admin' : 'Patient'} account verified and created! Sign in now.`
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// --- STEP 1 OF LOGIN: VERIFY PASSWORD & SEND 2FA OTP ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password, expectedRole } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) return res.status(400).json({ message: 'Email and password are required.' });

  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [cleanEmail]);
    if (users.length === 0) return res.status(401).json({ message: 'No active account found with this email.' });

    const user = users[0];
    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({ message: `This email is registered as ${user.role.toUpperCase()}, not ${expectedRole.toUpperCase()}.` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password.' });

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.execute('DELETE FROM email_otps WHERE email = ? AND purpose = ?', [cleanEmail, 'login_2fa']);
    await pool.execute(
      'INSERT INTO email_otps (email, otp_hash, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [cleanEmail, otpHash, 'login_2fa', expiresAt]
    );

    await sendSecurityOtpEmail(cleanEmail, otp, '2-Step Login');
    await logAudit(user.id, 'PASSWORD_OK_2FA_SENT', 'users', user.id);

    res.json({
      requires2FA: true,
      email: cleanEmail,
      message: `Password verified. Enter the 6-digit 2-Step Verification code sent to ${cleanEmail}.`
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- STEP 2 OF LOGIN: VERIFY 2FA OTP & ISSUE JWT ---
app.post('/api/auth/verify-2fa', async (req, res) => {
  const { email, otp, expectedRole } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !otp) return res.status(400).json({ message: 'Email and 6-digit 2FA code are required.' });

  try {
    const [otpRows] = await pool.execute(
      'SELECT * FROM email_otps WHERE email = ? AND purpose = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [cleanEmail, 'login_2fa']
    );
    if (otpRows.length === 0) {
      return res.status(400).json({ message: '2FA code expired. Please sign in again.' });
    }

    if (otpRows[0].attempts >= 5) {
      await pool.execute('DELETE FROM email_otps WHERE id = ?', [otpRows[0].id]);
      return res.status(429).json({ message: 'Too many invalid 2FA attempts. Sign in again.' });
    }

    const isValid = await bcrypt.compare(otp.trim(), otpRows[0].otp_hash);
    if (!isValid) {
      await pool.execute('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?', [otpRows[0].id]);
      return res.status(401).json({ message: 'Incorrect 2-Step Verification code.' });
    }

    await pool.execute('DELETE FROM email_otps WHERE id = ?', [otpRows[0].id]);

    const [users] = await pool.execute('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [cleanEmail]);
    if (users.length === 0) return res.status(401).json({ message: 'Account not found.' });

    const user = users[0];
    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({ message: `Role mismatch: account is ${user.role}.` });
    }

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
      { expiresIn: '12h' }
    );

    await logAudit(user.id, 'LOGIN_2FA_VERIFIED', 'users', user.id);
    res.json({ token, user: profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- PATIENT DASHBOARD ---
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
      'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.patientId, numericDoctorId, appointmentDate, appointmentTime, reason || 'General Consultation', 'confirmed']
    );
    await logAudit(req.user.id, 'BOOK_APPOINTMENT', 'appointments', result.insertId);
    res.status(201).json({ message: 'Appointment booked with real doctor.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/appointments/:id/cancel', verifyToken, async (req, res) => {
  try {
    await pool.execute('UPDATE appointments SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    await logAudit(req.user.id, 'CANCEL_APPOINTMENT', 'appointments', req.params.id);
    res.json({ message: 'Appointment cancelled.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- DOCTOR PORTAL ---
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

app.post('/api/doctor/patients', verifyToken, authorize('doctor', 'admin'), async (req, res) => {
  const { email, password, fullName, dob, gender, bloodGroup, phone, address, allergies } = req.body;
  const check = await isRealDeliverableEmail(email);
  if (!check.valid) return res.status(400).json({ message: check.reason });
  if (!password || !fullName) {
    return res.status(400).json({ message: 'Patient full name, real email, and initial password are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [check.email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'This patient email ID already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userRes] = await conn.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, TRUE)',
      [check.email, passwordHash, 'patient']
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
        phone || '',
        address || '',
        allergies || ''
      ]
    );

    await conn.commit();
    await logAudit(req.user.id, 'DOCTOR_CREATED_PATIENT', 'patients', patRes.insertId);
    res.status(201).json({
      message: `Patient ${fullName} registered (${check.email}).`,
      patient: { id: patRes.insertId, fullName, email: check.email }
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

app.get('/api/doctor/patient-lookup', verifyToken, authorize('doctor', 'admin'), async (req, res) => {
  const email = (req.query.email || '').toString().trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'Please enter a patient email ID.' });

  try {
    const [rows] = await pool.execute(
      `SELECT p.id, p.full_name, p.blood_group, p.gender, p.allergies, u.email
       FROM patients p JOIN users u ON p.user_id = u.id
       WHERE u.email = ? AND u.role = ?`,
      [email, 'patient']
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: `No registered patient found with email "${email}".` });
    }
    res.json({ patient: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
       WHERE u.email = ? AND u.role = ?`,
      [patientEmail.trim().toLowerCase(), 'patient']
    );

    if (patRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        message: `Invalid Patient Email: No patient account exists for "${patientEmail}".`
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
         VALUES (?, ?, ?, CURDATE(), ?, ?)`,
        [recordId, targetPatientId, doctorId, 'active', prescriptionInstructions || '']
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
         VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)`,
        [targetPatientId, doctorId, labTestName.trim(), 'Clinical Lab', 'Hospital Central Diagnostics', labResultSummary || 'Normal', 'verified-ledger']
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

// --- DOCTORS DIRECTORY ---
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

  const check = await isRealDeliverableEmail(email);
  if (!check.valid) return res.status(400).json({ message: check.reason });

  if (!fullName || !password || !specialization || !licenseNumber) {
    return res.status(400).json({ message: 'Name, real email, password, specialization, and license number are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [check.email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'This email ID already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userRes] = await conn.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, TRUE)',
      [check.email, passwordHash, 'doctor']
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
        phone || '',
        area || 'Bengaluru',
        latitude || 12.9716,
        longitude || 77.5946,
        Number(consultationRadiusKm) || 15,
        consultationFee || '₹700'
      ]
    );

    await conn.commit();
    await logAudit(req.user.id, `ADMIN_CREATED_DOCTOR_${licenseNumber}`, 'doctors', docRes.insertId);
    res.status(201).json({ message: `Doctor ${fullName} (${check.email}) registered.` });
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

// --- AUTO-INITIALIZE PRODUCTION TABLES ---
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(191) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('patient', 'doctor', 'admin') NOT NULL DEFAULT 'patient',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(191) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        purpose VARCHAR(32) NOT NULL,
        attempts INT DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_otp_email (email)
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients (
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        contact_name VARCHAR(150) NOT NULL,
        relationship VARCHAR(50) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        full_name VARCHAR(150) NOT NULL,
        specialization VARCHAR(100) NOT NULL,
        license_number VARCHAR(100) NOT NULL UNIQUE,
        hospital_affiliation VARCHAR(150) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        area VARCHAR(120) DEFAULT 'Bengaluru',
        latitude DECIMAL(10, 6) DEFAULT 12.971600,
        longitude DECIMAL(10, 6) DEFAULT 77.594600,
        consultation_radius_km INT DEFAULT 15,
        consultation_fee VARCHAR(30) DEFAULT '₹700',
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
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
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medical_records (
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
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
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
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prescription_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prescription_id INT NOT NULL,
        medicine_name VARCHAR(150) NOT NULL,
        dosage VARCHAR(50) NOT NULL,
        frequency VARCHAR(50) NOT NULL,
        duration VARCHAR(50) NOT NULL,
        special_notes VARCHAR(255),
        FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lab_reports (
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
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        entity_affected VARCHAR(100) NOT NULL,
        record_id INT NOT NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await pool.execute('DELETE FROM users WHERE email LIKE ? OR email LIKE ?', ['%@example.com', '%@uhrhospital.in']);
    console.log('✅ Production schema ready (zero dependencies, 2FA + DNS MX active).');
  } catch (err) {
    console.error('DB init error:', err.message);
  }
})();

app.listen(PORT, () => console.log(`Secure Healthcare Backend running at http://localhost:${PORT}`));

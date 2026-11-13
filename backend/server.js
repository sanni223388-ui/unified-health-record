const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;
const crypto = require('crypto');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./config/db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured. Refusing to start with an insecure default.');
}

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadDir));

// --- REAL EMAIL & MEDICAL LICENSE VALIDATION ---
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
    return { valid: false, reason: 'Invalid email format. Enter a real email address.' };
  }
  const domain = email.split('@')[1];
  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, reason: `Disposable or fake domain "@${domain}" is blocked.` };
  }
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: `Domain "@${domain}" has no active mail server.` };
    }
    return { valid: true, email };
  } catch {
    return { valid: false, reason: `Domain "@${domain}" does not exist or cannot receive emails.` };
  }
}

function isValidMedicalLicense(license) {
  const clean = (license || '').trim().toUpperCase();
  // Format: NMC/State Council code + digits (e.g., KMC-2024-12345, NMC-987654, MCI-45120)
  return /^[A-Z]{2,5}[-/]?[0-9]{4,12}([-/][0-9]{2,8})?$/.test(clean) && !/^(TEST|FAKE|DEMO|0000|1234)/.test(clean);
}

function generateUniqueUhrId() {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(100000, 1_000_000);
  return `UHR-${year}-${rand}`;
}

function generateSixDigitCode() {
  return crypto.randomInt(100000, 1_000_000).toString();
}

const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
const googleClientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const googleRefreshToken = (process.env.GOOGLE_REFRESH_TOKEN || '').trim();
const googleSenderEmail = (process.env.GOOGLE_SENDER_EMAIL || '').trim().toLowerCase();
const gmailApiConfigured = Boolean(googleClientId && googleClientSecret && googleRefreshToken && googleSenderEmail);
let googleAccessToken;
let googleAccessTokenExpiresAt = 0;

function emailDiagnostic(error, eventId) {
  // Keep provider details needed for Render troubleshooting, but never log a code,
  // recipient, or OAuth secret.
  const redact = (value) => {
    if (typeof value !== 'string') return value;
    let redacted = value;
    if (googleClientId) redacted = redacted.replaceAll(googleClientId, '[redacted-google-client-id]');
    if (googleClientSecret) redacted = redacted.replaceAll(googleClientSecret, '[redacted-google-client-secret]');
    if (googleRefreshToken) redacted = redacted.replaceAll(googleRefreshToken, '[redacted-google-refresh-token]');
    if (googleAccessToken) redacted = redacted.replaceAll(googleAccessToken, '[redacted-google-access-token]');
    return redacted;
  };
  return {
    eventId,
    code: error?.code,
    errno: error?.errno,
    syscall: error?.syscall,
    command: error?.command,
    responseCode: error?.responseCode,
    message: redact(error?.message) || 'No provider message supplied'
  };
}

async function getGoogleAccessToken() {
  if (googleAccessToken && Date.now() < googleAccessTokenExpiresAt) return googleAccessToken;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(20_000),
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: googleRefreshToken,
      grant_type: 'refresh_token'
    })
  });
  if (!response.ok) {
    const error = new Error(`Google OAuth token request failed with HTTP ${response.status}`);
    error.code = 'GOOGLE_OAUTH_ERROR';
    error.command = 'HTTPS';
    error.responseCode = response.status;
    throw error;
  }
  const payload = await response.json();
  if (!payload.access_token || !payload.expires_in) {
    const error = new Error('Google OAuth response did not contain an access token');
    error.code = 'GOOGLE_OAUTH_INVALID_RESPONSE';
    throw error;
  }
  googleAccessToken = payload.access_token;
  googleAccessTokenExpiresAt = Date.now() + Math.max(0, Number(payload.expires_in) - 60) * 1000;
  return googleAccessToken;
}

function sendOtpFailure(res, eventId) {
  return res.status(503).json({
    message: 'We could not send a verification code right now. Please try again shortly.',
    eventId
  });
}

async function sendSecurityOtpEmail(toEmail, otpCode, purposeLabel) {
  if (!gmailApiConfigured) {
    const error = new Error('Gmail API is not configured');
    error.code = 'GMAIL_API_NOT_CONFIGURED';
    throw error;
  }
  const subject = `Unified Health ${purposeLabel} verification code`;
  const text = `Your Unified Health ${purposeLabel} verification code is ${otpCode}. It expires in 10 minutes.`;
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0d9488; margin-top: 0;">Unified Health Record • 2-Step Verification</h2>
        <p style="color: #334155; font-size: 14px;">Your 6-digit verification code for <strong>${purposeLabel}</strong> is:</p>
        <div style="background: #f1f5f9; padding: 16px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">
          ${otpCode}
        </div>
        <p style="color: #64748b; font-size: 12px; margin-top: 16px;">Valid for 10 minutes. Protected under DPDP Act 2023 & ABDM Health Data Privacy Standards.</p>
      </div>
    `;
  const boundary = `uhr-${crypto.randomBytes(12).toString('hex')}`;
  const rawMessage = [
    `From: Unified Health Security <${googleSenderEmail}>`,
    `To: <${toEmail}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    `--${boundary}--`,
    ''
  ].join('\r\n');
  const accessToken = await getGoogleAccessToken();
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ raw: Buffer.from(rawMessage).toString('base64url') })
  });
  if (!response.ok) {
    const error = new Error(`Gmail API send request failed with HTTP ${response.status}`);
    error.code = 'GMAIL_API_SEND_ERROR';
    error.command = 'HTTPS';
    error.responseCode = response.status;
    throw error;
  }
}

if (gmailApiConfigured) {
  getGoogleAccessToken()
    .then(() => console.info('Gmail HTTPS API authentication succeeded.'))
    .catch((err) => console.error('Gmail HTTPS API authentication failed:', emailDiagnostic(err, 'startup')));
} else {
  console.error('Gmail HTTPS API is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, and GOOGLE_SENDER_EMAIL.');
}

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Missing authentication token.' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ message: 'Forbidden: Session expired. Please sign in again.' });
  }
};

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: `Access Denied: Requires [${allowedRoles.join(', ')}] role.` });
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
      email2faConfigured: gmailApiConfigured
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// --- REGISTRATION OTP ---
app.post('/api/auth/request-register-otp', async (req, res) => {
  const { email, accountType } = req.body;
  const check = await isRealDeliverableEmail(email);
  if (!check.valid) return res.status(400).json({ message: check.reason });

  let otpRecordId;
  const eventId = crypto.randomUUID();
  try {
    if (accountType === 'admin') {
      const [[{ adminCount }]] = await pool.query('SELECT COUNT(*) AS adminCount FROM users WHERE role = ?', ['admin']);
      if (adminCount > 0) {
        return res.status(403).json({ message: 'Primary Hospital Admin already exists. Only one Admin is permitted.' });
      }
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [check.email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'This email ID is already registered. Duplicate IDs are not allowed.' });
    }

    const otp = generateSixDigitCode();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.execute('DELETE FROM email_otps WHERE email = ? AND purpose = ?', [check.email, 'register']);
    const [insertResult] = await pool.execute(
      'INSERT INTO email_otps (email, otp_hash, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [check.email, otpHash, 'register', expiresAt]
    );
    otpRecordId = insertResult.insertId;

    await sendSecurityOtpEmail(check.email, otp, 'Account Registration');
    res.json({ message: `6-digit verification code sent to ${check.email}.` });
  } catch (err) {
    // A code is only usable if the matching email was accepted by Gmail.
    if (otpRecordId) await pool.execute('DELETE FROM email_otps WHERE id = ?', [otpRecordId]);
    console.error('Registration OTP email failed:', smtpDiagnostic(err, eventId));
    return sendOtpFailure(res, eventId);
  }
});

// --- COMPLETE REGISTRATION (PATIENT OR SINGLE PRIMARY ADMIN) ---
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
      return res.status(400).json({ message: 'OTP expired or not requested. Request a new code.' });
    }

    const otpValid = await bcrypt.compare(otp.trim(), otpRows[0].otp_hash);
    if (!otpValid) {
      await conn.rollback();
      return res.status(401).json({ message: 'Invalid 6-digit verification code.' });
    }

    let roleToCreate = 'patient';
    if (accountType === 'admin') {
      const [[{ adminCount }]] = await conn.execute('SELECT COUNT(*) AS adminCount FROM users WHERE role = ?', ['admin']);
      if (adminCount > 0) {
        await conn.rollback();
        return res.status(403).json({ message: 'Only one Hospital Admin is allowed in the system.' });
      }
      roleToCreate = 'admin';
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [userRes] = await conn.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, TRUE)',
      [check.email, passwordHash, roleToCreate]
    );
    const userId = userRes.insertId;

    let assignedUhrId = null;
    if (roleToCreate === 'patient') {
      if (!fullName || !fullName.trim()) {
        await conn.rollback();
        return res.status(400).json({ message: 'Patient full name is required.' });
      }
      assignedUhrId = generateUniqueUhrId();
      const consentPin = generateSixDigitCode();
      await conn.execute(
        `INSERT INTO patients (user_id, uhr_unique_id, consent_pin, full_name, date_of_birth, gender, blood_group, phone, address, allergies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          assignedUhrId,
          consentPin,
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
    await logAudit(userId, `REGISTERED_${roleToCreate.toUpperCase()}`, 'users', userId);

    res.status(201).json({
      message: roleToCreate === 'admin'
        ? 'Primary Hospital Admin registered! Sign in using 2-Step Verification.'
        : `Account created! Your permanent Health ID is ${assignedUhrId}. Sign in with 2-Step Verification.`,
      uhrUniqueId: assignedUhrId
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// --- LOGIN STEP 1: PASSWORD CHECK -> SEND 2FA OTP ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password, expectedRole } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !password) return res.status(400).json({ message: 'Email and password are required.' });

  let otpRecordId;
  const eventId = crypto.randomUUID();
  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [cleanEmail]);
    if (users.length === 0) return res.status(401).json({ message: 'No active account found with this email.' });

    const user = users[0];
    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({ message: `This email belongs to a ${user.role.toUpperCase()} account.` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password.' });

    const otp = generateSixDigitCode();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.execute('DELETE FROM email_otps WHERE email = ? AND purpose = ?', [cleanEmail, 'login_2fa']);
    const [insertResult] = await pool.execute(
      'INSERT INTO email_otps (email, otp_hash, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [cleanEmail, otpHash, 'login_2fa', expiresAt]
    );
    otpRecordId = insertResult.insertId;

    await sendSecurityOtpEmail(cleanEmail, otp, '2-Step Login');
    await logAudit(user.id, 'LOGIN_PASSWORD_VERIFIED_2FA_SENT', 'users', user.id);

    res.json({
      requires2FA: true,
      email: cleanEmail,
      message: `Password verified. Enter the 6-digit 2FA code sent to ${cleanEmail}.`
    });
  } catch (err) {
    // Do not leave a valid 2FA code behind when the delivery attempt fails.
    if (otpRecordId) await pool.execute('DELETE FROM email_otps WHERE id = ?', [otpRecordId]);
    console.error('Login OTP email failed:', smtpDiagnostic(err, eventId));
    return sendOtpFailure(res, eventId);
  }
});

// --- LOGIN STEP 2: VERIFY 2FA OTP -> ISSUE JWT ---
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
      return res.status(400).json({ message: '2FA code expired. Sign in again to get a new code.' });
    }
    if (otpRows[0].attempts >= 5) {
      await pool.execute('DELETE FROM email_otps WHERE id = ?', [otpRows[0].id]);
      return res.status(429).json({ message: 'Too many invalid attempts. Please sign in again.' });
    }

    const isValid = await bcrypt.compare(otp.trim(), otpRows[0].otp_hash);
    if (!isValid) {
      await pool.execute('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?', [otpRows[0].id]);
      return res.status(401).json({ message: 'Incorrect 6-digit 2FA code.' });
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
        profile.uhrUniqueId = patients[0].uhr_unique_id;
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
        uhrUniqueId: profile.uhrUniqueId || null,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    await logAudit(user.id, 'LOGIN_2FA_SUCCESS', 'users', user.id);
    res.json({ token, user: profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =========================================================================
// PATIENT PORTAL ROUTES (PERSONAL EDIT ONLY + UPLOAD REPORTS + CONSENT)
// =========================================================================
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
    const [consents] = await pool.execute(
      `SELECT dc.*, d.full_name AS doctor_name, d.specialization, d.hospital_affiliation
       FROM doctor_consents dc JOIN doctors d ON dc.doctor_id = d.id
       WHERE dc.patient_id = ?`,
      [patientId]
    );

    res.json({
      patient: patients[0] || null,
      email: req.user.email,
      appointments,
      records,
      prescriptions,
      labReports,
      consents
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Patient can ONLY update personal contact details (cannot alter medical records, UHR ID, or doctor notes)
app.put('/api/patient/profile', verifyToken, authorize('patient'), async (req, res) => {
  const patientId = req.user.patientId;
  const { phone, address } = req.body;
  try {
    await pool.execute('UPDATE patients SET phone = ?, address = ? WHERE id = ?', [phone || '', address || '', patientId]);
    await logAudit(req.user.id, 'PATIENT_UPDATED_PERSONAL_CONTACT', 'patients', patientId);
    res.json({ message: 'Personal contact details updated. Medical history remains cryptographically locked.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Block any attempt by a patient to modify clinical records
app.put('/api/patient/records/:id', verifyToken, authorize('patient'), (req, res) => {
  return res.status(403).json({ message: 'ABDM Governance Rule: Patients cannot edit or alter verified medical records.' });
});

// Patient uploads external hospital/diagnostic reports
app.post('/api/patient/reports', verifyToken, authorize('patient'), async (req, res) => {
  const patientId = req.user.patientId;
  const { testName, testType, testDate, laboratoryName, resultSummary, fileDataBase64, fileName } = req.body;

  if (!testName || !laboratoryName || !resultSummary) {
    return res.status(400).json({ message: 'Report title, hospital/lab name, and summary are required.' });
  }

  try {
    let storedUrl = 'patient-uploaded-summary';
    if (fileDataBase64 && fileName) {
      const safeName = `${patientId}_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const base64Body = fileDataBase64.includes(',') ? fileDataBase64.split(',')[1] : fileDataBase64;
      fs.writeFileSync(path.join(uploadDir, safeName), Buffer.from(base64Body, 'base64'));
      storedUrl = `/uploads/${safeName}`;
    }

    const [result] = await pool.execute(
      `INSERT INTO lab_reports (patient_id, doctor_id, test_name, test_type, test_date, laboratory_name, result_summary, document_url, notes)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        testName.trim(),
        testType || 'External Hospital Report',
        testDate || new Date().toISOString().split('T')[0],
        laboratoryName.trim(),
        resultSummary.trim(),
        storedUrl,
        'Uploaded by Patient'
      ]
    );

    await logAudit(req.user.id, 'PATIENT_UPLOADED_HOSPITAL_REPORT', 'lab_reports', result.insertId);
    res.status(201).json({ message: 'Hospital report added to your permanent UHR record.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Patient grants or revokes doctor access permission (DPDP Act 2023)
app.post('/api/patient/consent', verifyToken, authorize('patient'), async (req, res) => {
  const patientId = req.user.patientId;
  const { doctorId, granted } = req.body;
  const numericDocId = Number(String(doctorId).replace('DOC-', ''));
  if (!numericDocId) return res.status(400).json({ message: 'Valid doctor ID is required.' });

  try {
    if (granted) {
      await pool.execute(
        `INSERT INTO doctor_consents (patient_id, doctor_id, status, granted_at)
         VALUES (?, ?, 'granted', NOW())
         ON DUPLICATE KEY UPDATE status = 'granted', granted_at = NOW()`,
        [patientId, numericDocId]
      );
      await logAudit(req.user.id, `PATIENT_GRANTED_CONSENT_DOC_${numericDocId}`, 'doctor_consents', numericDocId);
      res.json({ message: 'Consent granted. This doctor can now view your medical profile and write prescriptions.' });
    } else {
      await pool.execute(
        `UPDATE doctor_consents SET status = 'revoked' WHERE patient_id = ? AND doctor_id = ?`,
        [patientId, numericDocId]
      );
      await logAudit(req.user.id, `PATIENT_REVOKED_CONSENT_DOC_${numericDocId}`, 'doctor_consents', numericDocId);
      res.json({ message: 'Consent revoked. This doctor can no longer view your medical history.' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- APPOINTMENTS ---
app.post('/api/appointments', verifyToken, authorize('patient'), async (req, res) => {
  const { doctorId, appointmentDate, appointmentTime, reason, grantConsentNow } = req.body;
  const numericDoctorId = Number(String(doctorId).replace('DOC-', ''));
  if (!numericDoctorId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ message: 'Doctor, date, and time are required.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.patientId, numericDoctorId, appointmentDate, appointmentTime, reason || 'Consultation', 'confirmed']
    );

    if (grantConsentNow) {
      await pool.execute(
        `INSERT INTO doctor_consents (patient_id, doctor_id, status, granted_at)
         VALUES (?, ?, 'granted', NOW())
         ON DUPLICATE KEY UPDATE status = 'granted', granted_at = NOW()`,
        [req.user.patientId, numericDoctorId]
      );
    }

    await logAudit(req.user.id, 'PATIENT_BOOKED_APPOINTMENT', 'appointments', result.insertId);
    res.status(201).json({ message: 'Appointment booked successfully.', id: result.insertId });
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

// =========================================================================
// DOCTOR PORTAL (APPOINTMENTS ONLY UNLESS CONSENT GRANTED + PRESCRIPTIONS)
// =========================================================================
app.get('/api/doctor/dashboard', verifyToken, authorize('doctor'), async (req, res) => {
  const doctorId = req.user.doctorId;
  try {
    const [doctorRows] = await pool.execute('SELECT * FROM doctors WHERE id = ?', [doctorId]);
    const [appointments] = await pool.execute(
      `SELECT a.id, a.patient_id, a.appointment_date, a.appointment_time, a.reason, a.status,
              p.uhr_unique_id, p.full_name AS patient_name,
              CASE WHEN dc.status = 'granted' THEN 1 ELSE 0 END AS has_consent
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       LEFT JOIN doctor_consents dc ON dc.patient_id = p.id AND dc.doctor_id = ?
       WHERE a.doctor_id = ?
       ORDER BY a.appointment_date DESC`,
      [doctorId, doctorId]
    );

    const [prescriptions] = await pool.execute(
      `SELECT pr.*, p.full_name AS patient_name, p.uhr_unique_id
       FROM prescriptions pr
       JOIN patients p ON pr.patient_id = p.id
       WHERE pr.doctor_id = ?
       ORDER BY pr.prescribed_date DESC`,
      [doctorId]
    );

    res.json({
      doctor: doctorRows[0] || null,
      appointments,
      prescriptions
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Doctor looks up patient by Fixed UHR ID or Email ONLY if patient granted permission (or shares Consent PIN)
app.post('/api/doctor/access-patient', verifyToken, authorize('doctor'), async (req, res) => {
  const doctorId = req.user.doctorId;
  const { identifier, consentPin } = req.body;
  const cleanId = (identifier || '').trim();
  if (!cleanId) return res.status(400).json({ message: 'Enter Patient UHR Unique ID (e.g. UHR-2026-123456) or Email.' });

  try {
    const [patRows] = await pool.execute(
      `SELECT p.*, u.email
       FROM patients p JOIN users u ON p.user_id = u.id
       WHERE p.uhr_unique_id = ? OR u.email = ?`,
      [cleanId.toUpperCase(), cleanId.toLowerCase()]
    );

    if (patRows.length === 0) {
      return res.status(404).json({ message: `No patient found with ID/Email "${cleanId}".` });
    }

    const patient = patRows[0];

    // Check if patient already granted consent OR if doctor provides valid 6-digit Patient Consent PIN
    const [consentRows] = await pool.execute(
      `SELECT status FROM doctor_consents WHERE patient_id = ? AND doctor_id = ? AND status = 'granted'`,
      [patient.id, doctorId]
    );

    let authorized = consentRows.length > 0;
    if (!authorized && consentPin && consentPin.trim() === patient.consent_pin) {
      await pool.execute(
        `INSERT INTO doctor_consents (patient_id, doctor_id, status, granted_at)
         VALUES (?, ?, 'granted', NOW())
         ON DUPLICATE KEY UPDATE status = 'granted', granted_at = NOW()`,
        [patient.id, doctorId]
      );
      authorized = true;
    }

    if (!authorized) {
      await logAudit(req.user.id, `BLOCKED_UNCONSENTED_ACCESS_${patient.uhr_unique_id}`, 'patients', patient.id);
      return res.status(403).json({
        requiresConsent: true,
        uhrUniqueId: patient.uhr_unique_id,
        patientName: patient.full_name,
        message: `DPDP Privacy Lock: ${patient.full_name} (${patient.uhr_unique_id}) has not granted you access yet. Ask the patient to toggle Consent ON in their portal or enter their 6-digit Clinic Consent PIN.`
      });
    }

    const [records] = await pool.execute(
      `SELECT mr.*, d.full_name AS doctor_name FROM medical_records mr JOIN doctors d ON mr.doctor_id = d.id WHERE mr.patient_id = ? ORDER BY mr.record_date DESC`,
      [patient.id]
    );
    const [reports] = await pool.execute(
      `SELECT * FROM lab_reports WHERE patient_id = ? ORDER BY test_date DESC`,
      [patient.id]
    );

    await logAudit(req.user.id, `CONSENTED_VIEW_${patient.uhr_unique_id}`, 'patients', patient.id);
    res.json({
      patient: {
        id: patient.id,
        uhrUniqueId: patient.uhr_unique_id,
        fullName: patient.full_name,
        email: patient.email,
        dob: patient.date_of_birth,
        gender: patient.gender,
        bloodGroup: patient.blood_group,
        allergies: patient.allergies
      },
      records,
      reports
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Doctor adds e-Prescription & Clinical Note (only when patient consent is active)
app.post('/api/doctor/consultation', verifyToken, authorize('doctor'), async (req, res) => {
  const doctorId = req.user.doctorId;
  const {
    patientIdentifier,
    diagnosis,
    symptoms,
    clinicalNotes,
    treatmentPlan,
    followUpDate,
    prescriptionItems,
    prescriptionInstructions
  } = req.body;

  if (!patientIdentifier || !diagnosis) {
    return res.status(400).json({ message: 'Patient UHR ID/Email and diagnosis are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [patRows] = await conn.execute(
      `SELECT p.id, p.full_name, p.uhr_unique_id, u.email
       FROM patients p JOIN users u ON p.user_id = u.id
       WHERE p.uhr_unique_id = ? OR u.email = ?`,
      [patientIdentifier.trim().toUpperCase(), patientIdentifier.trim().toLowerCase()]
    );

    if (patRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Patient not found.' });
    }

    const patient = patRows[0];

    const [consentRows] = await conn.execute(
      `SELECT status FROM doctor_consents WHERE patient_id = ? AND doctor_id = ? AND status = 'granted'`,
      [patient.id, doctorId]
    );
    if (consentRows.length === 0) {
      await conn.rollback();
      return res.status(403).json({ message: `Patient consent required before issuing prescriptions for ${patient.uhr_unique_id}.` });
    }

    const [rec] = await conn.execute(
      `INSERT INTO medical_records (patient_id, doctor_id, record_date, diagnosis, symptoms, clinical_notes, treatment_plan, follow_up_date)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?)`,
      [patient.id, doctorId, diagnosis, symptoms || '', clinicalNotes || '', treatmentPlan || '', followUpDate || null]
    );
    const recordId = rec.insertId;

    if (prescriptionItems && prescriptionItems.length > 0) {
      const [presc] = await conn.execute(
        `INSERT INTO prescriptions (medical_record_id, patient_id, doctor_id, prescribed_date, status, instructions)
         VALUES (?, ?, ?, CURDATE(), ?, ?)`,
        [recordId, patient.id, doctorId, 'active', prescriptionInstructions || '']
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

    await conn.commit();
    await logAudit(req.user.id, `ISSUED_RX_${patient.uhr_unique_id}`, 'prescriptions', recordId);
    res.status(201).json({
      message: `Prescription & diagnosis saved to ${patient.full_name} (${patient.uhr_unique_id}).`
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// --- PUBLIC ACTIVE DOCTORS DIRECTORY ---
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

// =========================================================================
// SINGLE ADMIN GOVERNANCE (ADD REAL DOCTORS ONLY & REMOVE/SUSPEND DOCTORS)
// =========================================================================
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

  if (!isValidMedicalLicense(licenseNumber)) {
    return res.status(400).json({
      message: 'Invalid Medical Council License Number. Use authentic NMC/State Council format (e.g., KMC-2024-89120).'
    });
  }

  if (!fullName || !password || password.length < 8 || !specialization || !hospitalAffiliation) {
    return res.status(400).json({ message: 'Full name, 8+ char password, specialization, and hospital name are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [check.email]);
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'This doctor email ID is already registered.' });
    }

    const [dupLic] = await conn.execute('SELECT id FROM doctors WHERE license_number = ?', [licenseNumber.trim().toUpperCase()]);
    if (dupLic.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'This Medical Council License Number is already registered to another doctor.' });
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
        licenseNumber.trim().toUpperCase(),
        hospitalAffiliation.trim(),
        phone || '',
        area || 'Bengaluru',
        latitude || 12.9716,
        longitude || 77.5946,
        Number(consultationRadiusKm) || 15,
        consultationFee || '₹700'
      ]
    );

    await conn.commit();
    await logAudit(req.user.id, `ADMIN_ADDED_REAL_DOCTOR_${licenseNumber.toUpperCase()}`, 'doctors', docRes.insertId);
    res.status(201).json({ message: `Verified Doctor ${fullName} (${licenseNumber.toUpperCase()}) added to hospital network.` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// Admin removes a doctor completely
app.delete('/api/admin/doctors/:id', verifyToken, authorize('admin'), async (req, res) => {
  const docId = Number(String(req.params.id).replace('DOC-', ''));
  try {
    const [rows] = await pool.execute('SELECT user_id, full_name FROM doctors WHERE id = ?', [docId]);
    if (rows.length === 0) return res.status(404).json({ message: 'Doctor not found.' });
    await pool.execute('DELETE FROM users WHERE id = ?', [rows[0].user_id]);
    await logAudit(req.user.id, `ADMIN_REMOVED_DOCTOR_${rows[0].full_name}`, 'doctors', docId);
    res.json({ message: `Doctor ${rows[0].full_name} removed from system.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
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

// --- AUTO-MIGRATE & INITIALIZE TABLES ---
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
        uhr_unique_id VARCHAR(32) NOT NULL UNIQUE,
        consent_pin VARCHAR(10) NOT NULL,
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

    // Add uhr_unique_id & consent_pin if upgrading an existing patients table
    try { await pool.query(`ALTER TABLE patients ADD COLUMN uhr_unique_id VARCHAR(32) UNIQUE`); } catch {}
    try { await pool.query(`ALTER TABLE patients ADD COLUMN consent_pin VARCHAR(10) NULL`); } catch {}
    const [patientsWithoutSecurePin] = await pool.query(
      `SELECT id FROM patients WHERE consent_pin IS NULL OR consent_pin = '123456'`
    );
    for (const patient of patientsWithoutSecurePin) {
      await pool.execute('UPDATE patients SET consent_pin = ? WHERE id = ?', [generateSixDigitCode(), patient.id]);
    }
    try { await pool.query(`ALTER TABLE patients MODIFY consent_pin VARCHAR(10) NOT NULL`); } catch {}

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
      CREATE TABLE IF NOT EXISTS doctor_consents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        doctor_id INT NOT NULL,
        status ENUM('granted', 'revoked') NOT NULL DEFAULT 'granted',
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_pat_doc (patient_id, doctor_id),
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
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
    console.log('✅ ABDM & DPDP Compliant Backend Ready (Fixed UHR IDs, Consent Locks, 2FA, Single Admin).');
  } catch (err) {
    console.error('DB init error:', err.message);
  }
})();

app.listen(PORT, () => console.log(`Secure Healthcare Backend running at http://localhost:${PORT}`));

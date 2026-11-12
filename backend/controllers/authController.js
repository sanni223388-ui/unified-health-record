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

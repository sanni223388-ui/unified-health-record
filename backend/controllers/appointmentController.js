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

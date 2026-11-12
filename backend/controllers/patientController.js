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

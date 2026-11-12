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

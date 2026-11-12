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

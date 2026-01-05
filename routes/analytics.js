import express from 'express';
import pool from '../config/database.js';
import { authenticate, canViewAnalytics } from '../middleware/auth.js';

const router = express.Router();

// System-wide analytics
router.get('/system', authenticate, async (req, res) => {
  try {
    if (!canViewAnalytics(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const [
      totalEvents,
      totalUsers,
      totalEnrollments,
      totalCertificates,
      upcomingEvents,
      recentEvents
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM events'),
      pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['student']),
      pool.query('SELECT COUNT(*) as count FROM event_enrollments'),
      pool.query('SELECT COUNT(*) as count FROM certificates WHERE revoked = false'),
      pool.query(
        `SELECT COUNT(*) as count FROM events 
         WHERE start_date > CURRENT_TIMESTAMP AND status = 'approved'`
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM events 
         WHERE start_date < CURRENT_TIMESTAMP AND status = 'approved'`
      )
    ]);

    // Participation trends (last 6 months)
    const trendsResult = await pool.query(
      `SELECT 
        DATE_TRUNC('month', e.start_date) as month,
        COUNT(DISTINCT e.id) as events_count,
        COUNT(DISTINCT ee.user_id) as participants_count
       FROM events e
       LEFT JOIN event_enrollments ee ON e.id = ee.event_id
       WHERE e.start_date >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', e.start_date)
       ORDER BY month ASC`
    );

    // Attendance rate
    const attendanceResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE attended = true) as attended,
        COUNT(*) as total
       FROM event_enrollments`
    );

    const attendanceRate = attendanceResult.rows[0].total > 0
      ? (attendanceResult.rows[0].attended / attendanceResult.rows[0].total * 100).toFixed(2)
      : 0;

    res.json({
      total_events: parseInt(totalEvents.rows[0].count),
      total_students: parseInt(totalUsers.rows[0].count),
      total_enrollments: parseInt(totalEnrollments.rows[0].count),
      total_certificates: parseInt(totalCertificates.rows[0].count),
      upcoming_events: parseInt(upcomingEvents.rows[0].count),
      past_events: parseInt(recentEvents.rows[0].count),
      attendance_rate: parseFloat(attendanceRate),
      participation_trends: trendsResult.rows
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Council/Club analytics
router.get('/council/:id', authenticate, async (req, res) => {
  try {
    if (!canViewAnalytics(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const councilId = req.params.id;

    const [
      eventsResult,
      enrollmentsResult,
      attendanceResult
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as count, status 
         FROM events 
         WHERE council_id = $1 
         GROUP BY status`,
        [councilId]
      ),
      pool.query(
        `SELECT COUNT(*) as count 
         FROM event_enrollments ee
         JOIN events e ON ee.event_id = e.id
         WHERE e.council_id = $1`,
        [councilId]
      ),
      pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE ee.attended = true) as attended,
          COUNT(*) as total
         FROM event_enrollments ee
         JOIN events e ON ee.event_id = e.id
         WHERE e.council_id = $1`,
        [councilId]
      )
    ]);

    const attendanceRate = attendanceResult.rows[0].total > 0
      ? (attendanceResult.rows[0].attended / attendanceResult.rows[0].total * 100).toFixed(2)
      : 0;

    res.json({
      events_by_status: eventsResult.rows,
      total_enrollments: parseInt(enrollmentsResult.rows[0].count),
      attendance_rate: parseFloat(attendanceRate)
    });
  } catch (error) {
    console.error('Get council analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Club analytics
router.get('/club/:id', authenticate, async (req, res) => {
  try {
    if (!canViewAnalytics(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const clubId = req.params.id;

    const [
      eventsResult,
      enrollmentsResult,
      attendanceResult
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as count, status 
         FROM events 
         WHERE club_id = $1 
         GROUP BY status`,
        [clubId]
      ),
      pool.query(
        `SELECT COUNT(*) as count 
         FROM event_enrollments ee
         JOIN events e ON ee.event_id = e.id
         WHERE e.club_id = $1`,
        [clubId]
      ),
      pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE ee.attended = true) as attended,
          COUNT(*) as total
         FROM event_enrollments ee
         JOIN events e ON ee.event_id = e.id
         WHERE e.club_id = $1`,
        [clubId]
      )
    ]);

    const attendanceRate = attendanceResult.rows[0].total > 0
      ? (attendanceResult.rows[0].attended / attendanceResult.rows[0].total * 100).toFixed(2)
      : 0;

    res.json({
      events_by_status: eventsResult.rows,
      total_enrollments: parseInt(enrollmentsResult.rows[0].count),
      attendance_rate: parseFloat(attendanceRate)
    });
  } catch (error) {
    console.error('Get club analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


import express from 'express';
import pool from '../config/database.js';
import { authenticate, canCreateEvents, canApproveEvents, canMarkAttendance } from '../middleware/auth.js';
import { sendEnrollmentConfirmation, sendEventReminder } from '../utils/email.js';

const router = express.Router();

// Get all events (with filters) - Public access for approved events
router.get('/', async (req, res) => {
  try {
    const { status, council_id, club_id, upcoming, search } = req.query;

    // For public access, only show approved events
    // Authenticated users can see all events based on their role
    const isAuthenticated = req.headers.authorization;
    const defaultStatus = isAuthenticated ? null : 'approved';
    const finalStatus = status || defaultStatus;

    let query = `
      SELECT e.*, 
             c.name as council_name, 
             cl.name as club_name,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM event_enrollments WHERE event_id = e.id) as enrollment_count
      FROM events e
      LEFT JOIN councils c ON e.council_id = c.id
      LEFT JOIN clubs cl ON e.club_id = cl.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (finalStatus) {
      paramCount++;
      query += ` AND e.status = $${paramCount}`;
      params.push(finalStatus);
    }

    if (council_id) {
      paramCount++;
      query += ` AND e.council_id = $${paramCount}`;
      params.push(council_id);
    }

    if (club_id) {
      paramCount++;
      query += ` AND e.club_id = $${paramCount}`;
      params.push(club_id);
    }

    if (upcoming === 'true') {
      query += ` AND e.start_date > CURRENT_TIMESTAMP`;
    }

    if (search) {
      paramCount++;
      query += ` AND (e.title ILIKE $${paramCount} OR e.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY e.start_date ASC';

    const result = await pool.query(query, params);
    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get event by ID - Public access for approved events
router.get('/:id', async (req, res) => {
  try {
    // Try to authenticate, but don't require it
    let user = null;
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userResult = await pool.query(
          'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
          [decoded.userId]
        );
        if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
          user = userResult.rows[0];
        }
      }
    } catch (authError) {
      // Not authenticated, continue as public user
    }

    const result = await pool.query(
      `SELECT e.*, 
              c.name as council_name, 
              cl.name as club_name,
              u.name as created_by_name,
              (SELECT COUNT(*) FROM event_enrollments WHERE event_id = e.id) as enrollment_count,
              (SELECT COUNT(*) FROM event_enrollments WHERE event_id = e.id AND attended = true) as attendance_count
       FROM events e
       LEFT JOIN councils c ON e.council_id = c.id
       LEFT JOIN clubs cl ON e.club_id = cl.id
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = result.rows[0];

    // Only show approved events to public, authenticated users can see all
    if (!user && event.status !== 'approved') {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user is enrolled (only for authenticated students)
    if (user && user.role === 'student') {
      const enrollment = await pool.query(
        'SELECT * FROM event_enrollments WHERE event_id = $1 AND user_id = $2',
        [req.params.id, user.id]
      );
      event.is_enrolled = enrollment.rows.length > 0;
    }

    res.json({ event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create event
router.post('/', authenticate, async (req, res) => {
  try {
    if (!canCreateEvents(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to create events' });
    }

    const {
      title,
      description,
      event_type,
      council_id,
      club_id,
      venue,
      start_date,
      end_date,
      registration_deadline,
      max_participants,
      certificate_eligible,
      image_url
    } = req.body;

    if (!title || !event_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'Title, event type, start date, and end date are required' });
    }

    const result = await pool.query(
      `INSERT INTO events (
        title, description, event_type, council_id, club_id, created_by,
        venue, start_date, end_date, registration_deadline, max_participants, certificate_eligible, status, image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13)
      RETURNING *`,
      [
        title,
        description,
        event_type,
        council_id || null,
        club_id || null,
        req.user.id,
        venue,
        start_date,
        end_date,
        registration_deadline || null,
        max_participants || null,
        certificate_eligible || false,
        image_url || null
      ]
    );

    res.status(201).json({ event: result.rows[0] });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve event
router.post('/:id/approve', authenticate, async (req, res) => {
  try {
    if (!canApproveEvents(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to approve events' });
    }

    const result = await pool.query(
      `UPDATE events 
       SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event: result.rows[0] });
  } catch (error) {
    console.error('Approve event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update event
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, event_type, council_id, club_id,
      venue, start_date, end_date, registration_deadline,
      max_participants, certificate_eligible, image_url
    } = req.body;

    // Check permissions: Super Admin or specific roles
    if (!canCreateEvents(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Verify event ownership or super admin status
    const eventCheck = await pool.query('SELECT created_by, status FROM events WHERE id = $1', [id]);
    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck.rows[0];

    // Allow update if Super Admin OR (Creator AND Event is Pending)
    // Note: Adjust logic if creators should edit approved events
    const isSuperAdmin = req.user.role === 'super_admin';
    const isCreator = event.created_by === req.user.id;

    if (!isSuperAdmin && !isCreator) {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const result = await pool.query(
      `UPDATE events SET
        title = $1, description = $2, event_type = $3, council_id = $4, club_id = $5,
        venue = $6, start_date = $7, end_date = $8, registration_deadline = $9,
        max_participants = $10, certificate_eligible = $11, image_url = $12,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING *`,
      [
        title, description, event_type, council_id || null, club_id || null,
        venue, start_date, end_date, registration_deadline || null,
        max_participants || null, certificate_eligible || false, image_url || null,
        id
      ]
    );

    res.json({ event: result.rows[0] });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enroll in event (students only)
router.post('/:id/enroll', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can enroll in events' });
    }

    // Check if event exists and is approved
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];
    if (event.status !== 'approved') {
      return res.status(400).json({ error: 'Event is not approved for enrollment' });
    }

    // Check registration deadline
    if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }

    // Check max participants
    if (event.max_participants) {
      const enrollmentCount = await pool.query(
        'SELECT COUNT(*) FROM event_enrollments WHERE event_id = $1',
        [req.params.id]
      );
      if (parseInt(enrollmentCount.rows[0].count) >= event.max_participants) {
        return res.status(400).json({ error: 'Event is full' });
      }
    }

    // Check if already enrolled
    const existingEnrollment = await pool.query(
      'SELECT * FROM event_enrollments WHERE event_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (existingEnrollment.rows.length > 0) {
      return res.status(400).json({ error: 'Already enrolled in this event' });
    }

    // Create enrollment
    const enrollmentResult = await pool.query(
      `INSERT INTO event_enrollments (event_id, user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    // Send confirmation email
    try {
      await sendEnrollmentConfirmation(req.user, event);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    res.status(201).json({ enrollment: enrollmentResult.rows[0] });
  } catch (error) {
    console.error('Enroll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark attendance
router.post('/:id/attendance', authenticate, async (req, res) => {
  try {
    if (!canMarkAttendance(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to mark attendance' });
    }

    const { user_id, attended } = req.body;

    if (typeof attended !== 'boolean') {
      return res.status(400).json({ error: 'attended must be a boolean' });
    }

    const result = await pool.query(
      `UPDATE event_enrollments
       SET attended = $1, attendance_marked_at = CURRENT_TIMESTAMP
       WHERE event_id = $2 AND user_id = $3
       RETURNING *`,
      [attended, req.params.id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({ enrollment: result.rows[0] });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Finalize attendance
router.post('/:id/finalize-attendance', authenticate, async (req, res) => {
  try {
    if (!canMarkAttendance(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(
      `UPDATE events
       SET attendance_finalized = true
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event: result.rows[0] });
  } catch (error) {
    console.error('Finalize attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get event enrollments
router.get('/:id/enrollments', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(
      `SELECT ee.*, u.name, u.email, u.student_id
       FROM event_enrollments ee
       JOIN users u ON ee.user_id = u.id
       WHERE ee.event_id = $1
       ORDER BY ee.enrolled_at DESC`,
      [req.params.id]
    );

    res.json({ enrollments: result.rows });
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Submit feedback (students only)
router.post('/:id/feedback', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can submit feedback' });
    }

    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if event exists and has ended
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];
    if (new Date(event.end_date) > new Date()) {
      return res.status(400).json({ error: 'Cannot submit feedback before event ends' });
    }

    // Check if user is enrolled
    const enrollmentCheck = await pool.query(
      'SELECT * FROM event_enrollments WHERE event_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (enrollmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You must be enrolled in the event to submit feedback' });
    }

    // Check if feedback already exists
    const existingFeedback = await pool.query(
      'SELECT * FROM event_feedback WHERE event_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (existingFeedback.rows.length > 0) {
      return res.status(400).json({ error: 'You have already submitted feedback for this event' });
    }

    const result = await pool.query(
      `INSERT INTO event_feedback (event_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.id, req.user.id, rating, comment]
    );

    res.status(201).json({ feedback: result.rows[0] });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


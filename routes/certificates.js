import express from 'express';
import pool from '../config/database.js';
import { authenticate, canGenerateCertificates, canRevokeCertificates } from '../middleware/auth.js';
import { generateCertificateId, generateCertificateData } from '../utils/certificate.js';
import { sendCertificateNotification } from '../utils/email.js';

const router = express.Router();

// Generate certificates for an event
router.post('/generate/:eventId', authenticate, async (req, res) => {
  try {
    if (!canGenerateCertificates(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get event
    const eventResult = await pool.query(
      'SELECT * FROM events WHERE id = $1',
      [req.params.eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    if (!event.certificate_eligible) {
      return res.status(400).json({ error: 'Event is not certificate eligible' });
    }

    if (!event.attendance_finalized) {
      return res.status(400).json({ error: 'Attendance must be finalized before generating certificates' });
    }

    // Get all attendees
    const attendeesResult = await pool.query(
      `SELECT u.* FROM event_enrollments ee
       JOIN users u ON ee.user_id = u.id
       WHERE ee.event_id = $1 AND ee.attended = true`,
      [req.params.eventId]
    );

    const certificates = [];
    const errors = [];

    for (const user of attendeesResult.rows) {
      try {
        // Check if certificate already exists
        const existingCert = await pool.query(
          'SELECT * FROM certificates WHERE user_id = $1 AND event_id = $2 AND revoked = false',
          [user.id, event.id]
        );

        if (existingCert.rows.length > 0) {
          certificates.push(existingCert.rows[0]);
          continue;
        }

        const certificateId = generateCertificateId();
        const certData = generateCertificateData(user, event, certificateId);

        const certResult = await pool.query(
          `INSERT INTO certificates (certificate_id, user_id, event_id, issued_by)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [certificateId, user.id, event.id, req.user.id]
        );

        certificates.push(certResult.rows[0]);

        // Send notification email
        try {
          await sendCertificateNotification(user, certResult.rows[0], event);
        } catch (emailError) {
          console.error('Failed to send certificate email:', emailError);
        }
      } catch (error) {
        errors.push({ user: user.name, error: error.message });
      }
    }

    res.json({
      success: true,
      certificates_generated: certificates.length,
      certificates,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Generate certificates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get certificates for a user
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // Users can only view their own certificates unless they have permission
    if (req.user.id !== userId && !canGenerateCertificates(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(
      `SELECT c.*, e.title as event_title, e.start_date as event_date, e.venue as event_venue
       FROM certificates c
       JOIN events e ON c.event_id = e.id
       WHERE c.user_id = $1 AND c.revoked = false
       ORDER BY c.issued_at DESC`,
      [userId]
    );

    res.json({ certificates: result.rows });
  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get certificate by ID
router.get('/:certificateId', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, 
              u.name as user_name, u.student_id,
              e.title as event_title, e.start_date as event_date, e.venue as event_venue,
              issuer.name as issued_by_name
       FROM certificates c
       JOIN users u ON c.user_id = u.id
       JOIN events e ON c.event_id = e.id
       LEFT JOIN users issuer ON c.issued_by = issuer.id
       WHERE c.certificate_id = $1`,
      [req.params.certificateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const cert = result.rows[0];

    // Users can only view their own certificates unless they have permission
    if (req.user.id !== cert.user_id && !canGenerateCertificates(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json({ certificate: cert });
  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke certificate
router.post('/:certificateId/revoke', authenticate, async (req, res) => {
  try {
    if (!canRevokeCertificates(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await pool.query(
      `UPDATE certificates
       SET revoked = true, revoked_at = CURRENT_TIMESTAMP, revoked_by = $1
       WHERE certificate_id = $2 AND revoked = false
       RETURNING *`,
      [req.user.id, req.params.certificateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found or already revoked' });
    }

    res.json({ certificate: result.rows[0] });
  } catch (error) {
    console.error('Revoke certificate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


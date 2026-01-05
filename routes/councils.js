import express from 'express';
import pool from '../config/database.js';
import { authenticate, canManageCouncils } from '../middleware/auth.js';

const router = express.Router();

// Get all councils - Public access
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name as admin_name, u.email as admin_email,
              (SELECT COUNT(*) FROM clubs WHERE council_id = c.id) as club_count
       FROM councils c
       LEFT JOIN users u ON c.admin_id = u.id
       ORDER BY c.name`
    );
    res.json({ councils: result.rows });
  } catch (error) {
    console.error('Get councils error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get council by slug - Public access
router.get('/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name as admin_name, u.email as admin_email
       FROM councils c
       LEFT JOIN users u ON c.admin_id = u.id
       WHERE c.slug = $1`,
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Council not found' });
    }

    const council = result.rows[0];

    // Get clubs
    const clubsResult = await pool.query(
      `SELECT cl.*, 
              u1.name as chair_name, u2.name as co_chair_name,
              u3.name as secretary_name, u4.name as general_secretary_name
       FROM clubs cl
       LEFT JOIN users u1 ON cl.chair_id = u1.id
       LEFT JOIN users u2 ON cl.co_chair_id = u2.id
       LEFT JOIN users u3 ON cl.secretary_id = u3.id
       LEFT JOIN users u4 ON cl.general_secretary_id = u4.id
       WHERE cl.council_id = $1
       ORDER BY cl.name`,
      [council.id]
    );

    // Get events
    const eventsResult = await pool.query(
      `SELECT * FROM events 
       WHERE council_id = $1 AND status = 'approved'
       ORDER BY start_date ASC`,
      [council.id]
    );

    council.clubs = clubsResult.rows;
    council.events = eventsResult.rows;

    res.json({ council });
  } catch (error) {
    console.error('Get council error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update council
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (!canManageCouncils(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, admin_id } = req.body;
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (name) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
    }

    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      params.push(description);
    }

    if (admin_id !== undefined) {
      paramCount++;
      updates.push(`admin_id = $${paramCount}`);
      params.push(admin_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE councils SET ${updates.join(', ')} WHERE id = $${paramCount}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Council not found' });
    }

    res.json({ council: result.rows[0] });
  } catch (error) {
    console.error('Update council error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


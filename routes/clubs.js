import express from 'express';
import pool from '../config/database.js';
import { authenticate, canManageClubs } from '../middleware/auth.js';

const router = express.Router();

// Get all clubs - Public access
router.get('/', async (req, res) => {
  try {
    const { council_id } = req.query;
    let query = `
      SELECT cl.*, 
             c.name as council_name, c.slug as council_slug,
             u1.name as chair_name, u2.name as co_chair_name,
             u3.name as secretary_name, u4.name as general_secretary_name
      FROM clubs cl
      LEFT JOIN councils c ON cl.council_id = c.id
      LEFT JOIN users u1 ON cl.chair_id = u1.id
      LEFT JOIN users u2 ON cl.co_chair_id = u2.id
      LEFT JOIN users u3 ON cl.secretary_id = u3.id
      LEFT JOIN users u4 ON cl.general_secretary_id = u4.id
      WHERE 1=1
    `;
    const params = [];

    if (council_id) {
      query += ' AND cl.council_id = $1';
      params.push(council_id);
    }

    query += ' ORDER BY cl.name';

    const result = await pool.query(query, params);
    res.json({ clubs: result.rows });
  } catch (error) {
    console.error('Get clubs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get club by slug - Public access
router.get('/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cl.*, 
              c.name as council_name, c.slug as council_slug,
              u1.name as chair_name, u1.email as chair_email,
              u2.name as co_chair_name, u2.email as co_chair_email,
              u3.name as secretary_name, u3.email as secretary_email,
              u4.name as general_secretary_name, u4.email as general_secretary_email
       FROM clubs cl
       LEFT JOIN councils c ON cl.council_id = c.id
       LEFT JOIN users u1 ON cl.chair_id = u1.id
       LEFT JOIN users u2 ON cl.co_chair_id = u2.id
       LEFT JOIN users u3 ON cl.secretary_id = u3.id
       LEFT JOIN users u4 ON cl.general_secretary_id = u4.id
       WHERE cl.slug = $1`,
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    const club = result.rows[0];

    // Get events
    const eventsResult = await pool.query(
      `SELECT * FROM events 
       WHERE club_id = $1 AND status = 'approved'
       ORDER BY start_date ASC`,
      [club.id]
    );

    club.events = eventsResult.rows;

    res.json({ club });
  } catch (error) {
    console.error('Get club error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update club
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (!canManageClubs(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, chair_id, co_chair_id, secretary_id, general_secretary_id } = req.body;
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

    if (chair_id !== undefined) {
      paramCount++;
      updates.push(`chair_id = $${paramCount}`);
      params.push(chair_id);
    }

    if (co_chair_id !== undefined) {
      paramCount++;
      updates.push(`co_chair_id = $${paramCount}`);
      params.push(co_chair_id);
    }

    if (secretary_id !== undefined) {
      paramCount++;
      updates.push(`secretary_id = $${paramCount}`);
      params.push(secretary_id);
    }

    if (general_secretary_id !== undefined) {
      paramCount++;
      updates.push(`general_secretary_id = $${paramCount}`);
      params.push(general_secretary_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE clubs SET ${updates.join(', ')} WHERE id = $${paramCount}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    res.json({ club: result.rows[0] });
  } catch (error) {
    console.error('Update club error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


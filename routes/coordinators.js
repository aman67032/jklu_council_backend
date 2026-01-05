import express from 'express';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all coordinators - Public access
router.get('/', async (req, res) => {
  try {
    const { council_id, club_id, role } = req.query;

    let query = `
      WITH coordinators AS (
        SELECT 
          u.id, u.name, u.email, u.phone, u.student_id,
          'chair' as role_type,
          cl.id as club_id, cl.name as club_name,
          c.id as council_id, c.name as council_name
        FROM users u
        JOIN clubs cl ON u.id = cl.chair_id
        JOIN councils c ON cl.council_id = c.id
        WHERE u.role = 'club_chair'
        
        UNION ALL
        
        SELECT 
          u.id, u.name, u.email, u.phone, u.student_id,
          'co_chair' as role_type,
          cl.id as club_id, cl.name as club_name,
          c.id as council_id, c.name as council_name
        FROM users u
        JOIN clubs cl ON u.id = cl.co_chair_id
        JOIN councils c ON cl.council_id = c.id
        WHERE u.role = 'club_co_chair'
        
        UNION ALL
        
        SELECT 
          u.id, u.name, u.email, u.phone, u.student_id,
          'secretary' as role_type,
          cl.id as club_id, cl.name as club_name,
          c.id as council_id, c.name as council_name
        FROM users u
        JOIN clubs cl ON u.id = cl.secretary_id
        JOIN councils c ON cl.council_id = c.id
        WHERE u.role = 'club_secretary'
        
        UNION ALL
        
        SELECT 
          u.id, u.name, u.email, u.phone, u.student_id,
          'general_secretary' as role_type,
          cl.id as club_id, cl.name as club_name,
          c.id as council_id, c.name as council_name
        FROM users u
        JOIN clubs cl ON u.id = cl.general_secretary_id
        JOIN councils c ON cl.council_id = c.id
        WHERE u.role = 'club_general_secretary'
        
        UNION ALL
        
        SELECT 
          u.id, u.name, u.email, u.phone, u.student_id,
          'council_admin' as role_type,
          NULL as club_id, NULL as club_name,
          c.id as council_id, c.name as council_name
        FROM users u
        JOIN councils c ON u.id = c.admin_id
        WHERE u.role = 'council_admin'
      )
      SELECT * FROM coordinators WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (council_id) {
      paramCount++;
      query += ` AND council_id = $${paramCount}`;
      params.push(council_id);
    }

    if (club_id) {
      paramCount++;
      query += ` AND club_id = $${paramCount}`;
      params.push(club_id);
    }

    if (role) {
      paramCount++;
      query += ` AND role_type = $${paramCount}`;
      params.push(role);
    }

    query += ' ORDER BY council_name, club_name, role_type';

    const result = await pool.query(query, params);
    res.json({ coordinators: result.rows });
  } catch (error) {
    console.error('Get coordinators error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


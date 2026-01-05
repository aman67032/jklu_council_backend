import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { authenticate, authorize, canCreateUsers, canAssignRoles } from '../middleware/auth.js';

const router = express.Router();

// Get all users (with filters)
router.get('/', authenticate, async (req, res) => {
  try {
    const { role, council_id, club_id, search } = req.query;
    let query = 'SELECT id, email, name, role, student_id, phone, created_at, is_active FROM users WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (role) {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      params.push(role);
    }

    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR student_id ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, student_id, phone, created_at, is_active FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user
router.post('/', authenticate, async (req, res) => {
  try {
    if (!canCreateUsers(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to create users' });
    }

    const { email, password, name, role, student_id, phone } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name, and role are required' });
    }

    // Check if role assignment is allowed
    if (!canAssignRoles(req.user.role) && ['super_admin', 'head_student_affairs', 'executive_student_affairs'].includes(role)) {
      return res.status(403).json({ error: 'Cannot assign this role' });
    }

    // Check if email already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, student_id, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, role, student_id, phone, created_at`,
      [email.toLowerCase(), hashedPassword, name, role, student_id || null, phone || null]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, role, student_id, phone, is_active } = req.body;
    const userId = parseInt(req.params.id);

    // Users can update their own profile (except role), admins can update anyone
    if (req.user.id !== userId && !canCreateUsers(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Only admins can change roles
    if (role && !canAssignRoles(req.user.role)) {
      return res.status(403).json({ error: 'Cannot modify roles' });
    }

    const updates = [];
    const params = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      params.push(name);
    }

    if (role !== undefined && canAssignRoles(req.user.role)) {
      paramCount++;
      updates.push(`role = $${paramCount}`);
      params.push(role);
    }

    if (student_id !== undefined) {
      paramCount++;
      updates.push(`student_id = $${paramCount}`);
      params.push(student_id);
    }

    if (phone !== undefined) {
      paramCount++;
      updates.push(`phone = $${paramCount}`);
      params.push(phone);
    }

    if (is_active !== undefined && canCreateUsers(req.user.role)) {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    params.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}
       RETURNING id, email, name, role, student_id, phone, created_at, is_active`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


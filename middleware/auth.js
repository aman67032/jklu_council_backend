import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists and is active
    const result = await pool.query(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const user = result.rows[0];

    // Fetch associated entity (Club or Council)
    if (['club_chair', 'club_co_chair', 'club_secretary', 'club_general_secretary'].includes(user.role)) {
      const clubResult = await pool.query(
        `SELECT id, name FROM clubs 
         WHERE chair_id = $1 OR co_chair_id = $1 OR secretary_id = $1 OR general_secretary_id = $1`,
        [user.id]
      );
      if (clubResult.rows.length > 0) {
        user.managed_club = clubResult.rows[0];
      }
    } else if (['council_admin', 'president', 'head_student_affairs', 'executive_student_affairs'].includes(user.role)) {
      const councilResult = await pool.query(
        'SELECT id, name FROM councils WHERE admin_id = $1',
        [user.id]
      );
      if (councilResult.rows.length > 0) {
        user.managed_council = councilResult.rows[0];
      }
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Permission check helpers
export const canCreateUsers = (role) => {
  return ['super_admin', 'head_student_affairs', 'executive_student_affairs'].includes(role);
};

export const canAssignRoles = (role) => {
  return ['super_admin'].includes(role);
};

export const canManageCouncils = (role) => {
  return ['super_admin', 'head_student_affairs', 'executive_student_affairs'].includes(role);
};

export const canManageClubs = (role) => {
  return ['super_admin', 'head_student_affairs', 'executive_student_affairs', 'council_admin'].includes(role);
};

export const canCreateEvents = (role) => {
  return ['super_admin', 'head_student_affairs', 'executive_student_affairs', 'president', 'council_admin', 'club_chair', 'club_co_chair', 'club_secretary', 'club_general_secretary'].includes(role);
};

export const canApproveEvents = (role) => {
  return ['super_admin', 'head_student_affairs', 'executive_student_affairs', 'president', 'council_admin'].includes(role);
};

export const canMarkAttendance = (role) => {
  return ['super_admin', 'head_student_affairs', 'executive_student_affairs', 'council_admin', 'club_chair', 'club_co_chair', 'club_secretary', 'club_general_secretary'].includes(role);
};

export const canGenerateCertificates = (role) => {
  return ['super_admin', 'head_student_affairs', 'executive_student_affairs', 'council_admin'].includes(role);
};

export const canRevokeCertificates = (role) => {
  return ['super_admin', 'head_student_affairs', 'executive_student_affairs'].includes(role);
};

export const canViewAnalytics = (role) => {
  return ['super_admin', 'head_student_affairs', 'executive_student_affairs', 'president', 'council_admin', 'club_chair', 'club_co_chair', 'club_secretary', 'club_general_secretary'].includes(role);
};


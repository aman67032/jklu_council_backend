
import pool from './config/database.js';

async function approveEvent() {
    try {
        const res = await pool.query("UPDATE events SET status = 'approved' WHERE title = 'Git & GitHub Workshop' RETURNING *");
        console.log('Approved Event:', res.rows[0]);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

approveEvent();

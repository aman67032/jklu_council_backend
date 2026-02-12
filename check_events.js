
import pool from './config/database.js';

async function checkEvents() {
    try {
        const res = await pool.query('SELECT id, title, start_date, status FROM events');
        console.log('Events in DB:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkEvents();


import pool from './config/database.js';

async function addImageColumn() {
    try {
        await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT");
        console.log('Added image_url column to events table');
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

addImageColumn();

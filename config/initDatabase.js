import pool from './database.js';

const initDatabase = async () => {
  try {
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        student_id VARCHAR(50),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS councils (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        admin_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS clubs (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        council_id INTEGER REFERENCES councils(id),
        chair_id INTEGER REFERENCES users(id),
        co_chair_id INTEGER REFERENCES users(id),
        secretary_id INTEGER REFERENCES users(id),
        general_secretary_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_type VARCHAR(50) NOT NULL,
        council_id INTEGER REFERENCES councils(id),
        club_id INTEGER REFERENCES clubs(id),
        created_by INTEGER REFERENCES users(id),
        venue VARCHAR(255),
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        registration_deadline TIMESTAMP,
        max_participants INTEGER,
        status VARCHAR(50) DEFAULT 'pending',
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        certificate_eligible BOOLEAN DEFAULT false,
        attendance_finalized BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_enrollments (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        attended BOOLEAN DEFAULT false,
        attendance_marked_at TIMESTAMP,
        UNIQUE(event_id, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id SERIAL PRIMARY KEY,
        certificate_id VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id),
        event_id INTEGER REFERENCES events(id),
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        issued_by INTEGER REFERENCES users(id),
        revoked BOOLEAN DEFAULT false,
        revoked_at TIMESTAMP,
        revoked_by INTEGER REFERENCES users(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        council_id INTEGER REFERENCES councils(id),
        club_id INTEGER REFERENCES clubs(id),
        created_by INTEGER REFERENCES users(id),
        priority VARCHAR(50) DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_reminders (
        id SERIAL PRIMARY KEY,
        enrollment_id INTEGER REFERENCES event_enrollments(id) ON DELETE CASCADE,
        reminder_type VARCHAR(50) NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_feedback (
        id SERIAL PRIMARY KEY,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      )
    `);

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_user ON event_enrollments(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_event ON event_enrollments(event_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`);

    console.log('✅ Database tables created successfully');

    // Create default Super Admin if not exists
    const adminCheck = await pool.query('SELECT * FROM users WHERE role = $1', ['super_admin']);
    if (adminCheck.rows.length === 0) {
      const bcrypt = (await import('bcryptjs')).default;
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        `INSERT INTO users (email, password_hash, name, role) 
         VALUES ($1, $2, $3, $4)`,
        ['admin@jklu.edu.in', hashedPassword, 'Super Admin', 'super_admin']
      );
      console.log('✅ Default Super Admin created (email: admin@jklu.edu.in, password: admin123)');
    }

    // Create default councils
    const councils = [
      { name: 'Council of Academic Affairs', slug: 'academic-affairs' },
      { name: 'Council of Cultural Affairs', slug: 'cultural-affairs' },
      { name: 'Council of Campus Life', slug: 'campus-life' },
      { name: 'Council of Technical Affairs', slug: 'technical-affairs' },
      { name: 'Council of Sports Affairs', slug: 'sports-affairs' },
      { name: 'Council of Public Relations', slug: 'public-relations' }
    ];

    for (const council of councils) {
      await pool.query(
        `INSERT INTO councils (name, slug) 
         VALUES ($1, $2) 
         ON CONFLICT (slug) DO NOTHING`,
        [council.name, council.slug]
      );
    }

    // Create default clubs
    const clubs = [
      { name: 'Technology Club', slug: 'technology-club', council: 'technical-affairs' },
      { name: 'Robotics Club', slug: 'robotics-club', council: 'technical-affairs' },
      { name: 'Astronomy Club', slug: 'astronomy-club', council: 'technical-affairs' },
      { name: 'Design Club', slug: 'design-club', council: 'cultural-affairs' },
      { name: 'Business Club', slug: 'business-club', council: 'academic-affairs' },
      { name: 'Competitive Programming (CP) Club', slug: 'cp-club', council: 'technical-affairs' },
      { name: 'Dance Club', slug: 'dance-club', council: 'cultural-affairs' },
      { name: 'Drama Club', slug: 'drama-club', council: 'cultural-affairs' },
      { name: 'Music Club', slug: 'music-club', council: 'cultural-affairs' },
      { name: 'Art Club', slug: 'art-club', council: 'cultural-affairs' },
      { name: 'Media Club', slug: 'media-club', council: 'public-relations' },
      { name: 'Literary Club', slug: 'literary-club', council: 'cultural-affairs' },
      { name: 'CDC (Career Development Cell)', slug: 'cdc', council: 'academic-affairs' },
      { name: 'Photography Club', slug: 'photography-club', council: 'cultural-affairs' }
    ];

    for (const club of clubs) {
      const councilResult = await pool.query('SELECT id FROM councils WHERE slug = $1', [club.council]);
      if (councilResult.rows.length > 0) {
        await pool.query(
          `INSERT INTO clubs (name, slug, council_id) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (slug) DO NOTHING`,
          [club.name, club.slug, councilResult.rows[0].id]
        );
      }
    }

    // Migration: Handle potential 'astro-club' to 'astronomy-club' transition
    const oldClub = await pool.query("SELECT id FROM clubs WHERE slug = 'astro-club'");
    if (oldClub.rows.length > 0) {
      const newClub = await pool.query("SELECT id FROM clubs WHERE slug = 'astronomy-club'");
      
      if (newClub.rows.length > 0) {
        // Both exist: migrate data to new club and delete old one
        const oldId = oldClub.rows[0].id;
        const newId = newClub.rows[0].id;
        
        console.log(`Migrating data from 'astro-club' (id: ${oldId}) to 'astronomy-club' (id: ${newId})`);
        
        // Update references in events
        await pool.query("UPDATE events SET club_id = $1 WHERE club_id = $2", [newId, oldId]);
        
        // Update references in announcements
        await pool.query("UPDATE announcements SET club_id = $1 WHERE club_id = $2", [newId, oldId]);
        
        // Delete old club
        await pool.query("DELETE FROM clubs WHERE id = $1", [oldId]);
      } else {
        // Only old club exists: rename it
        await pool.query("UPDATE clubs SET name = 'Astronomy Club', slug = 'astronomy-club' WHERE slug = 'astro-club'");
        console.log("Renamed 'astro-club' to 'Astronomy Club'");
      }
    }

    console.log('✅ Default councils and clubs created');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

export default initDatabase;


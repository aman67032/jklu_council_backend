# JKLU Council & Clubs Digital Management Platform - Backend

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   The `.env` file is already configured with the database connection. Update email settings if needed:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

3. **Initialize Database**
   The database will be automatically initialized when you start the server. It will create:
   - All necessary tables
   - Default Super Admin (admin@jklu.edu.in / admin123)
   - Default councils and clubs

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **API Endpoints**
   The API will be available at `http://localhost:5000/api`

## Default Admin Account

- **Email:** admin@jklu.edu.in
- **Password:** admin123

## API Routes

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Events
- `GET /api/events` - Get all events (with filters)
- `GET /api/events/:id` - Get event details
- `POST /api/events` - Create event (requires auth)
- `POST /api/events/:id/enroll` - Enroll in event (students only)
- `POST /api/events/:id/approve` - Approve event (admin)
- `POST /api/events/:id/attendance` - Mark attendance

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user

### Councils & Clubs
- `GET /api/councils` - Get all councils
- `GET /api/councils/:slug` - Get council details
- `GET /api/clubs` - Get all clubs
- `GET /api/clubs/:slug` - Get club details

### Certificates
- `POST /api/certificates/generate/:eventId` - Generate certificates
- `GET /api/certificates/user/:userId` - Get user certificates
- `GET /api/certificates/:certificateId` - Get certificate details

### Analytics
- `GET /api/analytics/system` - System-wide analytics
- `GET /api/analytics/council/:id` - Council analytics
- `GET /api/analytics/club/:id` - Club analytics

### Coordinators
- `GET /api/coordinators` - Get all coordinators (with filters)

## Database Schema

The platform uses PostgreSQL with the following main tables:
- `users` - User accounts and roles
- `councils` - Council information
- `clubs` - Club information
- `events` - Event details
- `event_enrollments` - Student enrollments
- `certificates` - Generated certificates
- `notifications` - In-app notifications
- `announcements` - System announcements

## Email Reminders

The system automatically sends email reminders:
- 48 hours before event
- 12 hours before event
- 1 hour before event

Configure email settings in `.env` to enable email functionality.

## Tech Stack

- Node.js
- Express.js
- PostgreSQL (Neon)
- JWT for authentication
- Bcrypt for password hashing
- Nodemailer for emails


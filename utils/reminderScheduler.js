import pool from '../config/database.js';
import { sendEventReminder } from './email.js';

// This would typically run as a cron job or scheduled task
export const checkAndSendReminders = async () => {
  try {
    const now = new Date();
    
    // 48 hours before
    const hours48 = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const hours12 = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const hours1 = new Date(now.getTime() + 1 * 60 * 60 * 1000);

    // Get events starting in 48 hours (±30 min window)
    const checkReminders = async (targetTime, hoursBefore) => {
      const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000);
      const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);

      const eventsResult = await pool.query(
        `SELECT e.* FROM events e
         WHERE e.start_date BETWEEN $1 AND $2
         AND e.status = 'approved'`,
        [windowStart, windowEnd]
      );

      for (const event of eventsResult.rows) {
        // Get enrollments
        const enrollmentsResult = await pool.query(
          `SELECT ee.*, u.* 
           FROM event_enrollments ee
           JOIN users u ON ee.user_id = u.id
           WHERE ee.event_id = $1`,
          [event.id]
        );

        for (const enrollment of enrollmentsResult.rows) {
          // Check if reminder already sent
          const reminderCheck = await pool.query(
            `SELECT * FROM email_reminders 
             WHERE enrollment_id = $1 AND reminder_type = $2`,
            [enrollment.id, `${hoursBefore}_hours`]
          );

          if (reminderCheck.rows.length === 0) {
            try {
              await sendEventReminder(enrollment, event, hoursBefore);
              
              // Record reminder
              await pool.query(
                `INSERT INTO email_reminders (enrollment_id, reminder_type)
                 VALUES ($1, $2)`,
                [enrollment.id, `${hoursBefore}_hours`]
              );
            } catch (emailError) {
              console.error(`Failed to send ${hoursBefore}h reminder:`, emailError);
            }
          }
        }
      }
    };

    await checkReminders(hours48, 48);
    await checkReminders(hours12, 12);
    await checkReminders(hours1, 1);

    console.log('Reminder check completed');
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
};

// Start the reminder scheduler (call this after database is initialized)
export const startReminderScheduler = () => {
  // Run every 30 minutes
  setInterval(checkAndSendReminders, 30 * 60 * 1000);
  // Run immediately
  checkAndSendReminders();
  console.log('📧 Reminder scheduler started');
};


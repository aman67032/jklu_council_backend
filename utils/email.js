import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendEmail = async (to, subject, html, text) => {
  try {
    const info = await transporter.sendMail({
      from: `"JKLU Council System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    });
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export const sendEnrollmentConfirmation = async (user, event) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Event Enrollment Confirmation</h2>
      <p>Dear ${user.name},</p>
      <p>You have successfully enrolled in the following event:</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">${event.title}</h3>
        <p><strong>Date & Time:</strong> ${new Date(event.start_date).toLocaleString()}</p>
        <p><strong>Venue:</strong> ${event.venue || 'TBA'}</p>
        <p><strong>Description:</strong> ${event.description || 'N/A'}</p>
      </div>
      <p>We look forward to seeing you at the event!</p>
      <p>Best regards,<br>JKLU Council System</p>
    </div>
  `;

  return sendEmail(user.email, `Enrollment Confirmation: ${event.title}`, html);
};

export const sendEventReminder = async (user, event, hoursBefore) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Event Reminder</h2>
      <p>Dear ${user.name},</p>
      <p>This is a reminder that you have an upcoming event in ${hoursBefore} hours:</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">${event.title}</h3>
        <p><strong>Date & Time:</strong> ${new Date(event.start_date).toLocaleString()}</p>
        <p><strong>Venue:</strong> ${event.venue || 'TBA'}</p>
        ${event.contact_person ? `<p><strong>Contact:</strong> ${event.contact_person}</p>` : ''}
      </div>
      <p>Don't forget to attend!</p>
      <p>Best regards,<br>JKLU Council System</p>
    </div>
  `;

  return sendEmail(user.email, `Reminder: ${event.title} in ${hoursBefore} hours`, html);
};

export const sendCertificateNotification = async (user, certificate, event) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Certificate Available</h2>
      <p>Dear ${user.name},</p>
      <p>Your certificate for the following event is now available:</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">${event.title}</h3>
        <p><strong>Certificate ID:</strong> ${certificate.certificate_id}</p>
        <p><strong>Issued Date:</strong> ${new Date(certificate.issued_at).toLocaleDateString()}</p>
      </div>
      <p>You can download your certificate from your student dashboard.</p>
      <p>Best regards,<br>JKLU Council System</p>
    </div>
  `;

  return sendEmail(user.email, `Certificate Available: ${event.title}`, html);
};


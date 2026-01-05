import { v4 as uuidv4 } from 'uuid';

export const generateCertificateId = () => {
  return `JKLU-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
};

export const generateCertificateData = (user, event, certificateId) => {
  return {
    certificate_id: certificateId,
    user_id: user.id,
    event_id: event.id,
    issued_at: new Date(),
    student_name: user.name,
    student_id: user.student_id,
    event_title: event.title,
    event_date: event.start_date,
    event_venue: event.venue
  };
};


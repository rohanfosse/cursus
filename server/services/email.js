/**
 * Service Email — wrapper nodemailer pour les confirmations de RDV.
 * Configure via env : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 */
const nodemailer = require('nodemailer');
const log = require('../utils/logger');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@cursus.school';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_HOST) {
    log.warn('SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
}

async function sendBookingConfirmation({ to, tutorName, teacherName, studentName, eventTitle, startDatetime, endDatetime, teamsJoinUrl, cancelUrl }) {
  const t = getTransporter();
  if (!t) {
    log.warn('Skipping confirmation email (SMTP not configured)');
    return false;
  }

  const startDate = new Date(startDatetime);
  const dateStr = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(endDatetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #3b82f6; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">RDV confirme</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">${eventTitle}</p>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px;">Bonjour <strong>${tutorName}</strong>,</p>
        <p style="margin: 0 0 16px;">Votre rendez-vous a bien ete reserve :</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr><td style="padding: 8px 0; color: #64748b; width: 120px;">Date</td><td style="padding: 8px 0; font-weight: 600;">${dateStr}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Horaire</td><td style="padding: 8px 0; font-weight: 600;">${timeStr} - ${endTime}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Enseignant</td><td style="padding: 8px 0;">${teacherName}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Etudiant</td><td style="padding: 8px 0;">${studentName}</td></tr>
        </table>
        ${teamsJoinUrl ? `
          <a href="${teamsJoinUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-bottom: 16px;">
            Rejoindre la reunion Teams
          </a>
        ` : ''}
        <p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">
          Besoin d'annuler ou reporter ?
          <a href="${cancelUrl}" style="color: #3b82f6;">Cliquez ici</a>
        </p>
      </div>
      <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 16px;">
        Envoye par Cursus &mdash; cursus.school
      </p>
    </div>
  `;

  try {
    await t.sendMail({
      from: SMTP_FROM,
      to,
      subject: `RDV confirme : ${eventTitle} - ${dateStr} ${timeStr}`,
      html,
    });
    return true;
  } catch (err) {
    log.warn('Email send failed', { error: err.message, to });
    return false;
  }
}

async function sendBookingCancellation({ to, tutorName, eventTitle, startDatetime, rebookUrl }) {
  const t = getTransporter();
  if (!t) return false;

  const startDate = new Date(startDatetime);
  const dateStr = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #ef4444; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">RDV annule</h1>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <p>Bonjour <strong>${tutorName}</strong>,</p>
        <p>Votre rendez-vous <strong>${eventTitle}</strong> du <strong>${dateStr} a ${timeStr}</strong> a ete annule.</p>
        ${rebookUrl ? `<p><a href="${rebookUrl}" style="color: #3b82f6; font-weight: 600;">Reserver un nouveau creneau</a></p>` : ''}
      </div>
    </div>
  `;

  try {
    await t.sendMail({
      from: SMTP_FROM,
      to,
      subject: `RDV annule : ${eventTitle} - ${dateStr}`,
      html,
    });
    return true;
  } catch (err) {
    log.warn('Cancellation email failed', { error: err.message, to });
    return false;
  }
}

function isConfigured() {
  return !!SMTP_HOST;
}

module.exports = { sendBookingConfirmation, sendBookingCancellation, isConfigured };

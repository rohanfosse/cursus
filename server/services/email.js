/**
 * Service Email — wrapper nodemailer pour les confirmations de RDV.
 * Configure via env : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 */
const nodemailer = require('nodemailer');
const log = require('../utils/logger');

const { escHtml } = require('../utils/escHtml');

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
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">${escHtml(eventTitle)}</p>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px;">Bonjour <strong>${escHtml(tutorName)}</strong>,</p>
        <p style="margin: 0 0 16px;">Votre rendez-vous a bien ete reserve :</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr><td style="padding: 8px 0; color: #64748b; width: 120px;">Date</td><td style="padding: 8px 0; font-weight: 600;">${dateStr}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Horaire</td><td style="padding: 8px 0; font-weight: 600;">${timeStr} - ${endTime}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Enseignant</td><td style="padding: 8px 0;">${escHtml(teacherName)}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Etudiant</td><td style="padding: 8px 0;">${escHtml(studentName)}</td></tr>
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
        <p>Bonjour <strong>${escHtml(tutorName)}</strong>,</p>
        <p>Votre rendez-vous <strong>${escHtml(eventTitle)}</strong> du <strong>${dateStr} a ${timeStr}</strong> a ete annule.</p>
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

async function sendBookingReminder({ to, tutorName, teacherName, eventTitle, startDatetime, teamsJoinUrl }) {
  const t = getTransporter();
  if (!t) return false;

  const startDate = new Date(startDatetime);
  const dateStr = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #f59e0b; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Rappel RDV demain</h1>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <p>Bonjour <strong>${escHtml(tutorName)}</strong>,</p>
        <p>Pour rappel, votre rendez-vous <strong>${escHtml(eventTitle)}</strong> avec <strong>${escHtml(teacherName)}</strong> est prevu :</p>
        <p style="font-size: 16px; font-weight: 700; color: #111827;">${dateStr} a ${timeStr}</p>
        ${teamsJoinUrl ? `<a href="${teamsJoinUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 8px;">Rejoindre la reunion Teams</a>` : ''}
      </div>
    </div>
  `;

  try {
    await t.sendMail({
      from: SMTP_FROM, to,
      subject: `Rappel : ${escHtml(eventTitle)} demain a ${timeStr}`,
      html,
    });
    return true;
  } catch (err) {
    log.warn('Reminder email failed', { error: err.message, to });
    return false;
  }
}

async function sendBookingReschedule({ to, tutorName, eventTitle, oldDatetime, rebookUrl }) {
  const t = getTransporter();
  if (!t) return false;

  const oldDate = new Date(oldDatetime);
  const dateStr = oldDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = oldDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #3b82f6; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">RDV reporte</h1>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <p>Bonjour <strong>${escHtml(tutorName)}</strong>,</p>
        <p>Votre rendez-vous <strong>${escHtml(eventTitle)}</strong> du <strong>${dateStr} a ${timeStr}</strong> a ete reporte.</p>
        <p><a href="${rebookUrl}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Choisir un nouveau creneau</a></p>
      </div>
    </div>
  `;

  try {
    await t.sendMail({
      from: SMTP_FROM, to,
      subject: `RDV reporte : ${escHtml(eventTitle)}`,
      html,
    });
    return true;
  } catch (err) {
    log.warn('Reschedule email failed', { error: err.message, to });
    return false;
  }
}

/**
 * Mail d'invitation envoye au lancement d'une campagne (1 par etudiant).
 * Contient le lien personnel /book/c/:token pour reserver son creneau.
 *
 * `replyTo` = notify_email du prof (si fourni) -> les questions des etudiants
 * arrivent direct chez le prof, sans passer par Cursus.
 */
async function sendCampaignInvite({ to, studentName, teacherName, campaignTitle, campaignDescription, bookingUrl, notifyEmail, deadlineDate }) {
  const t = getTransporter();
  if (!t) {
    log.warn('Skipping campaign invite (SMTP not configured)');
    return false;
  }

  const deadlineStr = deadlineDate
    ? new Date(deadlineDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #6366f1; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">${escHtml(campaignTitle)}</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Reservation d'un rendez-vous</p>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px;">Bonjour <strong>${escHtml(studentName)}</strong>,</p>
        <p style="margin: 0 0 16px;">${escHtml(teacherName)} t'invite a reserver un rendez-vous.</p>
        ${campaignDescription ? `<p style="margin: 0 0 16px; color: #475569;">${escHtml(campaignDescription)}</p>` : ''}
        ${deadlineStr ? `<p style="margin: 0 0 16px; font-size: 13px; color: #64748b;">A reserver avant le <strong>${deadlineStr}</strong>.</p>` : ''}
        <p style="margin: 24px 0;">
          <a href="${bookingUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Choisir mon creneau
          </a>
        </p>
        <p style="margin: 16px 0 0; font-size: 12px; color: #94a3b8;">
          Lien personnel — ne pas le partager.
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
      replyTo: notifyEmail || undefined,
      subject: `[${campaignTitle}] Reserve ton creneau`,
      html,
    });
    return true;
  } catch (err) {
    log.warn('Campaign invite email failed', { error: err.message, to });
    return false;
  }
}

/**
 * Mail de confirmation tripartite (etudiant + tuteur + prof) avec .ics attache.
 * Tous les destinataires recoivent le meme contenu et la meme invitation calendar
 * (METHOD:REQUEST -> Outlook propose Accepter/Refuser).
 */
async function sendTripartiteConfirmation({ studentEmail, studentName, tutorEmail, tutorName, teacherEmail, teacherName, eventTitle, startDatetime, endDatetime, joinUrl, cancelUrl, icsContent }) {
  const t = getTransporter();
  if (!t) {
    log.warn('Skipping tripartite confirmation (SMTP not configured)');
    return false;
  }

  const startDate = new Date(startDatetime);
  const dateStr = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(endDatetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #22c55e; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">RDV confirme</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">${escHtml(eventTitle)}</p>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr><td style="padding: 8px 0; color: #64748b; width: 130px;">Date</td><td style="padding: 8px 0; font-weight: 600;">${dateStr}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Horaire</td><td style="padding: 8px 0; font-weight: 600;">${timeStr} - ${endTime}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Enseignant</td><td style="padding: 8px 0;">${escHtml(teacherName || '-')}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Etudiant</td><td style="padding: 8px 0;">${escHtml(studentName || '-')}</td></tr>
          ${tutorName ? `<tr><td style="padding: 8px 0; color: #64748b;">Tuteur entreprise</td><td style="padding: 8px 0;">${escHtml(tutorName)}</td></tr>` : ''}
        </table>
        ${joinUrl ? `
          <p>
            <a href="${joinUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Rejoindre la visioconference
            </a>
          </p>
        ` : ''}
        <p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">
          L'invitation est jointe a ce mail (.ics). Ouvre-la pour ajouter le RDV a ton calendrier.
        </p>
        ${cancelUrl ? `<p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">Annuler ou reporter : <a href="${cancelUrl}" style="color: #3b82f6;">cliquez ici</a></p>` : ''}
      </div>
    </div>
  `;

  const recipients = [studentEmail, tutorEmail, teacherEmail].filter(Boolean);
  if (!recipients.length) return false;

  const attachments = icsContent ? [{
    filename: 'rdv.ics',
    content: icsContent,
    contentType: 'text/calendar; charset=utf-8; method=REQUEST',
  }] : [];

  try {
    await t.sendMail({
      from: SMTP_FROM,
      to: recipients.join(', '),
      replyTo: teacherEmail || undefined,
      subject: `RDV confirme : ${eventTitle} - ${dateStr} ${timeStr}`,
      html,
      attachments,
      icalEvent: icsContent ? { method: 'REQUEST', content: icsContent } : undefined,
    });
    return true;
  } catch (err) {
    log.warn('Tripartite confirmation email failed', { error: err.message, recipients });
    return false;
  }
}

function isConfigured() {
  return !!SMTP_HOST;
}

module.exports = {
  sendBookingConfirmation, sendBookingCancellation, sendBookingReminder, sendBookingReschedule,
  sendCampaignInvite, sendTripartiteConfirmation,
  isConfigured,
};

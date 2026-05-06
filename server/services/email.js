/**
 * Service Email — wrapper nodemailer pour les confirmations de RDV.
 * Configure via env : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 */
const nodemailer = require('nodemailer');
const log = require('../utils/logger');

const { escHtml, safeHttpUrl } = require('../utils/escHtml');
const { interpolateMacros, buildMacroVars } = require('../utils/emailMacros');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@cursus.school';

/**
 * Construit l'en-tete From RFC 5322 avec display name = nom du prof.
 * Pattern : `Prenom Nom <noreply@cursus.school>`. Si teacherName est vide,
 * on retombe sur l'adresse seule. Decision pilote (deep interview Q14) :
 * pas de mention "via Cursus" pour que le mail apparaisse comme venant
 * du prof — l'identite Cursus est portee par le branding visuel + footer.
 *
 * Securite : on echappe " et \ dans le display name pour eviter qu'un nom
 * malveillant brise le parsing RFC. Les autres caracteres speciaux sont
 * tolerees par les mailers grace au quoting double-quote.
 */
function formatFrom(teacherName) {
  const name = String(teacherName || '').trim()
  if (!name) return SMTP_FROM
  const safe = name.replace(/[\\"]/g, '')
  return `"${safe}" <${SMTP_FROM}>`
}

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

// ─── Shell HTML partage ────────────────────────────────────────────────────
//
// Design lignes directrices pour les emails transactionnels :
//   - typo system, taille confortable (15px), line-height 1.6
//   - palette restreinte : blanc + slate-900 (texte) + slate-600
//     (secondaire) + un seul accent indigo pour les CTA
//   - aucune barre coloree pleine largeur (look "SaaS bruyant"), aucun
//     emoji, aucun em-dash, aucun separateur visuel decoratif (<hr>)
//   - cadre tres discret (border 1px slate-200 + radius 8px) qui isole
//     visuellement le mail dans la boite reception sans tape-a-l'oeil
//   - pas de hero block colore : eyebrow + titre + corps de texte
//   - footer minimal une ligne, slate-400
//
// Compatibility :
//   - tables pour les colonnes (Outlook 2013-19 ne supporte pas flexbox)
//   - styles inline (Gmail strip <style>)
//   - max-width 580px (large lecture sur desktop, deborde pas mobile)

function emailShell({ eyebrow, title, intro, bodyHtml, cta, footnote }) {
  const ctaHtml = cta && cta.url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 8px;">
         <tr><td style="border-radius: 8px; background: #6366F1;">
           <a href="${escHtml(cta.url)}" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${escHtml(cta.label)}</a>
         </td></tr>
       </table>`
    : '';

  const introHtml = intro
    ? `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;">${intro}</p>`
    : '';

  const footnoteHtml = footnote
    ? `<p style="margin: 24px 0 0; font-size: 13px; line-height: 1.55; color: #64748b;">${footnote}</p>`
    : '';

  // Note : on n'inclut volontairement pas le mot "Cursus" dans le footer
  // pour rester sobre en pilote — l'identite est portee par le From et
  // par l'eyebrow. Le brandLine reste discret (slate-400 11px).
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title)}</title>
</head>
<body style="margin: 0; padding: 24px 16px; background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="580" style="max-width: 580px; width: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <tr><td style="padding: 36px 36px 32px;">
          ${eyebrow ? `<p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #6366F1;">${escHtml(eyebrow)}</p>` : ''}
          <h1 style="margin: 0 0 18px; font-size: 22px; font-weight: 700; line-height: 1.3; color: #0f172a;">${escHtml(title)}</h1>
          ${introHtml}
          ${bodyHtml || ''}
          ${ctaHtml}
          ${footnoteHtml}
        </td></tr>
      </table>
      <p style="margin: 16px 0 0; font-size: 11px; color: #94a3b8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">cursus.school</p>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Construit un tableau "Détails" cle-valeur dans le style sobre du shell.
 * `rows` : Array<{ label: string, value: string, mono?: boolean }>
 */
function detailsTable(rows) {
  if (!rows || rows.length === 0) return '';
  const trs = rows.map(r => `
    <tr>
      <td style="padding: 10px 16px 10px 0; font-size: 13px; color: #64748b; vertical-align: top; white-space: nowrap; width: 130px;">${escHtml(r.label)}</td>
      <td style="padding: 10px 0; font-size: 14px; color: #0f172a; font-weight: 600;${r.mono ? " font-family: 'SFMono-Regular', Menlo, Consolas, monospace;" : ''}">${r.value /* deja escape par l'appelant si HTML necessaire */}</td>
    </tr>
  `).join('');
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 4px 0 0; border-collapse: collapse;">
      ${trs}
    </table>`;
}

/**
 * Mail confirmation d'un RDV simple (lien public ou token attendee).
 * Vouvoiement (destinataire = tuteur entreprise externe le plus souvent).
 */
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

  // Whitelist scheme http(s) avant injection dans href + escape attribut.
  // z.string().url() autorise javascript:/data: -> sans ces 2 etapes, XSS dans
  // les clients mail HTML (Outlook web, Apple Mail) qui rendent les liens.
  const safeJoin = safeHttpUrl(teamsJoinUrl);
  const safeCancel = safeHttpUrl(cancelUrl);

  const details = detailsTable([
    { label: 'Date',       value: escHtml(dateStr) },
    { label: 'Horaire',    value: `${escHtml(timeStr)} à ${escHtml(endTime)}`, mono: true },
    { label: 'Type',       value: escHtml(eventTitle) },
    { label: 'Enseignant', value: escHtml(teacherName || '') },
    { label: 'Étudiant',   value: escHtml(studentName || '') },
  ]);

  const cancelLine = safeCancel
    ? `Pour annuler ou reporter ce rendez-vous, <a href="${escHtml(safeCancel)}" style="color: #6366F1; text-decoration: underline;">cliquez ici</a>.`
    : '';

  const html = emailShell({
    eyebrow: 'Rendez-vous confirmé',
    title: eventTitle,
    intro: `Bonjour ${escHtml(tutorName)}, votre rendez-vous a bien été enregistré. Voici les informations à conserver.`,
    bodyHtml: details,
    cta: safeJoin ? { label: 'Rejoindre la visioconférence', url: safeJoin } : null,
    footnote: cancelLine,
  });

  const text = [
    `Rendez-vous confirmé : ${eventTitle}`,
    '',
    `Bonjour ${tutorName},`,
    'Votre rendez-vous a bien été enregistré.',
    '',
    `Date      : ${dateStr}`,
    `Horaire   : ${timeStr} à ${endTime}`,
    `Avec      : ${teacherName || '-'}`,
    `Étudiant  : ${studentName || '-'}`,
    '',
    safeJoin   ? `Visio     : ${safeJoin}`   : '',
    safeCancel ? `Annuler   : ${safeCancel}` : '',
  ].filter(Boolean).join('\n');

  try {
    await t.sendMail({
      from: formatFrom(teacherName),
      to,
      subject: `Rendez-vous confirmé : ${eventTitle} le ${dateStr} à ${timeStr}`,
      html, text,
    });
    return true;
  } catch (err) {
    log.warn('Email send failed', { error: err.message, to });
    return false;
  }
}

/** Mail d'annulation envoye au tuteur (vouvoiement). */
async function sendBookingCancellation({ to, tutorName, teacherName, eventTitle, startDatetime, rebookUrl }) {
  const t = getTransporter();
  if (!t) return false;

  const startDate = new Date(startDatetime);
  const dateStr = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const safeRebook = safeHttpUrl(rebookUrl);

  const html = emailShell({
    eyebrow: 'Rendez-vous annulé',
    title: eventTitle,
    intro: `Bonjour ${escHtml(tutorName)}, le rendez-vous prévu le <strong>${escHtml(dateStr)} à ${escHtml(timeStr)}</strong> a été annulé.`,
    bodyHtml: '',
    cta: safeRebook ? { label: 'Réserver un nouveau créneau', url: safeRebook } : null,
    footnote: '',
  });

  const text = [
    `Rendez-vous annulé : ${eventTitle}`,
    '',
    `Bonjour ${tutorName},`,
    `Le rendez-vous prévu le ${dateStr} à ${timeStr} a été annulé.`,
    '',
    safeRebook ? `Réserver un nouveau créneau : ${safeRebook}` : '',
  ].filter(Boolean).join('\n');

  try {
    await t.sendMail({
      from: formatFrom(teacherName),
      to,
      subject: `Rendez-vous annulé : ${eventTitle} (${dateStr})`,
      html, text,
    });
    return true;
  } catch (err) {
    log.warn('Cancellation email failed', { error: err.message, to });
    return false;
  }
}

/**
 * Mail de rappel J-1.
 * Note v2.318 : plus appele en production. Decision pilote (Q15) :
 * l'invitation calendrier .ics suffit, le rappel auto est redondant.
 * Garde sa fonction au cas ou on reactive.
 */
async function sendBookingReminder({ to, tutorName, teacherName, eventTitle, startDatetime, teamsJoinUrl }) {
  const t = getTransporter();
  if (!t) return false;

  const startDate = new Date(startDatetime);
  const dateStr = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const safeJoin = safeHttpUrl(teamsJoinUrl);

  const details = detailsTable([
    { label: 'Date',    value: escHtml(dateStr) },
    { label: 'Horaire', value: escHtml(timeStr), mono: true },
    { label: 'Avec',    value: escHtml(teacherName || '') },
  ]);

  const html = emailShell({
    eyebrow: 'Rappel rendez-vous',
    title: eventTitle,
    intro: `Bonjour ${escHtml(tutorName)}, votre rendez-vous est prévu demain. Voici un rappel pour ne pas l'oublier.`,
    bodyHtml: details,
    cta: safeJoin ? { label: 'Rejoindre la visioconférence', url: safeJoin } : null,
    footnote: '',
  });

  const text = [
    `Rappel rendez-vous : ${eventTitle}`,
    '',
    `Bonjour ${tutorName},`,
    'Votre rendez-vous est prévu demain.',
    '',
    `Date    : ${dateStr}`,
    `Horaire : ${timeStr}`,
    `Avec    : ${teacherName || '-'}`,
    '',
    safeJoin ? `Visio   : ${safeJoin}` : '',
  ].filter(Boolean).join('\n');

  try {
    await t.sendMail({
      from: formatFrom(teacherName), to,
      subject: `Rappel : ${eventTitle} demain à ${timeStr}`,
      html, text,
    });
    return true;
  } catch (err) {
    log.warn('Reminder email failed', { error: err.message, to });
    return false;
  }
}

/** Mail de report envoye au tuteur (vouvoiement). */
async function sendBookingReschedule({ to, tutorName, teacherName, eventTitle, oldDatetime, rebookUrl }) {
  const t = getTransporter();
  if (!t) return false;

  const oldDate = new Date(oldDatetime);
  const dateStr = oldDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = oldDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const safeRebook = safeHttpUrl(rebookUrl);

  const html = emailShell({
    eyebrow: 'Rendez-vous reporté',
    title: eventTitle,
    intro: `Bonjour ${escHtml(tutorName)}, le rendez-vous prévu le <strong>${escHtml(dateStr)} à ${escHtml(timeStr)}</strong> a été reporté. Vous pouvez choisir un nouveau créneau ci-dessous.`,
    bodyHtml: '',
    cta: safeRebook ? { label: 'Choisir un nouveau créneau', url: safeRebook } : null,
    footnote: '',
  });

  const text = [
    `Rendez-vous reporté : ${eventTitle}`,
    '',
    `Bonjour ${tutorName},`,
    `Le rendez-vous prévu le ${dateStr} à ${timeStr} a été reporté.`,
    '',
    safeRebook ? `Nouveau créneau : ${safeRebook}` : '',
  ].filter(Boolean).join('\n');

  try {
    await t.sendMail({
      from: formatFrom(teacherName), to,
      subject: `Rendez-vous reporté : ${eventTitle}`,
      html, text,
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

  // bookingUrl est construit cote serveur a partir de SERVER_URL + token : safe en pratique,
  // mais on whitelist quand meme pour respecter le pattern (defense en profondeur).
  const safeBooking = safeHttpUrl(bookingUrl);
  if (!safeBooking) {
    log.warn('Skipping campaign invite : invalid booking URL', { bookingUrl });
    return false;
  }
  // Substitution des macros saisies par le prof dans la description.
  // Ex : "Bonjour {{prenom_etudiant}}, on fait le point sur ton stage."
  // -> "Bonjour Jean, on fait le point sur ton stage."
  // Application AVANT escapeHtml : les valeurs vars sont du texte brut.
  const interpolatedDesc = campaignDescription
    ? interpolateMacros(campaignDescription, buildMacroVars({
        studentName, teacherName, campaignTitle,
        // pas de date/heure encore : la reservation n'est pas faite
      }))
    : '';

  // Body : description de campagne (si fournie) + deadline (si fournie),
  // chacune dans un paragraphe sobre. Pas de blocs colores ni de listes
  // a puces decoratives — on reste sur du texte courant.
  const descParagraph = interpolatedDesc
    ? `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${escHtml(interpolatedDesc)}</p>`
    : '';
  const deadlineParagraph = deadlineStr
    ? `<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: #475569;">À réserver avant le <strong style="color: #0f172a;">${escHtml(deadlineStr)}</strong>.</p>`
    : '';

  // Tutoiement : destinataire = etudiant. Decision pilote (Q5) : tu pour
  // les etudiants, vous pour les tuteurs/profs externes.
  const html = emailShell({
    eyebrow: 'Invitation à un rendez-vous',
    title: campaignTitle,
    intro: `Bonjour ${escHtml(studentName)}, <strong>${escHtml(teacherName)}</strong> t'invite à réserver un créneau pour ce rendez-vous.`,
    bodyHtml: `${descParagraph}${deadlineParagraph}`,
    cta: { label: 'Choisir mon créneau', url: safeBooking },
    footnote: 'Ce lien est personnel et associé à ton adresse mail. Merci de ne pas le transférer à un tiers.',
  });

  const text = [
    `Invitation : ${campaignTitle}`,
    '',
    `Bonjour ${studentName},`,
    `${teacherName} t'invite à réserver un créneau pour ce rendez-vous.`,
    '',
    interpolatedDesc ? interpolatedDesc : '',
    interpolatedDesc ? '' : '',
    deadlineStr ? `À réserver avant le ${deadlineStr}.` : '',
    deadlineStr ? '' : '',
    `Pour choisir ton créneau : ${safeBooking}`,
    '',
    'Ce lien est personnel et associé à ton adresse mail. Merci de ne pas le transférer.',
  ].filter(Boolean).join('\n');

  try {
    await t.sendMail({
      from: formatFrom(teacherName),
      to,
      replyTo: notifyEmail || undefined,
      subject: `${campaignTitle} : choisis ton créneau`,
      html, text,
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
/**
 * Mail tripartite. Champs optionnels enrichis (deep interview Q7) :
 * `location` (lieu si presentiel), `agenda` (ordre du jour), `documents`
 * (a apporter). Affiches dans le mail seulement si fournis.
 *
 * `confirmUrl` (Q4) : si fourni, ajoute un lien "Confirmer ma presence"
 * dans le footnote, en plus du CTA "Rejoindre la visio".
 */
async function sendTripartiteConfirmation({ studentEmail, studentName, tutorEmail, tutorName, teacherEmail, teacherName, eventTitle, startDatetime, endDatetime, joinUrl, cancelUrl, icsContent, location, agenda, documents, confirmUrl }) {
  const t = getTransporter();
  if (!t) {
    log.warn('Skipping tripartite confirmation (SMTP not configured)');
    return false;
  }

  const startDate = new Date(startDatetime);
  const dateStr = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(endDatetime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Whitelist scheme http(s) sur tous les liens injectes pour bloquer
  // javascript:/data: que zod a pu laisser passer (fallback_visio_url custom).
  const safeJoin = safeHttpUrl(joinUrl);
  const safeCancel = safeHttpUrl(cancelUrl);
  const safeConfirm = safeHttpUrl(confirmUrl);
  const detailsRows = [
    { label: 'Date',       value: escHtml(dateStr) },
    { label: 'Horaire',    value: `${escHtml(timeStr)} à ${escHtml(endTime)}`, mono: true },
    { label: 'Enseignant', value: escHtml(teacherName || '-') },
    { label: 'Étudiant',   value: escHtml(studentName || '-') },
  ];
  if (tutorName) detailsRows.push({ label: 'Tuteur entreprise', value: escHtml(tutorName) });
  if (location)  detailsRows.push({ label: 'Lieu',              value: escHtml(location) });
  const details = detailsTable(detailsRows);

  // Application des macros sur agenda + documents (le prof peut y mettre
  // {{prenom_etudiant}}, {{date_rdv}}, etc.).
  const macroVars = buildMacroVars({
    studentName, teacherName, campaignTitle: eventTitle, startDatetime,
    durationMinutes: Math.round((new Date(endDatetime) - new Date(startDatetime)) / 60000),
  })
  const interpolatedAgenda    = agenda    ? interpolateMacros(agenda,    macroVars) : ''
  const interpolatedDocuments = documents ? interpolateMacros(documents, macroVars) : ''

  // Sections enrichies (deep interview Q7) : ordre du jour + documents.
  // Chacune dans son propre paragraphe titre. Affiche seulement si renseigne.
  function sectionBlock(label, content) {
    if (!content) return ''
    return `
      <div style="margin: 18px 0 0;">
        <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b;">${escHtml(label)}</p>
        <div style="margin: 0; font-size: 14px; line-height: 1.55; color: #0f172a; white-space: pre-wrap;">${escHtml(content)}</div>
      </div>
    `
  }
  const enrichedHtml = sectionBlock('Ordre du jour', interpolatedAgenda) + sectionBlock('À apporter', interpolatedDocuments)

  const footnoteParts = [
    'Une invitation calendrier (.ics) est jointe à cet email. Ouvrez-la pour ajouter le rendez-vous à votre agenda.',
  ];
  if (safeConfirm) {
    footnoteParts.push(`<a href="${escHtml(safeConfirm)}" style="color: #6366F1; text-decoration: underline; font-weight: 600;">Confirmer ma présence</a> en un clic — le prof saura que vous serez bien là.`);
  }
  if (safeCancel) {
    footnoteParts.push(`Pour annuler ou reporter, <a href="${escHtml(safeCancel)}" style="color: #6366F1; text-decoration: underline;">cliquez ici</a>.`);
  }

  const html = emailShell({
    eyebrow: 'Rendez-vous confirmé',
    title: eventTitle,
    intro: 'Le rendez-vous est confirmé pour les trois parties. Voici les informations à conserver.',
    bodyHtml: details + enrichedHtml,
    cta: safeJoin ? { label: 'Rejoindre la visioconférence', url: safeJoin } : null,
    footnote: footnoteParts.join('<br>'),
  });

  const text = [
    `Rendez-vous confirmé : ${eventTitle}`,
    '',
    'Le rendez-vous est confirmé pour les trois parties.',
    '',
    `Date              : ${dateStr}`,
    `Horaire           : ${timeStr} à ${endTime}`,
    `Enseignant        : ${teacherName || '-'}`,
    `Étudiant          : ${studentName || '-'}`,
    tutorName ? `Tuteur entreprise : ${tutorName}` : '',
    location  ? `Lieu              : ${location}` : '',
    '',
    interpolatedAgenda    ? `Ordre du jour :\n${interpolatedAgenda}` : '',
    interpolatedAgenda    ? '' : '',
    interpolatedDocuments ? `À apporter :\n${interpolatedDocuments}` : '',
    interpolatedDocuments ? '' : '',
    safeJoin    ? `Visio    : ${safeJoin}`    : '',
    safeConfirm ? `Confirmer ma présence : ${safeConfirm}` : '',
    safeCancel  ? `Annuler  : ${safeCancel}`  : '',
    '',
    'Une invitation calendrier (.ics) est jointe à cet email.',
  ].filter(Boolean).join('\n');

  const recipients = [studentEmail, tutorEmail, teacherEmail].filter(Boolean);
  if (!recipients.length) return false;

  const attachments = icsContent ? [{
    filename: 'rdv.ics',
    content: icsContent,
    contentType: 'text/calendar; charset=utf-8; method=REQUEST',
  }] : [];

  try {
    await t.sendMail({
      from: formatFrom(teacherName),
      to: recipients.join(', '),
      replyTo: teacherEmail || undefined,
      subject: `Rendez-vous confirmé : ${eventTitle} le ${dateStr} à ${timeStr}`,
      html, text,
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

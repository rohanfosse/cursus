/**
 * Service Microsoft Graph — OAuth2 Azure AD + Calendar + Teams.
 * Gere l'acquisition de tokens, la lecture du calendrier Outlook,
 * la creation d'events et de reunions Teams.
 */
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
const log = require('../utils/logger');

// ── Config Azure AD (via env) ───────────────────────────────────────────
const TENANT_ID     = process.env.AZURE_TENANT_ID || '';
const CLIENT_ID     = process.env.AZURE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.AZURE_REDIRECT_URI || 'http://localhost:3001/api/bookings/oauth/callback';

const SCOPES = [
  'Calendars.ReadWrite',
  'OnlineMeetings.ReadWrite',
  'User.Read',
  'offline_access',
];

let msalClient = null;

function getMsalClient() {
  if (msalClient) return msalClient;
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    log.warn('Azure AD credentials not configured — set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET');
    return null;
  }
  msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      clientSecret: CLIENT_SECRET,
    },
  });
  return msalClient;
}

/** Build authorization URL for OAuth2 consent */
function getAuthUrl(state = '') {
  const client = getMsalClient();
  if (!client) return null;
  return client.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    state,
    prompt: 'consent',
  });
}

/** Exchange authorization code for tokens */
async function acquireTokenByCode(code) {
  const client = getMsalClient();
  if (!client) throw new Error('MSAL not configured');
  const result = await client.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  });
  return {
    accessToken: result.accessToken,
    // MSAL node doesn't return refresh_token directly in acquireTokenByCode
    // We store the account for silent acquisition
    expiresOn: result.expiresOn,
    account: result.account,
  };
}

/** Refresh token using MSAL silent flow */
async function acquireTokenSilent(account) {
  const client = getMsalClient();
  if (!client) throw new Error('MSAL not configured');
  const result = await client.acquireTokenSilent({
    account,
    scopes: SCOPES,
  });
  return result.accessToken;
}

/** Create a Graph client with a given access token */
function getGraphClient(accessToken) {
  return Client.init({
    authProvider: (done) => { done(null, accessToken); },
  });
}

/**
 * Get full calendar events (with id, subject, location, body, organizer) for display.
 * Returns richer data than getCalendarBusy.
 */
async function getCalendarEvents(accessToken, startDateTime, endDateTime) {
  const client = getGraphClient(accessToken);
  try {
    const result = await client.api('/me/calendarView')
      .query({
        startDateTime, endDateTime,
        $select: 'id,subject,start,end,showAs,location,bodyPreview,onlineMeeting,organizer,isAllDay,categories',
        $orderby: 'start/dateTime',
        $top: 200,
      })
      .get();
    return (result.value || [])
      // Skip events malformes (sans start ou end) plutot que crasher
      .filter(e => e?.start?.dateTime && e?.end?.dateTime)
      .map(e => ({
        id: e.id,
        subject: e.subject || '(sans titre)',
        start: e.start.dateTime,
        end: e.end.dateTime,
        timezone: e.start.timeZone || 'UTC',
        isAllDay: !!e.isAllDay,
        location: e.location?.displayName || null,
        bodyPreview: e.bodyPreview || null,
        teamsJoinUrl: e.onlineMeeting?.joinUrl || null,
        organizer: e.organizer?.emailAddress?.address || null,
        showAs: e.showAs || 'busy',
        categories: Array.isArray(e.categories) ? e.categories : [],
      }));
  } catch (err) {
    log.warn('getCalendarEvents error', { error: err.message });
    return [];
  }
}

/**
 * Get busy times from Outlook calendar.
 * Returns an array of { start, end } busy slots.
 */
async function getCalendarBusy(accessToken, startDateTime, endDateTime) {
  const client = getGraphClient(accessToken);
  try {
    const result = await client.api('/me/calendarView')
      .query({
        startDateTime: startDateTime,
        endDateTime: endDateTime,
        $select: 'start,end,subject,showAs',
        $top: 100,
      })
      .get();
    return (result.value || [])
      .filter(e => e?.start?.dateTime && e?.end?.dateTime && e.showAs !== 'free' && e.showAs !== 'tentative')
      .map(e => ({
        start: e.start.dateTime,
        end: e.end.dateTime,
        subject: e.subject,
      }));
  } catch (err) {
    log.warn('getCalendarBusy error', { error: err.message });
    return [];
  }
}

/**
 * Create an Outlook calendar event with an online Teams meeting.
 * Returns { eventId, teamsJoinUrl }.
 */
async function createEventWithTeams(accessToken, {
  subject, startDateTime, endDateTime, attendees, body, timeZone = 'Europe/Paris',
}) {
  const client = getGraphClient(accessToken);
  const safeAttendees = Array.isArray(attendees) ? attendees : [];
  const event = {
    subject,
    body: { contentType: 'HTML', content: body || '' },
    start: { dateTime: startDateTime, timeZone },
    end: { dateTime: endDateTime, timeZone },
    attendees: safeAttendees
      .filter(a => a && typeof a.email === 'string' && a.email)
      .map(a => ({
        emailAddress: { address: a.email, name: a.name || a.email },
        type: 'required',
      })),
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
  };

  const created = await client.api('/me/events').post(event);
  return {
    eventId: created.id,
    teamsJoinUrl: created.onlineMeeting?.joinUrl || null,
  };
}

/** Delete an Outlook calendar event */
async function deleteEvent(accessToken, eventId) {
  // Validate eventId format to prevent URL injection
  if (!eventId || !/^[A-Za-z0-9_+/=-]{10,200}$/.test(eventId)) {
    throw new Error('Invalid eventId format');
  }
  const client = getGraphClient(accessToken);
  await client.api(`/me/events/${eventId}`).delete();
}

/** Check if Azure AD is configured */
function isConfigured() {
  return !!(TENANT_ID && CLIENT_ID && CLIENT_SECRET);
}

module.exports = {
  isConfigured,
  getAuthUrl,
  acquireTokenByCode,
  acquireTokenSilent,
  getGraphClient,
  getCalendarBusy,
  getCalendarEvents,
  createEventWithTeams,
  deleteEvent,
  REDIRECT_URI,
};

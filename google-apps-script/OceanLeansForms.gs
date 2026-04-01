const OCEANLEANS_FORMS_CONFIG = {
  spreadsheetId: "1YL_RyGTNT4RRUtUCk5lil9WpF14Rd0Q_ld_LuqgLGEE",
  alertEmail: "oceanleans@gmail.com",
  minFillTimeMs: 1500,
  maxLengths: {
    name: 160,
    email: 320,
    message: 4000,
    page_url: 2000,
    user_agent: 1000,
    request_id: 120
  },
  sheets: {
    subscribe: "Subscribers",
    contact: "Contact"
  }
};

function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};
  const requestId = sanitizeText_(params.request_id, OCEANLEANS_FORMS_CONFIG.maxLengths.request_id);

  try {
    const formType = sanitizeText_(params.form_type, 20);

    if (!isAllowedFormType_(formType)) {
      return buildResponse_("error", requestId);
    }

    if (sanitizeText_(params._honey, 200)) {
      return buildResponse_("success", requestId);
    }

    const renderedAt = Number(params.rendered_at || 0);

    if (!Number.isFinite(renderedAt) || renderedAt <= 0 || (Date.now() - renderedAt) < OCEANLEANS_FORMS_CONFIG.minFillTimeMs) {
      return buildResponse_("success", requestId);
    }

    const sheet = getOrCreateSheet_(formType);
    const row = buildRow_(formType, params);
    sheet.appendRow(row);
    sendSubmissionAlert_(formType, params);

    return buildResponse_("success", requestId);
  } catch (error) {
    return buildResponse_("error", requestId);
  }
}

function isAllowedFormType_(formType) {
  return Object.prototype.hasOwnProperty.call(OCEANLEANS_FORMS_CONFIG.sheets, formType);
}

function getOrCreateSheet_(formType) {
  const spreadsheet = SpreadsheetApp.openById(OCEANLEANS_FORMS_CONFIG.spreadsheetId);
  const sheetName = OCEANLEANS_FORMS_CONFIG.sheets[formType];
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(getHeaders_(formType));
  }

  return sheet;
}

function getHeaders_(formType) {
  if (formType === "subscribe") {
    return ["Submitted At", "Email", "Page URL", "User Agent", "Request ID"];
  }

  return ["Submitted At", "Name", "Email", "Message", "Page URL", "User Agent", "Request ID"];
}

function buildRow_(formType, params) {
  const submittedAt = new Date();
  const email = sanitizeText_(params.email, OCEANLEANS_FORMS_CONFIG.maxLengths.email);
  const pageUrl = sanitizeText_(params.page_url, OCEANLEANS_FORMS_CONFIG.maxLengths.page_url);
  const userAgent = sanitizeText_(params.user_agent, OCEANLEANS_FORMS_CONFIG.maxLengths.user_agent);
  const requestId = sanitizeText_(params.request_id, OCEANLEANS_FORMS_CONFIG.maxLengths.request_id);

  if (formType === "subscribe") {
    return [submittedAt, email, pageUrl, userAgent, requestId];
  }

  const name = sanitizeText_(params.name, OCEANLEANS_FORMS_CONFIG.maxLengths.name);
  const message = sanitizeText_(params.message, OCEANLEANS_FORMS_CONFIG.maxLengths.message);

  return [submittedAt, name, email, message, pageUrl, userAgent, requestId];
}

function sanitizeText_(value, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, maxLength);
}

function sendSubmissionAlert_(formType, params) {
  const recipient = sanitizeText_(OCEANLEANS_FORMS_CONFIG.alertEmail, OCEANLEANS_FORMS_CONFIG.maxLengths.email);

  if (!recipient) {
    return;
  }

  const email = sanitizeText_(params.email, OCEANLEANS_FORMS_CONFIG.maxLengths.email);
  const pageUrl = sanitizeText_(params.page_url, OCEANLEANS_FORMS_CONFIG.maxLengths.page_url);
  const requestId = sanitizeText_(params.request_id, OCEANLEANS_FORMS_CONFIG.maxLengths.request_id);

  if (formType === "subscribe") {
    MailApp.sendEmail({
      to: recipient,
      subject: "OceanLeans: New subscriber",
      body:
        "A new subscribe form was submitted.\n\n" +
        "Email: " + email + "\n" +
        "Page URL: " + pageUrl + "\n" +
        "Request ID: " + requestId
    });
    return;
  }

  const name = sanitizeText_(params.name, OCEANLEANS_FORMS_CONFIG.maxLengths.name);
  const message = sanitizeText_(params.message, OCEANLEANS_FORMS_CONFIG.maxLengths.message);

  MailApp.sendEmail({
    to: recipient,
    subject: "OceanLeans: New contact form message",
    body:
      "A new contact form was submitted.\n\n" +
      "Name: " + name + "\n" +
      "Email: " + email + "\n" +
      "Message:\n" + message + "\n\n" +
      "Page URL: " + pageUrl + "\n" +
      "Request ID: " + requestId
  });
}

function buildResponse_(status, requestId) {
  const payload = JSON.stringify({
    source: "oceanleans-forms",
    status: status,
    requestId: requestId
  });

  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}

# Forms Setup

This site is prepared for a Google Sheets + Google Apps Script form backend without changing the current form UX.

## What stays the same

- The subscribe dropdown keeps the same layout and styling.
- The contact form keeps the same layout and styling.
- The forms submit in-page through JavaScript, so users do not get redirected away from the site.

## Files involved

- `forms-config.js`
- `forms.js`
- `google-apps-script/OceanLeansForms.gs`

## Setup steps

1. Create a Google Sheet.
2. Copy the sheet ID from the URL.
3. Create a new Google Apps Script project.
4. Paste the contents of `google-apps-script/OceanLeansForms.gs` into the script editor.
5. Replace `PASTE_YOUR_SPREADSHEET_ID_HERE` with your Google Sheet ID.
6. Deploy the script as a web app.

Deploy settings:

- Execute as: `Me`
- Who has access: `Anyone`

7. Copy the deployed web app URL.
8. Open `forms-config.js`.
9. Replace the empty `endpoint: ""` value with the deployed web app URL.

## Sheet tabs

The script will create these tabs if they do not exist:

- `Subscribers`
- `Contact`

## Stored fields

### Subscribers

- Submitted At
- Email
- Page URL
- User Agent
- Request ID

### Contact

- Submitted At
- Name
- Email
- Message
- Page URL
- User Agent
- Request ID

## Spam protection included

- Hidden honeypot field
- Minimum time-on-page check before submit
- Basic field length limits

## Current fallback

If `forms-config.js` does not contain an Apps Script URL yet, the forms will continue using their existing HTML `action` URLs.

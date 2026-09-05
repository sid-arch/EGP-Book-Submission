# EGP Story Submission Page

A responsive **dark-themed** GitHub Pages front end for collecting video submissions from the
Euler's Golden Pie activity book.

## What is already built

- Kid-friendly EGP-style landing page
- Storyteller name / nickname field
- Age-group selector
- Parent / guardian email required for under-18 age groups
- Drag-and-drop video picker
- MP4 / MOV / M4V / WebM validation
- 250 MB front-end size limit
- Local video preview
- Separate review and publishing-permission checkboxes
- Mobile-friendly layout
- Ready for a QR code once the final GitHub Pages URL is live


## Included branding assets

- `logo.png` — logo shown at the top of the page
- `favicon.png` — browser-tab icon

## Important: connect the upload backend

GitHub Pages is static hosting. It cannot securely store uploaded videos.

Open `config.js` and replace:

```js
UPLOAD_ENDPOINT: "YOUR-UPLOAD-ENDPOINT-HERE"
```

with your secure POST upload endpoint.

The site sends a `multipart/form-data` request containing:

- `video`
- `storytellerName`
- `ageGroup`
- `guardianEmail`
- `reviewConsent`
- `publishingPermission`
- `submittedAt`

Your backend should validate the file again, store it privately, and save the
submission metadata.

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `script.js`, and `config.js`.
3. Commit the files.
4. In the repository, open **Settings → Pages**.
5. Choose **Deploy from a branch**.
6. Select the `main` branch and `/ (root)`.
7. Save.
8. GitHub will provide your public Pages URL.
9. Test the final URL on a phone.
10. Only after testing, generate the QR code for the activity book.

## Local preview

Just open `index.html` in a browser. The form UI works locally, but actual
submission will intentionally stop until `UPLOAD_ENDPOINT` is configured.

## Before public launch

- Connect private video storage.
- Add server-side file-size and file-type validation.
- Add rate limiting / bot protection.
- Decide who receives submission notifications.
- Add your final privacy/terms links if desired.
- Test iPhone and Android uploads.
- Test a large phone-recorded MOV file.
- Generate the QR code from the permanent final URL.

## Latest tweak

- Enlarged the header logo significantly so it is a prominent centerpiece instead of a tiny icon.

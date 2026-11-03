const path = require('path');
const { getAuthenticatedClient } = require(path.resolve(__dirname, '../backend/dist/services/googleDriveService.js'));
const { google } = require(path.resolve(__dirname, '../backend/node_modules/googleapis'));

async function test() {
  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.get({
      fileId: '1xsYn1pnOjpGguKEHEV11nhVAPSj7P5Ca',
      fields: 'id, name, trashed'
    });
    console.log('Google Drive connected! File data:', res.data);
  } catch (err) {
    console.error('Google Drive error:', err.message, err.code);
  }
  process.exit(0);
}

test();


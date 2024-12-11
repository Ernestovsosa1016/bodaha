const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(bodyParser.json());
app.use(cors({ origin: 'https://heribertoalejandra.netlify.app' }));
app.use(express.static('public'));

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

let credentials;
if (process.env.GOOGLE_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
} else {
    credentials = require('./credentials.json');
}

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
});

auth.getClient().then(client => {
    google.options({ auth: client });

    const driveService = google.drive({ version: 'v3', auth: client });

    app.post('/upload', upload.array('files[]', 12), async (req, res) => {
        const files = req.files;

        if (!files || files.length === 0) {
            console.error('No files were uploaded.');
            return res.status(400).send('No files were uploaded.');
        }

        try {
            const uploadedFiles = await Promise.all(files.map(file => {
                console.log(`Uploading file: ${file.originalname}`);
                const fileMetadata = { name: file.originalname };
                const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };

                return driveService.files.create({
                    resource: fileMetadata,
                    media: media,
                    fields: 'id, webViewLink'
                }).then(async response => {
                    const fileId = response.data.id;
                    // Hacer público el archivo
                    await driveService.permissions.create({
                        fileId: fileId,
                        requestBody: {
                            role: 'reader',
                            type: 'anyone',
                        }
                    });
                    console.log(`File uploaded: ${file.originalname} with ID: ${fileId}`);
                    fs.unlinkSync(file.path); // Remove the file from local folder after upload
                    return {
                        id: fileId,
                        name: file.originalname,
                        url: response.data.webViewLink
                    };
                });
            }));

            console.log('All files uploaded successfully.');
            res.status(200).json({ message: 'Files uploaded successfully', files: uploadedFiles });
        } catch (error) {
            console.error('Error uploading files:', error);
            res.status(500).send('Error uploading files');
        }
    });

    app.get('/gallery', async (req, res) => {
        try {
            console.log('Fetching gallery...');
            const response = await driveService.files.list({
                pageSize: 10, 
                fields: 'files(id, name, webViewLink)'
            });

            const files = response.data.files.map(file => {
                console.log(`File found: ${file.name} with URL: ${file.webViewLink}`);
                return { name: file.name, url: file.webViewLink };
            });

            console.log('Gallery fetched successfully.');
            res.status(200).json({ images: files });
        } catch (error) {
            console.error('Error fetching gallery:', error);
            res.status(500).send('Error fetching gallery');
        }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(error => {
    console.error('Error initializing Google Auth:', error);
    process.exit(1);
});

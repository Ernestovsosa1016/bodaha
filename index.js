const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(bodyParser.json());
app.use(express.static('public'));

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const KEYFILEPATH = path.join(__dirname, 'credentials.json'); // Usa el archivo de credenciales

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES
});

const driveService = google.drive({ version: 'v3', auth });

app.post('/upload', upload.array('files[]', 12), async (req, res) => {
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    try {
        const uploadedFiles = await Promise.all(files.map(file => {
            const fileMetadata = { name: file.originalname };
            const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };

            return driveService.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            }).then(response => {
                fs.unlinkSync(file.path); // Remove the file from local folder after upload
                return `https://drive.google.com/uc?id=${response.data.id}`;
            });
        }));

        res.status(200).json({ message: 'Files uploaded successfully', files: uploadedFiles });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading files');
    }
});

app.get('/gallery', async (req, res) => {
    try {
        const response = await driveService.files.list({
            pageSize: 10,
            fields: 'files(id, name)'
        });

        const files = response.data.files.map(file => {
            return { name: file.name, url: `https://drive.google.com/uc?id=${file.id}` };
        });

        res.status(200).json({ images: files });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching gallery');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

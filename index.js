const express = require('express');
const multer = require('multer');
const aws = require('aws-sdk');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: 'https://heribertoalejandra.netlify.app' }));  // Reemplaza con tu dominio de Netlify

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-1'
});

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).send('No file uploaded.');
    }

    const params = {
        Bucket: 'boda-album-fotos',
        Key: file.originalname,
        Body: fs.createReadStream(file.path),
        ContentType: file.mimetype
    };

    s3.upload(params, (err, data) => {
        if (err) {
            return res.status(500).send('Error uploading file.');
        }

        fs.unlinkSync(file.path);
        res.status(200).json({ message: 'File uploaded successfully', url: data.Location });
    });
});

app.get('/gallery', (req, res) => {
    const params = {
        Bucket: 'boda-album-fotos'
    };

    s3.listObjectsV2(params, (err, data) => {
        if (err) {
            return res.status(500).send('Error fetching gallery.');
        }

        const images = data.Contents.map(item => ({
            name: item.Key,
            url: `https://${params.Bucket}.s3.amazonaws.com/${item.Key}`
        }));

        res.status(200).json({ images });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

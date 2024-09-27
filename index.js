const express = require('express')
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express()
const port = 5000
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://podcastify-598b9.web.app'
    ],
    credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'coverImage') {
            cb(null, 'uploads/images');
        } else if (file.fieldname === 'audioFile') {
            cb(null, 'uploads/audios');
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
    }
});

// Initialize multer
const upload = multer({ storage: storage });




app.get('/', (req, res) => {
    res.send('Server is running...........!')
})


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://podcastify:XkLFI6W2yCRQ4MoQ@cluster0.lyuai16.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const podcastCollection = client.db("podcastify").collection("podcast");

        app.get('/podcast', async (req, res) => {
            try {
                const data = await podcastCollection.find().sort({ _id: -1 }).limit(9).toArray();
                res.status(200).send(data);
            } catch (error) {
                console.error("Error fetching podcasts:", error);
                res.status(500).send({ message: "Failed to fetch podcasts" });
            }
        });

        app.post('/upload', upload.fields([
            { name: 'coverImage', maxCount: 1 },
            { name: 'audioFile', maxCount: 1 }
        ]), async (req, res) => {
            try {
                const { title, host, guest, description, releaseDate, category, tags } = req.body;

                const coverImage = req.files['coverImage'] ? req.files['coverImage'][0].filename : null;
                const audioFile = req.files['audioFile'] ? req.files['audioFile'][0].filename : null;

                let tagsArray = [];
                if (Array.isArray(tags)) {
                    tagsArray = tags;
                } else if (typeof tags === 'string') {
                    tagsArray = tags.split(',').map(tag => tag.trim());
                }
                // Data object to be inserted into MongoDB
                const podcastData = {
                    title,
                    host,
                    guest,
                    description,
                    releaseDate: new Date(releaseDate),
                    category,
                    tags: tagsArray,
                    coverImageUrl: coverImage ? `/uploads/images/${coverImage}` : null,
                    audioFileUrl: audioFile ? `/uploads/audios/${audioFile}` : null
                };

                const result = await podcastCollection.insertOne(podcastData);
                res.status(201).send({ message: 'Podcast uploaded successfully', data: result });
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to upload podcast' });
            }
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
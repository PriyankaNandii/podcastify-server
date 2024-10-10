const express = require('express')
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express()
app.use(express.json()); 
const port = 5000
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://podcastify-598b9.web.app'
    ],
    credentials: true
}));

app.get("/", (req, res) => {
  res.send("Server is running...........!");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lyuai16.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
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

        app.post('/upload', async (req, res) => {
            try {
                const { title, musician, description, coverImage, audioFile, releaseDate, category, tags } = req.body;
                
                let tagsArray = [];
                if (Array.isArray(tags)) {
                    tagsArray = tags;
                } else if (typeof tags === 'string') {
                    tagsArray = tags.split(',').map(tag => tag.trim());
                }
                
                const musicData = {
                    title,
                    musician,
                    description,
                    coverImageUrl:coverImage,
                    audioFileUrl:audioFile,
                    releaseDate: new Date(releaseDate),
                    category,
                    tags: tagsArray
                };
                const result = await podcastCollection.insertOne(musicData);
                res.status(200).send({ message: 'Music uploaded successfully', data: result });
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to upload podcast' });
            }
        });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

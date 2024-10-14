const express = require('express')
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require("jsonwebtoken");
require('dotenv').config();
const { ObjectId } = require('mongodb');



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
        const userCollection = client.db("podcastify").collection("users");
        const announcement = client.db("podcastify").collection("announcement");
        const notificationReaction = client.db("podcastify").collection("reactions");

        // jwt related api
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "5h",
            });
            res.send({ token });
        });

        // middlewares
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "unauthorized access" });
            }
            const token = req.headers.authorization?.split(" ")[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "unauthorized  access" });
                }
                req.decoded = decoded;
                next();
            });
        };


   

    // admin stats or analytics
    app.get("/admin-stats", verifyToken, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      res.send({ users });
    });

    app.get("/podcast", async (req, res) => {

      try {
        const data = await podcastCollection
          .find()
          .sort({ _id: -1 })
          .limit(9)
          .toArray();
        res.status(200).send(data);
      } catch (error) {
        console.error("Error fetching podcasts:", error);
        res.status(500).send({ message: "Failed to fetch podcasts" });
      }
    });
        // Get All Music
        app.get('/podcast', async (req, res) => {
            try {
                const data = await podcastCollection.find().sort({ _id: -1 }).limit(9).toArray();
                res.status(200).send(data);
            } catch (error) {
                console.error("Error fetching podcasts:", error);
                res.status(500).send({ message: "Failed to fetch podcasts" });
            }
        });

        app.get('/manage-podcast', async (req, res) => {
            const { userEmail, page = 0, limit = 5 } = req.query;

            if (!userEmail) {
                return res.status(400).send({ message: "Email is required" });
            }

            const skip = page * limit;

  
    
            try {
                const podcasts = await podcastCollection.find({ userEmail: userEmail })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray();

                console.log("Podcasts Retrieved:", podcasts);  // Log the podcasts retrieved

                const total = await podcastCollection.countDocuments({ userEmail: userEmail });

                res.status(200).send({ podcasts, total });
            } catch (error) {
                console.error("Error fetching podcasts:", error);
                res.status(500).send({ message: "Failed to fetch podcasts" });
            }
        });

        // Upload Podcast
        app.post('/upload', async (req, res) => {
            try {
                const { title, musician, description, coverImage, audioFile, releaseDate, category, userEmail, tags } = req.body;

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
                    coverImageUrl: coverImage,
                    audioFileUrl: audioFile,
                    releaseDate: new Date(releaseDate),
                    category,
                    userEmail,
                    tags: tagsArray
                };
                const result = await podcastCollection.insertOne(musicData);
                res.status(200).send({ message: 'Music uploaded successfully', data: result });
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to upload podcast' });
            }
        });

        // Delete Music
        app.delete('/podcast/:id', async (req, res) => {
            try {
                console.log(req.params.id);
                const music_id = new ObjectId(req.params.id);
                console.log('Object ID:', music_id);
                const query = { _id: music_id };
                const result = await podcastCollection.deleteOne(query);
                if (!result) return res.status(404).send('Music not found');
                res.send({ message: 'Music deleted successfully' });
            } catch (error) {
                res.status(500).send('Server error');
            }
        });

        // Get Specific Music
        app.get("/podcast/:id", async (req, res) => {
            const podcastId = req.params.id;
            console.log(podcastId);
            try {
                const podcast = await podcastCollection.findOne({ _id: new ObjectId(podcastId) });
                if (!podcast) {
                    return res.status(404).json({ error: "Podcast not found" });
                }
                res.json(podcast);
            } catch (error) {
                console.error("Error fetching podcast:", error);
                res.status(500).json({ error: "Server error" });
            }
        });

        // Update Podcast
        app.put('/podcast/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const filter = { _id: new ObjectId(id) };
                const options = { upsert: true };
                const { title, musician, description, coverImage, audioFile, releaseDate, category, userEmail, tags } = req.body;

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
                    coverImageUrl: coverImage,
                    audioFileUrl: audioFile,
                    releaseDate: new Date(releaseDate),
                    category,
                    userEmail,
                    tags: tagsArray
                };
                // console.log(musicData);
                const updateData = {
                    $set: musicData
                };
                // console.log(updateData);
                const result = await podcastCollection.updateOne(filter, updateData, options);
                res.send(result);

            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Failed to upload podcast' });
            }
        })

        // all users data get
        app.get("/users", async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // get single user data
        app.get("/users/email/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }; // Querying by email
            const result = await userCollection.findOne(query);

            if (result) {
                res.send(result);
            } else {
                res.status(404).send({ message: "User not found" });
            }
        });

        // Update user data by email
        app.put("/users/email/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const { name, username, phoneNumber } = req.body;
            const query = { email: email };

            const update = {
                $set: {
                    name: name,
                    username: username,
                    phoneNumber: phoneNumber,
                },
            };

            try {
                const result = await userCollection.updateOne(query, update);
                if (result.modifiedCount > 0) {
                    res.status(200).send({ message: "User updated successfully" });
                } else {
                    res
                        .status(404)
                        .send({ message: "User not found or no changes made" });
                }
            } catch (error) {
                res.status(500).send({ error: "Error updating user" });
            }
        });

        // users data save to database when a user login
        app.post("/users", async (req, res) => {
            const user = req.body;
            // /* console.log("User data:", user); */
            const query = { email: user?.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User already exists", insertedId: null });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.post("/make-announcement", async (req, res) => {
            const body = req.body;
            const result = await announcement.insertOne(body);
            return result.insertedId ? res.send("Success") : res.send("Network error");
        });
        
        app.get("/announcements", async (req, res) => {
            const result = await announcement.find().toArray();
             res.send(result);
        });
        app.get("/announcements/:id", async (req, res) => {
            const id = req.params.id;
            const queryForAnnouncement = new ObjectId(id);
            const findAnnouncement = await announcement.findOne(queryForAnnouncement);
            let findPerson = {};
            const { email } = findAnnouncement;
            if (email) {
                const queryForPerson = { email};
                findPerson = await userCollection.findOne(queryForPerson);
                return res.send({ findAnnouncement, findPerson });
            }
            return res.send({findAnnouncement, findPerson});
        });

        app.post("/notification-reaction", async (req, res) => {
            const obj = req.body;
            const result = await notificationReaction.insertOne(obj);
            return res.send(result);
        });
        app.get("/notification-reaction/:id", async (req, res) => {
            const { id } = req.params;
            const result = await notificationReaction.find({ postId: id }).toArray();
            return res.send(result)
        })
        


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
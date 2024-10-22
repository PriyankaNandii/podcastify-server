const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const multer = require("multer");
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./firebaseServiceAccountKey.json");
require("dotenv").config();
const app = express();
const port = 5000;

// Middleware to parse JSON
app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:5173", "https://podcastify-598b9.web.app"],
    credentials: true,
  })
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "coverImage") {
      cb(null, "uploads/images");
    } else if (file.fieldname === "audioFile") {
      cb(null, "uploads/audios");
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique file name
  },
});

// Initialize multer
const videoStorage = multer.memoryStorage();
const videoUploader = multer({ videoStorage });
const upload = multer({ storage: storage });

// Initialize firebase-admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.get("/", (req, res) => {
  res.send("Server is running...........!");
});

const { MongoClient, ServerApiVersion, GridFSBucket } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lyuai16.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
let bucket;

async function run() {
  try {
    const db = client.db("podcastify");
    bucket = new GridFSBucket(db, { bucketName: "videos" });
    const podcastCollection = client.db("podcastify").collection("podcast");
    const userCollection = client.db("podcastify").collection("users");
    const announcement = client.db("podcastify").collection("announcement");
    const notificationReaction = client
      .db("podcastify")
      .collection("reactions");
    const playlistCollection = client.db("podcastify").collection("playlist");
    const ReviewsCollection = client.db("podcastify").collection("reviews");
    const subscribersCollection = client
      .db("podcastify")
      .collection("subscriber");

    app.post("/video-upload", videoUploader.single("video"), (req, res) => {
      const videoStream = req.file.buffer; // Video as buffer
      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });

      // Upload the video file to MongoDB GridFS
      uploadStream.end(videoStream, () => {
        res.send("Video uploaded successfully!");
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

      // Get All Music
      /*  app.get("/podcast", async (req, res) => {
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
      }); */
    });

    app.get("/video/:filename", (req, res) => {
      const filename = req.params.filename;

      // Find the video file metadata
      bucket.find({ filename: filename }).toArray((err, files) => {
        if (!files || files.length === 0) {
          return res.status(404).json({ err: "No video found" });
        }
        res.json(files);

        // Set the correct content type for video
        res.set("Content-Type", files[0].contentType);

        // Stream the video from GridFS
        bucket.openDownloadStreamByName(filename).pipe(res);
      });
    });

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res.send({ token });
    });

    // Update Podcast
    app.put("/podcast/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const {
          title,
          musician,
          description,
          coverImage,
          audioFile,
          releaseDate,
          category,
          userEmail,
          tags,
        } = req.body;

        let tagsArray = [];
        if (Array.isArray(tags)) {
          tagsArray = tags;
        } else if (typeof tags === "string") {
          tagsArray = tags.split(",").map((tag) => tag.trim());
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
          tags: tagsArray,
        };
        // console.log(musicData);
        const updateData = {
          $set: musicData,
        };
        // console.log(updateData);
        const result = await podcastCollection.updateOne(
          filter,
          updateData,
          options
        );
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to upload podcast" });
      }
    });

    // Playlist Start

    // Added playlist
    /* app.post("/playlist", async (req, res) => {
      try {
        const { music_id, title, user_email } = req.body;

        const query = {
          user_email: user_email,
          music_id: music_id,
        };

        const existingPlaylist = await playlistCollection.findOne(query);

        if (existingPlaylist) {
          return res.send({
            message: "Podcast already exists in playlist.",
            insertedId: null,
          });
        }

        const playlistData = {
          user_email,
          music_id,
          title,
        };
        const result = await playlistCollection.insertOne(playlistData);
        res
          .status(200)
          .send({ message: "Playlist Added successfully", data: result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to add playlist" });
      }
    }); */

    // Reviews collection data post
    app.post("/addReview", async (req, res) => {
      const usersReview = req.body;
      const result = await ReviewsCollection.insertOne(usersReview);
      res.send(result);
    });

    // Manage playlist
    // app.get("/manage-playlist", async (req, res) => {
    //   const { userEmail, page = 0, limit = 5 } = req.query;

    //   if (!userEmail) {
    //     return res.status(400).send({ message: "Email is required" });
    //   }

    //   const skip = page * limit;

    //     try {
    //         const playlist = await playlistCollection
    //             .find({ user_email: userEmail })
    //             .skip(skip)
    //             .limit(parseInt(limit))
    //             .toArray();

    //         const total = await playlistCollection.countDocuments({
    //             user_email: userEmail,

    //         });

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

    // Get All Music
    /* app.get("/podcast", async (req, res) => {
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
    }); */

    app.get("/manage-podcast", async (req, res) => {
      const { userEmail, page = 0, limit = 5 } = req.query;

      if (!userEmail) {
        return res.status(400).send({ message: "Email is required" });
      }

      const skip = page * limit;

      try {
        const podcasts = await podcastCollection
          .find({ userEmail: userEmail })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        console.log("Podcasts Retrieved:", podcasts); // Log the podcasts retrieved

        const total = await podcastCollection.countDocuments({
          userEmail: userEmail,
        });
        res.status(200).send({ podcasts, total });
      } catch (error) {
        console.error("Error fetching podcasts:", error);
        res.status(500).send({ message: "Failed to fetch podcasts" });
      }
    });
    // all reviews data get
    app.get("/allReviews", async (req, res) => {
      const result = await ReviewsCollection.find().toArray();
      res.send(result);
    });

    // Update user data by email
    app.put("/users/email/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const { name, username, phoneNumber } = req.body;
      const query = { email: email };
    });

    // Upload Podcast
    app.post("/upload", async (req, res) => {
      try {
        const {
          title,
          musician,
          description,
          coverImage,
          audioFile,
          releaseDate,
          category,
          userEmail,
          tags,
        } = req.body;

        let tagsArray = [];
        if (Array.isArray(tags)) {
          tagsArray = tags;
        } else if (typeof tags === "string") {
          tagsArray = tags.split(",").map((tag) => tag.trim());
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
          tags: tagsArray,
        };
        const result = await podcastCollection.insertOne(musicData);
        res
          .status(200)
          .send({ message: "Music uploaded successfully", data: result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to upload podcast" });
      }
    });

    // Delete Music
    app.delete("/podcast/:id", async (req, res) => {
      try {
        console.log(req.params.id);
        const music_id = new ObjectId(req.params.id);
        console.log("Object ID:", music_id);
        const query = { _id: music_id };
        const result = await podcastCollection.deleteOne(query);
        if (!result) return res.status(404).send("Music not found");
        res.send({ message: "Music deleted successfully" });
      } catch (error) {
        res.status(500).send("Server error");
      }
    });

    // Get Specific Music
    app.get("/podcast/:id", async (req, res) => {
      const podcastId = req.params.id;
      console.log(podcastId);
      try {
        const podcast = await podcastCollection.findOne({
          _id: new ObjectId(podcastId),
        });
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
    app.put("/podcast/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const {
          title,
          musician,
          description,
          coverImage,
          audioFile,
          releaseDate,
          category,
          userEmail,
          tags,
        } = req.body;

        let tagsArray = [];
        if (Array.isArray(tags)) {
          tagsArray = tags;
        } else if (typeof tags === "string") {
          tagsArray = tags.split(",").map((tag) => tag.trim());
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
          tags: tagsArray,
        };
        // console.log(musicData);
        const updateData = {
          $set: musicData,
        };
        // console.log(updateData);
        const result = await podcastCollection.updateOne(
          filter,
          updateData,
          options
        );
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to upload podcast" });
      }
    });

    // Playlist Start

    // Added playlist
    app.post("/playlist", async (req, res) => {
      try {
        const { music_id, title, user_email } = req.body;

        const query = {
          user_email: user_email,
          music_id: music_id,
        };

        const existingPlaylist = await playlistCollection.findOne(query);

        if (existingPlaylist) {
          return res.send({
            message: "Podcast already exists in playlist.",
            insertedId: null,
          });
        }

        const playlistData = {
          user_email,
          music_id,
          title,
        };
        const result = await playlistCollection.insertOne(playlistData);
        res
          .status(200)
          .send({ message: "Playlist Added successfully", data: result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to add playlist" });
      }
    });

    // admin stats or analytics
    app.get("/admin-stats", verifyToken, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      res.send({ users });
    });

    // get all podcasts
    app.get("/podcast", async (req, res) => {
      try {
        const { search, category, language } = req.query;
        const query = {};

        if (search) {
          query.title = { $regex: search, $options: "i" };
        }

        if (language) {
          query.tags = { $regex: language, $options: "i" };
        }
        const data = await podcastCollection
          .find(query)
          .sort({ _id: -1 })
          .toArray();

        res.status(200).send(data);
      } catch (error) {
        console.error("Error fetching podcasts:", error);
        res.status(500).send({ message: "Failed to fetch podcasts" });
      }
    });

    // Get All Music
    /* app.get("/podcast", async (req, res) => {
      try {
        const data = await podcastCollection.find().sort({ _id: -1 }).toArray();
        res.status(200).send(data);
      } catch (error) {
        console.error("Error fetching podcasts:", error);
        res.status(500).send({ message: "Failed to fetch podcasts" });
      }
      const existingPlaylist = await playlistCollection.findOne(query);

      if (existingPlaylist) {
        return res.send({
          message: "Podcast already exists in playlist.",
          insertedId: null,
        });
      }

      const playlistData = {
        user_email,
        music_id,
        title,
      };
      const result = await playlistCollection.insertOne(playlistData);
      try {
        res
          .status(200)
          .send({ message: "Playlist Added successfully", data: result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to add playlist" });
      }
    }); */

    // Manage playlist
    app.get("/manage-playlist", async (req, res) => {
      const { userEmail, page = 0, limit = 5 } = req.query;

      if (!userEmail) {
        return res.status(400).send({ message: "Email is required" });
      }

      const skip = page * limit;

      try {
        const playlist = await playlistCollection
          .find({ user_email: userEmail })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        const total = await playlistCollection.countDocuments({
          user_email: userEmail,
        });

        res.status(200).send({ playlist, total });
      } catch (error) {
        console.error("Error fetching playlist:", error);
        res.status(500).send({ message: "Failed to fetch playlist" });
      }
    });

    // Delete playlist item
    app.delete("/playlist/:id", async (req, res) => {
      try {
        const item_id = new ObjectId(req.params.id);
        const query = { _id: item_id };
        const result = await playlistCollection.deleteOne(query);
        if (!result) return res.status(404).send("Playlist Item not found");
        res.send({ message: "PLaylist podcast deleted successfully" });
      } catch (error) {
        res.status(500).send("Server error");
      }
    });

    // all users data get
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Request Podcaster
    app.get("/request-podcaster", async (req, res) => {
      const query = { flag: true };
      const result = await userCollection.find(query).toArray();
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

    // Podcast Request accept or decline
    app.put("/users/request/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const { flag, role } = req.body;
      const query = { email: email };

      const update = {
        $set: {
          flag: flag,
          role: role,
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

    // delete a user
    app.delete("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const user = await userCollection.findOne(query);

        // delete from database
        const result = await userCollection.deleteOne(query);

        if (user.uid && user.uid.length > 0) {
          // delete from firebase
          await admin.auth().deleteUser(user?.uid);
        } else {
          console.warn(`User UID is empty or invalid: ${user?.uid}`);
        }

        res.send(result);
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Internal server error" });
      }
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
      return result.insertedId
        ? res.send("Success")
        : res.send("Network error");
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
        const queryForPerson = { email };
        findPerson = await userCollection.findOne(queryForPerson);
        return res.send({ findAnnouncement, findPerson });
      }
      return res.send({ findAnnouncement, findPerson });
    });

    app.post("/notification-reaction", async (req, res) => {
      const obj = req.body;
      const result = await notificationReaction.insertOne(obj);
      return res.send(result);
    });
    app.get("/notification-reaction/:id", async (req, res) => {
      const { id } = req.params;
      const result = await notificationReaction.find({ postId: id }).toArray();
      return res.send(result);
    });

    app.post("/subscriptions", async (req, res) => {
      const data = req.body;
      console.log(data);
      const { podcasterId, subscriberEmail } = data;
      const ifAlreadySubscribed = await subscribersCollection.findOne({
        podcasterId,
        subscriberEmail,
      });
      if (ifAlreadySubscribed) {
        res.send("Already subscribed");
        return;
      }
      const result = await subscribersCollection.insertOne(data);
      return res.send(result);
    });
    app.get("/mySubscription/:email", async (req, res) => {
      const email = req.params.email;

      const result = await subscribersCollection
        .find({ subscriberEmail: email })
        .toArray();

      return res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // console.log("this");
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

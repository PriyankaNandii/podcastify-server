const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const jwt = require("jsonwebtoken");
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
const upload = multer({ storage: storage });

// Initialize firebase-admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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
    const userCollection = client.db("podcastify").collection("users");

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
      /* console.log("User data:", user); */
      const query = { email: user?.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.post(
      "/upload",
      upload.fields([
        { name: "coverImage", maxCount: 1 },
        { name: "audioFile", maxCount: 1 },
      ]),
      async (req, res) => {
        try {
          const {
            title,
            host,
            guest,
            description,
            releaseDate,
            category,
            tags,
          } = req.body;

          const coverImage = req.files["coverImage"]
            ? req.files["coverImage"][0].filename
            : null;
          const audioFile = req.files["audioFile"]
            ? req.files["audioFile"][0].filename
            : null;

          let tagsArray = [];
          if (Array.isArray(tags)) {
            tagsArray = tags;
          } else if (typeof tags === "string") {
            tagsArray = tags.split(",").map((tag) => tag.trim());
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
            audioFileUrl: audioFile ? `/uploads/audios/${audioFile}` : null,
          };

          const result = await podcastCollection.insertOne(podcastData);
          res
            .status(201)
            .send({ message: "Podcast uploaded successfully", data: result });
        } catch (error) {
          console.error(error);
          res.status(500).send({ error: "Failed to upload podcast" });
        }
      }
    );

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

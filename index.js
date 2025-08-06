const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
//Basic packages
require("dotenv").config();

// ===============================================================
//                      Session token
// ===============================================================
const session = require("express-session");

app.set("trust proxy", 1); // trust first proxy
app.use(
  session({
    secret: "some secret",
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

//Some configurations
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["POST", "PUT", "GET", "OPTIONS", "HEAD", "DELETE"],
    credentials: true,
  })
);

// ===============================================================
//                      Middleware / Imports
// ===============================================================
//Import DB connection
const { authDataPool, validateEmail } = require("./DB/dbConn.js");

//Import our custom modules-controllers

// ===============================================================
//                      Routes
// ===============================================================
//This means whenever we do url..../novice, we will be redirected to the novice controller
//If we change the app.get("/") to app.get("/n") inside our novice.js file, we will need to go to url..../novice/n
app.use(express.json());

app.get("/", (req, res) => {
  res.send("hola DB Tutorial");
});

// ===============================================================
//                      Routes - DB

//Register route
app.post("/register", async (req, res) => {
  const result = await authDataPool.createUser(req.body);

  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});
//Login route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const result = await authDataPool.authenticateUser(username, password);

  if (result.success) {
    // Set session or generate JWT token here
    req.session.userId = result.data.UserID;
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// ===============================================================
//                      App init
// ===============================================================
///App listening on port
app.listen(process.env.PORT || port, () => {
  console.log(`Server is running on port: ${process.env.PORT || port}`);
});

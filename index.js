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
    origin: `http://88.200.63.148:3081`,
    methods: ["POST", "PUT", "GET", "OPTIONS", "HEAD", "DELETE"],
    credentials: true,
  })
);

// ===============================================================
//                      Middleware / Imports
// ===============================================================
console.log("\n\n\tLoading Middleware and imports...");
//Import DB connection
const { authDataPool, validateEmail } = require("./DB/dbConn.js");

//Import our custom modules-controllers
console.log("\tMiddleware and imports loaded successfully!");

// ===============================================================
//                      Routes
// ===============================================================

app.use(express.json()); // Parse JSON bodies (as sent by API clients)
console.log("\tImporting routes...");

const authRoutes = require("./routes/userAuthentication.js"); //user login, register, etc.
app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("hola DB Tutorial");
});
console.log("\tImported all routes successfully!");

// ===============================================================
//                      App init
// ===============================================================
///App listening on port
const host = "0.0.0.0";
app.listen(process.env.PORT || port, host, () => {
  console.log(`--Server is running on port: ${process.env.PORT || port}`);
  console.log(`--Server is running on host: ${host}`);
});

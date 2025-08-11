const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
const port = 3080;
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

const allowedOrigins = [
  "http://localhost:3081",
  "http://localhost:3000",
  "https://localhost:3081",
  "http://88.200.63.148:3081",
  "http://88.200.63.148:3080",
  "https://casa-box.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // console.log(`CORS Origin Check: ${origin}`);
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
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
app.use("/uploads", express.static("uploads"));
console.log("\tImporting routes...");

const authRoutes = require("./routes/userAuthentication.js"); //user login, register, etc.
app.use("/auth", authRoutes);

const listingRoutes = require("./routes/listing.js"); // search, searchall
app.use("/listings", listingRoutes);

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

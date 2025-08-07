const express = require("express");
const router = express.Router();
const { authDataPool } = require("../DB/dbConn.js"); // Adjust the path as needed

// ===============================================================
//                      AUTHENTICATION ROUTES
// ===============================================================

// Register route: POST /auth/register
router.post("/register", async (req, res) => {
  const result = await authDataPool.createUser(req.body);

  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

// Login route: POST /auth/login
router.post("/login", async (req, res) => {
  // Accept a generic 'identifier' which can be a username or an email
  const { identifier, password } = req.body;
  const result = await authDataPool.authenticateUser(identifier, password);

  if (result.success) {
    // Set session user ID
    req.session.userId = result.data.UserID;
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

// Logout route: POST /auth/logout
router.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({
          success: false,
          message: "Could not log out, please try again.",
        });
      } else {
        res.clearCookie("connect.sid");
        res.json({ success: true, message: "Logout successful." });
      }
    });
  } else {
    res.json({ success: true, message: "No active session." });
  }
});

module.exports = router;

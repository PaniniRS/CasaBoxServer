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

router.get("/session", async (req, res) => {
  if (req.session.userId) {
    try {
      // If a session exists, fetch the user's profile
      const userProfile = await authDataPool.getUserProfile(req.session.userId);
      if (userProfile) {
        res.json({ success: true, user: userProfile });
      } else {
        // This can happen if the user was deleted but the session remains
        res.json({ success: false, message: "User not found." });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error." });
    }
  } else {
    // If no session exists, the user is not logged in
    res.json({ success: false, message: "No active session." });
  }
});

module.exports = router;

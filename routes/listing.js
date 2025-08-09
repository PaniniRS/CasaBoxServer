const express = require("express");
const router = express.Router();
const { authDataPool } = require("../DB/dbConn.js");

// ===============================================================
//                      LISTING ROUTES
// ===============================================================

// GET /listings/all - Fetches all listings for the homepage
router.get("/all", async (req, res) => {
  try {
    const listings = await authDataPool.getAllListings();
    res.json({ success: true, data: listings });
  } catch (error) {
    console.error("Error fetching all listings:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch listings." });
  }
});

// GET /listings/search?q=... - Searches for listings
router.get("/search", async (req, res) => {
  const { q } = req.query; // Get search term from query parameter

  if (!q) {
    return res
      .status(400)
      .json({ success: false, message: "Search query is required." });
  }

  try {
    const listings = await authDataPool.searchListings(q);
    res.json({ success: true, data: listings });
  } catch (error) {
    console.error("Error searching listings:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to search listings." });
  }
});

module.exports = router;

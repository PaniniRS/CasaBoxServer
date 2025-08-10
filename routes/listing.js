const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { authDataPool } = require("../DB/dbConn.js");

// Multer Configuration for File Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    // Create a unique filename to prevent overwrites.
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// ===============================================================
//                      LISTING ROUTES
// ===============================================================

// GET /listings/all - Fetches all listings
router.get("/all", async (req, res) => {
  try {
    const listings = await authDataPool.getAllListings();
    res.json({ success: true, data: listings });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch listings." });
  }
});

// GET /listings/search?q=... - Searches for listings
router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res
      .status(400)
      .json({ success: false, message: "Search query is required." });
  }
  try {
    const listings = await authDataPool.searchListings(q);
    res.json({ success: true, data: listings });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to search listings." });
  }
});

// POST /listings/create - Creates a new listing
router.post("/create", upload.array("listingImages", 4), async (req, res) => {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ success: false, message: "You must be logged in." });
  }

  const listingData = req.body;
  const imageFiles = req.files;

  if (!imageFiles || imageFiles.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "At least one image is required." });
  }

  // Add user ID and the array of image info to the data object
  listingData.providerId = req.session.userId;
  listingData.images = imageFiles.map((file) => ({
    path: file.path,
    isPrimary: file.originalname === listingData.primaryImageName, // Check if this is the primary image
  }));

  try {
    const result = await authDataPool.createListing(listingData);
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error creating listing:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

module.exports = router;

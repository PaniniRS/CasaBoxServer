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

// GET /listings/:id - Fetches a single detailed listing
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await authDataPool.getListingById(id);
    if (listing) {
      res.json({ success: true, data: listing });
    } else {
      res.status(404).json({ success: false, message: "Listing not found." });
    }
  } catch (error) {
    console.error("Error fetching listing by ID:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch listing." });
  }
});

// POST /listings/book - Creates a new booking
router.post("/book", async (req, res) => {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ success: false, message: "You must be logged in to book." });
  }

  const bookingData = req.body;
  bookingData.seekerId = req.session.userId;

  try {
    const result = await authDataPool.createBooking(bookingData);
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during booking.",
    });
  }
});

// GET /listings/provider - Fetches all listings for the currently logged-in provider
router.get("/provider/mine", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const listings = await authDataPool.getListingsByProvider(
      req.session.userId
    );
    res.json({ success: true, data: listings });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch provider listings." });
  }
});

// GET /listings/:id/requests - Fetches booking requests for a specific listing
router.get("/:id/requests", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const requests = await authDataPool.getBookingRequestsByListing(
      req.params.id,
      req.session.userId
    );
    res.json({ success: true, data: requests });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch booking requests." });
  }
});

// POST /listings/bookings/:bookingId/update - Updates the status of a booking
router.post("/bookings/:bookingId/update", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { status } = req.body;
    const result = await authDataPool.updateBookingStatus(
      req.params.bookingId,
      status,
      req.session.userId
    );
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update booking status." });
  }
});

// GET /listings/seeker/mine - Fetches all bookings for the currently logged-in seeker
router.get("/seeker/mine", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const bookings = await authDataPool.getBookingsBySeeker(req.session.userId);
    res.json({ success: true, data: bookings });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch seeker bookings." });
  }
});

// POST /listings/:id/update - Updates the details of a listing
router.post("/:id/update", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    const result = await authDataPool.updateListingDetails(
      req.params.id,
      req.body,
      req.session.userId
    );
    res.json(result);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update listing." });
  }
});

module.exports = router;

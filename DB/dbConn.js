/*
=================================================================
                    AUTHENTICATION DATABASE MODULE
=================================================================
*/

const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const validator = require("validator");

const conn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE_NAME,
});

conn.connect((err) => {
  if (err) {
    console.log("DATABASE CONNECTION ERROR: " + err.message);
    return;
  }
  console.log("Authentication Database Connection Established");
});

// ===============================================================
//                     INPUT VALIDATION HELPERS
// ===============================================================

const validateEmail = (email) => validator.isEmail(email);
const validatePassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(password);
const validatePhoneNumber = (phone) => !phone || validator.isMobilePhone(phone);
const validateRole = (role) =>
  !role || ["Admin", "Provider", "Seeker"].includes(role);

// ===============================================================
//                     DB HELPER FUNCTIONS
// ===============================================================

const getOrCreateAddress = (addressData, dbConnection) => {
  return new Promise((resolve, reject) => {
    const { streetName, city, postalCode, number } = addressData;
    const fullStreetName = `${number || ""} ${streetName}`.trim();

    const checkQuery =
      "SELECT AddressID FROM Address WHERE StreetName = ? AND City = ? AND PostalCode = ?";
    dbConnection.query(
      checkQuery,
      [fullStreetName, city, postalCode],
      (checkErr, checkResults) => {
        if (checkErr) return reject(checkErr);
        if (checkResults.length > 0) {
          return resolve(checkResults[0].AddressID);
        } else {
          const insertQuery =
            "INSERT INTO Address (StreetName, City, PostalCode) VALUES (?, ?, ?)";
          dbConnection.query(
            insertQuery,
            [fullStreetName, city, postalCode],
            (insertErr, insertResult) => {
              if (insertErr) return reject(insertErr);
              resolve(insertResult.insertId);
            }
          );
        }
      }
    );
  });
};

const formatMySqlDateTime = (date) => {
  if (!date) return null;
  // Converts JS date to 'YYYY-MM-DD HH:MM:SS so bookings can be stored in MySQL'
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
};

// ===============================================================
//                     AUTHENTICATION DATA POOL
// ===============================================================

let authDataPool = {};

// ===============================================================
//                      USER LOOKUP OPERATIONS
// ===============================================================

authDataPool.getUserByUsername = (username) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM User WHERE Username = ?";
    conn.query(query, [username], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

authDataPool.getUserByEmail = (email) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM User WHERE Email = ?";
    conn.query(query, [email], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

authDataPool.getUserById = (userId) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM User WHERE UserID = ?";
    conn.query(query, [userId], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

authDataPool.getUserProfile = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        UserID, Username, Email, PhoneNumber, FirstName, LastName,
        Role, ProfilePictureURL, RegistrationDate, LastLoginDate, 
        IsVerified, AverageProviderRating, AverageSeekerRating,
        AddressLine1, AddressLine2
      FROM User 
      WHERE UserID = ?
    `;
    conn.query(query, [userId], (err, results) => {
      if (err) return reject(err);
      resolve(results[0] || null);
    });
  });
};

// ===============================================================
//                      LISTING LOOKUP OPERATIONS
// ===============================================================

authDataPool.getListingById = (listingId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        l.*,
        a.City, a.StreetName,
        GROUP_CONCAT(CONCAT(att.FileURL, ';', att.IsPrimary)) AS Images
      FROM Listing l
      JOIN Address a ON l.AddressID = a.AddressID
      LEFT JOIN Attachment att ON l.ListingID = att.ListingID
      WHERE l.ListingID = ?
      GROUP BY l.ListingID;
    `;
    conn.query(query, [listingId], (err, results) => {
      if (err) return reject(err);
      if (results.length > 0) {
        // Process the images string into a structured array
        const listing = results[0];
        listing.Images = listing.Images
          ? listing.Images.split(",")
              .map((imgStr) => {
                const [url, isPrimary] = imgStr.split(";");
                return { FileURL: url, IsPrimary: parseInt(isPrimary) };
              })
              .sort((a, b) => b.IsPrimary - a.IsPrimary)
          : []; // Sort primary image first
        resolve(listing);
      } else {
        resolve(null);
      }
    });
  });
};

authDataPool.getAllListings = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        l.ListingID, l.Title, l.Description, l.PricePerUnit, l.PriceUnit, l.StorageType,
        l.TotalCapacity_Slots, l.CapacitySQMeter,
        a.City, a.StreetName,
        att.FileURL AS PrimaryImage
      FROM Listing l
      JOIN Address a ON l.AddressID = a.AddressID
      LEFT JOIN Attachment att ON l.ListingID = att.ListingID AND att.IsPrimary = 1
      ORDER BY l.CreationDate DESC;
    `;
    conn.query(query, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

authDataPool.searchListings = (searchTerm) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        l.ListingID, l.Title, l.Description, l.PricePerUnit, l.PriceUnit, l.StorageType,
        l.TotalCapacity_Slots, l.CapacitySQMeter,
        a.City, a.StreetName,
        att.FileURL AS PrimaryImage
      FROM Listing l
      JOIN Address a ON l.AddressID = a.AddressID
      LEFT JOIN Attachment att ON l.ListingID = att.ListingID AND att.IsPrimary = 1
      WHERE a.City LIKE ? OR a.StreetName LIKE ?
      ORDER BY l.CreationDate DESC;
    `;
    const searchValue = `%${searchTerm}%`;
    conn.query(query, [searchValue, searchValue], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// ===============================================================
//                    USER & LISTING CREATION
// ===============================================================

authDataPool.createUser = (userData) => {
  return new Promise((resolve) => {
    conn.beginTransaction(async (transactionErr) => {
      if (transactionErr) {
        return resolve({ success: false, message: "DB transaction error." });
      }
      try {
        const {
          username,
          password,
          email,
          streetName,
          city,
          postalCode,
          number,
        } = userData;
        const addressId = await getOrCreateAddress(
          { streetName, city, postalCode, number },
          conn
        );
        const passwordHash = await bcrypt.hash(password, 12);
        const userQuery = `
          INSERT INTO User (Username, PasswordHash, Email, Role, RegistrationDate, IsVerified, AddressID1) 
          VALUES (?, ?, ?, ?, NOW(), ?, ?)`;
        const userValues = [
          username,
          passwordHash,
          email,
          "Seeker",
          0,
          addressId,
        ];
        conn.query(userQuery, userValues, (userErr, userResult) => {
          if (userErr)
            return conn.rollback(() =>
              resolve({
                success: false,
                message: "DB error during user creation.",
              })
            );
          conn.commit((commitErr) => {
            if (commitErr)
              return conn.rollback(() =>
                resolve({ success: false, message: "DB commit error." })
              );
            resolve({
              success: true,
              message: "User created successfully!",
              data: { userId: userResult.insertId },
            });
          });
        });
      } catch (error) {
        conn.rollback(() =>
          resolve({
            success: false,
            message: "Internal error during user creation.",
          })
        );
      }
    });
  });
};

authDataPool.createBooking = (bookingData) => {
  return new Promise((resolve) => {
    conn.beginTransaction(async (transactionErr) => {
      if (transactionErr)
        return resolve({ success: false, message: "DB transaction error." });
      try {
        const {
          listingId,
          seekerId,
          startDate,
          endDate,
          totalCost,
          storageType,
          items,
          requestedSqm,
        } = bookingData;
        const bookingQuery = `INSERT INTO Booking (ListingID, SeekerID, StartDate, EndDate, TotalCost, RequestDate, BookingStatus) VALUES (?, ?, ?, ?, ?, NOW(), 'Pending')`;
        const bookingValues = [
          listingId,
          seekerId,
          formatMySqlDateTime(startDate),
          formatMySqlDateTime(endDate),
          totalCost,
        ];
        conn.query(bookingQuery, bookingValues, (bookingErr, bookingResult) => {
          if (bookingErr) {
            console.error("DB error creating booking:", bookingErr);
            return conn.rollback(() =>
              resolve({
                success: false,
                message: "DB error on booking creation.",
              })
            );
          }
          const newBookingId = bookingResult.insertId;
          if (storageType === "ItemSlot" && items.length > 0) {
            const bookingItemsQuery = `INSERT INTO BookingItem (BookingID, CategoryID, Quantity) VALUES ?`;
            const bookingItemsValues = items.map((item) => [
              newBookingId,
              item.categoryId,
              item.quantity,
            ]);
            conn.query(bookingItemsQuery, [bookingItemsValues], (itemsErr) => {
              if (itemsErr) {
                console.error("DB error creating booking items:", itemsErr);
                return conn.rollback(() =>
                  resolve({
                    success: false,
                    message: "DB error on booking item creation.",
                  })
                );
              }
              conn.commit((commitErr) => {
                if (commitErr)
                  return conn.rollback(() =>
                    resolve({ success: false, message: "DB commit error." })
                  );
                resolve({
                  success: true,
                  message: "Booking created successfully!",
                  data: { bookingId: newBookingId },
                });
              });
            });
          } else if (storageType === "SquareMeter") {
            const updateBookingQuery = `UPDATE Booking SET RequestedCapacity_SQMeters = ? WHERE BookingID = ?`;
            conn.query(
              updateBookingQuery,
              [requestedSqm, newBookingId],
              (updateErr) => {
                if (updateErr) {
                  console.error(
                    "DB error updating booking capacity:",
                    updateErr
                  ); // Added logging
                  return conn.rollback(() =>
                    resolve({
                      success: false,
                      message: "DB error updating booking capacity.",
                    })
                  );
                }
                conn.commit((commitErr) => {
                  if (commitErr)
                    return conn.rollback(() =>
                      resolve({ success: false, message: "DB commit error." })
                    );
                  resolve({
                    success: true,
                    message: "Booking created successfully!",
                    data: { bookingId: newBookingId },
                  });
                });
              }
            );
          } else {
            conn.commit((commitErr) => {
              if (commitErr)
                return conn.rollback(() =>
                  resolve({ success: false, message: "DB commit error." })
                );
              resolve({
                success: true,
                message: "Booking created successfully!",
                data: { bookingId: newBookingId },
              });
            });
          }
        });
      } catch (error) {
        console.error("Transaction error in createBooking:", error);
        conn.rollback(() =>
          resolve({
            success: false,
            message: "Internal error during booking creation.",
          })
        );
      }
    });
  });
};

authDataPool.createListing = (listingData) => {
  return new Promise((resolve) => {
    conn.beginTransaction(async (transactionErr) => {
      if (transactionErr) {
        return resolve({ success: false, message: "DB transaction error." });
      }
      try {
        const {
          title,
          description,
          price,
          priceUnit,
          storageType,
          capacity,
          streetName,
          city,
          postalCode,
          number,
          providerId,
          images,
        } = listingData;
        const addressId = await getOrCreateAddress(
          { streetName, city, postalCode, number },
          conn
        );
        const listingQuery = `
          INSERT INTO Listing (ProviderID, Title, Description, StorageType, ${
            storageType === "ItemSlot"
              ? "TotalCapacity_Slots"
              : "CapacitySQMeter"
          }, PricePerUnit, PriceUnit, AddressID, CreationDate, Status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'Active')`;
        const listingValues = [
          providerId,
          title,
          description,
          storageType,
          capacity,
          parseFloat(price),
          priceUnit,
          addressId,
        ];
        conn.query(listingQuery, listingValues, (listingErr, listingResult) => {
          if (listingErr)
            return conn.rollback(() =>
              resolve({
                success: false,
                message: "DB error on listing creation.",
              })
            );
          const newListingId = listingResult.insertId;
          const attachmentQuery = `INSERT INTO Attachment (ListingID, FileURL, FileType, UploadTimestamp, IsPrimary) VALUES ?`;
          const attachmentValues = images.map((img) => [
            newListingId,
            img.path,
            "Image",
            new Date(),
            img.isPrimary ? 1 : 0,
          ]);
          conn.query(attachmentQuery, [attachmentValues], (attachmentErr) => {
            if (attachmentErr)
              return conn.rollback(() =>
                resolve({
                  success: false,
                  message: "DB error on attachment creation.",
                })
              );
            conn.commit((commitErr) => {
              if (commitErr)
                return conn.rollback(() =>
                  resolve({ success: false, message: "DB commit error." })
                );
              resolve({
                success: true,
                message: "Listing created successfully!",
                data: { listingId: newListingId },
              });
            });
          });
        });
      } catch (error) {
        conn.rollback(() =>
          resolve({
            success: false,
            message: "Internal error during listing creation.",
          })
        );
      }
    });
  });
};

// ===============================================================
//                    USER PROFILE UPDATES
// ===============================================================
authDataPool.updateProfilePicture = (userId, filePath) => {
  return new Promise((resolve, reject) => {
    const query = "UPDATE User SET ProfilePictureURL = ? WHERE UserID = ?";
    conn.query(query, [filePath, userId], (err, result) => {
      if (err) return reject(err);
      resolve({
        success: true,
        message: "Profile picture updated.",
        data: { filePath },
      });
    });
  });
};

authDataPool.updateUserDetails = async (userId, userDetails) => {
  try {
    const { firstName, lastName, email, phoneNumber, currentPassword } =
      userDetails;

    // First, verify the user's current password
    const users = await authDataPool.getUserById(userId);
    if (users.length === 0)
      return { success: false, message: "User not found." };

    const user = users[0];
    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.PasswordHash
    );
    if (!passwordMatch)
      return { success: false, message: "Incorrect password." };

    // If password is correct, proceed with the update
    return new Promise((resolve, reject) => {
      const query =
        "UPDATE User SET FirstName = ?, LastName = ?, Email = ?, PhoneNumber = ? WHERE UserID = ?";
      conn.query(
        query,
        [firstName, lastName, email, phoneNumber, userId],
        (err, result) => {
          if (err) return reject(err);
          resolve({
            success: true,
            message: "Account details updated successfully.",
          });
        }
      );
    });
  } catch (error) {
    console.error("Error updating user details:", error);
    return { success: false, message: "Internal server error." };
  }
};

// ===============================================================
//                    USER AUTHENTICATION & UPDATES
// ===============================================================

authDataPool.authenticateUser = async (identifier, password) => {
  try {
    const isEmail = validator.isEmail(identifier);
    const query = isEmail
      ? "SELECT * FROM User WHERE Email = ?"
      : "SELECT * FROM User WHERE Username = ?";
    const users = await new Promise((resolve, reject) => {
      conn.query(query, [identifier], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
    if (users.length === 0)
      return { success: false, message: "Invalid credentials." };
    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!passwordMatch)
      return { success: false, message: "Invalid credentials." };
    await authDataPool.updateLastLogin(user.UserID);
    const { PasswordHash, ...userWithoutPassword } = user;
    return {
      success: true,
      message: "Authentication successful",
      data: userWithoutPassword,
    };
  } catch (error) {
    return { success: false, message: "Internal error during authentication" };
  }
};

authDataPool.updateLastLogin = (userId) => {
  return new Promise((resolve, reject) => {
    const query = "UPDATE User SET LastLoginDate = NOW() WHERE UserID = ?";
    conn.query(query, [userId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

// ===============================================================
//                      BOOKING OPERATIONS
// ===============================================================

// ===============================================================
//                        MODULE EXPORTS
// ===============================================================

module.exports = {
  authDataPool,
  validateEmail,
  validatePassword,
  validatePhoneNumber,
  validateRole,
};

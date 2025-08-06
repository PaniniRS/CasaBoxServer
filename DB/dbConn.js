/*
=================================================================
                    AUTHENTICATION DATABASE MODULE
=================================================================
Database connection and CRUD operations for user authentication
Handles: Registration, Login, Password Management, User Queries
To be imported into route handlers and controllers
=================================================================
*/

// ===============================================================
//                      DEPENDENCIES & IMPORTS
// ===============================================================

const mysql = require("mysql2"); // MySQL database driver
const bcrypt = require("bcrypt"); // Password hashing library
const validator = require("validator"); // Input validation library

// ===============================================================
//                    DATABASE CONNECTION SETUP
// ===============================================================

/**
 * MySQL database connection configuration
 * Uses environment variables for security
 */
const conn = mysql.createConnection({
  host: process.env.DB_HOST, // Database host (e.g., localhost, AWS RDS endpoint)
  user: process.env.DB_USER, // Database username
  password: process.env.DB_PASS, // Database password
  database: "Qcodeigniter", // Database name from your schema
});

/**
 * Establish database connection with error handling
 * Logs connection status for debugging
 */
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

/**
 * Validate email address format
 * Uses validator library for comprehensive email validation
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
const validateEmail = (email) => {
  return validator.isEmail(email);
};

/**
 * Validate password strength requirements
 * Requirements: At least 8 characters, 1 uppercase, 1 lowercase, 1 number
 * Can be customized based on security requirements
 * @param {string} password - Password to validate
 * @returns {boolean} True if password meets requirements
 */
const validatePassword = (password) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Validate phone number format
 * Uses validator library with international phone number support
 * Phone number is optional, so empty/null values are considered valid
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format or empty
 */
const validatePhoneNumber = (phone) => {
  if (!phone) return true; // Optional field - empty is valid
  return validator.isMobilePhone(phone);
};

/**
 * Validate user role
 * Checks if role matches database enum values
 * @param {string} role - Role to validate
 * @returns {boolean} True if valid role or empty (defaults to 'Seeker')
 */
const validateRole = (role) => {
  if (!role) return true; // Optional field - will default to 'Seeker'
  return ["Admin", "Provider", "Seeker"].includes(role);
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
      return resolve(results);
    });
  });
};

authDataPool.getUserByEmail = (email) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM User WHERE Email = ?";
    conn.query(query, [email], (err, results) => {
      if (err) return reject(err);
      return resolve(results);
    });
  });
};

authDataPool.getUserById = (userId) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM User WHERE UserID = ?";
    conn.query(query, [userId], (err, results) => {
      if (err) {
        console.error("Error fetching user by ID:", err);
        return reject(err);
      }
      return resolve(results);
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
        AddressID1, AddressID2
      FROM User 
      WHERE UserID = ?
    `;
    conn.query(query, [userId], (err, results) => {
      if (err) {
        console.error("Error fetching user profile:", err);
        return reject(err);
      }
      return resolve(results[0] || null);
    });
  });
};

// ===============================================================
//                    USER CREATION OPERATIONS
// ===============================================================

/**
 * Create new user and their address in the database using a transaction.
 * @param {Object} userData - User and address information from the form.
 * @returns {Promise<Object>} Result object with success status and user data or error.
 */
authDataPool.createUser = async (userData) => {
  return new Promise((resolve, reject) => {
    conn.beginTransaction(async (transactionErr) => {
      if (transactionErr) {
        console.error("Error starting transaction:", transactionErr);
        return resolve({
          success: false,
          message: "Database transaction error.",
        });
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

        if (
          !username ||
          !password ||
          !email ||
          !streetName ||
          !city ||
          !postalCode
        ) {
          return resolve({
            success: false,
            message: "All fields are required.",
          });
        }
        if (!validateEmail(email)) {
          return resolve({ success: false, message: "Invalid email format." });
        }
        if (!validatePassword(password)) {
          return resolve({
            success: false,
            message:
              "Password must be at least 8 characters with uppercase, lowercase, and a number.",
          });
        }

        const existingUserByUsername = await authDataPool.getUserByUsername(
          username
        );
        if (existingUserByUsername.length > 0) {
          return resolve({
            success: false,
            message: "Username already exists.",
          });
        }
        const existingUserByEmail = await authDataPool.getUserByEmail(email);
        if (existingUserByEmail.length > 0) {
          return resolve({
            success: false,
            message: "Email already registered.",
          });
        }

        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const fullStreetName = `${number || ""} ${streetName}`.trim();
        const addressQuery =
          "INSERT INTO Address (City, PostalCode, StreetName) VALUES (?, ?, ?)";
        const addressValues = [city, postalCode, fullStreetName];

        conn.query(addressQuery, addressValues, (addressErr, addressResult) => {
          if (addressErr) {
            console.error("Error creating address:", addressErr);
            return conn.rollback(() =>
              resolve({
                success: false,
                message: "Database error during address creation.",
              })
            );
          }

          const newAddressId = addressResult.insertId;

          const userQuery = `
                        INSERT INTO User (
                            Username, PasswordHash, Email, Role, RegistrationDate, IsVerified, AddressID1
                        ) VALUES (?, ?, ?, ?, NOW(), ?, ?)
                    `;
          const userValues = [
            username,
            passwordHash,
            email,
            "Seeker",
            0,
            newAddressId,
          ];

          conn.query(userQuery, userValues, (userErr, userResult) => {
            if (userErr) {
              console.error("Error creating user:", userErr);
              return conn.rollback(() =>
                resolve({
                  success: false,
                  message: "Database error during user creation.",
                })
              );
            }

            conn.commit((commitErr) => {
              if (commitErr) {
                console.error("Error committing transaction:", commitErr);
                return conn.rollback(() =>
                  resolve({ success: false, message: "Database commit error." })
                );
              }

              resolve({
                success: true,
                message: "User created successfully!",
                data: {
                  userId: userResult.insertId,
                  username,
                  email,
                  role: "Seeker",
                },
              });
            });
          });
        });
      } catch (error) {
        console.error("Error in createUser transaction:", error);
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

// ===============================================================
//                    USER AUTHENTICATION OPERATIONS
// ===============================================================

authDataPool.authenticateUser = async (username, password) => {
  try {
    if (!username || !password) {
      return { success: false, message: "Username and password are required" };
    }

    const users = await authDataPool.getUserByUsername(username);
    if (users.length === 0) {
      return { success: false, message: "Invalid username or password" };
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.PasswordHash);

    if (!passwordMatch) {
      return { success: false, message: "Invalid username or password" };
    }

    await authDataPool.updateLastLogin(user.UserID);

    const { PasswordHash, ...userWithoutPassword } = user;
    return {
      success: true,
      message: "Authentication successful",
      data: userWithoutPassword,
    };
  } catch (error) {
    console.error("Error in authenticateUser:", error);
    return { success: false, message: "Internal error during authentication" };
  }
};

// ===============================================================
//                    USER UPDATE OPERATIONS
// ===============================================================

authDataPool.updateLastLogin = (userId) => {
  return new Promise((resolve, reject) => {
    const query = "UPDATE User SET LastLoginDate = NOW() WHERE UserID = ?";
    conn.query(query, [userId], (err, result) => {
      if (err) {
        console.error("Error updating last login:", err);
        return reject(err);
      }
      return resolve(result);
    });
  });
};

authDataPool.updatePassword = async (userId, currentPassword, newPassword) => {
  try {
    if (!userId || !currentPassword || !newPassword) {
      return {
        success: false,
        message: "User ID, current password, and new password are required",
      };
    }
    if (!validatePassword(newPassword)) {
      return {
        success: false,
        message:
          "New password must be at least 8 characters with uppercase, lowercase, and number",
      };
    }

    const users = await authDataPool.getUserById(userId);
    if (users.length === 0) {
      return { success: false, message: "User not found" };
    }
    const user = users[0];

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      user.PasswordHash
    );
    if (!passwordMatch) {
      return { success: false, message: "Current password is incorrect" };
    }

    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    return new Promise((resolve, reject) => {
      const query = "UPDATE User SET PasswordHash = ? WHERE UserID = ?";
      conn.query(query, [newPasswordHash, userId], (err, result) => {
        if (err) {
          console.error("Error updating password:", err);
          return resolve({
            success: false,
            message: "Database error during password update",
          });
        }
        resolve({ success: true, message: "Password updated successfully" });
      });
    });
  } catch (error) {
    console.error("Error in updatePassword:", error);
    return { success: false, message: "Internal error during password update" };
  }
};

authDataPool.updateVerificationStatus = (userId, isVerified) => {
  return new Promise((resolve, reject) => {
    const query = "UPDATE User SET IsVerified = ? WHERE UserID = ?";
    conn.query(query, [isVerified, userId], (err, result) => {
      if (err) {
        console.error("Error updating verification status:", err);
        return reject(err);
      }
      return resolve({
        success: true,
        message: "Verification status updated successfully",
      });
    });
  });
};

// ===============================================================
//                    UTILITY FUNCTIONS
// ===============================================================

authDataPool.checkConnection = () => {
  return new Promise((resolve, reject) => {
    conn.ping((err) => {
      if (err) {
        console.error("Database connection error:", err);
        return resolve({ connected: false, error: err.message });
      }
      resolve({ connected: true, message: "Database connection active" });
    });
  });
};

authDataPool.closeConnection = () => {
  return new Promise((resolve, reject) => {
    conn.end((err) => {
      if (err) {
        console.error("Error closing database connection:", err);
        return reject(err);
      }
      console.log("Database connection closed");
      resolve();
    });
  });
};

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

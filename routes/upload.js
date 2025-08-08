const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CSVParser = require("../utils/csvParser");

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${timestamp}_${originalName}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files at once
  },
});

// Upload and process CSV files
router.post("/csv", upload.array("csvFiles", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No CSV files uploaded",
      });
    }

    const results = [];

    for (const file of req.files) {
      try {
        const data = await CSVParser.parseCSV(file.path);
        const analysis = {
          filename: file.originalname,
          uploadedAs: file.filename,
          size: file.size,
          rowCount: data.length,
          columns: data.length > 0 ? Object.keys(data[0]) : [],
          genreDistribution: CSVParser.analyzeGenreDistribution(data),
          preview: data.slice(0, 5), // First 5 rows for preview
        };

        results.push({
          success: true,
          file: analysis,
          data: data,
        });
      } catch (parseError) {
        results.push({
          success: false,
          filename: file.originalname,
          error: `Failed to parse CSV: ${parseError.message}`,
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${req.files.length} file(s)`,
      results: results,
      uploadTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      error: "Upload failed",
      message: error.message,
    });
  }
});

// Validate CSV structure
router.post("/validate", upload.single("csvFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CSV file provided for validation",
      });
    }

    const data = await CSVParser.parseCSV(req.file.path);

    // Check for required columns
    const requiredColumns = ["title", "artist", "genre"];
    const availableColumns = data.length > 0 ? Object.keys(data[0]) : [];
    const missingColumns = requiredColumns.filter(
      (col) =>
        !availableColumns.some((available) =>
          available.toLowerCase().includes(col.toLowerCase())
        )
    );

    const validation = {
      isValid: missingColumns.length === 0,
      rowCount: data.length,
      columnCount: availableColumns.length,
      availableColumns: availableColumns,
      missingColumns: missingColumns,
      dataTypes: this.analyzeDataTypes(data),
      preview: data.slice(0, 3),
    };

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      validation: validation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Validation failed",
      message: error.message,
    });
  }
});

// Helper method to analyze data types
function analyzeDataTypes(data) {
  if (data.length === 0) return {};

  const sample = data[0];
  const types = {};

  Object.keys(sample).forEach((key) => {
    const value = sample[key];
    if (!isNaN(value) && !isNaN(parseFloat(value))) {
      types[key] = "number";
    } else if (value && (value.includes("/") || value.includes("-"))) {
      types[key] = "category";
    } else {
      types[key] = "string";
    }
  });

  return types;
}

module.exports = router;

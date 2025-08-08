const express = require("express");
const router = express.Router();
const path = require("path");
const CSVParser = require("../utils/csvParser");

// Get all chart data
router.get("/all", async (req, res) => {
  try {
    const dataDir = path.join(__dirname, "../data");
    const csvFiles = [
      { file: "billboard_2024_analysis.csv", platform: "Billboard" },
      { file: "tiktok_viral_2024.csv", platform: "TikTok" },
      { file: "spotify_top_2024.csv", platform: "Spotify" },
      {
        file: "cross_genre_collaborations_2024.csv",
        platform: "Collaborations",
      },
    ];

    const results = await Promise.all(
      csvFiles.map(async ({ file, platform }) => {
        try {
          const filePath = path.join(dataDir, file);
          const data = await CSVParser.parseCSV(filePath);
          return { platform, data, count: data.length };
        } catch (error) {
          console.warn(`Could not load ${file}: ${error.message}`);
          return { platform, data: [], count: 0, error: error.message };
        }
      })
    );

    res.json({
      success: true,
      data: results,
      totalSongs: results.reduce((sum, result) => sum + result.count, 0),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching chart data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch chart data",
      message: error.message,
    });
  }
});

// Get genre distribution analysis
router.get("/genre-analysis", async (req, res) => {
  try {
    const dataDir = path.join(__dirname, "../data");
    const billboardPath = path.join(dataDir, "billboard_2024_analysis.csv");

    const billboardData = await CSVParser.parseCSV(billboardPath);
    const genreDistribution = CSVParser.analyzeGenreDistribution(
      billboardData,
      "Primary_Genre"
    );

    res.json({
      success: true,
      data: genreDistribution,
      totalSongs: billboardData.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to analyze genre distribution",
      message: error.message,
    });
  }
});

// Get cross-platform artists
router.get("/cross-platform", async (req, res) => {
  try {
    const dataDir = path.join(__dirname, "../data");
    const datasets = [
      {
        platform: "Billboard",
        data: await CSVParser.parseCSV(
          path.join(dataDir, "billboard_2024_analysis.csv")
        ),
      },
      {
        platform: "TikTok",
        data: await CSVParser.parseCSV(
          path.join(dataDir, "tiktok_viral_2024.csv")
        ),
      },
      {
        platform: "Spotify",
        data: await CSVParser.parseCSV(
          path.join(dataDir, "spotify_top_2024.csv")
        ),
      },
    ];

    const crossPlatformArtists = CSVParser.findCrossPlatformArtists(datasets);

    res.json({
      success: true,
      data: crossPlatformArtists,
      totalArtists: crossPlatformArtists.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to analyze cross-platform data",
      message: error.message,
    });
  }
});

// Search functionality
router.get("/search", async (req, res) => {
  try {
    const { query, platform, genre } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Search query is required",
      });
    }

    const dataDir = path.join(__dirname, "../data");
    const allData = [];

    // Load data based on platform filter
    const platformFiles = platform
      ? [{ file: `${platform.toLowerCase()}_*.csv`, platform }]
      : [
          { file: "billboard_2024_analysis.csv", platform: "Billboard" },
          { file: "tiktok_viral_2024.csv", platform: "TikTok" },
          { file: "spotify_top_2024.csv", platform: "Spotify" },
        ];

    for (const { file, platform: platformName } of platformFiles) {
      try {
        const data = await CSVParser.parseCSV(path.join(dataDir, file));
        allData.push(
          ...data.map((item) => ({ ...item, platform: platformName }))
        );
      } catch (error) {
        console.warn(`Could not search in ${file}: ${error.message}`);
      }
    }

    // Filter data based on query and genre
    const filteredData = allData.filter((item) => {
      const matchesQuery = Object.values(item).some(
        (value) =>
          value && value.toString().toLowerCase().includes(query.toLowerCase())
      );

      const matchesGenre =
        !genre ||
        (item.genre &&
          item.genre.toLowerCase().includes(genre.toLowerCase())) ||
        (item.Primary_Genre &&
          item.Primary_Genre.toLowerCase().includes(genre.toLowerCase()));

      return matchesQuery && matchesGenre;
    });

    res.json({
      success: true,
      data: filteredData,
      totalResults: filteredData.length,
      query: { query, platform, genre },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Search failed",
      message: error.message,
    });
  }
});

module.exports = router;

const csv = require("csv-parser");
const fs = require("fs");

class CSVParser {
  static parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];

      if (!fs.existsSync(filePath)) {
        reject(new Error(`File not found: ${filePath}`));
        return;
      }

      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => {
          // Clean and validate data
          const cleanedData = this.cleanRowData(data);
          if (this.validateRowData(cleanedData)) {
            results.push(cleanedData);
          }
        })
        .on("end", () => {
          resolve(results);
        })
        .on("error", (error) => {
          reject(error);
        });
    });
  }

  static cleanRowData(row) {
    const cleaned = {};
    Object.keys(row).forEach((key) => {
      // Remove BOM and trim whitespace
      const cleanKey = key.replace(/^\ufeff/, "").trim();
      const cleanValue =
        typeof row[key] === "string" ? row[key].trim() : row[key];
      cleaned[cleanKey] = cleanValue;
    });
    return cleaned;
  }

  static validateRowData(row) {
    // Basic validation - check if row has essential fields
    const essentialFields = ["title", "artist", "genre"];
    return essentialFields.some((field) =>
      Object.keys(row).some(
        (key) => key.toLowerCase().includes(field.toLowerCase()) && row[key]
      )
    );
  }

  static async processMultipleCSVs(filePaths) {
    try {
      const results = await Promise.all(
        filePaths.map(async (filePath) => {
          const data = await this.parseCSV(filePath);
          return {
            file: filePath,
            data: data,
            count: data.length,
          };
        })
      );
      return results;
    } catch (error) {
      throw new Error(`Error processing CSV files: ${error.message}`);
    }
  }

  static analyzeGenreDistribution(data, genreField = "genre") {
    const genreCount = {};
    data.forEach((item) => {
      const genre = item[genreField] || "Unknown";
      genreCount[genre] = (genreCount[genre] || 0) + 1;
    });

    return Object.entries(genreCount)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);
  }

  static findCrossPlatformArtists(datasets) {
    const artistPlatforms = {};

    datasets.forEach((dataset, index) => {
      const platformName = dataset.platform || `Platform_${index}`;
      dataset.data.forEach((item) => {
        const artist = item.artist || item.Artist;
        if (artist) {
          if (!artistPlatforms[artist]) {
            artistPlatforms[artist] = new Set();
          }
          artistPlatforms[artist].add(platformName);
        }
      });
    });

    return Object.entries(artistPlatforms)
      .filter(([artist, platforms]) => platforms.size > 1)
      .map(([artist, platforms]) => ({
        artist,
        platforms: Array.from(platforms),
        platformCount: platforms.size,
      }))
      .sort((a, b) => b.platformCount - a.platformCount);
  }
}

module.exports = CSVParser;

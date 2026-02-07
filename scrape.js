/**
 * Library, which provides methods to control a headless browser.
 */
const puppeteer = require("puppeteer");

/**
 * File System
 */
const fs = require("fs");

const maxPages = 20;

/**
 * Launches a new browser instance and opens a page.
 *
 * @returns - The browser and page objects
 */
const startBrowser = async () => {
  const browser = await puppeteer.launch({
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  const page = await browser.newPage();
  return { browser, page };
};

/**
 * Scrapes movie title, label and link from a given page number.
 *
 * @param {puppeteer.Page} page - The Puppeteer page instance
 * @param {number} pageNumber - The page number to scrape
 * @returns
 */
const scrapePage = async (page, pageNumber) => {
  const url = `https://www.dvdfr.com/index_bacs.php?page=${pageNumber}`;
  await page.goto(url);

  return await page.evaluate(() => {
    const movieElements = document.querySelectorAll(".singleResult");
    return Array.from(movieElements).map((movie) => {
      const title = movie.querySelector(".compact h2 a")?.textContent ?? null;
      const label = movie.querySelector(".compact .left a")?.textContent ?? null;
      const link = movie.querySelector(".compact h2 a")?.href ?? null;

      return { title, label, link };
    });
  });
};

/**
 * Scrapes detailed info (EAN code and release date) for a given movie.
 * @param {puppeteer.Page} page - The Puppeteer page instance
 * @param {Object} movie - Movie object containing title, label and link
 * @returns - Updated movie object with EAN and release date
 */
const scrapeMovieDetails = async (page, movie) => {
  if (!movie.link) return movie;
  await page.goto(movie.link, { waitUntil: "load" });

  const { eanCode, releaseDate } = await page.evaluate(() => {
    const pElements = document.querySelectorAll("#editeur .twoColumns p");
    const timeElements = document.querySelectorAll("time");
    const pEAN = pElements[3];
    const eanCode = pEAN ? (pEAN.nextSibling && pEAN.nextSibling.nodeType === Node.TEXT_NODE ? pEAN.nextSibling.textContent.trim() : null) : null;
    const releaseDate = timeElements[1]?.textContent?.trim() || null;
    return { eanCode, releaseDate };
  });

  movie.ean = eanCode;
  movie.release = releaseDate;
  return movie;
};

/**
 * Saves the movies array as a CSV file.
 *
 * @param {Array} movies - List of movies with details
 */
const saveCSV = (movies) => {
  const headers = ["EAN", "Title", "Label", "Release", "Link"];
  const rows = movies.map((movie) => [movie.ean, movie.title, movie.label, movie.release, movie.link].map((field) => `"${field || ""}"`).join(","));
  const csvContent = [headers.join(","), ...rows].join("\n"); // Combine headers and rows

  fs.writeFileSync("dvdfr.csv", csvContent);
  console.log("Daten gespeichert im File dvdfr.csv");
};

/**
 * Main function that orchestrates the scraping of all pages and movies.
 */
const scrape = async () => {
  const { browser, page } = await startBrowser();
  let allMovies = [];

  console.log("Daten werden ermittelt, bitte warten...");

  for (let i = 0; i <= maxPages; i++) {
    const movies = await scrapePage(page, i);
    for (const movie of movies) {
      await scrapeMovieDetails(page, movie);
    }
    allMovies.push(...movies);
  }

  saveCSV(allMovies);
  await browser.close();
};

scrape();

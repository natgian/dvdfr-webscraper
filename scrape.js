const os = require("os");
const path = require("path");
require("dotenv").config();
const { sendMail } = require("./mailer");

/**
 * Library, which provides methods to control a headless browser.
 */
const puppeteer = require("puppeteer");

/**
 * Library to read and write spreadsheet data and styles to XLSX, CSV and JSON.
 */
const ExcelJS = require("exceljs");

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
  const response = await page.goto(url);

  if (!response || response.status() >= 400) {
    console.log(`Fehler auf dvdfr.com, Status: ${response?.status()}`);
    return false;
  }

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
 *
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
 * Scrapes the movie data from all pages.
 *
 * @param {puppeteer.Page} page - The Puppeteer page instance
 * @param {number} maxPages - The maximal pages to scrape
 * @returns - An array of all movies
 */
const scrapeAllPages = async (page, maxPages) => {
  const allMovies = [];

  for (let i = 0; i <= maxPages; i++) {
    const movies = await scrapePage(page, i);

    if (!movies) {
      console.log("Seite zurzeit nicht erreichbar, bitte später erneut versuchen.");
      return;
    } else {
      for (const movie of movies) {
        await scrapeMovieDetails(page, movie);
      }
    }

    allMovies.push(...movies);
  }
  return allMovies;
};

/**
 * Saves the movies data into an XLSX file.
 *
 * @param {Array} movies - List of movies with details
 */
const saveXLSX = async (movies) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("dvdfr Wochen-News");

  sheet.columns = [
    { header: "EAN", key: "ean", width: 15 },
    { header: "Title", key: "title", width: 60 },
    { header: "Label", key: "label", width: 20 },
    { header: "Release", key: "release", width: 15 },
    { header: "Link", key: "link", width: 60 },
  ];

  sheet.getRow(1).font = { bold: true };
  movies.forEach((movie) => sheet.addRow(movie));

  const desktopPath = path.join(os.homedir(), "Desktop", "dvdfr.xlsx");
  await workbook.xlsx.writeFile(desktopPath);
  console.log("Daten gespeichert im File dvdfr.xlsx");
};

/**
 * Generates the movies data as an XLSX buffer.
 *
 * @param {Array} movies - List of movies with details
 * @returns - The XLSX file as a buffer
 */
const generateXLSX = async (movies) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("dvdfr Wochennews");

  sheet.columns = [
    { header: "EAN", key: "ean", width: 15 },
    { header: "Title", key: "title", width: 60 },
    { header: "Label", key: "label", width: 20 },
    { header: "Release", key: "release", width: 15 },
    { header: "Link", key: "link", width: 60 },
  ];

  sheet.getRow(1).font = { bold: true };
  movies.forEach((movie) => sheet.addRow(movie));

  return await workbook.xlsx.writeBuffer();
};

/**
 * Main function that orchestrates the scraping of all pages and movies.
 */
const scrape = async () => {
  const { browser, page } = await startBrowser();
  console.log("Daten werden ermittelt, bitte warten...");

  const allMovies = await scrapeAllPages(page, maxPages);

  if (!allMovies) {
    await browser.close();
    console.log("Keine Daten gefunden");
    return [];
  }

  // await saveXLSX(allMovies);
  const xlsxData = await generateXLSX(allMovies);
  await sendMail(xlsxData);
  await browser.close();
};

scrape();

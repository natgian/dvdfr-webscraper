const os = require("os");
const path = require("path");
require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const ExcelJS = require("exceljs");
const { sendMail } = require("./mailer");

const MAX_PAGES = 20;

/**
 * Scrapes movie title, label and link from a given page number.
 *
 * @param {number} pageNumber - The page number to scrape
 * @returns {Promise<Array|false>} - Array of movies or false if there is an error
 */
const scrapePage = async (pageNumber) => {
  const url = `https://www.dvdfr.com/index_bacs.php?page=${pageNumber}`;
  const { data, status } = await axios.get(url);

  if (status >= 400) {
    console.log(`Fehler auf dvdfr.com, Status: ${status}`);
    return false;
  }

  const $ = cheerio.load(data);
  const movies = [];

  $(".singleResult").each((_, movie) => {
    const title = $(movie).find(".compact h2 a").text() || null;
    const label = $(movie).find(".compact .left a").text() || null;
    const rawLink = $(movie).find(".compact h2 a").attr("href") || null;
    const link = rawLink ? `https:${rawLink}` : null;

    movies.push({ title, label, link });
  });

  return movies;
};

/**
 * Scrapes detailed info (EAN code and release date) for a given movie.
 *
 * @param {Object} movie - Movie object containing title, label and link
 * @returns {Promise<Object>} - Updated movie object with EAN and release date
 */
const scrapeMovieDetails = async (movie) => {
  if (!movie.link) return movie;

  const { data } = await axios.get(movie.link);
  const $ = cheerio.load(data);

  const pEAN = $("#editeur .twoColumns p").eq(3);
  const eanCode = pEAN.length ? pEAN[0].nextSibling?.data?.trim() || null : null;
  const releaseDate = $("time").eq(1).text().trim() || null;

  movie.ean = eanCode;
  movie.release = releaseDate;
  return movie;
};

/**
 * Scrapes the movie data from all pages.
 *
 * @param {number} MAX_PAGES - The maximal pages to scrape
 * @returns {Promise<Array|null>} - An array of all movies or null if there is an error
 */
const scrapeAllPages = async (MAX_PAGES) => {
  const allMovies = [];

  for (let i = 0; i <= MAX_PAGES; i++) {
    const movies = await scrapePage(i);

    if (!movies) {
      console.log("Seite zurzeit nicht erreichbar, bitte später erneut versuchen.");
      return null;
    }

    for (const movie of movies) {
      await scrapeMovieDetails(movie);
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
  console.log("Daten werden ermittelt, bitte warten...");

  const allMovies = await scrapeAllPages(MAX_PAGES);

  if (!allMovies) {
    console.log("Keine Daten gefunden");
    return;
  }

  const xlsxData = await generateXLSX(allMovies);
  await sendMail(xlsxData);
  console.log("Fertig!");
};

scrape();

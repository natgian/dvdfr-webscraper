const puppeteer = require("puppeteer"); // Library, which provides methods to control a headless browser

const fs = require("fs"); // File System

const scrape = async () => {
  const browser = await puppeteer.launch({
    ignoreDefaultArgs: ["--disable-extensions"],
  }); // Launching a new browser instance
  const page = await browser.newPage(); // Opening a new tab (page) in the browser

  const allMovies = [];
  let currentPage = 0;
  const maxPages = 10;

  console.log("Daten werden ermittelt, bitte warten...");

  while (currentPage <= maxPages) {
    const url = `https://www.dvdfr.com/index_bacs.php?page=${currentPage}`; // Target URL to scrape

    await page.goto(url); // Navigating to the specified URL

    // Sending a script to the browser to run the code and send back the results
    const movies = await page.evaluate(() => {
      const movieElements = document.querySelectorAll(".singleResult");
      return Array.from(movieElements).map((movie) => {
        const title = movie.querySelector(".compact h2 a")?.textContent ?? null;
        const label =
          movie.querySelector(".compact .left a")?.textContent ?? null;
        const link = movie.querySelector(".compact h2 a")?.href ?? null;

        return { title, label, link };
      });
    });

    // Getting the EAN and release date from detail page
    for (const movie of movies) {
      if (movie.link) {
        await page.goto(movie.link, { waitUntil: "load" }); // Navigate to the movie detail page

        const { eanCode, releaseDate } = await page.evaluate(() => {
          const pElements = document.querySelectorAll("#editeur .twoColumns p");
          const timeElements = document.querySelectorAll("time");

          const pEAN = pElements[3];
          const eanCode = pEAN
            ? pEAN.nextSibling && pEAN.nextSibling.nodeType === Node.TEXT_NODE
              ? pEAN.nextSibling.textContent.trim()
              : null
            : null;

          const releaseDate = timeElements[1]?.textContent?.trim() || null;

          return { eanCode, releaseDate };
        });
        // Add EAN and release date to the movie object
        movie.ean = eanCode;
        movie.release = releaseDate;
      }
    }

    allMovies.push(...movies);
    currentPage++;
  }

  // CREATE CSV FILE:
  const headers = ["EAN", "Title", "Label", "Release", "Link"];

  const rows = allMovies.map((movie) =>
    [movie.ean, movie.title, movie.label, movie.release, movie.link]
      .map((field) => `"${field || ""}"`)
      .join(",")
  );
  const csvContent = [headers.join(","), ...rows].join("\n"); // Combine headers and rows

  fs.writeFileSync("dvdfr.csv", csvContent); // Save the CSV content to a file

  console.log("Daten gespeichert im File dvdfr.csv");

  await browser.close(); // Closing the browser once the operation is complete
};

scrape();

# dvdfr-webscraper

A web-scraper to get data from the weekly dvd/blu-ray news on the dvdfr.com website.

## Features

Scrapes the title, label, EAN code, release date and link to detail page from the dvdfr.com weekly news listing page. It then saves the data directly as an Excel file (`dvdfr.xlsx`).

## Technologies Used

- Javascript
- Node.js

## Installation

To get a local copy of the project up and running, follow these steps:

1. clone the repository
2. install the dependencies: `npm install`
3. run `node scrape`

I used "pkg" to create a standalone executable.

## Build

To create a standalone executable, run:

```
npm run build
```

This uses `@yao-pkg/pkg` to bundle the application. The executable will be created in the `dist/` folder.

**Note:** Chromium (used by Puppeteer) cannot be bundled into the executable. When distributing the executable to another machine, you must copy the Chromium folder alongside it.

## Contact

For questions or feedback, please contact:

- Email: <info@natgian.com>
- GitHub: [natgian](https://github.com/natgian)

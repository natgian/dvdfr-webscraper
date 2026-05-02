const nodemailer = require("nodemailer");

const sendMail = async (xlsxData) => {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PW,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: process.env.MAIL_TO,
    subject: "dvdfr Wochen-News",
    text: "Im Anhang findest du die aktuellen dvdfr Wochen-News.",
    attachments: [
      {
        filename: "dvdfr.xlsx",
        content: xlsxData,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });

  console.log("Mail erfolgreich versendet.");
};

module.exports = { sendMail };

const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const axios = require("axios");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

async function extractSheetData(auth, sheetId, range) {
  const sheets = google.sheets({ version: "v4" });
  const request = {
    spreadsheetId: sheetId,
    range,
    auth,
  };
  const res = await sheets.spreadsheets.values.get(request);
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    console.log("No data found.");
    return;
  }
  return rows;
}

const whatsappCallback = (req, res) => {
  console.log("callback --->", req.body);
};

const compute = (tenders, users) => {
  userVsTender = {};

  //get the tender cohort
  for (let i = 1; i < tenders.length; ++i) {
    let tender = tenders[i];
    let overallLocation = tender[1].split(",");
    //cohort
    let material = tender[8].toLowerCase().trim();
    let city = overallLocation[0].toLowerCase().trim();
    let state = overallLocation[1].toLowerCase().trim();

    for (let j = 1; j < users.length; ++j) {
      let user = users[j];
      let userCity = user[1].toLowerCase().trim();
      let userState = user[2].toLowerCase().trim();
      let userMaterial = user[8].toLowerCase().trim();

      if (
        city === userCity &&
        state === userState &&
        material === userMaterial
      ) {
        let link = `https://prcommerce-campaign.com/${i}/${j}`;
        let tenderName = tender[0].toString();
        let tenderLocation = tender[1].toString();
        let tenderDesc = tender[2].toString();
        let tenderEmd = tender[6].toString();
        let userId = j;
        if (userVsTender[user[4]] === undefined) {
          userVsTender[user[4]] = [];
        }
        userVsTender[user[4]].push({
          link,
          tenderName,
          tenderLocation,
          tenderDesc,
          tenderEmd,
          userId,
        });
      }
    }
  }

  return userVsTender;
};

const createMessageTemplate = (
  userVsTender,
  tenderSheetData,
  usersSheetData
) => {
  Object.keys(userVsTender).forEach((key) => {
    //creating message template
    let userId = userVsTender[key][0]["userId"];
    let message = `Hi ${usersSheetData[userId][3]}\n\nWe have exciting Tender Opportunities for you in the ${usersSheetData[userId][7]} Category. Click on the links to get tender details.`;
    let tenders = userVsTender[key];
    for (let i = 0; i < tenders.length; ++i) {
      let tenderObj = tenders[i];
      let tenderDetails = `\n\n*Tender Name*: ${tenderObj["tenderName"]}\n*Location*: ${tenderObj["tenderLocation"]}\n*Description*: ${tenderObj["tenderDesc"]}\n*EMD Amount*: ${tenderObj["tenderEmd"]}\n*Link*: ${tenderObj["link"]}\n\n`;
      message += tenderDetails;
    }

    let data = JSON.stringify({
      from: process.env.INFOBIP_REGISTERED_PHONE,
      to: key.toString(),
      messageId: "a28dd97c-1ffb-4fcf-99f1-0b557ed381da",
      content: {
        text: message,
        whatsapp: {
          text: message,
          url: {
            clickable: true,
          },
        },
      },
      callbackData: "Callback data",
      notifyUrl: "https://www.example.com/whatsapp",
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.INFOBIP_BASE_URL,
      headers: {
        Authorization: process.env.INFOBIP_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: data,
    };

    axios
      .request(config)
      .then((response) => {
        console.log(JSON.stringify(response.data));
      })
      .catch((error) => {
        console.log(error);
      });
  });
};

const extractData = (req, res) => {
  authorize()
    .then(async (auth) => {
      tenderSheetId = process.env.TENDER_SHEET_ID;
      tenderRange = "Tender";
      usersSheetId = process.env.USERS_SHEET_ID;
      usersRange = "User";

      tenderSheetData = await extractSheetData(
        auth,
        tenderSheetId,
        tenderRange
      );
      usersSheetData = await extractSheetData(auth, usersSheetId, usersRange);

      userVsTender = compute(tenderSheetData, usersSheetData);
      createMessageTemplate(userVsTender, tenderSheetData, usersSheetData);

      res.send({ userVsTender });
    })
    .catch(console.error);
};

module.exports = {
  extractData,
  whatsappCallback,
};

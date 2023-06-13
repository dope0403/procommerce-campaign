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

function getFormattedDate() {
  let date = new Date();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let year = date.getFullYear().toString();

  let formattedDate = month + "/" + day + "/" + year;
  return formattedDate;
}

const compute = (tenders, users) => {
  userVsTender = {};
  let formattedDate = getFormattedDate().toString();

  for (let i = 1; i < tenders.length; ++i) {
    let tender = tenders[i];
    if (tender[9] === formattedDate) {
      //cohort
      let overallLocation = tender[1].toString().toLowerCase().trim();
      let material = tender[8].toString().toLowerCase().trim();

      for (let j = 1; j < users.length; ++j) {
        let user = users[j];
        let userState = user[2].toString().toLowerCase().trim();
        let userMaterial = user[8].toString().toLowerCase().trim();
        let stateComp = overallLocation.includes(userState);

        let materialComp = material === userMaterial;
        if (stateComp && materialComp) {
          let link = `https://prcommerce-campaign.com/${i}/${user[9]}`;
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
  }

  return userVsTender;
};

const createMessageTemplate = async (
  userVsTender,
  tenderSheetData,
  usersSheetData
) => {
  Object.keys(userVsTender).forEach(async (key) => {
    //creating message placeholders
    let userId = userVsTender[key][0]["userId"];
    let placeholders = [usersSheetData[userId][3], usersSheetData[userId][7]];
    let tenders = userVsTender[key];
    for (let i = 0; i < tenders.length; ++i) {
      let tenderObj = tenders[i];
      placeholders.push(
        ...[
          tenderObj["tenderName"],
          tenderObj["tenderLocation"],
          tenderObj["tenderDesc"],
          tenderObj["tenderEmd"],
          tenderObj["link"],
        ]
      );
    }

    let data = JSON.stringify({
      messages: [
        {
          from: "447860099299",
          to: "919027138976",
          messageId: "test-message-93847",
          content: {
            templateName: "custom_template",
            templateData: {
              body: {
                placeholders,
              },
            },
            language: "en",
          },
          callbackData: "Callback data",
        },
      ],
    });

    let config = {
      method: "POST",
      url: process.env.INFOBIP_BASE_URL,
      headers: {
        Authorization: process.env.INFOBIP_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: data,
    };

    axios.request(config).then((res) => console.log(res.data));
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

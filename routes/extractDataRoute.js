const {
  extractData,
  whatsappCallback,
} = require("../controllers/extractDataController");
const router = require("express").Router();

router.get("/extract-data", extractData);
router.get("/whatsapp", whatsappCallback);
module.exports = router;

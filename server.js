require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();
const PORT = 5050;

const extractDataRoutes = require("./routes/extractDataRoute");

app.use(cors());
app.use(
  express.json({
    extended: false,
  })
);
app.use(express.urlencoded({ extended: true }));

app.use("/api", extractDataRoutes);

app.listen(PORT, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log(`Server running on PORT ${PORT}`);
  }
});

import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.get("/", async (req, res) => {
  res.status(200).send("Not Implemented");
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

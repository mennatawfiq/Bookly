import express from "express";
import router from "./routes/index"

const app = express();

app.use(express.json());

app.use("/", router);

app.listen(3000, () => {
  console.log("server is listening...")
});
import express from "express";
import router from "./routes/index";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(express.json());

app.use("/", router);

app.use(errorHandler);

app.listen(3000, () => {
  console.log("server is listening...")
});
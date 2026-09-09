import express from "express";
import everntRouter from "./routes/event.routes";

const app = express();

app.use(express.json());

app.use("/events", everntRouter);

app.listen(3000, () => {
  console.log("server is listening...")
});
import "./docs/zod-extend"
import express from "express";
import router from "./routes/index";
import { errorHandler } from "./middlewares/errorHandler";
import { jsend } from "./middlewares/jsend";
import swaggerUi from "swagger-ui-express";
import { generateOpenApiDocument } from "./docs/generateOpenApi.js";

const app = express();

app.use(express.json());
app.use(jsend);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(generateOpenApiDocument()));

app.use("/", router);

app.use(errorHandler);

app.listen(3000, () => {
  console.log("server is listening...")
});
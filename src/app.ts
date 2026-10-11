import { generateOpenApiDocument } from "./docs/index";
import express from "express";
import router from "./routes/index";
import { errorHandler } from "./middlewares/errorHandler";
import { jsend } from "./middlewares/jsend";
import swaggerUi from "swagger-ui-express";

export const app = express();

app.use(express.json());
app.use(jsend);

const openapiDocument = generateOpenApiDocument();

app.get("/openapi.json", (req, res) => res.json(openapiDocument)); // for postman
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

app.use("/", router);

app.use(errorHandler);

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const passport = require("passport");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const goodsRoutes = require("./routes/goodsRoutes");
const elasticRoutes = require("./routes/elasticRoutes");
const cartRoutes = require("./routes/cartRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const packsRouter = require("./routes/packsRouter");
const descriptionRoutes = require("./routes/descriptionRoutes");
const fuzzySearchRoutes = require("./routes/fuzzywuzzyRoutes");

require("dotenv").config();
require("./config/passport")(passport);

const app = express();
const port = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000", // Allow localhost for local development
      "https://taric-frontend.vercel.app", // Allow the deployed frontend URL
      "https://taric-backend-gamma.vercel.app/"
    ], 
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


// Handling preflight OPTIONS requests
app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.status(204).end();
});

// Middleware for chunking large request bodies
let requestChunks = {};  // Temporary storage for chunks

app.use(express.json({ limit: "200mb" })); // Increased limit to 200mb

// Middleware to log request details
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const contentLength = req.headers["content-length"]
    ? req.headers["content-length"]
    : Buffer.byteLength(JSON.stringify(req.body));

  console.log(
    `[${timestamp}] ${req.method} request made to ${req.url} with body size: ${contentLength} bytes`
  );

  // Log the app body size limit
  const bodySizeLimit = "200mb"; // You can adjust this to reflect your configured limit
  console.log(`[${timestamp}] App body size limit is: ${bodySizeLimit}`);

  next(); // Pass control to the next middleware
});

// Middleware to split request body if too large
app.use((req, res, next) => {
  const { body } = req;
  if (Buffer.byteLength(JSON.stringify(body)) > 5000000) { // For example, 5MB
    const chunkId = req.headers["x-chunk-id"];
    const totalChunks = req.headers["x-total-chunks"];

    if (!chunkId || !totalChunks) {
      return res.status(400).json({ error: "Missing chunk metadata" });
    }

    if (!requestChunks[chunkId]) {
      requestChunks[chunkId] = [];
    }

    requestChunks[chunkId].push(body);  // Store the chunk

    // If all chunks have been received
    if (requestChunks[chunkId].length === parseInt(totalChunks)) {
      // Merge all chunks into one
      const completeBody = [].concat(...requestChunks[chunkId]);
      req.body = completeBody; // Set the merged body

      // Cleanup after merging
      delete requestChunks[chunkId];
    }
  }
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/goods", goodsRoutes);
app.use("/api/elastic", elasticRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/packs", packsRouter);
app.use("/api/description", descriptionRoutes);
app.use("/api/fuzzy-search", fuzzySearchRoutes);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

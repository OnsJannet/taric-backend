const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
//const csrf = require('csurf');
const passport = require('passport');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const goodsRoutes = require('./routes/goodsRoutes');
const elasticRoutes = require('./routes/elasticRoutes');
const cartRoutes = require('./routes/cartRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const packsRouter = require('./routes/packsRouter');
const descriptionRoutes = require('./routes/descriptionRoutes');
require('dotenv').config();


require('./config/passport')(passport);

const app = express();
const port = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());



// Routes
app.use('/api/auth', authRoutes);
app.use('/api/goods', goodsRoutes);
app.use('/api/elastic', elasticRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/subscription', subscriptionRoutes)
app.use('/api/packs', packsRouter)
app.use('/api/description', descriptionRoutes)


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

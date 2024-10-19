// models/Pack.js
const mongoose = require('mongoose');

const packSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  features: { type: [String] },
  billingCycle: { type: String, enum: ['monthly', 'yearly'], required: true },
  stripePriceId: { type: String }
});

const Pack = mongoose.model('Product', packSchema);
module.exports = Pack;

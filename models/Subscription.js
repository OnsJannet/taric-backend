const mongoose = require('mongoose');

// Define the Subscription schema
const SubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true,
  },
  stripeSubscriptionId: {
    type: String,
    required: true,
    unique: true, // Ensure subscription ID is unique
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'incomplete', 'unpaid'], // Possible statuses from Stripe
    default: 'active',
  },
  currentPeriodStart: {
    type: Date,
    required: true,
  },
  currentPeriodEnd: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
SubscriptionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Create the Subscription model
const Subscription = mongoose.model('Subscription', SubscriptionSchema);

module.exports = Subscription;

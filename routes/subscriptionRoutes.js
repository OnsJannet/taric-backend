const express = require('express');
const router = express.Router();
const stripe = require('../stripeConfig'); // Import Stripe instance
const User = require('../models/User');
const Product = require('../models/Product'); // Import Product model

// Create a Stripe subscription
router.post('/create-subscription', async (req, res) => {
  const { userId, paymentMethodId, productId } = req.body;

  try {
    // Get the product from the DB
    const product = await Product.findById(productId);
    if (!product) return res.status(404).send('Product not found');

    // Get user from DB
    const user = await User.findById(userId);
    if (!user) return res.status(404).send('User not found');

    // Create a new Stripe customer if the user doesn't have one
    let customer;
    if (!user.stripeCustomerId) {
      customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId }
      });
      user.stripeCustomerId = customer.id;
      await user.save();
    } else {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
    }

    // Create the subscription with EUR currency
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        price_data: {
          currency: 'eur', // Set currency to EUR
          product_data: {
            name: product.name, // Use product name from DB
            description: product.description
          },
          unit_amount: product.price * 100, // Price in cents
          recurring: { interval: product.billingCycle } // monthly or yearly from DB
        }
      }],
      expand: ['latest_invoice.payment_intent'],
    });

    res.json({ subscription });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).send('Server error');
  }
});

module.exports = router;

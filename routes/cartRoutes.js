const express = require('express');
const router = express.Router();
const {
  createCart,
  addItemToCart,
  removeItemFromCart,
  getCartItems,
  clearCart,
  deleteCart,
  cancelCart,
  setCartStatusToPaid, // Import the new function
} = require('./cart');

// API route to create a new cart
router.post('/create', async (req, res) => {
  try {
    const { userId } = req.body;
    const cart = await createCart(userId);
    res.status(201).json(cart);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// API route to add an item to the cart

router.post('/add', async (req, res) => {
  try {
    const { userId, item } = req.body;
    await addItemToCart(userId, item);
    const updatedCart = await getCartItems(userId);
    res.status(200).json(updatedCart);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// API route to remove an item from the cart
router.delete('/remove', async (req, res) => {
  try {
    const { userId, productId } = req.body;
    await removeItemFromCart(userId, productId);
    res.status(200).send('Item removed from cart');
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// API route to get all items in the cart
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    const items = await getCartItems(userId);
    res.json(items);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// API route to clear the cart
router.delete('/clear', async (req, res) => {
  try {
    const { userId } = req.body;
    await clearCart(userId);
    res.status(200).send('Cart cleared');
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// API route to delete the cart
router.delete('/delete', async (req, res) => {
  try {
    const { userId } = req.body;
    await deleteCart(userId);
    res.status(200).send('Cart deleted');
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// API route to cancel a cart
router.post('/cancel', async (req, res) => {
  try {
    const { userId } = req.body;
    await cancelCart(userId);
    res.status(200).send('Cart canceled');
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// API route to change cart status to paid
router.post('/pay', async (req, res) => {
  try {
    const { userId } = req.body;
    await markCartAsPaid(userId);
    res.status(200).send('Cart marked as paid');
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;

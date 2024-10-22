const carts = {}; // To store the cart data for users
const cartStatus = {}; // To store the status of each user's cart (e.g., open, paid, closed)
const Cart = require('../models/Cart');

// Function to create a new cart for a user
const createCart = async (userId) => {
  try {
    // Check if there's already an open cart
    const existingCart = await Cart.findOne({ userId, status: 'open' });
    if (existingCart) throw new Error('Cart already exists for this user and is open.');

    // Create a new cart with empty items
    const newCart = new Cart({ userId, items: [] });
    await newCart.save();
    return newCart;
  } catch (error) {
    throw new Error(error.message);
  }
};

// Function to add an item to the cart, with cart creation if it doesn't exist
const addItemToCart = async (userId, { code, score, value, data, quantity }) => {
  try {
    // Find the user's cart
    let cart = await Cart.findOne({ userId, status: 'open' });

    // Automatically create a new cart if one doesn't exist or is closed/paid
    if (!cart) {
      cart = await createCart(userId);
    }

    // Check if the item (by product code) is already in the cart
    const existingItem = cart.items.find(item => item.code === code);

    if (existingItem) {
      // Update the quantity if the item already exists
      existingItem.quantity += quantity;
    } else {
      // Add a new item to the cart
      cart.items.push({ code, score, value, data, quantity });
    }

    // Save the updated cart
    await cart.save();

    // Find the user and update the 'carts' field
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { carts: cart._id } }, // Add the cart ID to the user's 'carts' array
      { new: true } // Return the updated document
    );
  } catch (error) {
    throw new Error(`Error adding item to cart: ${error.message}`);
  }
};


// Function to remove an item from the cart
const removeItemFromCart = async (userId, code) => {
  const cart = await Cart.findOne({ userId, status: 'open' });
  if (!cart) {
    throw new Error('Cart does not exist for this user.');
  }
  cart.items = cart.items.filter(item => item.code !== code); // Remove by product code
  await cart.save(); // Save the updated cart
};

// Function to get all items in the cart
const getCartItems = async (userId) => {
  const cart = await Cart.findOne({ userId, status: 'open' });
  if (!cart) {
    throw new Error('Cart does not exist for this user.');
  }
  return cart.items; // Return the items from the cart
};

// Function to clear the cart
const clearCart = async (userId) => {
  const cart = await Cart.findOne({ userId, status: 'open' });
  if (!cart) {
    throw new Error('Cart does not exist for this user.');
  }
  cart.items = []; // Clear the cart
  await cart.save(); // Save the updated cart
};

// Function to delete the cart
const deleteCart = async (userId) => {
  const cart = await Cart.findOne({ userId, status: 'open' });
  if (!cart) {
    throw new Error('Cart does not exist for this user.');
  }
  await Cart.deleteOne({ userId, status: 'open' }); // Delete the cart from the database
  delete cartStatus[userId];
};

// Function to cancel a cart
const cancelCart = async (userId) => {
  const cart = await Cart.findOne({ userId, status: 'open' });
  if (!cart) {
    throw new Error('Cart does not exist for this user.');
  }
  cart.items = [];
  await cart.save();
  cartStatus[userId] = 'closed'; // Mark the cart as closed
};

// Function to mark the cart as "paid"
const markCartAsPaid = async (userId) => {
  const cart = await Cart.findOne({ userId, status: 'open' });
  if (!cart) {
    throw new Error('Cart does not exist for this user.');
  }
  cartStatus[userId] = 'paid'; // Mark the cart as paid
};

// Export the functions
module.exports = {
  createCart,
  addItemToCart,
  removeItemFromCart,
  getCartItems,
  clearCart,
  deleteCart,
  cancelCart,
  markCartAsPaid,
};

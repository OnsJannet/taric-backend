const Cart = require('../models/Cart');
const User = require('../models/User');
const { ApiError } = require('../middlewares/errorMiddleware');

/**
 * Creates a new cart for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The created cart
 */
const createCart = async (userId) => {
  try {
    // Check if there's already an open cart
    const existingCart = await Cart.findOne({ userId, status: 'open' });
    if (existingCart) {
      throw new ApiError(400, 'Cart already exists for this user and is open');
    }

    // Create a new cart with empty items
    const newCart = new Cart({ userId, items: [] });
    await newCart.save();
    return newCart;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Error creating cart: ${error.message}`);
  }
};

/**
 * Adds an item to the user's cart
 * @param {string} userId - The user ID
 * @param {Object} item - The item to add
 * @returns {Promise<Object>} - The updated cart
 */
const addItemToCart = async (userId, { code, score, value, data, quantity }) => {
  try {
    // Find the user's cart
    let cart = await Cart.findOne({ userId, status: 'open' });

    // Automatically create a new cart if one doesn't exist or is closed/paid
    if (!cart) {
      cart = await createCart(userId);
    }

    // Check if the item (by product code) is already in the cart
    const existingItemIndex = cart.items.findIndex(item => item.code === code);

    if (existingItemIndex !== -1) {
      // Update the quantity if the item already exists
      cart.items[existingItemIndex].quantity += quantity;
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

    return cart;
  } catch (error) {
    throw new ApiError(500, `Error adding item to cart: ${error.message}`);
  }
};

/**
 * Removes an item from the cart
 * @param {string} userId - The user ID
 * @param {string} code - The product code to remove
 * @returns {Promise<Object>} - The updated cart
 */
const removeItemFromCart = async (userId, code) => {
  try {
    const cart = await Cart.findOne({ userId, status: 'open' });
    if (!cart) {
      throw new ApiError(404, 'Cart does not exist for this user');
    }
    
    const initialItemCount = cart.items.length;
    cart.items = cart.items.filter(item => item.code !== code);
    
    if (cart.items.length === initialItemCount) {
      throw new ApiError(404, 'Item not found in cart');
    }
    
    await cart.save();
    return cart;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Error removing item from cart: ${error.message}`);
  }
};

/**
 * Gets all items in the user's cart
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} - The cart items
 */
const getCartItems = async (userId) => {
  try {
    const cart = await Cart.findOne({ userId, status: 'open' });
    if (!cart) {
      throw new ApiError(404, 'Cart does not exist for this user');
    }
    return cart.items;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Error getting cart items: ${error.message}`);
  }
};

/**
 * Clears all items from the cart
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The updated cart
 */
const clearCart = async (userId) => {
  try {
    const cart = await Cart.findOne({ userId, status: 'open' });
    if (!cart) {
      throw new ApiError(404, 'Cart does not exist for this user');
    }
    cart.items = [];
    await cart.save();
    return cart;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Error clearing cart: ${error.message}`);
  }
};

/**
 * Deletes the user's cart
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - True if successful
 */
const deleteCart = async (userId) => {
  try {
    const result = await Cart.deleteOne({ userId, status: 'open' });
    if (result.deletedCount === 0) {
      throw new ApiError(404, 'Cart does not exist for this user');
    }
    return true;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Error deleting cart: ${error.message}`);
  }
};

/**
 * Cancels the user's cart
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The updated cart
 */
const cancelCart = async (userId) => {
  try {
    const cart = await Cart.findOne({ userId, status: 'open' });
    if (!cart) {
      throw new ApiError(404, 'Cart does not exist for this user');
    }
    cart.items = [];
    cart.status = 'closed';
    await cart.save();
    return cart;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Error canceling cart: ${error.message}`);
  }
};

/**
 * Marks the cart as paid
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - The updated cart
 */
const markCartAsPaid = async (userId) => {
  try {
    const cart = await Cart.findOne({ userId, status: 'open' });
    if (!cart) {
      throw new ApiError(404, 'Cart does not exist for this user');
    }
    cart.status = 'paid';
    await cart.save();
    return cart;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Error marking cart as paid: ${error.message}`);
  }
};

module.exports = {
  createCart,
  addItemToCart,
  removeItemFromCart,
  getCartItems,
  clearCart,
  deleteCart,
  cancelCart,
  markCartAsPaid
};

const express = require('express');
const { check, validationResult } = require('express-validator');
const { protect } = require('../middlewares/authMiddleware');
const cartService = require('../services/cartService');
const { ApiError } = require('../middlewares/errorMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Create a rate limiter for cart operations
const cartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many cart operations from this IP, please try again after 15 minutes'
});

/**
 * @route   POST /api/cart
 * @desc    Create a new cart
 * @access  Private
 */
router.post('/', [protect, cartLimiter], async (req, res, next) => {
  try {
    const cart = await cartService.createCart(req.user.id);
    res.status(201).json({ 
      success: true, 
      data: cart,
      message: 'Cart created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/cart/items
 * @desc    Add item to cart
 * @access  Private
 */
router.post('/items', [
  protect,
  cartLimiter,
  check('code').notEmpty().withMessage('Product code is required'),
  check('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ApiError(400, 'Validation error', true, null));
  }

  try {
    const { code, score, value, data, quantity } = req.body;
    const cart = await cartService.addItemToCart(req.user.id, { 
      code, 
      score: score || 0, 
      value: value || '', 
      data: data || {}, 
      quantity: parseInt(quantity) 
    });
    
    res.status(200).json({ 
      success: true, 
      data: cart,
      message: 'Item added to cart successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/cart/items/:code
 * @desc    Remove item from cart
 * @access  Private
 */
router.delete('/items/:code', [protect, cartLimiter], async (req, res, next) => {
  try {
    const cart = await cartService.removeItemFromCart(req.user.id, req.params.code);
    res.status(200).json({ 
      success: true, 
      data: cart,
      message: 'Item removed from cart successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/cart/items
 * @desc    Get all items in cart
 * @access  Private
 */
router.get('/items', protect, async (req, res, next) => {
  try {
    const items = await cartService.getCartItems(req.user.id);
    res.status(200).json({ 
      success: true, 
      data: items,
      count: items.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/cart/items
 * @desc    Clear all items from cart
 * @access  Private
 */
router.delete('/items', [protect, cartLimiter], async (req, res, next) => {
  try {
    const cart = await cartService.clearCart(req.user.id);
    res.status(200).json({ 
      success: true, 
      data: cart,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/cart
 * @desc    Delete cart
 * @access  Private
 */
router.delete('/', [protect, cartLimiter], async (req, res, next) => {
  try {
    await cartService.deleteCart(req.user.id);
    res.status(200).json({ 
      success: true, 
      message: 'Cart deleted successfully' 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/cart/cancel
 * @desc    Cancel cart
 * @access  Private
 */
router.put('/cancel', [protect, cartLimiter], async (req, res, next) => {
  try {
    const cart = await cartService.cancelCart(req.user.id);
    res.status(200).json({ 
      success: true, 
      data: cart,
      message: 'Cart cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/cart/pay
 * @desc    Mark cart as paid
 * @access  Private
 */
router.put('/pay', [protect, cartLimiter], async (req, res, next) => {
  try {
    const cart = await cartService.markCartAsPaid(req.user.id);
    res.status(200).json({ 
      success: true, 
      data: cart,
      message: 'Cart marked as paid successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

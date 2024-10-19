// models/Cart.js
const mongoose = require("mongoose");

const CartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        code: {
          type: String,
          required: true,
        },
        score: {
          type: Number,
          required: true,
        },
        value: {
          type: String,
          required: true,
        },
        data: {
          type: String, 
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
  },
  { timestamps: true }
);

const Cart = mongoose.model("Cart", CartSchema);
module.exports = Cart;

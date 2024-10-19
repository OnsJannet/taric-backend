const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  defaultLanguage: { type: String, default: 'en' },
  pack: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // Reference to the selected pack from Product model
  carts: [{ // List of carts
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // Assuming you have a Product model
        quantity: { type: Number, default: 1 },
      }
    ],
    createdAt: { type: Date, default: Date.now },
  }]
});

// Pre-save hook to hash password before saving the user
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to match user-entered password with the stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;

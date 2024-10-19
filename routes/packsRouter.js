// routes/packs.js
const express = require('express');
const router = express.Router();
const Pack = require('../models/Product'); // Import the Pack model

// API route to create a new pack
router.post('/', async (req, res) => {
  try {
    const pack = new Pack(req.body);
    await pack.save();
    res.status(201).json(pack);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// API route to update a pack by ID
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPack = await Pack.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updatedPack) {
      return res.status(404).send('Pack not found');
    }
    res.json(updatedPack);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// API route to delete a pack by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPack = await Pack.findByIdAndDelete(id);
    if (!deletedPack) {
      return res.status(404).send('Pack not found');
    }
    res.status(204).send(); // No content to send back
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// API route to get all packs
router.get('/', async (req, res) => {
  try {
    const packs = await Pack.find();
    res.json(packs);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// API route to get a pack by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pack = await Pack.findById(id);
    if (!pack) {
      return res.status(404).send('Pack not found');
    }
    res.json(pack);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;

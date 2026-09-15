const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({
  text: String,
  price: Number,
});

const serviceQuestionSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "service", required: true },
  question: { type: String, required: true },
  type: { type: String, enum: ["text", "select", "multi"], default: "text" },
  options: [optionSchema],
  isRequired: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
});

module.exports = mongoose.model("ServiceQuestion", serviceQuestionSchema);
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  action: { type: String, enum: ["start", "complete"], required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

module.exports = mongoose.model("OTP", otpSchema);
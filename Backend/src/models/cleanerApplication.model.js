const mongoose = require("mongoose");

const cleanerApplicationSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // will be hashed after approval
  phone: { type: String, required: true },
  address: { type: String, required: true },
  cleanerType: { type: String, required: true },
  cnicFrontImage: { type: String, required: true }, // path or URL
  cnicBackImage: { type: String, required: true },
   profileImage: { type: String, default: "" },  
  cnicNumber: { type: String, required: true, unique: true },
  status: { type: String, enum: ["pending", "approved", "rejected", "blocked"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("CleanerApplication", cleanerApplicationSchema);
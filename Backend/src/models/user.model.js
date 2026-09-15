const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },
  cnicNumber: { type: String, unique: true, sparse: true }  ,
  password: {
    type: String,
    required: true,
  },
   profileImage: { type: String, default: "" },  
 phone: {
  type: String,
  required: false,   // ya true agar compulsory hai
  default: ""
},
  role: {
    type: String,
    enum: ['user', 'admin', 'cleaner'],
    default: 'user'
  },

  // NEW FIELD
  cleanerType: {
  type: String,
  default: undefined
},

  address: {
    type: String,
    required: true,
  },
  isOnline: {
  type: Boolean,
  default: false
}

});

const userModel = mongoose.model("user", userSchema);

module.exports = userModel;
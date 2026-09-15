const express=require("express");
const router=express.Router();
const {
  forgotPassword
} = require("../controllers/auth.controller");
const authController=require("../controllers/auth.controller");
router.post("/forgot-password", forgotPassword);
router.post("/register",authController.registerUser)
router.post("/login",authController.loginUser)
router.post("/logout", authController.logoutUser);
module.exports=router;
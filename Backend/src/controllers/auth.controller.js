const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
require("dotenv").config();

const generatePassword = () => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;
  let password = "";
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];
  for (let i = password.length; i < 8; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const isValidStrongPassword = (password) => {
  if (password.length !== 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const newPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    await transporter.sendMail({
      from: `"Service App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your New Password",
      text: `Your new password is: ${newPassword}`,
    });
    user.password = hashedPassword;
    await user.save();
    return res.status(200).json({ message: "New password sent to email" });
  } catch (error) {
    console.log("FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

async function logoutUser(req, res) {
  try {
    const { userId } = req.body;
    await userModel.findByIdAndUpdate(userId, { isOnline: false });
    res.clearCookie("token");
    res.status(200).json({ message: "Logout successfully" });
  } catch (error) {
    res.status(500).json({ message: "Logout failed", error: error.message });
  }
}

async function registerUser(req, res) {
  const { username, email, password, role = "user", address, phone, cleanerType } = req.body;
  const isUserAlreadyExists = await userModel.findOne({ $or: [{ username }, { email }] });
  if (isUserAlreadyExists) {
    return res.status(409).json({ message: "User Already Exists" });
  }
  if (!isValidStrongPassword(password)) {
    return res.status(400).json({ message: "Password must be exactly 8 characters long and contain uppercase, lowercase, digit and special character." });
  }
  const hash = await bcrypt.hash(password, 10);
  const userData = {
    username,
    email,
    password: hash,
    phone,
    role,
    address,
    cleanerType: role === "cleaner" ? cleanerType : undefined,
  };
  const user = await userModel.create(userData);
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
  res.cookie("token", token);
  res.status(201).json({
    message: "User registered Successfully",
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
    },
  });
}

async function loginUser(req, res) {
  try {
    const { username, email, password } = req.body;
    console.log("LOGIN ATTEMPT:", { username, email });

    // Fix: agar email hai toh email se dhundo, warna username se
    const query = email ? { email } : { username };
    const user = await userModel.findOne(query);
    console.log("USER FOUND:", user ? user.email : "NOT FOUND");

    if (!user) {
      return res.status(401).json({ message: "Invalid Credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("PASSWORD VALID:", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid Credentials" });
    }

    await userModel.findByIdAndUpdate(user._id, { isOnline: true });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
    res.cookie("token", token);
    return res.status(201).json({
      message: "User Login Successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        address: user.address,
        profileImage: user.profileImage,
        phone: user.phone,  
        isOnline: true,
        ...(user.role === "cleaner" && { cleanerType: user.cleanerType }),
      },
    });
  } catch (error) {
    console.log("LOGIN ERROR DETAILS:", error.message);
    console.log("LOGIN ERROR STACK:", error.stack);
    return res.status(500).json({ message: "Login Server Error", error: error.message });
  }
}

module.exports = { registerUser, loginUser, logoutUser, forgotPassword };
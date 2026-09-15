require("dotenv").config();

// ✅ Node.js 18 fix
const crypto = require("crypto");
globalThis.crypto = crypto;

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Stripe = require("stripe");
const Review = require("./models/review.model");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const ServiceQuestion = require("./models/serviceQuestion.model");
const createNotification = require("./utils/createNotification");
const { sendEmail, sendOTPEmail } = require("./utils/sendEmail");

const CleanerApplication = require("./models/cleanerApplication.model");
const upload = require("./routes/upload.routes");

const authRoutes = require("./routes/auth.route");
const userModel = require("./models/user.model");
const serviceModel = require("./models/service.model");
const Booking = require("./models/booking.model");
const OTP = require("./models/otp.model");

const app = express();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(cookieParser());
app.use("/uploads", express.static("uploads"));


const Notification = require("./models/notification.model");

// ========== PASSWORD VALIDATION ==========
function isValidStrongPassword(password) {
  if (password.length !== 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
  return true;
}

// ========== NOTIFICATIONS ==========
app.get("/api/notifications", async (req, res) => {
  try {
    const { userId, role } = req.query;
    if (!userId || !role) {
      return res.status(400).json({ message: "userId and role required" });
    }
    const notifications = await Notification.find({
      recipientId: userId,
      recipientRole: role,
    }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/notifications/:id/read", async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/notifications/mark-all-read", async (req, res) => {
  try {
    const { userId, role } = req.body;
    await Notification.updateMany(
      { recipientId: userId, recipientRole: role, read: false },
      { read: true }
    );
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/notifications/clear", async (req, res) => {
  try {
    const { userId, role } = req.body;
    await Notification.deleteMany({ recipientId: userId, recipientRole: role });
    res.json({ message: "Cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== HELPER FUNCTIONS ==========
function timeToMinutes(time) {
  let cleanTime = String(time).trim().toUpperCase();
  const isPM = cleanTime.includes("PM");
  const isAM = cleanTime.includes("AM");
  cleanTime = cleanTime.replace("AM", "").replace("PM", "").trim();
  const parts = cleanTime.split(":");
  if (parts.length !== 2) throw new Error("Invalid time format");
  let hours = Number(parts[0]);
  let minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
    throw new Error("Invalid time value");
  }
  if (isPM && hours !== 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  if (hours > 23) throw new Error("Invalid hour value");
  return hours * 60 + minutes;
}

function parseTimeRange(timeRange) {
  const parts = String(timeRange).split("-");
  if (parts.length !== 2) throw new Error("Invalid time range format");
  const startMinutes = timeToMinutes(parts[0]);
  const endMinutes = timeToMinutes(parts[1]);
  if (endMinutes <= startMinutes) throw new Error("End time must be after start time");
  return { startMinutes, endMinutes };
}

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function generateBookingSlots(date, timeRange, frequency) {
  const { startMinutes, endMinutes } = parseTimeRange(timeRange);
  const slots = [];

  if (frequency === "Weekly" || frequency === "Full Week") {
    for (let i = 0; i < 7; i++) {
      slots.push({ date: addDays(date, i), startMinutes, endMinutes });
    }
    return slots;
  }

  if (frequency === "Monthly") {
    for (let i = 0; i < 30; i++) {
      slots.push({ date: addDays(date, i), startMinutes, endMinutes });
    }
    return slots;
  }

  slots.push({ date, startMinutes, endMinutes });
  return slots;
}

function slotsOverlap(slotA, slotB) {
  return (
    slotA.date === slotB.date &&
    slotA.startMinutes < slotB.endMinutes &&
    slotA.endMinutes > slotB.startMinutes
  );
}

function isBookingActionWindowOpen(booking) {
  const createdAtTime = new Date(booking.createdAt).getTime();
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() - createdAtTime <= fiveMinutes;
}

function attachBookingWindowStatus(bookings) {
  return bookings.map((booking) => {
    const bookingObj = booking.toObject ? booking.toObject() : booking;
    const actionWindowOpen = isBookingActionWindowOpen(bookingObj);
    return {
      ...bookingObj,
      actionWindowOpen,
      shouldShowInOverview: bookingObj.bookingStatus !== "Completed",
      shouldShowInHistory: bookingObj.bookingStatus === "Completed",
    };
  });
}

function normalizeCleanerType(serviceName) {
  const cleanerTypeMap = {
    "Regular Cleaning": "Regular Cleaner",
    "Move-In Cleaning ": "Move In",
    "Move-Out Cleaning": "Move Out",
    "Plumber Service": "Plumber Services",
    "Electrician Service": "Electrician Services",
    "Handyman Service": "Handyman Services",
  };
  return cleanerTypeMap[serviceName] || serviceName;
}

function bookingHasAnyOverlap(existingBooking, requestedSlots) {
  let existingSlots = existingBooking.slots || [];
  if (existingSlots.length === 0) {
    try {
      existingSlots = generateBookingSlots(
        existingBooking.date,
        existingBooking.timeRange || existingBooking.time,
        existingBooking.frequency
      );
    } catch (err) {
      return false;
    }
  }
  for (const existingSlot of existingSlots) {
    for (const requestedSlot of requestedSlots) {
      if (slotsOverlap(existingSlot, requestedSlot)) return true;
    }
  }
  return false;
}

// ========== CHANGE PASSWORD ==========
app.put("/api/users/:userId/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.params.userId;

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (!isValidStrongPassword(newPassword)) {
      return res.status(400).json({
        message:
          "New password must be exactly 8 characters long and contain uppercase, lowercase, digit and special character."
      });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Current password is incorrect"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await userModel.findByIdAndUpdate(
      userId,
      { password: hashedPassword },
      { runValidators: false }
    );

    return res.json({
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

// ========== ADMIN PROFILE IMAGE UPLOAD ==========
app.put("/api/users/:userId/profile-image",
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const profileImage = req.file?.path;
      if (!profileImage) return res.status(400).json({ message: "No image uploaded" });
      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        { profileImage },
        { new: true }
      );
      if (!updatedUser) return res.status(404).json({ message: "User not found" });
      res.json({ message: "Profile image updated", profileImage: updatedUser.profileImage });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.use("/api/auth", authRoutes);

// ========== USERS ==========
app.get("/users", async (req, res) => {
  try {
    const users = await userModel.find({ role: "user" }).select("username email _id");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== UPDATE USER PROFILE ==========
app.put("/api/users/:userId", async (req, res) => {
  try {
    const { username, email } = req.body;
    const userId = req.params.userId;
    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { username, email },
      { new: true }
    );
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Profile updated", user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CLEANER APPLICATIONS ==========
app.put("/api/admin/cleaner-applications/:id/block", async (req, res) => {
  try {
    const application = await CleanerApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    const deletedUser = await userModel.findOneAndDelete({ email: application.email });
    if (!deletedUser) {
      console.log(`User not found with email: ${application.email}, but continuing to block application`);
    }
    application.status = "blocked";
    await application.save();
    res.json({ message: "Cleaner blocked and account removed" });
  } catch (err) {
    console.error("Block error:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ========== REVIEWS ==========
app.delete("/api/reviews/:id", async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    const io = req.app.get("io");
    if (io) io.emit("reviewDeleted", review._id);
    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/reviews/:id", async (req, res) => {
  try {
    const updatedReview = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedReview);
  } catch (err) {
    res.status(500).json({ error: "Review update failed" });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const { userId, cleanerId, bookingId, rating, comment } = req.body;
    if (!userId || !cleanerId || !rating || !comment) {
      return res.status(400).json({ message: "All fields required" });
    }
    const review = await Review.create({
      userId, cleanerId, bookingId: bookingId || null, rating, comment,
    });
    const io = req.app.get("io");
    if (io) io.emit("reviewAdded", review);
    res.status(201).json({ message: "Review submitted", review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("userId", "username email")
      .populate("cleanerId", "username cleanerType")
      .populate("bookingId", "serviceName date");
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reviews/admin", async (req, res) => {
  try {
    const { userId, cleanerId, bookingId, rating, comment } = req.body;
    if (!userId || !cleanerId || !rating || !comment) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const review = await Review.create({
      userId, cleanerId, bookingId: bookingId || null, rating, comment, addedByAdmin: true,
    });
    const io = req.app.get("io");
    if (io) io.emit("reviewAdded", review);
    res.status(201).json({ message: "Admin review added", review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/cleaner/:cleanerId/rating", async (req, res) => {
  try {
    const result = await Review.aggregate([
      { $match: { cleanerId: new mongoose.Types.ObjectId(req.params.cleanerId) } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, total: { $sum: 1 } } },
    ]);
    const avg = result.length ? result[0].avgRating : 0;
    res.json({ averageRating: avg, totalReviews: result.length ? result[0].total : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reviews/public", async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate("userId", "username")
      .populate("cleanerId", "username cleanerType profileImage")
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== OTP ==========
app.post("/booking/request-otp/:bookingId", async (req, res) => {
  try {
    const { action } = req.body;
    const booking = await Booking.findById(req.params.bookingId).populate("userId");
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const userEmail = booking.userId.email;
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await OTP.deleteMany({ bookingId: booking._id, action });
    await OTP.create({ bookingId: booking._id, action, code: otpCode, expiresAt });
    await sendOTPEmail(userEmail, otpCode, action);
    res.json({ message: "OTP sent to user's email" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/booking/verify-otp/:bookingId", async (req, res) => {
  try {
    const { action, otp } = req.body;
    const otpRecord = await OTP.findOne({
      bookingId: req.params.bookingId,
      action,
      code: otp,
    });
    if (!otpRecord) return res.status(400).json({ message: "Invalid OTP" });
    if (otpRecord.expiresAt < new Date()) return res.status(400).json({ message: "OTP expired" });

    let updatedBooking;
    if (action === "start") {
      updatedBooking = await Booking.findByIdAndUpdate(
        req.params.bookingId,
        { bookingStatus: "In Process" },
        { new: true }
      );
    } else if (action === "complete") {
      const existingBooking = await Booking.findById(req.params.bookingId);
      let updateData = { bookingStatus: "Completed" };
      if (existingBooking.paymentMethod === "Cash") {
        updateData.paymentStatus = "Paid";
        updateData.cleanerEarningStatus = "Paid";
      } else if (existingBooking.paymentMethod === "Online") {
        updateData.cleanerEarningStatus = "Pending";
      }
      updatedBooking = await Booking.findByIdAndUpdate(
        req.params.bookingId,
        updateData,
        { new: true }
      );
    }

    await OTP.deleteOne({ _id: otpRecord._id });

    const io = req.app.get("io");
    if (io) {
      io.to(String(updatedBooking.userId)).emit("bookingUpdated");
      io.emit("bookingUpdated");
      if (action === "complete") {
        io.to(String(updatedBooking.assignedCleaner)).emit("cleanerPaymentPaid", updatedBooking);
      }
    }

    res.json({ message: `${action} successful`, booking: updatedBooking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CLEANER APPLICATION ROUTES ==========
app.post(
  "/api/cleaner/apply",
  upload.fields([
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 },
    { name: "profileImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { username, email, password, phone, address, cleanerType, cnicNumber } = req.body;
      const cnicFront = req.files?.cnicFront?.[0]?.path || "";
      const cnicBack = req.files?.cnicBack?.[0]?.path || "";
      const profileImage = req.files?.profileImage?.[0]?.path || "";

      if (!cnicFront || !cnicBack) return res.status(400).json({ message: "CNIC images required" });
      if (!cnicNumber) return res.status(400).json({ message: "CNIC number required" });

      const existingApp = await CleanerApplication.findOne({
        $or: [{ username }, { email }, { cnicNumber }],
        status: { $in: ["pending", "approved"] },
      });
      if (existingApp) {
        return res.status(409).json({ message: "Application with same username/email/CNIC exists" });
      }

      const existingUser = await userModel.findOne({
        $or: [{ username }, { email }, { cnicNumber }],
      });
      if (existingUser) {
        return res.status(409).json({ message: "User with same username/email/CNIC exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await CleanerApplication.create({
        username, email, password: hashedPassword, phone, address,
        cleanerType, cnicNumber, profileImage,
        cnicFrontImage: cnicFront, cnicBackImage: cnicBack, status: "pending",
      });

      res.status(201).json({ message: "Application submitted, pending admin approval" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

app.get("/api/admin/cleaner-applications", async (req, res) => {
  try {
    const apps = await CleanerApplication.find().sort({ status: 1, createdAt: -1 });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/cleaner-applications/:id/approve", async (req, res) => {
  try {
    const application = await CleanerApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    if (application.status !== "pending") {
      return res.status(400).json({
        message: `Already processed (current status: ${application.status})`,
      });
    }

    let user = await userModel.findOne({
      $or: [{ username: application.username }, { email: application.email }],
    });

    if (!user) {
      user = await userModel.create({
        username: application.username,
        email: application.email,
        password: application.password,
        phone: application.phone,
        address: application.address,
        role: "cleaner",
        cleanerType: application.cleanerType,
        isOnline: false,
        cnicNumber: application.cnicNumber,
        profileImage: application.profileImage,
      });
    }

    application.status = "approved";
    await application.save();

    await sendEmail({
      to: application.email,
      subject: "Cleaner Application Approved",
      text: `Hello ${application.username},\n\nYour cleaner account has been approved. You can now log in using your registered email/username and password.\n\nThank you.`,
    });

    res.json({ message: "Cleaner approved", cleaner: user });
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/cleaner-applications/:id/reject", async (req, res) => {
  try {
    const application = await CleanerApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    if (application.status !== "pending") {
      return res.status(400).json({
        message: `Already processed (current status: ${application.status})`,
      });
    }
    application.status = "rejected";
    await application.save();
    await sendEmail({
      to: application.email,
      subject: "Cleaner Application Rejected",
      text: `Hello ${application.username},\n\nYour application to become a cleaner has been rejected. Please contact support for more details.`,
    });
    res.json({ message: "Application rejected" });
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== BOOKING CANCEL & RESCHEDULE ==========
app.put("/bookings/:id/cancel", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.bookingStatus !== "Temporary") {
      return res.status(400).json({ message: "Booking can no longer be cancelled" });
    }
    const createdAtTime = new Date(booking.createdAt).getTime();
    if (Date.now() - createdAtTime > 5 * 60 * 1000) {
      return res.status(400).json({ message: "Cancellation window expired" });
    }
    await Booking.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Booking cancelled and deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put("/bookings/:id/reschedule", async (req, res) => {
  try {
    const { newDate, newTime } = req.body;
    if (!newDate || !newTime) {
      return res.status(400).json({ message: "New date and new time are required" });
    }
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.bookingStatus !== "Temporary") {
      return res.status(400).json({ message: "Booking can no longer be rescheduled" });
    }
    const createdAtTime = new Date(booking.createdAt).getTime();
    if (Date.now() - createdAtTime > 5 * 60 * 1000) {
      return res.status(400).json({ message: "Reschedule window expired" });
    }

    const requestedSlots = generateBookingSlots(newDate, newTime, booking.frequency);
    const normalizedCleanerType = normalizeCleanerType(booking.serviceName);
    const cleaners = await userModel.find({ role: "cleaner", cleanerType: normalizedCleanerType });
    const cleanerCapacity = cleaners.length;

    if (cleanerCapacity === 0) {
      return res.status(400).json({ message: "No cleaner available for this service" });
    }

    const activeBookings = await Booking.find({
      _id: { $ne: booking._id },
      bookingStatus: { $nin: ["Cancelled", "Completed"] },
      serviceName: booking.serviceName,
    });

    let overlappingBookingsCount = 0;
    for (const existingBooking of activeBookings) {
      if (bookingHasAnyOverlap(existingBooking, requestedSlots)) {
        overlappingBookingsCount++;
      }
    }

    if (overlappingBookingsCount >= cleanerCapacity) {
      return res.status(400).json({ message: "Cleaner is not available for this time slot" });
    }

    booking.date = newDate;
    booking.formattedDate = newDate;
    booking.timeRange = newTime;
    booking.slots = requestedSlots;
    booking.bookingStatus = "Pending";
    booking.assignedCleaner = null;
    await booking.save();

    return res.status(200).json({ message: "Rescheduled", booking });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ========== STRIPE CHECKOUT ==========
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: "Booking ID is required" });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const amount = Math.round(Number(booking.price) * 100);
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid booking price" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "pkr",
            product_data: { name: booking.serviceName || "Cleaning Service" },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        bookingId: String(booking._id),
        cleanerId: String(booking.assignedCleaner),
      },
      success_url: "http://localhost:5173/payment-success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: `http://localhost:5173/payment-cancel?bookingId=${booking._id}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.log("Stripe session error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ========== STRIPE WEBHOOK ==========
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      try {
        await Booking.findByIdAndUpdate(bookingId, { paymentStatus: "Paid" });
        const io = req.app.get("io");
        if (io) io.emit("bookingUpdated");
        console.log(`Payment confirmed for booking ${bookingId}`);
      } catch (err) {
        console.error("Webhook booking update error:", err);
      }
    }
  }
  res.json({ received: true });
});

// ========== VERIFY PAYMENT (User Booking) ==========
app.post("/verify-payment", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: "Session ID required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const bookingId = session.metadata?.bookingId;
    if (!bookingId) {
      return res.status(400).json({ message: "Booking ID not found in session" });
    }

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { paymentStatus: "Paid" },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const io = req.app.get("io");
    if (io) io.emit("bookingUpdated");

    return res.status(200).json({
      message: "Payment verified successfully",
      booking,
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ========== CLEANER DUE PAYMENT ==========
app.post("/create-cleaner-due-session", async (req, res) => {
  try {
    const { cleanerId } = req.body;
    if (!cleanerId) return res.status(400).json({ message: "Cleaner ID required" });

    const duePendingBookings = await Booking.find({
      assignedCleaner: cleanerId,
      paymentMethod: "Cash",
      bookingStatus: "Completed",
      adminEarningStatus: { $ne: "Paid" },
    });

    const totalDue = duePendingBookings.reduce((sum, b) => sum + (b.adminEarning || 0), 0);
    if (totalDue <= 0) return res.status(400).json({ message: "No due amount found" });

    const cleaner = await userModel.findById(cleanerId);
    const amount = Math.round(totalDue * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "pkr",
            product_data: { name: `Admin Commission Payment - ${cleaner?.username || "Cleaner"}` },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: { cleanerId: String(cleanerId), type: "cleaner_due" },
      success_url: "http://localhost:5173/cleaner-payment-success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:5173/cleaner-dashboard",
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.log("Cleaner due session error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ========== VERIFY CLEANER DUE PAYMENT ==========
app.post("/verify-cleaner-due-payment", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: "Session ID required" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const cleanerId = session.metadata?.cleanerId;
    if (!cleanerId) {
      return res.status(400).json({ message: "Cleaner ID not found in session" });
    }

    const duePendingBookings = await Booking.find({
      assignedCleaner: cleanerId,
      paymentMethod: "Cash",
      bookingStatus: "Completed",
      adminEarningStatus: { $ne: "Paid" },
    });

    if (duePendingBookings.length === 0) {
      return res.status(200).json({
        message: "Already processed or no pending bookings",
        bookingsUpdated: 0,
      });
    }

    await Booking.updateMany(
      {
        assignedCleaner: cleanerId,
        paymentMethod: "Cash",
        bookingStatus: "Completed",
        adminEarningStatus: { $ne: "Paid" },
      },
      { $set: { adminEarningStatus: "Paid" } }
    );

    const cleaner = await userModel.findById(cleanerId);
    const io = req.app.get("io");

    const adminUsers = await userModel.find({ role: "admin" });
    for (const admin of adminUsers) {
      const adminNotif = await createNotification({
        recipientId: admin._id,
        recipientRole: "admin",
        type: "admin_commission_paid",
        title: "Commission Received",
        message: `${cleaner?.username || "Cleaner"} has paid the admin commission for ${duePendingBookings.length} booking(s).`,
        bookingId: duePendingBookings[0]?._id,
      });
      if (io) {
        io.to(String(admin._id)).emit("new-notification", adminNotif);
      }
    }

    if (io) {
      io.to(String(cleanerId)).emit("adminCommissionPaid");
      io.emit("bookingUpdated");
    }

    console.log(`[DuePayment] Cleaner ${cleanerId} paid admin commission for ${duePendingBookings.length} bookings`);

    return res.status(200).json({
      message: "Payment verified and commission marked as paid",
      bookingsUpdated: duePendingBookings.length,
    });
  } catch (error) {
    console.error("Verify cleaner due payment error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ========== ADMIN MARK PAID ROUTES ==========
app.put("/admin/mark-admin-paid/:bookingId", async (req, res) => {
  try {
    await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { adminEarningStatus: "Paid" }
    );

    // ✅ Alag se populate karo
    const booking = await Booking.findById(req.params.bookingId)
      .populate("assignedCleaner", "username _id");

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const io = req.app.get("io");
    const cleanerName = booking.assignedCleaner?.username || "Cleaner";

    // ✅ Admin notification with cleaner name
    const adminUsers = await userModel.find({ role: "admin" });
    for (const admin of adminUsers) {
      const adminNotif = await createNotification({
        recipientId: admin._id,
        recipientRole: "admin",
        type: "admin_commission_received",
        title: "Commission Received",
        message: `${cleanerName} has paid the admin commission for a ${booking.serviceName} booking.`,
        bookingId: booking._id,
      });
      if (io) {
        io.to(String(admin._id)).emit("new-notification", adminNotif);
      }
    }

    if (io) {
      io.to(String(booking.assignedCleaner?._id)).emit("adminCommissionPaid", booking);
      io.emit("bookingUpdated");
    }

    res.json({ message: "Admin earning marked as paid", booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/admin/mark-cleaner-paid/:bookingId", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.cleanerEarningStatus === "Paid") {
      return res.status(400).json({ message: "Cleaner already paid" });
    }
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { cleanerEarningStatus: "Paid" },
      { new: true }
    );
    const io = req.app.get("io");
    if (io) {
      io.to(String(updatedBooking.assignedCleaner)).emit("cleanerPaymentPaid", updatedBooking);
      io.emit("bookingUpdated");
    }
    return res.status(200).json({ message: "Cleaner earning marked as paid", booking: updatedBooking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== SERVICES ==========
app.get("/", async (req, res) => {
  try {
    const services = await serviceModel.find();
    res.json({ services });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/services", async (req, res) => {
  try {
    const services = await serviceModel.find();
    res.json({ services });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ========== UPDATE CLEANER PROFILE ==========
app.put("/api/cleaner/:id", async (req, res) => {
  try {
    const { username, email, phone, address, cleanerType } = req.body;
    const cleanerId = req.params.id;

    const updatedCleaner = await userModel.findByIdAndUpdate(
      cleanerId,
      {
        username,
        email,
        phone,
        address,
        cleanerType,
      },
      { new: true }
    );

    if (!updatedCleaner) {
      return res.status(404).json({
        message: "Cleaner not found",
      });
    }

    res.json({
      message: "Cleaner profile updated successfully",
      updatedCleaner,
    });
  } catch (error) {
    console.error("Cleaner profile update error:", error);

    res.status(500).json({
      message: "Failed to update cleaner profile",
      error: error.message,
    });
  }
});
// ========== UPDATE CLEANER PROFILE IMAGE ==========
app.put(
  "/api/cleaner/:id/profile-image",
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const cleanerId = req.params.id;

      if (!req.file) {
        return res.status(400).json({
          message: "No profile image uploaded",
        });
      }

      const profileImage = req.file.path;

      const updatedCleaner = await userModel.findByIdAndUpdate(
        cleanerId,
        { profileImage },
        { new: true }
      );

      if (!updatedCleaner) {
        return res.status(404).json({
          message: "Cleaner not found",
        });
      }

      res.json({
        message: "Profile picture updated successfully",
        profileImage: updatedCleaner.profileImage,
      });
    } catch (error) {
      console.error("Profile image update error:", error);

      res.status(500).json({
        message: "Failed to update profile image",
        error: error.message,
      });
    }
  }
);
app.post("/Admin", async (req, res) => {
  try {
    const { Name, Icons, Price, Description, importantNote, pricingType } = req.body;
    const newService = await serviceModel.create({
      Name, Icons, Price, Description, importantNote, pricingType,
    });
    const io = req.app.get("io");
    if (io) io.emit("serviceUpdated", newService);
    res.status(201).json({ message: "Service added", service: newService });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/service/:id", async (req, res) => {
  try {
    const updatedService = await serviceModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedService) return res.status(404).json({ message: "Service not found" });
    const io = req.app.get("io");
    if (io) io.emit("serviceUpdated", updatedService);
    res.json({ message: "Service updated", service: updatedService });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/service/:id", async (req, res) => {
  try {
    const deletedService = await serviceModel.findByIdAndDelete(req.params.id);
    if (!deletedService) return res.status(404).json({ message: "Service not found" });
    const io = req.app.get("io");
    if (io) io.emit("serviceDeleted", req.params.id);
    res.json({ message: "Service deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== SERVICE QUESTIONS ==========
app.get("/api/service-questions/:serviceId", async (req, res) => {
  try {
    const questions = await ServiceQuestion.find({ serviceId: req.params.serviceId });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/service-questions", async (req, res) => {
  try {
    const { serviceId, question, type, options, isRequired } = req.body;
    const newQuestion = await ServiceQuestion.create({
      serviceId, question, type, options, isRequired,
    });
    res.status(201).json(newQuestion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/service-questions/:id", async (req, res) => {
  try {
    const updated = await ServiceQuestion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/service-questions/:id", async (req, res) => {
  try {
    await ServiceQuestion.findByIdAndDelete(req.params.id);
    res.json({ message: "Question deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== BOOKINGS ==========
app.post("/booking", async (req, res) => {
  try {
     await Booking.deleteMany({
      bookingStatus: { $in: ["Temporary", "Pending"] },
      paymentStatus: "Pending", // Sirf woh bookings delete karein jinki payment pending hai
      createdAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) } // 15 minutes ka time
    });

    const {
      userId, serviceName, name, area, frequency, address, hours,
      paymentMethod, price, date, formattedDate, timeRange, time,
      customDescription, answers,
    } = req.body;

    const bookingDate = date || formattedDate;
    const bookingTime = timeRange || time;

    const requestedSlots = generateBookingSlots(bookingDate, bookingTime, frequency);
    
    // ✅ 2. Extra spaces hatayein
    const normalizedCleanerType = normalizeCleanerType(serviceName).trim();

    // ✅ 3. Regex use karein taake Capital/Small letters ka masla khatam ho jaye
    const allCleaners = await userModel.find({
      role: "cleaner",
      cleanerType: { $regex: new RegExp(`^${normalizedCleanerType}$`, "i") }
    });

    if (allCleaners.length === 0) {
      return res.status(400).json({ message: "No cleaner available for this service" });
    }

    const activeBookings = await Booking.find({
      bookingStatus: { $nin: ["Cancelled", "Completed", "Unavailable"] },
      serviceName: serviceName,
    });

    let overlappingCount = 0;
    for (const existing of activeBookings) {
      if (bookingHasAnyOverlap(existing, requestedSlots)) {
        overlappingCount++;
      }
    }

    if (overlappingCount >= allCleaners.length) {
      return res.status(400).json({ message: "Cleaner not available for this time slot" });
    }

    const totalPrice = parseFloat(price) || 0;
    const adminEarning = Math.round(totalPrice * 0.2 * 100) / 100;
    const cleanerEarning = Math.round(totalPrice * 0.8 * 100) / 100;

    const newBooking = await Booking.create({
      userId, serviceName, name, area, frequency, address, hours,
      paymentMethod, price: totalPrice, adminEarning, cleanerEarning,
      date: bookingDate, formattedDate: bookingDate,
      timeRange: bookingTime, time: bookingTime,
      customDescription, answers, slots: requestedSlots,
      bookingStatus: "Temporary", paymentStatus: "Pending",
      adminEarningStatus: "Pending", cleanerEarningStatus: "Pending",
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("new-booking", newBooking);
      io.emit("bookingUpdated");
    }

    res.status(201).json({
      message: "Booking created. You have 5 minutes to cancel or reschedule.",
      booking: newBooking,
      actionWindowOpen: true,
    });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/booking", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("assignedCleaner", "username _id phone cleanerType")
      .populate("userId", "username email phone")
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/booking/:userId", async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.userId })
      .populate("assignedCleaner", "username _id phone cleanerType profileImage")
      .sort({ createdAt: -1 });
    const bookingsWithStatus = attachBookingWindowStatus(bookings);
    res.json({ bookings: bookingsWithStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/cleaner-jobs/:cleanerId", async (req, res) => {
  try {
    const bookings = await Booking.find({
      assignedCleaner: req.params.cleanerId,
    })
      .populate("userId", "username email phone")
      .sort({ createdAt: -1 });

    const jobsWithReviews = await Promise.all(
      bookings.map(async (booking) => {
        const review = await Review.findOne({
          bookingId: booking._id,
        });

        return {
          ...booking.toObject(),
          review,
        };
      })
    );

    res.json({ jobs: jobsWithReviews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CLEANERS LIST ==========
app.get("/cleaners", async (req, res) => {
  try {
    const cleaners = await userModel.find({ role: "cleaner" }).select(
      "username email phone cleanerType isOnline profileImage _id"
    );
    res.json({ cleaners });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;
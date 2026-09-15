const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientRole: {
      type: String,
      enum: ["admin", "cleaner", "user"],
      required: true,
    },
    type: {
      type: String,
      enum: [
        "new_booking",
        "job_assigned",
        "booking_assigned",
        "admin_commission_paid",
        "cleaner_payment_paid",
        "due_paid",
        "booking_updated",
        "general"
      ],
      default: "general",
      required: false,
    },
    title: String,
    message: String,
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
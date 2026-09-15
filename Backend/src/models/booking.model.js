const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    slots: [
      {
        date: {
          type: String, // YYYY-MM-DD format
          required: true,
        },
        startMinutes: {
          type: Number,
          required: true,
        },
        endMinutes: {
          type: Number,
          required: true,
        },
      },
    ],
    adminEarning: {
      type: Number,
      default: 0,
    },
    serviceName: {
      type: String,
      required: true,
    },
    area: {
      type: String,
      required: true,
    },
    frequency: {
      type: String,
      required: true,
    },
    hours: {
      type: Number,
      required: true,
    },
    quantity: Number,
    date: {
      type: String,
      required: true,
    },
    answers: { type: Object, default: {} },
    customDescription: { type: String, default: "" },
    formattedDate: {
      type: String,
    },
    time: {
      type: String,
      required: true,
    },
    timeRange: {
      type: String,
    },
    duration: {
      type: String,
    },
    name: String,
    address: String,
    price: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      default: "Cash on Service",
    },
    paymentStatus: {
      type: String,
      default: "Pending",
    },
    bookingStatus: {
      type: String,
      default: "Pending",
    },
    assignedCleaner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    cleanerEarning: {
      type: Number,
      default: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
    },
    adminEarningStatus: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },
    cleanerEarningStatus: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

// ✅ VIRTUAL FIELD YAHAN LAGAO - SCHEMA KE BAHAR
bookingSchema.virtual('review', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'bookingId',
  justOne: true
});

module.exports = mongoose.model("Booking", bookingSchema);
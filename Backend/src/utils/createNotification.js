const Notification = require("../models/notification.model");

const createNotification = async ({ recipientId, recipientRole, type, title, message, bookingId, io }) => {
  try {
    const notification = await Notification.create({
      recipientId,
      recipientRole,
      type,
      title,
      message,
      bookingId: bookingId || null,
    });

    // Real-time socket emit (agar io diya gaya ho)
    if (io) {
      io.to(String(recipientId)).emit("new-notification", notification);
      console.log("🔔 Notification emitted to:", recipientId);
    }

    return notification;
  } catch (err) {
    console.error("Failed to create notification:", err);
    // Error ko throw karo taake endpoint mein pata chal sake
    throw err;
  }
};

module.exports = createNotification;
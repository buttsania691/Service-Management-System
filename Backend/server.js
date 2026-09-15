require("dotenv").config();

const app = require("./src/app");
const Connectdb = require("./src/db/db");

const http = require("http");
const { Server } = require("socket.io");
const Booking = require("./src/models/booking.model");
const userModel = require("./src/models/user.model");
const createNotification = require("./src/utils/createNotification");
const { sendEmail } = require("./src/utils/sendEmail");

Connectdb();
const bcrypt = require("bcrypt");
bcrypt.hash("123456", 10).then(console.log);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT"],
  },
});

app.set("io", io);

// ========== SOCKET CONNECTION ==========
io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    socket.join(userId);
    console.log(`User ${userId} joined room ${userId}`);
  }

  socket.on("joinUserRoom", (userId) => {
    socket.join(String(userId));
    console.log("USER ROOM JOINED:", userId);
  });

  socket.on("joinCleanerRoom", (cleanerId) => {
    socket.join(String(cleanerId));
    console.log("CLEANER ROOM JOINED:", cleanerId);
  });

  socket.on("cleanerOnline", async ({ cleanerId }) => {
    try {
      await userModel.findByIdAndUpdate(cleanerId, { isOnline: true });
      io.emit("cleanerStatusChanged", { cleanerId, isOnline: true });
      io.emit("bookingUpdated");
      console.log(`[Socket] Cleaner ${cleanerId} ONLINE`);
      const cleaner = await userModel.findById(cleanerId);
      if (cleaner) {
        await checkAndAssignPendingForCleaner(cleaner);
      }
    } catch (err) {
      console.error("cleanerOnline error:", err);
    }
  });

  socket.on("cleanerOffline", async ({ cleanerId }) => {
    try {
      await userModel.findByIdAndUpdate(cleanerId, { isOnline: false });
      io.emit("cleanerStatusChanged", { cleanerId, isOnline: false });
      io.emit("bookingUpdated");
      console.log(`[Socket] Cleaner ${cleanerId} OFFLINE`);
    } catch (err) {
      console.error("cleanerOffline error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
  });
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
  if (isPM && hours !== 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
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

function bookingHasAnyOverlap(existingBooking, requestedSlots) {
  for (const existingSlot of existingBooking.slots || []) {
    for (const requestedSlot of requestedSlots) {
      if (slotsOverlap(existingSlot, requestedSlot)) return true;
    }
  }
  return false;
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

function calculateSlotLoad(bookings) {
  return bookings.reduce((sum, b) => {
    return sum + (b.slots?.length || 1);
  }, 0);
}

// ========== CHECK IF ALL CLEANERS BUSY ==========
async function checkIfAllCleanersBusy(allCleaners, bookingSlots, currentBookingId) {
  for (const cleaner of allCleaners) {
    const activeBookings = await Booking.find({
      assignedCleaner: cleaner._id,
      bookingStatus: { $nin: ["Cancelled", "Completed", "Unavailable"] },
      _id: { $ne: currentBookingId },
    });

    let hasConflict = false;
    for (const existingBooking of activeBookings) {
      if (!existingBooking.slots || existingBooking.slots.length === 0) {
        existingBooking.slots = generateBookingSlots(
          existingBooking.date,
          existingBooking.timeRange || existingBooking.time,
          existingBooking.frequency
        );
      }
      if (bookingHasAnyOverlap(existingBooking, bookingSlots)) {
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) return false;
  }
  return true;
}

// ========== UPDATE TEMPORARY BOOKINGS ==========
async function updateTemporaryBookings() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // ✅ Online + Paid bookings turant Pending ho jayein — 5 min wait nahi
    const onlinePaidBookings = await Booking.find({
      bookingStatus: "Temporary",
      paymentMethod: "Online",
      paymentStatus: "Paid",
    });

    if (onlinePaidBookings.length > 0) {
      await Booking.updateMany(
        {
          bookingStatus: "Temporary",
          paymentMethod: "Online",
          paymentStatus: "Paid",
        },
        { $set: { bookingStatus: "Pending" } }
      );
      onlinePaidBookings.forEach((booking) => {
        io.emit("bookingUpdated", { bookingId: booking._id, bookingStatus: "Pending" });
      });
      console.log(`[Online→Pending] ${onlinePaidBookings.length} online paid bookings instantly moved to Pending`);
      await autoAssignCleaners(); // turant cleaner assign karo
    }

    // Cash / unpaid bookings pehle ki tarah 5 min baad Pending hoti hain
    const expiredBookings = await Booking.find({
      bookingStatus: "Temporary",
      createdAt: { $lte: fiveMinutesAgo },
      $or: [{ paymentMethod: "Cash" }, { paymentStatus: { $ne: "Paid" } }],
    });

    if (expiredBookings.length === 0) return;

    await Booking.updateMany(
      {
        bookingStatus: "Temporary",
        createdAt: { $lte: fiveMinutesAgo },
        $or: [{ paymentMethod: "Cash" }, { paymentStatus: { $ne: "Paid" } }],
      },
      { $set: { bookingStatus: "Pending" } }
    );

    expiredBookings.forEach((booking) => {
      io.emit("bookingUpdated", {
        bookingId: booking._id,
        bookingStatus: "Pending",
      });
    });

    console.log(`[Temp→Pending] ${expiredBookings.length} bookings updated`);
  } catch (error) {
    console.error("Temporary booking update error:", error);
  }
}

// ========== AUTO ASSIGN CLEANERS ==========
async function autoAssignCleaners() {
  try {
    const pendingBookings = await Booking.find({
      bookingStatus: "Pending",
      assignedCleaner: null,
    });

    for (const booking of pendingBookings) {
      const normalizedCleanerType = normalizeCleanerType(booking.serviceName);

      const onlineCleaners = await userModel.find({
        role: "cleaner",
        cleanerType: normalizedCleanerType,
        isOnline: true,
      });

      const allCleaners = await userModel.find({
        role: "cleaner",
        cleanerType: normalizedCleanerType,
      });

      if (allCleaners.length === 0) {
        await Booking.findByIdAndUpdate(booking._id, {
          bookingStatus: "Unavailable",
        });
        io.to(String(booking.userId)).emit("bookingUpdated");
        console.log(`[AutoAssign] No cleaners registered for ${normalizedCleanerType}`);
        continue;
      }

      if (onlineCleaners.length === 0) {
        console.log(`[AutoAssign] No online cleaners for booking ${booking._id}, will retry`);
        continue;
      }

      let bookingSlots = booking.slots;
      if (!bookingSlots || bookingSlots.length === 0) {
        bookingSlots = generateBookingSlots(
          booking.date,
          booking.timeRange,
          booking.frequency
        );
      }

      const availableCleaners = [];

      for (const cleaner of onlineCleaners) {
        const activeBookings = await Booking.find({
          assignedCleaner: cleaner._id,
          bookingStatus: { $nin: ["Cancelled", "Completed", "Unavailable"] },
        });

        let hasConflict = false;
        for (const existingBooking of activeBookings) {
          if (!existingBooking.slots || existingBooking.slots.length === 0) {
            existingBooking.slots = generateBookingSlots(
              existingBooking.date,
              existingBooking.timeRange || existingBooking.time,
              existingBooking.frequency
            );
            console.log(`[SlotFix] Regenerated ${existingBooking.slots.length} slots for booking ${existingBooking._id}`);
          }

          if (bookingHasAnyOverlap(existingBooking, bookingSlots)) {
            hasConflict = true;
            console.log(`[Conflict] Cleaner ${cleaner.username} busy — booking ${existingBooking._id} (${existingBooking.frequency})`);
            break;
          }
        }

        if (!hasConflict) {
          const slotLoad = calculateSlotLoad(activeBookings);
          availableCleaners.push({
            cleaner,
            load: slotLoad,
          });
          console.log(`[LoadCheck] Cleaner ${cleaner.username}: ${activeBookings.length} bookings, ${slotLoad} total slots`);
        }
      }

      if (availableCleaners.length === 0) {
        const allBusy = await checkIfAllCleanersBusy(allCleaners, bookingSlots, booking._id);

        if (allBusy) {
          await Booking.findByIdAndUpdate(booking._id, {
            bookingStatus: "Unavailable",
          });
          io.to(String(booking.userId)).emit("bookingUpdated");
          console.log(`[AutoAssign] Booking ${booking._id} → Unavailable (all cleaners busy)`);
        } else {
          console.log(`[AutoAssign] Booking ${booking._id} waiting — online busy, offline free`);
        }
        continue;
      }

      availableCleaners.sort((a, b) => a.load - b.load);
      const minLoad = availableCleaners[0].load;
      const tiedCleaners = availableCleaners.filter((c) => c.load === minLoad);
      const randomIndex = Math.floor(Math.random() * tiedCleaners.length);
      const selectedCleaner = tiedCleaners[randomIndex].cleaner;

      const totalPrice = parseFloat(booking.price) || 0;
      const cleanerEarning = Math.round(totalPrice * 0.8 * 100) / 100;
      const adminEarning = Math.round(totalPrice * 0.2 * 100) / 100;

      await Booking.findByIdAndUpdate(booking._id, {
        assignedCleaner: selectedCleaner._id,
        bookingStatus: "Assigned",
        slots: bookingSlots,
        cleanerEarning,
        adminEarning,
        dueAmount: booking.paymentStatus === "Pending" ? adminEarning : 0,
      });

      const user = await userModel.findById(booking.userId);
      if (user && user.email) {
        await sendEmail({
          to: user.email,
          subject: "Cleaner Assigned for Your Booking",
          text: `Dear ${user.username},\n\nYour booking for ${booking.serviceName} has been assigned to ${selectedCleaner.username}.\n\nCleaner Contact: ${selectedCleaner.phone}\nDate: ${booking.formattedDate}\nTime: ${booking.timeRange}\n\nThank you for using our service.`,
        });
      }

      // ========== ADMIN NOTIFICATION ==========
      const adminUsers = await userModel.find({ role: "admin" });
      for (const admin of adminUsers) {
        const adminNotif = await createNotification({
          recipientId: admin._id,
          recipientRole: "admin",
          type: "booking_assigned",
          title: "New Booking Assigned",
          message: `${selectedCleaner.username} has been assigned a ${booking.serviceName} booking on ${booking.formattedDate} at ${booking.timeRange}.`,
          bookingId: booking._id,
        });
        io.to(String(admin._id)).emit("new-notification", adminNotif);
      }

      // ========== CLEANER NOTIFICATION ==========
      const cleanerNotif = await createNotification({
        recipientId: selectedCleaner._id,
        recipientRole: "cleaner",
        type: "job_assigned",
        title: "New Job Assigned",
        message: `You have been assigned a ${booking.serviceName} job on ${booking.formattedDate} at ${booking.timeRange}.`,
        bookingId: booking._id,
      });

      io.to(String(selectedCleaner._id)).emit("newJobAssigned", booking);
      io.to(String(selectedCleaner._id)).emit("new-notification", cleanerNotif);
      io.to(String(booking.userId)).emit("bookingUpdated");
      io.emit("bookingUpdated");

      console.log(`[AutoAssign] Booking ${booking._id} → Cleaner ${selectedCleaner.username} (slots: ${minLoad})`);
    }
  } catch (error) {
    console.error("[AutoAssign] Error:", error);
  }
}

// ========== CHECK PENDING FOR SPECIFIC CLEANER ==========
async function checkAndAssignPendingForCleaner(cleaner) {
  try {
    const pendingBookings = await Booking.find({
      bookingStatus: "Pending",
      assignedCleaner: null,
    });

    const requiredType = cleaner.cleanerType;
    let found = false;

    for (const booking of pendingBookings) {
      const bookingType = normalizeCleanerType(booking.serviceName);
      if (bookingType !== requiredType) continue;
      found = true;
      break;
    }

    if (found) {
      console.log(`[OnlineCheck] Cleaner ${cleaner.username} online — running autoAssign`);
      await autoAssignCleaners();
    } else {
      console.log(`[OnlineCheck] No pending bookings for type: ${requiredType}`);
    }
  } catch (err) {
    console.error("[checkAndAssignPendingForCleaner] Error:", err);
  }
}

// ========== INTERVAL: HAR 5 SECONDS ==========
setInterval(async () => {
  await updateTemporaryBookings();
  await autoAssignCleaners();
}, 5 * 1000);

// ========== SERVER START ==========
server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
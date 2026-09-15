import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import {
  Clock, RefreshCw, CheckCircle, Wrench, XCircle,
  Calendar, X, CreditCard, LogOut, Globe, Scroll,
  User, Menu, AlertCircle, Timer
} from "lucide-react";
import styles from "./UserDashboard.module.css";

const socket = io("http://localhost:3000");

export default function UserDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  // ========== STATE ==========
  const [services, setServices] = useState([]);
  const [userProfile, setUserProfile] = useState(() => JSON.parse(localStorage.getItem("user")) || {});
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    username: userProfile?.username || "",
    email: userProfile?.email || "",
    phone: userProfile?.phone || "",
    address: userProfile?.address || "",
  });
  const [profileMessage, setProfileMessage] = useState("");

  const [overviewBookings, setOverviewBookings] = useState([]);
  const [historyBookings, setHistoryBookings] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleForBooking, setRescheduleForBooking] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [rescheduleSuccessMsg, setRescheduleSuccessMsg] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState(false);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const FIVE_MIN_MS = 5 * 60 * 1000;

  // ========== UTILITIES ==========
  const getUserId = () => userProfile?._id || userProfile?.id;

  const validateStrongPassword = (password) => {
    if (password.length !== 8) return "Password must be exactly 8 characters long.";
    if (!/[A-Z]/.test(password)) return "Must contain at least one uppercase letter (A-Z).";
    if (!/[a-z]/.test(password)) return "Must contain at least one lowercase letter (a-z).";
    if (!/[0-9]/.test(password)) return "Must contain at least one digit (0-9).";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Must contain at least one special character.";
    return null;
  };

  const getRemainingSeconds = (booking) => {
    if (!booking.createdAt) return 0;
    if (["Cancelled", "Completed"].includes(booking.bookingStatus)) return 0;
    const createdAtTime = new Date(booking.createdAt).getTime();
    const deadline = createdAtTime + FIVE_MIN_MS;
    const remainingMs = deadline - Date.now();
    return remainingMs > 0 ? Math.floor(remainingMs / 1000) : 0;
  };

  const addRemainingSeconds = (bookings) =>
    bookings.map((b) => ({ ...b, remainingSeconds: getRemainingSeconds(b) }));

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const getHourlyDescription = (serviceDescription, hours) => {
    if (!serviceDescription || !hours) return "";
    const includeIndex = serviceDescription.toLowerCase().indexOf("include:");
    const mappingsText =
      includeIndex !== -1 ? serviceDescription.substring(0, includeIndex) : serviceDescription;
    const includeText =
      includeIndex !== -1 ? serviceDescription.substring(includeIndex).trim() : "";
    const pattern = new RegExp(`${hours}\\s*hours?\\s*:?\\s*(.*?)(?=\\d+\\s*hours|$)`, "i");
    const match = mappingsText.match(pattern);
    if (match && match[1]) {
      let mappedText = match[1].trim().replace(/,\s*$/, "");
      let result = `${hours} hour${hours != 1 ? "s" : ""}: ${mappedText}`;
      if (includeText) result += `. ${includeText}`;
      return result;
    }
    return serviceDescription.trim() === "" ? "" : serviceDescription;
  };

  const getBookingDescription = (booking) => {
    if (booking.customDescription?.trim()) return booking.customDescription;
    const service = services.find((s) => s.Name === booking.serviceName);
    if (!service?.Description) return "";
    return getHourlyDescription(service.Description, booking.hours);
  };
// Frontend (UserDashboard.jsx) mein yeh add karein
useEffect(() => {
  if (activeTab === "Profile") {
    const userId = getUserId();
    if (userId) {
      axios.get(`http://localhost:3000/api/users/${userId}`) // Aapke backend route ke mutabiq
        .then(res => {
          setUserProfile(res.data.user || res.data);
          localStorage.setItem("user", JSON.stringify(res.data.user || res.data));
        })
        .catch(err => console.error("Error fetching profile:", err));
    }
  }
}, [activeTab]);
  // ========== FETCH DATA ==========
  useEffect(() => {
    axios
      .get("http://localhost:3000/services")
      .then((res) => setServices(res.data.services))
      .catch((err) => console.error(err));
  }, []);

  const fetchBookings = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;
    try {
      const response = await axios.get(`http://localhost:3000/booking/${userId}`);
      const allBookings = response.data.bookings || [];

      const overview = addRemainingSeconds(
        allBookings.filter((b) => b.bookingStatus !== "Completed")
      );
      const history = allBookings.filter((b) => b.bookingStatus === "Completed");

      setOverviewBookings(overview);
      setHistoryBookings(history);
    } catch (err) {
      console.error("Fetch bookings error:", err);
    }
  }, [userProfile?._id, userProfile?.id]);

  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;
    fetchBookings();
    socket.emit("joinUserRoom", userId);
    socket.on("bookingUpdated", fetchBookings);
    return () => socket.off("bookingUpdated");
  }, [fetchBookings]);

  useEffect(() => {
    if (location.state?.refresh) {
      fetchBookings();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, fetchBookings, navigate]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setOverviewBookings((prev) =>
        prev.map((b) => ({ ...b, remainingSeconds: getRemainingSeconds(b) }))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ========== ACTIONS ==========
  const handleLogout = () => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const handleCancel = async (bookingId) => {
    try {
      await axios.put(`http://localhost:3000/bookings/${bookingId}/cancel`);
      setCancelSuccessMsg(true);
      setTimeout(() => setCancelSuccessMsg(false), 3000);
      await fetchBookings();
    } catch (err) {
      console.error("Cancel failed:", err);
      alert(err.response?.data?.message || "Could not cancel booking.");
    }
  };

  const handleRescheduleRedirect = async (booking) => {
    try {
      await axios.delete(`http://localhost:3000/bookings/${booking._id}`);
      navigate("/checkout", {
        state: {
          serviceName: booking.serviceName,
          servicePrice: booking.price / booking.hours,
          reschedule: true,
        },
      });
    } catch (err) {
      console.log(err);
      alert("Could not reschedule booking");
    }
  };

  const openRescheduleModal = (booking) => {
    setRescheduleForBooking(booking);
    setNewDate("");
    setNewTime("");
    setShowReschedule(true);
  };

  // ========== PROFILE MANAGEMENT ==========
  const handleEditProfile = () => setIsEditing(true);

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      username: userProfile.username || "",
      email: userProfile.email || "",
      phone: userProfile.phone || "",
      address: userProfile.address || "",
    });
    setProfileMessage("");
  };

  const handleSaveProfile = async () => {
    try {
      const userId = getUserId();
      await axios.put(`http://localhost:3000/api/users/${userId}`, editForm);
      const updatedUser = { ...userProfile, ...editForm };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUserProfile(updatedUser);
      setIsEditing(false);
      setProfileMessage("Profile updated successfully!");
      setTimeout(() => setProfileMessage(""), 3000);
    } catch (err) {
      console.error("Update profile error:", err);
      setProfileMessage(err.response?.data?.message || "Update failed");
    }
  };

  const handleInputChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // ========== PASSWORD CHANGE ==========
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New passwords do not match");
      return;
    }
    const validationError = validateStrongPassword(newPassword);
    if (validationError) {
      setPasswordMessage(validationError);
      return;
    }
    setPasswordLoading(true);
    setPasswordMessage("");
    try {
      const userId = getUserId();
      await axios.put(`http://localhost:3000/api/users/${userId}/change-password`, {
        currentPassword,
        newPassword,
      });
      setPasswordMessage("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage(err.response?.data?.message || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  // ========== BOOKING STATUS LABEL ==========
  const getStatusLabel = (booking) => {
    switch (booking.bookingStatus) {
      case "Temporary":
        return <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><Clock size={14} /> Confirming...</span>;
      case "Pending":
        return <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><RefreshCw size={14} /> Looking for cleaner...</span>;
      case "Assigned":
        return <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><CheckCircle size={14} /> Cleaner Assigned</span>;
      case "In Process":
        return <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><Wrench size={14} /> In Process</span>;
      case "Completed":
        return <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><CheckCircle size={14} /> Completed</span>;
      case "Unavailable":
        return <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><XCircle size={14} /> No cleaner available — please reschedule</span>;
      default:
        return booking.bookingStatus;
    }
  };

  // ========== RENDER BOOKING CARD ==========
  const renderBookingCard = (booking, showActions = false) => (
    <div className={styles.cleaningCard} key={booking._id}>
      <p className={styles.cleaningType}>
        {booking.serviceName} ({booking.frequency})
      </p>
      <p className={styles.cleaningDescription}>{getBookingDescription(booking)}</p>
      <p className={styles.cleaningDate}>{booking.formattedDate || booking.date}</p>
      <p className={styles.cleaningTime}>{booking.timeRange}</p>
      <p className={styles.cleaningTime}>
        Booking Status: <strong>{getStatusLabel(booking)}</strong>
      </p>
      <p className={styles.cleaningTime}>Payment Status: {booking.paymentStatus}</p>

      {booking.assignedCleaner && (
        <>
          <p className={styles.cleaningTime}>
            Assigned Cleaner: {booking.assignedCleaner.username}
          </p>
          <p className={styles.cleaningTime}>
            Cleaner Phone: {booking.assignedCleaner.phone || "Not provided"}
          </p>
        </>
      )}

      {/* Cancel/Reschedule — Temporary status mein 5 min window */}
      {showActions && booking.bookingStatus === "Temporary" && booking.remainingSeconds > 0 && (
        <div className={styles.actionButtons}>
          {booking.paymentMethod !== "Online" && (
            <div className={styles.cancelWrapper}>
              <button
                className={styles.rescheduleBtn}
                onClick={() => handleRescheduleRedirect(booking)}
              >
                <Calendar size={14} /> Reschedule
              </button>
              <span className={styles.cancelTimer}>
                (<Timer size={12} /> {formatTime(booking.remainingSeconds)} left)
              </span>
            </div>
          )}
          {booking.paymentMethod === "Cash" && (
            <div className={styles.cancelWrapper}>
              <button
                className={styles.cancelBtn}
                onClick={() => handleCancel(booking._id)}
              >
                <X size={14} /> Cancel Booking
              </button>
              <span className={styles.cancelTimer}>
                (<Timer size={12} /> {formatTime(booking.remainingSeconds)} left)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Window expired message */}
      {showActions &&
        booking.bookingStatus === "Temporary" &&
        booking.remainingSeconds === 0 && (
          <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
            <AlertCircle size={14} /> Cancel/Reschedule window expired
          </p>
        )}

      {/* Unavailable — suggest reschedule */}
      {booking.bookingStatus === "Unavailable" && (
        <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
          <XCircle size={14} /> No cleaner available for this slot. Please contact support to reschedule.
        </p>
      )}

      {/* Online payment — Pay Now button */}
      {showActions &&
        booking.paymentMethod === "Online" &&
        booking.paymentStatus !== "Paid" &&
        booking.bookingStatus !== "Temporary" && (
          <div className={styles.cancelWrapper}>
            <button
              className={styles.rescheduleBtn}
              onClick={async () => {
                try {
                  const res = await axios.post(
                    "http://localhost:3000/create-checkout-session",
                    { bookingId: booking._id }
                  );
                  window.location.href = res.data.url;
                } catch (err) {
                  alert(err.response?.data?.message || "Payment failed");
                }
              }}
            >
              <CreditCard size={14} /> Pay Now
            </button>
          </div>
        )}
    </div>
  );

  // ========== MAIN RENDER ==========
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.dashboardCard}>
        {/* Header */}
        <div className={styles.dashboardHeader}>
          <span className={styles.brandName}>EaseService</span>
          <span className={styles.userName}>
            Welcome, {userProfile.username || "User"}!
          </span>
          {!dropdownOpen && (
            <button
              className={styles.menuToggleBtn}
              onClick={() => setDropdownOpen(true)}
            >
              <Menu size={20} />
            </button>
          )}
        </div>

        {/* Nav Tabs */}
        <div className={styles.dashboardNav}>
          {["Overview", "History", "Profile"].map((tab) => (
            <button
              key={tab}
              className={`${styles.navTab} ${activeTab === tab ? styles.active : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className={styles.dashboardBody}>
          {/* ===== OVERVIEW ===== */}
          {activeTab === "Overview" && (
            <>
              <p className={styles.sectionLabel}>Current Bookings:</p>
              {cancelSuccessMsg && (
                <div className={styles.rescheduleSuccess}>
                  <CheckCircle size={15} style={{ marginRight: "6px" }} />
                  Booking cancelled successfully!
                </div>
              )}
              {rescheduleSuccessMsg && (
                <div className={styles.rescheduleSuccess}>
                  <CheckCircle size={15} style={{ marginRight: "6px" }} />
                  Booking rescheduled successfully!
                </div>
              )}
              {overviewBookings.length === 0 ? (
                <div className={styles.historyEmpty}>No active bookings right now.</div>
              ) : (
                <div className={styles.historyList}>
                  {overviewBookings.map((booking) => renderBookingCard(booking, true))}
                </div>
              )}
            </>
          )}

          {/* ===== HISTORY ===== */}
          {activeTab === "History" && (
            <>
              <p className={styles.sectionLabel}>Past Bookings:</p>
              {historyBookings.length === 0 ? (
                <div className={styles.historyEmpty}>No history yet.</div>
              ) : (
                <div className={styles.historyList}>
                  {historyBookings.map((booking) => renderBookingCard(booking, false))}
                </div>
              )}
            </>
          )}

          {/* ===== PROFILE ===== */}
          {activeTab === "Profile" && (
            <div className={styles.profileSection}>
              <h3 className={styles.profileTitle}>Your Profile</h3>
              {profileMessage && (
                <div className={styles.profileMessage}>{profileMessage}</div>
              )}
              {!isEditing ? (
                <div className={styles.profileDetails}>
                  <p><strong>Username:</strong> {userProfile.username}</p>
                  <p><strong>Email:</strong> {userProfile.email}</p>
                  <p><strong>Phone:</strong> {userProfile.phone || "Not provided"}</p>
                  <p><strong>Address:</strong> {userProfile.address || "Not provided"}</p>
                  <button className={styles.editProfileBtn} onClick={handleEditProfile}>
                    Edit Profile
                  </button>

                  {/* Password Change Section */}
                  <div className={styles.passwordChangeSection}>
                    <h4>Change Password</h4>
                    <p style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "12px" }}>
                      8 characters • uppercase • lowercase • digit • special character
                    </p>
                    <input
                      type="password"
                      placeholder="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={styles.passwordInput}
                    />
                    <input
                      type="password"
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={styles.passwordInput}
                    />
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={styles.passwordInput}
                    />
                    <button
                      className={styles.changePasswordBtn}
                      onClick={handleChangePassword}
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? "Updating..." : "Update Password"}
                    </button>
                    {passwordMessage && (
                      <div className={styles.passwordMessage}>{passwordMessage}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.profileEditForm}>
                  <label>Username:</label>
                  <input
                    type="text"
                    name="username"
                    value={editForm.username}
                    onChange={handleInputChange}
                  />
                  <label>Email:</label>
                  <input
                    type="email"
                    name="email"
                    value={editForm.email}
                    onChange={handleInputChange}
                  />
                  <label>Phone:</label>
                  <input
                    type="tel"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleInputChange}
                  />
                  <label>Address:</label>
                  <textarea
                    name="address"
                    value={editForm.address}
                    onChange={handleInputChange}
                  />
                  <div className={styles.profileEditButtons}>
                    <button className={styles.saveProfileBtn} onClick={handleSaveProfile}>
                      Save Changes
                    </button>
                    <button className={styles.cancelEditBtn} onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===== RESCHEDULE MODAL ===== */}
        {showReschedule && rescheduleForBooking && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalBox}>
              <h3 className={styles.modalTitle}>Reschedule Booking</h3>
              <label className={styles.modalLabel}>Select New Date</label>
              <input
                type="date"
                className={styles.modalInput}
                min={new Date().toISOString().split("T")[0]}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
              <label className={styles.modalLabel}>Select New Time</label>
              <input
                type="time"
                className={styles.modalInput}
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
              <div className={styles.modalActions}>
                <button
                  className={styles.modalConfirmBtn}
                  onClick={() => handleRescheduleRedirect(rescheduleForBooking)}
                >
                  Confirm
                </button>
                <button
                  className={styles.modalCancelBtn}
                  onClick={() => setShowReschedule(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== DROPDOWN MENU (mobile) ===== */}
        {dropdownOpen && (
          <div className={styles.dropdownOverlay}>
            <div className={styles.dropdownClose}>
              <button className={styles.closeBtn} onClick={() => setDropdownOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div
              className={styles.dropdownItem}
              onClick={() => { setActiveTab("Overview"); setDropdownOpen(false); }}
            >
              <Globe size={16} className={styles.dropdownIcon} /> Overview
            </div>
            <div
              className={styles.dropdownItem}
              onClick={() => { setActiveTab("History"); setDropdownOpen(false); }}
            >
              <Scroll size={16} className={styles.dropdownIcon} /> History
            </div>
            <div
              className={styles.dropdownItem}
              onClick={() => { setActiveTab("Profile"); setDropdownOpen(false); }}
            >
              <User size={16} className={styles.dropdownIcon} /> Profile
            </div>
            <div className={styles.dropdownItem} onClick={handleLogout}>
              <LogOut size={16} className={styles.dropdownIcon} /> Logout
            </div>
            <button
              className={styles.bookServiceBtn}
              onClick={() => navigate("/")}
            >
              Book Service
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

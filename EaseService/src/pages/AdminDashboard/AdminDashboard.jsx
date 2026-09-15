import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from "./AdminDashboard.module.css";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

const StarRating = ({ rating, setRating }) => {
  return (
    <div className={styles.starRating}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`${styles.star} ${star <= rating ? styles.filledStar : ""}`} onClick={() => setRating(star)}>★</span>
      ))}
    </div>
  );
};

const getRelativeTime = (timestamp, _tick) => {
  if (!timestamp) return "just now";
  const now = new Date();
  const then = new Date(timestamp);
  const diffSeconds = Math.floor((now - then) / 1000);
  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  const diffMins = Math.floor(diffSeconds / 60);
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return then.toLocaleDateString();
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const highlightBookingId = searchParams.get("bookingId");
  const hasHighlighted = useRef(false);
const [showCurrentPassword, setShowCurrentPassword] = useState(false);
const [showNewPassword, setShowNewPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [filterDate, setFilterDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [settlementFilter, setSettlementFilter] = useState("");
  const [cleanerSearch, setCleanerSearch] = useState("");
  const [bookings, setBookings] = useState([]);
  const [section, setSection] = useState("dashboard");
  const [services, setServices] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [approvedCleaners, setApprovedCleaners] = useState([]);
  const [serviceForm, setServiceForm] = useState({ Name: "", Icons: "", Price: "", Description: "", importantNote: "", pricingType: "hourly" });
  const [editId, setEditId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [periodType, setPeriodType] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [applications, setApplications] = useState([]);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [selectedServiceForQuestions, setSelectedServiceForQuestions] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState({ question: "", type: "text", options: [], isRequired: false });
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const [adminProfile, setAdminProfile] = useState(() => JSON.parse(localStorage.getItem("user")) || {});
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({
    username: adminProfile?.username || "",
    email: adminProfile?.email || "",
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [imageUploading, setImageUploading] = useState(false);



  // ========== SETTLEMENT FILTER LOGIC ==========
  // "pay_to_cleaner"    = Online booking completed, admin needs to pay cleaner
  // "receive_from_cleaner" = Cash booking completed, cleaner needs to pay admin commission
  const getSettlementType = (booking) => {
    if (!booking.assignedCleaner || booking.bookingStatus !== "Completed") return null;

    if (booking.paymentMethod === "Online" && booking.cleanerEarningStatus !== "Paid") {
      return "pay_to_cleaner"; // Admin ko cleaner ko pay karna hai
    }
    if (booking.paymentMethod === "Cash" && booking.adminEarningStatus !== "Paid") {
      return "receive_from_cleaner"; // Cleaner ne admin ko abhi pay nahi kiya
    }
    return "settled"; // Sab clear
  };

  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    let withoutDay = dateStr.replace(/^[A-Za-z]+,?\s*/, "");
    const match = withoutDay.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)(?:\s+(\d{4}))?/i);
    if (match) {
      let day = parseInt(match[1], 10);
      let monthName = match[2];
      let year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      const months = { january:"01",february:"02",march:"03",april:"04",may:"05",june:"06",july:"07",august:"08",september:"09",october:"10",november:"11",december:"12" };
      const month = months[monthName.toLowerCase()];
      if (month) return `${year}-${month}-${String(day).padStart(2, "0")}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    return null;
  };

  const getStartOfWeek = (year, weekNumber) => {
    const date = new Date(year, 0, 1);
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const firstMonday = new Date(date.setDate(date.getDate() - daysToMonday));
    const targetMonday = new Date(firstMonday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7));
    return targetMonday.toISOString().split("T")[0];
  };

  const getWeekOptions = () => {
    const year = new Date().getFullYear();
    const options = [];
    for (let w = 1; w <= 52; w++) {
      const start = getStartOfWeek(year, w);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      options.push({ value: `${year}-W${w}`, label: `Week ${w} (${start} to ${end.toISOString().split("T")[0]})` });
    }
    return options;
  };

  const monthOptions = ["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => ({ value: String(i+1).padStart(2,"0"), label: m }));

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 5; y <= currentYear + 2; y++) years.push({ value: String(y), label: String(y) });
    return years;
  };

  const getCustomPeriodStart = () => {
    if (periodType === "week" && selectedWeek) { const [year, weekNum] = selectedWeek.split("-W"); return getStartOfWeek(parseInt(year), parseInt(weekNum)); }
    else if (periodType === "month" && selectedMonth && selectedYear) return `${selectedYear}-${selectedMonth}-01`;
    else if (periodType === "year" && selectedYear) return `${selectedYear}-01-01`;
    return null;
  };

  const getCustomPeriodEnd = () => {
    if (periodType === "week" && selectedWeek) { const start = getCustomPeriodStart(); const end = new Date(start); end.setDate(end.getDate() + 6); return end.toISOString().split("T")[0]; }
    else if (periodType === "month" && selectedMonth && selectedYear) { const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate(); return `${selectedYear}-${selectedMonth}-${lastDay}`; }
    else if (periodType === "year" && selectedYear) return `${selectedYear}-12-31`;
    return null;
  };

  const completedPaidBookings = bookings.filter((b) => b.bookingStatus === "Completed" && b.paymentStatus === "Paid");
  const realisedAdminEarning = bookings.filter((b) => b.adminEarningStatus === "Paid").reduce((sum, b) => sum + (b.adminEarning || 0), 0);
  const pendingAdminCommission = bookings.filter((b) => b.paymentMethod === "Cash" && b.bookingStatus === "Completed" && b.adminEarningStatus !== "Paid").reduce((sum, b) => sum + (b.adminEarning || 0), 0);
  const periodAdminEarnings = bookings.filter((b) => {
    if (b.adminEarningStatus !== "Paid") return false;
    const dateYMD = normalizeDate(b.formattedDate || b.date);
    if (!dateYMD) return false;
    const start = getCustomPeriodStart(); const end = getCustomPeriodEnd();
    if (!start) return false;
    return dateYMD >= start && dateYMD <= end;
  }).reduce((sum, b) => sum + (b.adminEarning || 0), 0);

  const cleanersWithUnpaidCommission = [...new Set(
    bookings
      .filter((b) => b.paymentMethod === "Cash" && b.bookingStatus === "Completed" && b.adminEarningStatus !== "Paid" && b.assignedCleaner)
      .map((b) => b.assignedCleaner?._id || b.assignedCleaner)
  )].length;

  const jobsNotStarted = bookings.filter((b) => b.bookingStatus === "Assigned" || b.bookingStatus === "Pending").length;

  const chartData = [
    { name: "Bookings", value: bookings.length },
    { name: "Admin Earning", value: completedPaidBookings.reduce((t, b) => t + (b.price || 0) * 0.2, 0) },
    { name: "Pending", value: bookings.filter((b) => !b.assignedCleaner).length },
  ];

  const fetchBookings = useCallback(() => {
    axios.get("http://localhost:3000/booking").then((res) => setBookings(res.data.bookings)).catch(console.log);
  }, []);

  const fetchCleaners = useCallback(() => {
    axios.get("http://localhost:3000/cleaners").then((res) => {
      setCleaners(res.data.cleaners);
      setApprovedCleaners(res.data.cleaners);
    }).catch(console.log);
  }, []);

  const fetchReviews = useCallback(() => {
    axios.get("http://localhost:3000/api/reviews").then((res) => setReviews(res.data)).catch(console.log);
  }, []);

  const fetchUsers = useCallback(() => {
    axios.get("http://localhost:3000/users").then((res) => setUsers(res.data)).catch(console.log);
  }, []);

  const fetchApplications = useCallback(() => {
    axios.get("http://localhost:3000/api/admin/cleaner-applications").then((res) => setApplications(res.data)).catch(console.log);
  }, []);

  const fetchNotifications = useCallback(async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") return;
    const userId = user._id || user.id;
    try {
      const res = await axios.get(`http://localhost:3000/api/notifications?userId=${userId}&role=admin`);
      setNotifications(res.data);
      setNotificationCount(res.data.filter((n) => !n.read).length);
    } catch (err) { console.error("Failed to fetch notifications", err); }
  }, []);

  const clearAllNotifications = async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const userId = user._id || user.id;
    try {
      await axios.delete("http://localhost:3000/api/notifications/clear", { data: { userId, role: "admin" } });
      setNotifications([]); setNotificationCount(0);
    } catch (err) { console.error("Failed to clear", err); }
  };

  const fetchQuestions = useCallback(async (serviceId) => {
    if (!serviceId) return;
    try { const res = await axios.get(`http://localhost:3000/api/service-questions/${serviceId}`); setQuestions(res.data); }
    catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    const userId = user?._id || user?.id;
    const newSocket = io("http://localhost:3000", { query: { userId } });
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => { fetchBookings(); fetchNotifications(); };
    const handleNewNotification = (newNotification) => {
      setNotifications((prev) => {
        const alreadyExists = prev.some((n) => n._id === newNotification._id);
        if (alreadyExists) return prev;
        return [newNotification, ...prev];
      });
      setNotificationCount((prev) => prev + 1);
      new Audio("https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3").play().catch(console.log);
    };
    const handleCleanerStatusChanged = () => { fetchCleaners(); };
    socket.on("new-booking", handleRefresh);
    socket.on("bookingUpdated", handleRefresh);
    socket.on("newJobAssigned", handleRefresh);
    socket.on("serviceUpdated", () => axios.get("http://localhost:3000/").then((res) => setServices(res.data.services)));
    socket.on("serviceDeleted", () => axios.get("http://localhost:3000/").then((res) => setServices(res.data.services)));
    socket.on("reviewAdded", fetchReviews);
    socket.on("reviewDeleted", fetchReviews);
    socket.on("new-notification", handleNewNotification);
    socket.on("cleanerStatusChanged", handleCleanerStatusChanged);
    return () => {
      socket.off("new-booking"); socket.off("bookingUpdated"); socket.off("newJobAssigned");
      socket.off("serviceUpdated"); socket.off("serviceDeleted");
      socket.off("reviewAdded"); socket.off("reviewDeleted");
      socket.off("new-notification"); socket.off("cleanerStatusChanged", handleCleanerStatusChanged);
    };
  }, [socket, fetchBookings, fetchNotifications, fetchReviews, fetchCleaners]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") navigate("/login");
  }, [navigate]);

  useEffect(() => {
    axios.get("http://localhost:3000/").then((res) => setServices(res.data.services)).catch(console.log);
    fetchCleaners(); fetchApplications(); fetchBookings(); fetchReviews(); fetchUsers(); fetchNotifications();
  }, [fetchCleaners, fetchApplications, fetchBookings, fetchReviews, fetchUsers, fetchNotifications]);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 768) setIsMenuOpen(false); };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => { if (highlightBookingId) hasHighlighted.current = false; }, [highlightBookingId]);

  useEffect(() => {
    if (highlightBookingId && !hasHighlighted.current) {
      setSection("booking");
      const timer = setTimeout(() => {
        const row = document.getElementById(`booking-row-${highlightBookingId}`);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          row.style.backgroundColor = "#fef3c7";
          setTimeout(() => { row.style.backgroundColor = ""; }, 3000);
        }
        hasHighlighted.current = true;
        navigate("/admin", { replace: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlightBookingId, bookings, navigate]);
const openEditModal = (question) => {
  console.log("🔍 RAW QUESTION:", JSON.stringify(question, null, 2));
  console.log("📦 OPTIONS RAW:", question.options);
  console.log("📝 TYPE OF OPTIONS:", typeof question.options);
  console.log("🔢 IS ARRAY:", Array.isArray(question.options));

  let normalizedOptions = [];

  // Agar options exist karte hain
  if (question.options) {
    // Agar options array hai
    if (Array.isArray(question.options)) {
      normalizedOptions = question.options.map((opt) => {
        // Agar string hai
        if (typeof opt === "string") {
          const parts = opt.split(",");
          return { text: parts[0]?.trim() || "", price: parseInt(parts[1]) || 0 };
        }
        // Agar object hai
        if (typeof opt === "object" && opt !== null) {
          return {
            text: opt.text || opt.label || opt.option || "",
            price: opt.price || opt.cost || 0,
          };
        }
        return { text: "", price: 0 };
      });
    } else if (typeof question.options === "string") {
      // Agar options ek single string hai
      const lines = question.options.split("\n").filter((l) => l.trim());
      normalizedOptions = lines.map((line) => {
        const parts = line.split(",");
        return { text: parts[0]?.trim() || "", price: parseInt(parts[1]) || 0 };
      });
    }
  }

  const normalizedQuestion = {
    ...question,
    options: normalizedOptions,
    isRequired: question.isRequired || false,
    question: question.question || "",
    type: question.type || "text",
  };

  console.log("✅ NORMALIZED QUESTION:", JSON.stringify(normalizedQuestion, null, 2));
  console.log("📦 NORMALIZED OPTIONS:", normalizedQuestion.options);
  console.log("🔢 OPTIONS LENGTH:", normalizedQuestion.options.length);

  setEditingQuestion(normalizedQuestion);
  setEditModalOpen(true);
};
  const markAdminPaid = async (bookingId) => {
  try {
    await axios.put(`http://localhost:3000/admin/mark-admin-paid/${bookingId}`);

    setBookings((prev) =>
      prev.map((b) =>
        b._id === bookingId
          ? { ...b, adminEarningStatus: "Paid" }
          : b
      )
    );

    fetchBookings(); // backup sync
  } catch (err) {
    alert(err.response?.data?.message || "Failed to mark as received");
  }
};

 const markCleanerPaid = async (bookingId) => {
  try {
    await axios.put(`http://localhost:3000/admin/mark-cleaner-paid/${bookingId}`);

    setBookings((prev) =>
      prev.map((b) =>
        b._id === bookingId
          ? { ...b, cleanerEarningStatus: "Paid" }
          : b
      )
    );
    fetchBookings();
  } catch (err) {
    if (err.response?.status === 400) {
      fetchBookings();
    } else {
      alert(err.response?.data?.message || "Failed to mark cleaner as paid");
    }
  }
};

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!serviceForm.Name || !serviceForm.Icons || !serviceForm.Price) { alert("Fill all fields"); return; }
    if (editId) {
      axios.put(`http://localhost:3000/service/${editId}`, serviceForm)
        .then(() => axios.get("http://localhost:3000/"))
        .then((res) => { setServices(res.data.services); setEditId(null); })
        .catch(console.log);
    } else {
      axios.post("http://localhost:3000/Admin", serviceForm)
        .then(() => axios.get("http://localhost:3000/"))
        .then((res) => setServices(res.data.services))
        .catch(console.log);
    }
    setServiceForm({ Name: "", Icons: "", Price: "", Description: "", importantNote: "", pricingType: "hourly" });
  };

  const handleEdit = (service) => {
    setServiceForm({ Name: service.Name, Icons: service.Icons, Price: service.Price, Description: service.Description, importantNote: service.importantNote || "", pricingType: service.pricingType || "hourly" });
    setEditId(service._id);
  };

  const handleDelete = async (id) => {
    if (!id) { alert("Invalid service ID"); return; }
    if (window.confirm("Are you sure you want to delete this service?")) {
      try {
        await axios.delete(`http://localhost:3000/service/${id}`);
        setServices((prev) => prev.filter((s) => s._id !== id));
        alert("Service deleted successfully");
      } catch (err) { alert(err.response?.data?.message || "Failed to delete service"); }
    }
  };

  const approveApp = async (id) => {
    try {
      await axios.put(`http://localhost:3000/api/admin/cleaner-applications/${id}/approve`);
      fetchApplications(); fetchUsers(); fetchCleaners();
      alert("Cleaner approved");
    } catch (err) { alert(err.response?.data?.message || "Approval failed"); }
  };

  const rejectApp = async (id) => {
    try {
      await axios.put(`http://localhost:3000/api/admin/cleaner-applications/${id}/reject`);
      fetchApplications();
      alert("Application rejected");
    } catch (err) { alert(err.response?.data?.message || "Rejection failed"); }
  };

  const blockCleaner = async (applicationId) => {
    if (window.confirm("Block this cleaner? Their account will be removed.")) {
      try {
        await axios.put(`http://localhost:3000/api/admin/cleaner-applications/${applicationId}/block`);
        fetchApplications(); fetchCleaners();
        alert("Cleaner blocked successfully");
      } catch (err) { alert("Failed to block cleaner"); }
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (window.confirm("Delete this review?")) {
      try {
        await axios.delete(`http://localhost:3000/api/reviews/${reviewId}`);
        fetchReviews();
        alert("Deleted");
      } catch (err) { alert("Failed"); }
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      await axios.put(`http://localhost:3000/api/notifications/${notification._id}/read`);
      setNotifications((prev) => prev.map((n) => n._id === notification._id ? { ...n, read: true } : n));
      setNotificationCount((prev) => Math.max(0, prev - 1));
      navigate(`/admin?bookingId=${notification.bookingId}`);
      setShowNotifications(false);
    } catch (err) { console.error("Failed to mark as read", err); }
  };

  const openQuestionModal = (serviceId) => {
    setSelectedServiceForQuestions(serviceId);
    fetchQuestions(serviceId);
    setQuestionModalOpen(true);
  };

  const closeQuestionModal = () => {
    setQuestionModalOpen(false);
    setSelectedServiceForQuestions(null);
    setQuestions([]);
    setNewQuestion({ question: "", type: "text", options: [], isRequired: false });
    setEditingQuestion(null);
    setEditModalOpen(false);
  };

  const addQuestion = async () => {
    if (!newQuestion.question.trim()) { alert("Please enter a question"); return; }
    try {
      await axios.post("http://localhost:3000/api/service-questions", { serviceId: selectedServiceForQuestions, ...newQuestion });
      fetchQuestions(selectedServiceForQuestions);
      setNewQuestion({ question: "", type: "text", options: [], isRequired: false });
    } catch (err) { alert("Failed to add question"); }
  };

  const deleteQuestion = async (questionId) => {
    if (window.confirm("Delete this question?")) {
      try {
        await axios.delete(`http://localhost:3000/api/service-questions/${questionId}`);
        fetchQuestions(selectedServiceForQuestions);
      } catch (err) { alert("Failed to delete question"); }
    }
  };

const updateQuestion = async () => {
  console.log("🔄 UPDATE STARTED");
  console.log("📝 editingQuestion:", JSON.stringify(editingQuestion, null, 2));

  if (!editingQuestion) {
    alert("No question to update");
    return;
  }

  if (!editingQuestion.question.trim()) {
    alert("Please enter a question");
    return;
  }

  let optionsToSend = [];

  if (editingQuestion.type === "text") {
    optionsToSend = [];
  } else {
    // Ensure options are in correct format
    if (Array.isArray(editingQuestion.options)) {
      optionsToSend = editingQuestion.options
        .filter((opt) => opt.text && opt.text.trim())
        .map((opt) => ({
          text: opt.text.trim(),
          price: opt.price || 0,
        }));
    } else {
      optionsToSend = [];
    }
  }

  const payload = {
    question: editingQuestion.question.trim(),
    type: editingQuestion.type || "text",
    options: optionsToSend,
    isRequired: editingQuestion.isRequired || false,
  };

  console.log("📤 FINAL PAYLOAD:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.put(
      `http://localhost:3000/api/service-questions/${editingQuestion._id}`,
      payload
    );
    console.log("✅ UPDATE RESPONSE:", response.data);
    fetchQuestions(selectedServiceForQuestions);
    setEditModalOpen(false);
    setEditingQuestion(null);
    alert("Question updated successfully!");
  } catch (err) {
    console.error("❌ UPDATE ERROR:", err.response?.data || err.message);
    alert(err.response?.data?.message || "Failed to update question");
  }
};

const getAdminId = () => adminProfile?._id || adminProfile?.id;

const validateStrongPassword = (password) => {
    if (password.length !== 8) return "Password must be exactly 8 characters long.";
    if (!/[A-Z]/.test(password)) return "Must contain at least one uppercase letter (A-Z).";
    if (!/[a-z]/.test(password)) return "Must contain at least one lowercase letter (a-z).";
    if (!/[0-9]/.test(password)) return "Must contain at least one digit (0-9).";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Must contain at least one special character.";
    return null;
  };

  const handleSaveAdminProfile = async () => {
    try {
      const userId = getAdminId();
      await axios.put(`http://localhost:3000/api/users/${userId}`, profileEditForm);
      const updatedUser = { ...adminProfile, ...profileEditForm };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setAdminProfile(updatedUser);
      setIsEditingProfile(false);
      setProfileMessage("Profile updated successfully.");
      setTimeout(() => setProfileMessage(""), 3000);
    } catch (err) { setProfileMessage(err.response?.data?.message || "Update failed."); }
  };

  const handleCancelEditProfile = () => {
    setIsEditingProfile(false);
    setProfileEditForm({ username: adminProfile.username || "", email: adminProfile.email || "" });
    setProfileMessage("");
  };

  const handleChangeAdminPassword = async () => {
    if (newPassword !== confirmPassword) { setPasswordMessage("New passwords do not match."); return; }
    const validationError = validateStrongPassword(newPassword);
    if (validationError) { setPasswordMessage(validationError); return; }
    setPasswordLoading(true);
    setPasswordMessage("");
    try {
      const userId = getAdminId();
      await axios.put(`http://localhost:3000/api/users/${userId}/change-password`, { currentPassword, newPassword });
      setPasswordMessage("Password changed successfully.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) { setPasswordMessage(err.response?.data?.message || "Failed to change password."); }
    finally { setPasswordLoading(false); }
  };

  const handleProfileImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("profileImage", file);
    setImageUploading(true);
    try {
      const userId = getAdminId();
      const res = await axios.put(`http://localhost:3000/api/users/${userId}/profile-image`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      const updatedUser = { ...adminProfile, profileImage: res.data.profileImage };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setAdminProfile(updatedUser);
      setProfileMessage("Profile picture updated.");
      setTimeout(() => setProfileMessage(""), 3000);
    } catch (err) { setProfileMessage("Failed to upload image."); }
    finally { setImageUploading(false); }
  };

  const handleRemoveProfileImage = async () => {
    try {
      const userId = getAdminId();
      await axios.put(`http://localhost:3000/api/users/${userId}`, { username: adminProfile.username, email: adminProfile.email, profileImage: "" });
      const updatedUser = { ...adminProfile, profileImage: "" };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setAdminProfile(updatedUser);
      setProfileMessage("Profile picture removed.");
      setTimeout(() => setProfileMessage(""), 3000);
    } catch (err) { setProfileMessage("Failed to remove image."); }
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "fa-tachometer-alt" },
    { id: "services", label: "Manage Services", icon: "fa-cogs" },
    { id: "booking", label: "Manage Booking", icon: "fa-calendar-alt" },
    { id: "cleaners", label: "Cleaners List", icon: "fa-users" },
    { id: "reviews", label: "Reviews Management", icon: "fa-star" },
    { id: "applications", label: "Cleaner Applications", icon: "fa-file-alt" },
    { id: "profile", label: "My Profile", icon: "fa-user-circle" },
  ];

  const profileCardStyle = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", marginBottom: "24px" };
  const profileHeadingStyle = { borderLeft: "4px solid #0e7676", paddingLeft: "12px", marginBottom: "20px" };
  const profileInputStyle = { display: "block", width: "100%", boxSizing: "border-box", padding: "10px 14px", marginBottom: "12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px" };
  const primaryBtnStyle = { background: "#0e7676", color: "white", border: "none", borderRadius: "8px", padding: "10px 24px", cursor: "pointer", fontSize: "14px", fontWeight: "600" };
  const secondaryBtnStyle = { background: "transparent", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 24px", cursor: "pointer", fontSize: "14px" };
  const yellowBtnStyle = { background: "#ca8a04", color: "white", border: "none", borderRadius: "8px", padding: "10px 24px", cursor: "pointer", fontSize: "14px", fontWeight: "600" };
  const msgStyle = (msg) => ({
    padding: "10px 14px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px",
    background: msg.toLowerCase().includes("success") || msg.toLowerCase().includes("updated") || msg.toLowerCase().includes("removed") || msg.toLowerCase().includes("changed") ? "#d1fae5" : "#fee2e2",
    color: msg.toLowerCase().includes("success") || msg.toLowerCase().includes("updated") || msg.toLowerCase().includes("removed") || msg.toLowerCase().includes("changed") ? "#065f46" : "#991b1b",
  });

  // ========== FILTERED BOOKINGS ==========
  const filteredBookings = bookings
    .filter((b) => !filterDate || normalizeDate(b.formattedDate || b.date) === filterDate)
    .filter((b) => !statusFilter || b.bookingStatus === statusFilter)
    .filter((b) => {
      if (!settlementFilter) return true;
      return getSettlementType(b) === settlementFilter;
    });

  // Summary counts for settlement filter badges
  const payToCleanerCount = bookings.filter((b) => getSettlementType(b) === "pay_to_cleaner").length;
  const receiveFromCleanerCount = bookings.filter((b) => getSettlementType(b) === "receive_from_cleaner").length;

  return (
    <div className={styles.container}>
      <div className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ""}`}>
        <button className={styles.closeSidebar} onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }}>✕</button>
        <h2 className={styles.logo}>Dashboard</h2>
        <ul>
          {menuItems.map((item) => (
            <li key={item.id} onClick={() => setSection(item.id)} className={section === item.id ? styles.activeMenu : ""}>
              <i className={`fas ${item.icon}`} style={{ width: "24px", fontSize: "1.2rem" }}></i>{item.label}
            </li>
          ))}
        </ul>
        <button className={styles.logoutBtn} onClick={() => { localStorage.removeItem("user"); navigate("/login"); }}>Logout</button>
      </div>

      {isMenuOpen && <div className={styles.menuOverlay} onClick={() => setIsMenuOpen(false)} />}

      <div className={styles.main}>
        <div className={styles.welcomeHeader}>
          <div className={styles.headerLeft}>
            <button className={styles.hamburger} onClick={() => setIsMenuOpen(!isMenuOpen)}>☰</button>
            <div className={styles.adminIcon} style={{ overflow: "hidden", padding: 0 }}>
              {adminProfile.profileImage ? (
                <img src={`http://localhost:3000/${adminProfile.profileImage}`} alt="Admin" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              ) : (
                <i className="fas fa-user" style={{ fontSize: "18px" }}></i>
              )}
            </div>
            <h2>Welcome, {adminProfile.username || "Admin"}</h2>
          </div>
          <div className={styles.notificationBell} onClick={() => setShowNotifications(!showNotifications)}>
            <i className="fas fa-bell"></i>
            {notificationCount > 0 && <span className={styles.badge}>{notificationCount}</span>}
            {showNotifications && (
              <div className={styles.notificationBox}>
                <div className={styles.notificationHeader}>
                  <h3>Notifications</h3>
                  <div className={styles.notificationCount}>{notifications.length}</div>
                  <button className={styles.clearNotificationBtn} onClick={clearAllNotifications}>Clear</button>
                </div>
                <div className={styles.notificationList}>
                  {notifications.length === 0 ? (
                    <div className={styles.emptyNotification}>No notifications yet</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n._id} className={`${styles.notificationItem} ${!n.read ? styles.unread : ""}`} onClick={() => handleNotificationClick(n)}>
                        <div className={styles.notificationIcon}>
                          <i className="fas fa-broom" style={{ fontSize: "14px" }}></i>
                        </div>
                        <div className={styles.notificationContent}>
                          <p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: "600", color: "#111827" }}>{n.title}</p>
                          <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#4b5563", lineHeight: "1.5" }}>{n.message}</p>
                          <div className={styles.notificationTime}>{getRelativeTime(n.createdAt, tick)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== DASHBOARD ===== */}
        {section === "dashboard" && (
          <>
            <div className={styles.cards}>
              <div className={`${styles.card} ${styles.blue}`}>Total Bookings <span>{bookings.length}</span></div>
              <div className={`${styles.card} ${styles.green}`}>Total Earnings (Realised) <span>{realisedAdminEarning}</span></div>
              <div className={`${styles.card} ${styles.orange}`}>Pending Commission <span>{pendingAdminCommission}</span></div>
              <div className={`${styles.card} ${styles.purple}`}>Pending Request <span>{bookings.filter((b) => !b.assignedCleaner).length}</span></div>
              <div className={`${styles.card} ${styles.yellow}`}>Active Cleaners <span>{cleaners.filter((c) => c.isOnline).length}</span></div>
              <div className={`${styles.card} ${styles.orange}`}>
                Cleaners with Unpaid Commission <span>{cleanersWithUnpaidCommission}</span>
                <small style={{ fontSize: "11px", opacity: 0.85, display: "block", marginTop: "4px" }}>cleaners haven't paid admin yet</small>
              </div>
              <div className={`${styles.card} ${styles.purple}`}>
                Jobs Not Started Yet <span>{jobsNotStarted}</span>
                <small style={{ fontSize: "11px", opacity: 0.85, display: "block", marginTop: "4px" }}>assigned/pending — work not started</small>
              </div>
              <div className={`${styles.card} ${styles.teal}`}>
                <h3 style={{ margin: "0 0 10px 0" }}>Period Income (Admin)</h3>
                <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
                  <button onClick={() => setPeriodType("month")} style={{ background: periodType === "month" ? "white" : "rgba(255,255,255,0.2)", color: periodType === "month" ? "#0f766e" : "white", border: "none", borderRadius: "20px", padding: "4px 12px", cursor: "pointer" }}>Month</button>
                  <button onClick={() => setPeriodType("year")} style={{ background: periodType === "year" ? "white" : "rgba(255,255,255,0.2)", color: periodType === "year" ? "#0f766e" : "white", border: "none", borderRadius: "20px", padding: "4px 12px", cursor: "pointer" }}>Year</button>
                </div>
                {periodType === "month" && (<div style={{ display: "flex", gap: "8px" }}><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={styles.periodSelect}><option value="">Select Month</option>{monthOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select><select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={styles.periodSelect}><option value="">Select Year</option>{getYearOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>)}
                {periodType === "year" && (<select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={styles.periodSelect}><option value="">Select Year</option>{getYearOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>)}
                <div style={{ marginTop: "12px" }}><span>{periodAdminEarnings}</span></div>
              </div>
            </div>
            <div className={styles.chartBox}>
              <h3>Booking Statistics</h3>
              <div className={styles.chartContainer}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#fff", borderRadius: "12px", border: "none" }} />
                    <Bar dataKey="value" fill="#0e7676" radius={[12, 12, 0, 0]} barSize={70} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* ===== SERVICES ===== */}
        {section === "services" && (
          <>
            <h1>Manage Services</h1>
            <form className={styles.formBox} onSubmit={handleSubmit}>
              <input type="text" placeholder="Service Name" value={serviceForm.Name} onChange={(e) => setServiceForm({ ...serviceForm, Name: e.target.value })} />
              <input type="text" placeholder="Service Icons" value={serviceForm.Icons} onChange={(e) => setServiceForm({ ...serviceForm, Icons: e.target.value })} />
              <input type="text" placeholder="Price" value={serviceForm.Price} onChange={(e) => setServiceForm({ ...serviceForm, Price: e.target.value })} />
              <input type="text" placeholder="Description" value={serviceForm.Description} onChange={(e) => setServiceForm({ ...serviceForm, Description: e.target.value })} />
              <input type="text" placeholder="Important Note (optional)" value={serviceForm.importantNote} onChange={(e) => setServiceForm({ ...serviceForm, importantNote: e.target.value })} />
              <select value={serviceForm.pricingType} onChange={(e) => setServiceForm({ ...serviceForm, pricingType: e.target.value })} className={styles.formSelect}>
                <option value="hourly">Hourly (per hour)</option>
                <option value="quantity">Quantity (per item)</option>
              </select>
              <button type="submit">{editId ? "Update Service" : "Add Service"}</button>
            </form>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead><tr><th>ID</th><th>Name</th><th>Icons</th><th>Price</th><th>Description</th><th>Important Note</th><th>Pricing Type</th><th>Action</th></tr></thead>
                <tbody>
                  {services.map((s, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td><td>{s.Name}</td><td><i className={`fa-solid ${s.Icons}`}></i></td><td>{s.Price}</td><td>{s.Description}</td><td>{s.importantNote || "-"}</td><td>{s.pricingType === "hourly" ? "Hourly" : "Quantity"}</td>
                      <td>
                        <button className={styles.editBtn} onClick={() => handleEdit(s)}>Edit</button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(s._id)}>Delete</button>
                        <button className={styles.editBtn} onClick={() => openQuestionModal(s._id)}>Manage Qs</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===== BOOKINGS ===== */}
        {section === "booking" && (
          <>
            <h1>Manage Booking</h1>
            <div className={styles.filterBar} style={{ flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
              {/* Date Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label>Filter by Date:</label>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                {filterDate && <button onClick={() => setFilterDate("")} className={styles.clearBtn}>Clear</button>}
              </div>

              {/* Status Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label>Filter by Status:</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", cursor: "pointer", background: "white" }}>
                  <option value="">All Bookings</option>
                  <option value="Temporary">Temporary</option>
                  <option value="Pending">Pending</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Process">In Process</option>
                  <option value="Completed">Completed</option>
                </select>
                {statusFilter && <button onClick={() => setStatusFilter("")} className={styles.clearBtn}>Clear</button>}
              </div>

              {/* ===== SETTLEMENT FILTER ===== */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label>Filter by Settlement:</label>
                <select
                  value={settlementFilter}
                  onChange={(e) => setSettlementFilter(e.target.value)}
                  style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", cursor: "pointer", background: "white" }}
                >
                  <option value="">All</option>
                  {/* Admin ko cleaner ko pay karna hai (Online bookings) */}
                  <option value="pay_to_cleaner">Pay to Cleaner ({payToCleanerCount})</option>
                  {/* Cleaner ko admin ko pay karna hai (Cash bookings) */}
                  <option value="receive_from_cleaner">Receive from Cleaner ({receiveFromCleanerCount})</option>
                  {/* Sab settled */}
                  <option value="settled">Settled</option>
                </select>
                {settlementFilter && <button onClick={() => setSettlementFilter("")} className={styles.clearBtn}>Clear</button>}
              </div>

              <span style={{ fontSize: "13px", color: "#6b7280", marginLeft: "auto" }}>
                Showing <strong>{filteredBookings.length}</strong> of <strong>{bookings.length}</strong> bookings
              </span>
            </div>



            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Assigned Cleaner</th><th>Booking ID</th><th>Service Name</th><th>Name</th>
                    <th>Area</th><th>Frequency</th><th>Address</th><th>Hours</th>
                    <th>Payment Status</th><th>Payment Method</th><th>Total Payment</th>
                    <th>Booking Status</th><th>Date</th><th>Time</th><th>Settlement</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => (
                    <tr key={booking._id} id={`booking-row-${booking._id}`}>
                      <td>{booking.assignedCleaner ? `${booking.assignedCleaner.username} (${booking.assignedCleaner._id})` : <span style={{ color: "gray" }}>Not assigned</span>}</td>
                      <td>{booking._id}</td>
                      <td>{booking.serviceName}</td>
                      <td>{booking.name}</td>
                      <td>{booking.area}</td>
                      <td>{booking.frequency}</td>
                      <td>{booking.address}</td>
                      <td>{booking.hours} Hours</td>
                      <td className={booking.paymentStatus === "Paid" ? styles.paid : styles.pending}>{booking.paymentStatus || "Pending"}</td>
                      <td>{booking.paymentMethod || "—"}</td>
                      <td>{booking.price}</td>
                      <td className={
                        booking.bookingStatus === "Completed" ? styles.completed :
                        booking.bookingStatus === "In Process" ? styles.process :
                        booking.bookingStatus === "Assigned" ? styles.assigned :
                        booking.bookingStatus === "Temporary" ? styles.temporary :
                        booking.bookingStatus === "Unavailable" ? styles.unavailable :
                        styles.pending
                      }>{booking.bookingStatus || "Pending"}</td>
                      <td>{booking.formattedDate || booking.date}</td>
                      <td>{booking.timeRange || booking.time}</td>
                      <td>
                        {booking.assignedCleaner ? (
                          <>
                            {booking.paymentMethod === "Cash" && (
                              booking.bookingStatus === "Completed"
                                ? (booking.adminEarningStatus === "Paid"
                                  ? <span className={styles.paidStatus}>Received from cleaner</span>
                                  : <button onClick={() => markAdminPaid(booking._id)} className={styles.editBtn}>Mark Received</button>)
                                : <span className={styles.pendingStatus}>Job not completed yet</span>
                            )}
                            {booking.paymentMethod === "Online" && (
                              booking.bookingStatus === "Completed"
                                ? (booking.cleanerEarningStatus === "Paid"
                                  ? <span className={styles.paidStatus}>Paid to cleaner</span>
                                  : <button onClick={() => markCleanerPaid(booking._id)} className={styles.editBtn}>Pay Cleaner</button>)
                                : <span className={styles.pendingStatus}>Job not completed yet</span>
                            )}
                          </>
                        ) : <span className={styles.pendingStatus}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===== CLEANERS LIST ===== */}
        {section === "cleaners" && (
          <>
            <h1>Cleaners List</h1>
            <div className={styles.searchBar}>
              <label>Search Cleaner: </label>
              <input type="text" placeholder="By ID, Name, Phone or Cleaner Type" value={cleanerSearch} onChange={(e) => setCleanerSearch(e.target.value)} />
              {cleanerSearch && <button onClick={() => setCleanerSearch("")} className={styles.clearBtn}>Clear</button>}
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead><tr><th>Cleaner ID</th><th>Name</th><th>Phone</th><th>Cleaner Type</th><th>Status</th></tr></thead>
                <tbody>
                  {approvedCleaners.filter((cleaner) => {
                    if (!cleanerSearch) return true;
                    return (
                      cleaner._id?.toLowerCase().includes(cleanerSearch.toLowerCase()) ||
                      cleaner.username?.toLowerCase().includes(cleanerSearch.toLowerCase()) ||
                      cleaner.phone?.toLowerCase().includes(cleanerSearch.toLowerCase()) ||
                      cleaner.cleanerType?.toLowerCase().includes(cleanerSearch.toLowerCase())
                    );
                  }).map((cleaner) => (
                    <tr key={cleaner._id}>
                      <td>{cleaner._id}</td><td>{cleaner.username}</td><td>{cleaner.phone}</td><td>{cleaner.cleanerType}</td>
                      <td className={cleaner.isOnline ? styles.online : styles.offline}>{cleaner.isOnline ? "Online" : "Offline"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}



        {/* ===== REVIEWS ===== */}
        {section === "reviews" && (
          <>
            <h1>Reviews Management</h1>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead><tr><th>Booking ID</th><th>User ID</th><th>User Name</th><th>Cleaner ID</th><th>Cleaner (Type)</th><th>Rating</th><th>Comment</th><th>Date</th><th>Action</th></tr></thead>
                <tbody>
                  {reviews.map((rev) => (
                    <tr key={rev._id}>
                      <td>{rev.bookingId?._id || "—"}</td><td>{rev.userId?._id || "—"}</td>
                      <td>{rev.userId?.username || "—"}</td><td>{rev.cleanerId?._id || "—"}</td>
                      <td>{rev.cleanerId?.username} ({rev.cleanerId?.cleanerType})</td>
                      <td>{"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}</td>
                      <td>{rev.comment}</td><td>{new Date(rev.createdAt).toLocaleDateString()}</td>
                      <td><button className={styles.deleteBtn} onClick={() => handleDeleteReview(rev._id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===== APPLICATIONS ===== */}
        {section === "applications" && (
          <>
            <h1>Cleaner Applications</h1>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead><tr><th>Profile</th><th>Username</th><th>Email</th><th>Phone</th><th>Cleaner Type</th><th>CNIC Number</th><th>CNIC Front</th><th>CNIC Back</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app._id}>
                      <td>
                        {app.profileImage
                          ? <img src={`http://localhost:3000/${app.profileImage}`} alt={app.username} className={styles.profileThumb} />
                          : <div className={styles.profilePlaceholder}><i className="fas fa-broom"></i></div>}
                      </td>
                      <td>{app.username}</td><td>{app.email}</td><td>{app.phone}</td>
                      <td>{app.cleanerType}</td><td>{app.cnicNumber || "—"}</td>
                      <td><a href={`http://localhost:3000/${app.cnicFrontImage}`} target="_blank" className={styles.viewBtn}>View</a></td>
                      <td><a href={`http://localhost:3000/${app.cnicBackImage}`} target="_blank" className={styles.viewBtn}>View</a></td>
                      <td>{app.status}</td>
                      <td>
                        {app.status === "pending" && (<><button className={styles.editBtn} onClick={() => approveApp(app._id)}>Approve</button><button className={styles.deleteBtn} onClick={() => rejectApp(app._id)}>Reject</button></>)}
                        {app.status === "approved" && (<button className={styles.deleteBtn} onClick={() => blockCleaner(app._id)}>Block</button>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===== MY PROFILE ===== */}
       {section === "profile" && (
  <div style={{ maxWidth: "600px", padding: "20px" }}>
    <h1>My Profile</h1>
    {profileMessage && <div style={msgStyle(profileMessage)}>{profileMessage}</div>}
    {!isEditingProfile ? (
      <>
        {/* Profile Picture */}
        <div style={profileCardStyle}>
          <div style={profileHeadingStyle}><h3 style={{ margin: 0, fontSize: "18px" }}>Profile Picture</h3></div>
          <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ width: "90px", height: "90px", borderRadius: "50%", overflow: "hidden", border: "3px solid #0e7676", display: "flex", alignItems: "center", justifyContent: "center", background: "#e2e8f0", flexShrink: 0 }}>
              {adminProfile.profileImage
                ? <img src={`http://localhost:3000/${adminProfile.profileImage}`} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <i className="fas fa-user" style={{ fontSize: "32px", color: "#94a3b8" }}></i>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input type="file" accept="image/*" id="adminProfileImageInput" style={{ display: "none" }} onChange={handleProfileImageUpload} />
              <button onClick={() => document.getElementById("adminProfileImageInput").click()} style={{ ...primaryBtnStyle, display: "flex", alignItems: "center", gap: "8px", opacity: imageUploading ? 0.7 : 1 }} disabled={imageUploading}>
                <i className="fas fa-camera"></i>{imageUploading ? "Uploading..." : "Upload Photo"}
              </button>
              {adminProfile.profileImage && (
                <button onClick={handleRemoveProfileImage} style={{ ...secondaryBtnStyle, color: "#ef4444", borderColor: "#ef4444", display: "flex", alignItems: "center", gap: "8px" }}>
                  <i className="fas fa-trash"></i>Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Your Profile */}
        <div style={profileCardStyle}>
          <div style={profileHeadingStyle}><h3 style={{ margin: 0, fontSize: "18px" }}>Your Profile</h3></div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px" }}>
            <tbody>
              {[{ label: "Username", value: adminProfile.username }, { label: "Email", value: adminProfile.email }].map(({ label, value }) => (
                <tr key={label} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 0", fontWeight: "600", width: "130px", color: "#374151" }}>{label}:</td>
                  <td style={{ padding: "10px 0", color: "#6b7280" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setIsEditingProfile(true)} style={{ ...primaryBtnStyle, marginTop: "20px" }}>Edit Profile</button>
        </div>

        {/* ===== CHANGE PASSWORD WITH SHOW/HIDE ICONS ===== */}
        <div style={profileCardStyle}>
          <div style={profileHeadingStyle}><h3 style={{ margin: 0, fontSize: "18px" }}>Change Password</h3></div>
          <p style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "16px" }}>8 characters • uppercase • lowercase • digit • special character</p>

          {/* Current Password */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input
              type={showCurrentPassword ? "text" : "password"}
              placeholder="Current Password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={profileInputStyle}
            />
            <span
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              <i className={`fas ${showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </span>
          </div>

          {/* New Password */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={profileInputStyle}
            />
            <span
              onClick={() => setShowNewPassword(!showNewPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              <i className={`fas ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </span>
          </div>

          {/* Confirm New Password */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={profileInputStyle}
            />
            <span
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </span>
          </div>

          {passwordMessage && <div style={msgStyle(passwordMessage)}>{passwordMessage}</div>}
          <button onClick={handleChangeAdminPassword} disabled={passwordLoading} style={{ ...yellowBtnStyle, opacity: passwordLoading ? 0.7 : 1, cursor: passwordLoading ? "not-allowed" : "pointer" }}>
            {passwordLoading ? "Updating..." : "Update Password"}
          </button>
        </div>
      </>
    ) : (
      <div style={profileCardStyle}>
        <div style={profileHeadingStyle}><h3 style={{ margin: 0, fontSize: "18px" }}>Edit Profile</h3></div>
        {[{ label: "Username", name: "username", type: "text" }, { label: "Email", name: "email", type: "email" }].map(({ label, name, type }) => (
          <div key={name} style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>{label}</label>
            <input type={type} value={profileEditForm[name]} onChange={(e) => setProfileEditForm({ ...profileEditForm, [name]: e.target.value })} style={profileInputStyle} />
          </div>
        ))}
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button onClick={handleSaveAdminProfile} style={primaryBtnStyle}>Save Changes</button>
          <button onClick={handleCancelEditProfile} style={secondaryBtnStyle}>Cancel</button>
        </div>
      </div>
    )}
  </div>
)}
      </div>
     {/* ===== QUESTION MODAL ===== */}
{questionModalOpen && (
  <div className={styles.modalOverlay} onClick={closeQuestionModal}>
    {/* ✅ STOP PROPAGATION — ANDAR CLICK KARNE PAR BAND NA HO */}
    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
      <div className={styles.modalHeader}>
        <h2>Manage Questions: {services.find((s) => s._id === selectedServiceForQuestions)?.Name}</h2>
        <button onClick={closeQuestionModal} className={styles.modalClose}>&times;</button>
      </div>

      <div className={styles.addQuestionForm}>
        <h4>Add New Question</h4>
        <input
          type="text"
          placeholder="Question text"
          className={styles.inputField}
          value={newQuestion.question}
          onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
        />
        <select
          className={styles.selectField}
          value={newQuestion.type}
          onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value })}
        >
          <option value="text">Text (free answer)</option>
          <option value="select">Select (single choice)</option>
          <option value="multi">Multi-select (multiple choices)</option>
        </select>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={newQuestion.isRequired}
            onChange={(e) => setNewQuestion({ ...newQuestion, isRequired: e.target.checked })}
          />
          Required question
        </label>
        {newQuestion.type !== "text" && (
          <div>
            <p className={styles.optionsLabel}>Options (one per line, format: text,price)</p>
            <textarea
              className={styles.textareaField}
              placeholder="Kitchen,500&#10;Window cleaning,300&#10;Bathroom,400"
              rows="4"
              onChange={(e) => {
                const lines = e.target.value.split("\n").filter((l) => l.trim());
                const opts = lines.map((line) => {
                  const [text, price] = line.split(",");
                  return { text: text.trim(), price: parseInt(price) || 0 };
                });
                setNewQuestion({ ...newQuestion, options: opts });
              }}
            />
          </div>
        )}
        <button className={styles.addQuestionBtn} onClick={addQuestion}>
          Add Question
        </button>
      </div>

      <div className={styles.existingQuestions}>
        <h4>Existing Questions</h4>
        {questions.length === 0 && <p className={styles.emptyText}>No questions added yet.</p>}
        {questions.map((q) => (
          <div key={q._id} className={styles.questionItem}>
            <div className={styles.questionInfo}>
              <strong>{q.question}</strong>
              <span className={styles.questionType}>({q.type})</span>
              {q.isRequired && <span className={styles.requiredBadge}>*</span>}
              {q.type !== "text" && (
                <div className={styles.optionsList}>
                  Options: {q.options.map((opt) => `${opt.text} (+${opt.price})`).join(", ")}
                </div>
              )}
            </div>
            <div className={styles.questionActions}>
              <button className={styles.editQuestionBtn} onClick={() => openEditModal(q)}>
                Edit
              </button>
              <button className={styles.deleteQuestionBtn} onClick={() => deleteQuestion(q._id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

   {/* ===== EDIT QUESTION MODAL ===== */}
{editModalOpen && editingQuestion && (
  <div className={styles.modalOverlay} onClick={() => setEditModalOpen(false)}>
    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
      <h3>Edit Question</h3>

      {/* Question Text Input */}
      <input
        type="text"
        placeholder="Question text"
        className={styles.inputField}
        value={editingQuestion.question || ""}
        onChange={(e) =>
          setEditingQuestion({
            ...editingQuestion,
            question: e.target.value,
          })
        }
      />

      {/* Question Type Select */}
      <select
        className={styles.selectField}
        value={editingQuestion.type || "text"}
        onChange={(e) => {
          const newType = e.target.value;
          setEditingQuestion({
            ...editingQuestion,
            type: newType,
            options: newType === "text" ? [] : editingQuestion.options || [],
          });
        }}
      >
        <option value="text">Text</option>
        <option value="select">Select</option>
        <option value="multi">Multi-select</option>
      </select>

      {/* Required Checkbox */}
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={editingQuestion.isRequired || false}
          onChange={(e) =>
            setEditingQuestion({
              ...editingQuestion,
              isRequired: e.target.checked,
            })
          }
        />
        Required
      </label>

      {/* Options Textarea */}
      {editingQuestion.type !== "text" && (
        <div>
          <p className={styles.optionsLabel}>
            Options (one per line, format: text,price)
          </p>
          <textarea
            className={styles.textareaField}
            rows="4"
            value={
              editingQuestion.options && editingQuestion.options.length > 0
                ? editingQuestion.options
                    .map((opt) => {
                      if (typeof opt === "string") return opt;
                      return `${opt.text || ""},${opt.price || 0}`;
                    })
                    .join("\n")
                : ""
            }
            onChange={(e) => {
              const rawValue = e.target.value;
              const lines = rawValue.split("\n").filter((l) => l.trim());
              const newOptions = lines.map((line) => {
                const commaIndex = line.lastIndexOf(",");
                if (commaIndex === -1) {
                  return { text: line.trim(), price: 0 };
                }
                const text = line.substring(0, commaIndex).trim();
                const price = parseInt(line.substring(commaIndex + 1).trim()) || 0;
                return { text, price };
              });
              setEditingQuestion({
                ...editingQuestion,
                options: newOptions,
              });
            }}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.modalActions}>
        <button onClick={() => setEditModalOpen(false)}>Cancel</button>
        <button onClick={updateQuestion}>Update</button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default AdminDashboard;

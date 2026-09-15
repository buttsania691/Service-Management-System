import styles from "./CleanerDashboard.module.css";
import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

// ========== RELATIVE TIME ==========
const getRelativeTime = (timestamp) => {
  if (!timestamp) return "just now";
  const now = new Date();
  const then = new Date(timestamp);
  const diffSeconds = Math.floor((now - then) / 1000);
  if (diffSeconds < 0) return "just now";
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

const CleanerDashboard = () => {
  const navigate = useNavigate();
  const [pendingHighlightId, setPendingHighlightId] = useState(null);
  const [searchParams] = useSearchParams();
  const highlightJobId = searchParams.get("jobId");
  const hasHighlighted = useRef(false);
  const [jobs, setJobs] = useState([]);
  const [payingDue, setPayingDue] = useState(false);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("today");
  const [periodType, setPeriodType] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const hasFetched = useRef(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpAction, setOtpAction] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [currentBookingId, setCurrentBookingId] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [cleanerRating, setCleanerRating] = useState(null);

  // ========== NOTIFICATIONS ==========
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const getTodayDate = () => new Date().toISOString().split("T")[0];

  const getHourlyDescription = (serviceDescription, hours) => {
    if (!serviceDescription || !hours) return "";
    const includeIndex = serviceDescription.toLowerCase().indexOf("include:");
    const mappingsText =
      includeIndex !== -1
        ? serviceDescription.substring(0, includeIndex)
        : serviceDescription;
    const includeText =
      includeIndex !== -1 ? serviceDescription.substring(includeIndex).trim() : "";
    const pattern = new RegExp(
      `${hours}\\s*hours?\\s*:?\\s*(.*?)(?=\\d+\\s*hours|$)`,
      "i"
    );
    const match = mappingsText.match(pattern);
    if (match && match[1]) {
      let mappedText = match[1].trim().replace(/,\s*$/, "");
      let result = `${hours} hour${hours != 1 ? "s" : ""}: ${mappedText}`;
      if (includeText) result += `. ${includeText}`;
      return result;
    }
    return serviceDescription.trim() === "" ? "" : serviceDescription;
  };

  const getJobDescription = (job) => {
    if (job.customDescription && job.customDescription.trim() !== "") {
      return job.customDescription;
    }
    if (job.answers && typeof job.answers === "object" && Object.keys(job.answers).length > 0) {
      const answersList = [];
      for (const [, answer] of Object.entries(job.answers)) {
        if (Array.isArray(answer)) {
          answersList.push(answer.join(", "));
        } else if (answer) {
          answersList.push(answer);
        }
      }
      if (answersList.length) {
        return `Answers: ${answersList.join("; ")}`;
      }
    }
    const service = services.find((s) => s.Name === job.serviceName);
    if (!service || !service.Description) return "";
    return getHourlyDescription(service.Description, job.hours);
  };

  const parseDateToYMD = (dateStr) => {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    let withoutDay = dateStr.replace(/^[A-Za-z]+,?\s*/, "");
    const match = withoutDay.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)(?:\s+(\d{4}))?/i);
    if (match) {
      let day = parseInt(match[1], 10);
      let monthName = match[2];
      let year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      const months = {
        january: "01", february: "02", march: "03", april: "04",
        may: "05", june: "06", july: "07", august: "08",
        september: "09", october: "10", november: "11", december: "12",
      };
      const month = months[monthName.toLowerCase()];
      if (month) return `${year}-${month}-${String(day).padStart(2, "0")}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    }
    return null;
  };

  const isToday = (job) => {
    const today = getTodayDate();
    return (
      job.date === today ||
      parseDateToYMD(job.date) === today ||
      parseDateToYMD(job.formattedDate) === today
    );
  };

  const getStartOfWeek = (year, weekNumber) => {
    const date = new Date(year, 0, 1);
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const firstMonday = new Date(date.setDate(date.getDate() - daysToMonday));
    const targetMonday = new Date(
      firstMonday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
    );
    return targetMonday.toISOString().split("T")[0];
  };

  const getWeekOptions = () => {
    const year = new Date().getFullYear();
    const options = [];
    for (let w = 1; w <= 52; w++) {
      const start = getStartOfWeek(year, w);
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + 6);
      const end = endDate.toISOString().split("T")[0];
      options.push({ value: `${year}-W${w}`, label: `Week ${w} (${start} to ${end})` });
    }
    return options;
  };

  const monthOptions = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ].map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m }));

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 5; y <= currentYear + 2; y++) {
      years.push({ value: String(y), label: String(y) });
    }
    return years;
  };

  const todayJobs = jobs.filter(
    (job) => job.bookingStatus !== "Completed" && isToday(job)
  );
  const pendingJobs = jobs.filter(
    (job) => job.bookingStatus !== "Completed" && !isToday(job)
  );
  const completedJobs = jobs.filter((job) => job.bookingStatus === "Completed");

  const realisedCleanerEarning = jobs
    .filter((job) => job.cleanerEarningStatus === "Paid")
    .reduce((sum, job) => sum + (job.cleanerEarning || 0), 0);

  // u2705 Sirf Cash bookings ka due — Online mein commission platform pe already kat jaati hai
  const dueToAdmin = jobs
    .filter(
      (job) =>
        job.paymentMethod === "Cash" &&
        job.bookingStatus === "Completed" &&
        job.adminEarningStatus !== "Paid"
    )
    .reduce((sum, job) => sum + (job.adminEarning || 0), 0);
const refreshDashboard = () => {
  fetchJobs();
  fetchNotifications();
  fetchCleanerRating();
};
socket.on("bookingUpdated", refreshDashboard);
socket.on("cleanerPaymentPaid", refreshDashboard);
socket.on("bookingAssigned", refreshDashboard);
socket.on("newJobAssigned", refreshDashboard);
useEffect(() => {
  socket.on("reviewAdded", refreshDashboard);

  return () => {
    socket.off("reviewAdded", refreshDashboard);
  };
}, []);
const getCustomPeriodStart = () => {
    if (periodType === "week" && selectedWeek) {
      const [year, weekNum] = selectedWeek.split("-W");
      return getStartOfWeek(parseInt(year), parseInt(weekNum));
    } else if (periodType === "month" && selectedMonth && selectedYear) {
      return `${selectedYear}-${selectedMonth}-01`;
    } else if (periodType === "year" && selectedYear) {
      return `${selectedYear}-01-01`;
    }
    return null;
};
const getCustomPeriodEnd = () => {
    if (periodType === "week" && selectedWeek) {
      const start = getCustomPeriodStart();
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return end.toISOString().split("T")[0];
    } else if (periodType === "month" && selectedMonth && selectedYear) {
      const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
      return `${selectedYear}-${selectedMonth}-${lastDay}`;
    } else if (periodType === "year" && selectedYear) {
      return `${selectedYear}-12-31`;
    }
    return null;
};

const periodEarnings = jobs
.filter((job) => {
      if (job.cleanerEarningStatus !== "Paid") return false;
      const jobDateYMD = parseDateToYMD(job.formattedDate || job.date);
      if (!jobDateYMD) return false;
      const start = getCustomPeriodStart();
      const end = getCustomPeriodEnd();
      if (!start) return false;
      return jobDateYMD >= start && jobDateYMD <= end;
})
.reduce((sum, job) => sum + (job.cleanerEarning || 0), 0);

  // ========== FETCH FUNCTIONS ==========
const handlePayDueToAdmin = async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    const cleanerId = user?._id || user?.id;
    if (!cleanerId) { alert("Cleaner ID not found"); return; }
    setPayingDue(true);
    try {
      const res = await axios.post("http://localhost:3000/create-cleaner-due-session", { cleanerId });
      window.location.href = res.data.url;
    } catch (err) {
      alert(err.response?.data?.message || "Payment initiation failed");
      setPayingDue(false);
    }
};

const fetchServices = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:3000/services");
      setServices(res.data.services);
    } catch (err) {
      console.error("Failed to fetch services", err);
    }
}, []);

const fetchCleanerRating = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await axios.get(`http://localhost:3000/api/cleaner/${user._id}/rating`);
      setCleanerRating(res.data);
    } catch (err) {
      console.log(err);
    }
}, [user]);

const fetchJobs = useCallback(() => {
    const loggedUser = JSON.parse(localStorage.getItem("user"));
    const cleanerId = String(loggedUser?._id || loggedUser?.id);
    if (!cleanerId) return;
    return axios
      .get(`http://localhost:3000/cleaner-jobs/${cleanerId}`)
      .then((res) => {
        setJobs(res.data.jobs);
        return res.data.jobs;
      })
      .catch((err) => console.error("Fetch jobs error:", err));
}, []);

const fetchNotifications = useCallback(async () => {
    const loggedUser = JSON.parse(localStorage.getItem("user"));
    if (!loggedUser || loggedUser.role !== "cleaner") return;
    const cleanerId = loggedUser._id || loggedUser.id;
    try {
      const res = await axios.get(
        `http://localhost:3000/api/notifications?userId=${cleanerId}&role=cleaner`
      );
      setNotifications(res.data);
      setNotificationCount(res.data.filter((n) => !n.read).length);
    } catch (err) {
      console.error("Failed to fetch cleaner notifications", err);
    }
}, []);

const clearAllNotifications = async () => {
    const loggedUser = JSON.parse(localStorage.getItem("user"));
    const cleanerId = loggedUser._id || loggedUser.id;
    try {
      await axios.delete("http://localhost:3000/api/notifications/clear", {
        data: { userId: cleanerId, role: "cleaner" },
      });
      setNotifications([]);
      setNotificationCount(0);
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
};

const requestOtp = async (bookingId, action) => {
    setOtpLoading(true);
    try {
      await axios.post(`http://localhost:3000/booking/request-otp/${bookingId}`, { action });
      setCurrentBookingId(bookingId);
      setOtpAction(action);
      setShowOtpModal(true);
      alert("OTP sent to user's email. Ask user for the code.");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
};

const verifyOtpAndProceed = async () => {
    if (!otpCode || otpCode.length !== 6) {
      alert("Enter 6-digit OTP");
      return;
    }
    setOtpLoading(true);
    try {
      const response = await axios.post(
        `http://localhost:3000/booking/verify-otp/${currentBookingId}`,
        { action: otpAction, otp: otpCode }
      );
      const updatedJob = response.data.booking;
      setJobs((prev) =>
        prev.map((job) => (job._id === currentBookingId ? updatedJob : job))
      );
      setShowOtpModal(false);
      setOtpCode("");
      alert(`Job ${otpAction}ed successfully!`);
    } catch (err) {
      alert(err.response?.data?.message || "OTP verification failed");
    } finally {
      setOtpLoading(false);
    }
};

  // ========== HIGHLIGHT HELPER ==========
const highlightJobCard = (jobId, retries = 0) => {
    const jobCard = document.getElementById(`job-${jobId}`);
    if (jobCard) {
      jobCard.scrollIntoView({ behavior: "smooth", block: "center" });
      jobCard.style.transition = "background-color 0.3s ease";
      jobCard.style.backgroundColor = "#fef3c7";
      setTimeout(() => {
        jobCard.style.backgroundColor = "";
      }, 3000);
      return true;
    }
    if (retries < 20) {
      setTimeout(() => highlightJobCard(jobId, retries + 1), 200);
    }
    return false;
  };

  // ========== NOTIFICATION CLICK ==========
 const handleNotificationClick = async (notification) => {
    try {
      await axios.put(`http://localhost:3000/api/notifications/${notification._id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n))
      );
      setNotificationCount((prev) => Math.max(0, prev - 1));

      let targetTab = "today";
      const matchedJob = jobs.find((job) => job._id === notification.bookingId);
      if (matchedJob) {
        if (matchedJob.bookingStatus === "Completed") targetTab = "completed";
        else targetTab = isToday(matchedJob) ? "today" : "pending";
      } else {
        const freshJobs = await fetchJobs();
        const freshMatched = freshJobs?.find((j) => j._id === notification.bookingId);
        if (freshMatched) {
          if (freshMatched.bookingStatus === "Completed") targetTab = "completed";
          else targetTab = isToday(freshMatched) ? "today" : "pending";
        }
      }

      setActiveTab(targetTab);
      setPendingHighlightId(notification.bookingId);
      setShowNotifications(false);
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  // ========== DEEP LINKING ==========
  useEffect(() => {
    if (!highlightJobId || hasHighlighted.current) return;
    const targetJob = jobs.find((job) => job._id === highlightJobId);
    if (!targetJob) return;

    let targetTab = "today";
    if (targetJob.bookingStatus === "Completed") {
      targetTab = "completed";
    } else {
      targetTab = isToday(targetJob) ? "today" : "pending";
    }

    const doHighlight = () => {
      if (highlightJobCard(highlightJobId)) hasHighlighted.current = true;
    };

    if (activeTab !== targetTab) {
      setActiveTab(targetTab);
      setTimeout(doHighlight, 300);
    } else {
      doHighlight();
    }
  }, [highlightJobId, jobs, activeTab]);

  useEffect(() => {
    if (highlightJobId) hasHighlighted.current = false;
  }, [highlightJobId]);

  useEffect(() => {
    if (!pendingHighlightId) return;
    const timer = setTimeout(() => {
      const success = highlightJobCard(pendingHighlightId);
      if (success) setPendingHighlightId(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTab, jobs, pendingHighlightId]);
useEffect(() => {
  fetchJobs();

  socket.on("reviewAdded", () => {
    fetchJobs();
  });

  return () => {
    socket.off("reviewAdded");
  };
}, []);
  // ========== MAIN USE EFFECT ==========
  useEffect(() => {
    const loggedUser = JSON.parse(localStorage.getItem("user"));
    if (!loggedUser || loggedUser.role !== "cleaner") {
      navigate("/login");
      return;
    }
    setUser(loggedUser);

    const cleanerId = loggedUser._id || loggedUser.id;

    socket.emit("cleanerOnline", { cleanerId });
    socket.emit("joinCleanerRoom", cleanerId);

    const handleNewJob = () => {
      fetchJobs();
      fetchNotifications();
      const audio = new Audio(
        "https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3"
      );
      audio.play().catch((err) => console.log("Audio blocked:", err));
    };

    const handleBookingAssigned = () => {
      fetchJobs();
      fetchNotifications();
    };

    socket.on("newJobAssigned", handleNewJob);
    socket.on("bookingAssigned", handleBookingAssigned);
    socket.on("bookingUpdated", fetchJobs);
    socket.on("cleanerPaymentPaid", fetchJobs);

    if (!hasFetched.current) {
      fetchJobs();
      hasFetched.current = true;
    }

    return () => {
      socket.emit("cleanerOffline", { cleanerId });
      socket.off("newJobAssigned", handleNewJob);
      socket.off("bookingAssigned", handleBookingAssigned);
      socket.off("bookingUpdated", fetchJobs);
      socket.off("cleanerPaymentPaid");
    };
  }, [navigate, fetchJobs, fetchNotifications]);

  // ========== REAL-TIME NOTIFICATIONS ==========
  useEffect(() => {
    const handleNewNotification = (newNotification) => {
      setNotifications((prev) => {
        const alreadyExists = prev.some((n) => n._id === newNotification._id);
        if (alreadyExists) return prev;
        return [newNotification, ...prev];
      });
      setNotificationCount((prev) => prev + 1);
      const audio = new Audio(
        "https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3"
      );
      audio.play().catch(console.log);
    };

    socket.on("new-notification", handleNewNotification);
    return () => socket.off("new-notification", handleNewNotification);
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);
  useEffect(() => { fetchCleanerRating(); }, [fetchCleanerRating]);
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ========== RENDER JOB LIST ==========
  const renderJobList = () => {
    let jobsToRender = [];
    if (activeTab === "today") jobsToRender = todayJobs;
    else if (activeTab === "pending") jobsToRender = pendingJobs;
    else jobsToRender = completedJobs;

    if (jobsToRender.length === 0) {
      return <p className={styles.noJobs}>No jobs in this category.</p>;
    }

    return jobsToRender.map((job) => (
      <div className={styles.taskItem} key={job._id} id={`job-${job._id}`}>
        <div>
          <h4>{job.serviceName}</h4>
          <p className={styles.serviceDescription}>{getJobDescription(job)}</p>
          <p>{job.name}</p>
          <p>{job.formattedDate || job.date} | {job.timeRange || job.time}</p>
          <p>{job.address}</p>
          <p>Phone: {job.userId?.phone}</p>

          {/* ✅ Online: Sirf net earning (80%) dikhao — commission already kat gayi */}
          {job.paymentMethod === "Online" ? (
            <p>
              Your Earning (after 20% commission):{" "}
              <strong style={{ color: "#16a34a" }}>{job.cleanerEarning}</strong>
            </p>
          ) : (
            /* ✅ Cash: Total earning dikhao + admin ka due alag dikhao */
            <>
              <>
  <p>
    Cleaner Earning:
    <strong style={{ color: "#16a34a" }}>
      {job.cleanerEarning}
    </strong>
  </p>

  <p>
    Admin Commission:
    <strong style={{ color: "#dc2626" }}>
      {job.adminEarning}
    </strong>
  </p>

  <p>
    Commission Status:
    {job.adminEarningStatus === "Paid" ? (
      <span style={{ color: "#16a34a", fontWeight: "500" }}>
        Paid
      </span>
    ) : (
      <span style={{ color: "#d97706", fontWeight: "500" }}>
        Pending
      </span>
    )}
  </p>
</>
            </>
          )}

          <p>
            Payment Status:{" "}
            {job.cleanerEarningStatus === "Paid" ? (
              <span style={{ color: "#16a34a", fontWeight: "500" }}>
                <i className="fas fa-check-circle" style={{ marginRight: "4px" }}></i>Paid
              </span>
            ) : (
              <span style={{ color: "#d97706", fontWeight: "500" }}>
                <i className="fas fa-clock" style={{ marginRight: "4px" }}></i>Unpaid
              </span>
            )}
          </p>
        </div>
        <div className={styles.actions}>
          {job.bookingStatus === "Assigned" && (
            <button
              className={styles.startBtn}
              onClick={() => requestOtp(job._id, "start")}
            >
              Start Job
            </button>
          )}
          {job.bookingStatus === "In Process" && (
            <button
              className={styles.completeBtn}
              onClick={() => requestOtp(job._id, "complete")}
            >
              Complete Job
            </button>
          )}
          {job.bookingStatus === "Completed" && (
            <>
              <span className={styles.completedBadge}>
                <i className="fas fa-check" style={{ marginRight: "6px" }}></i>Completed
              </span>
              {job.review && (
                <div className={styles.reviewBox}>
                  <p className={styles.reviewStars}>
                    {"★".repeat(job.review.rating)}
                  </p>
                  {job.review.comment && (
                    <p className={styles.reviewComment}>"{job.review.comment}"</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    ));
  };

  // ========== MAIN RETURN ==========
  return (
    <div className={styles.container}>
      {/* ===== HEADER ===== */}
      <div className={styles.header}>
        <h2>Cleaner Dashboard</h2>
        <div className={styles.rightHeader}>
          <div className={styles.profileTop}>
            {user?.profileImage ? (
              <img
                src={`http://localhost:3000/${user.profileImage}`}
                alt={user.username}
                className={styles.profileImage}
              />
            ) : (
              <div className={styles.profilePlaceholder}>
                <i className="fas fa-user"></i>
              </div>
            )}
            <div>
              <span>Welcome, {user?.username}</span>
              <button
                className={styles.profileBtn}
                onClick={() => navigate("/cleaner-profile")}
              >
                Profile
              </button>
            </div>
          </div>

          {/* ===== NOTIFICATION BELL ===== */}
          <div
            className={styles.notificationBell}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <i className="fas fa-bell"></i>
            {notificationCount > 0 && (
              <span className={styles.badge}>{notificationCount}</span>
            )}
            {showNotifications && (
              <div className={styles.notificationBox}>
                <div className={styles.notificationHeader}>
                  <h3>Notifications</h3>
                  <div className={styles.notificationCount}>
                    {notifications.length}
                  </div>
                  <button
                    className={styles.clearNotificationBtn}
                    onClick={clearAllNotifications}
                  >
                    Clear
                  </button>
                </div>
                <div className={styles.notificationList}>
                  {notifications.length === 0 ? (
                    <div className={styles.emptyNotification}>
                      <i className="fas fa-bell-slash"></i>
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        className={`${styles.notificationItem} ${!n.read ? styles.unread : ""}`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className={styles.notificationIcon}>
                          <i className="fas fa-broom" style={{ fontSize: "14px" }}></i>
                        </div>
                        <div className={styles.notificationContent}>
                          <p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: "600", color: "#111827" }}>{n.title}</p>
                          <span style={{ fontSize: "12px", color: "#4b5563", lineHeight: "1.5" }}>{n.message}</span>
                          <div className={styles.notificationTime}>
                            {getRelativeTime(n.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ===== LOGOUT BUTTON ===== */}
          <button
            className={styles.logoutBtn}
            onClick={() => {
              const cleanerId = user?.id || user?._id;
              socket.emit("cleanerOffline", { cleanerId });
              axios
                .post("http://localhost:3000/api/auth/logout", { userId: cleanerId })
                .then(() => {
                  localStorage.removeItem("user");
                  navigate("/login");
                })
                .catch((err) => console.log(err));
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* ===== CARDS ===== */}
      <div className={styles.cards}>
        <div className={`${styles.card} ${styles.blue}`}>
          <h3>Today's Jobs</h3>
          <span>{todayJobs.length}</span>
        </div>
        <div className={`${styles.card} ${styles.pink}`}>
          <h3>Completed Jobs</h3>
          <span>{completedJobs.length}</span>
        </div>
        <div className={`${styles.card} ${styles.green}`}>
          <h3>Total Earning (Received)</h3>
          <span>{realisedCleanerEarning}</span>
        </div>
       
        <div className={`${styles.card} ${styles.purple}`}>
  <h3>Due to Admin (Cash Jobs)</h3>
  <span>{dueToAdmin}</span>

  <small
    style={{
      fontSize: "11px",
      opacity: 0.85,
      display: "block",
      marginTop: "4px",
    }}
  >
    20% commission on cash bookings
  </small>
</div>


        <div className={`${styles.card} ${styles.orange}`}>
          <h3 style={{ margin: "0 0 10px 0" }}>Period Income (Cleaner)</h3>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => setPeriodType("month")}
              style={{
                background: periodType === "month" ? "white" : "rgba(255,255,255,0.2)",
                color: periodType === "month" ? "#0f766e" : "white",
                border: "none", borderRadius: "20px", padding: "4px 12px", cursor: "pointer",
              }}
            >
              Month
            </button>
            <button
              onClick={() => setPeriodType("year")}
              style={{
                background: periodType === "year" ? "white" : "rgba(255,255,255,0.2)",
                color: periodType === "year" ? "#0f766e" : "white",
                border: "none", borderRadius: "20px", padding: "4px 12px", cursor: "pointer",
              }}
            >
              Year
            </button>
          </div>
          {periodType === "month" && (
            <div style={{ display: "flex", gap: "8px" }}>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={styles.periodSelect}>
                <option value="">Select Month</option>
                {monthOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={styles.periodSelect}>
                <option value="">Select Year</option>
                {getYearOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}
          {periodType === "year" && (
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={styles.periodSelect}>
              <option value="">Select Year</option>
              {getYearOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          )}
          <div style={{ marginTop: "12px" }}>
            <span>{periodEarnings}</span>
          </div>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabBtn} ${activeTab === "today" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("today")}
        >
          Today's Job
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "pending" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Pending Jobs
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "completed" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("completed")}
        >
          Completed Jobs
        </button>
      </div>

      {/* ===== OTP MODAL ===== */}
      {showOtpModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3>Enter OTP</h3>
            <p>Ask the user to provide the OTP sent to their email.</p>
            <input
              type="text"
              placeholder="6-digit OTP"
              maxLength="6"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className={styles.otpInput}
            />
            <div className={styles.modalButtons}>
              <button onClick={verifyOtpAndProceed} disabled={otpLoading} className={styles.confirmBtn}>
                {otpLoading ? "Verifying..." : "Confirm"}
              </button>
              <button onClick={() => setShowOtpModal(false)} className={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== JOBS LIST ===== */}
      <div className={styles.tasksBox}>
        <div className={styles.tasksHeader}>
          <h3>
            {activeTab === "today"
              ? "Today's Assigned Jobs"
              : activeTab === "pending"
              ? "Pending Jobs"
              : "Completed Jobs"}
          </h3>
        </div>
        {renderJobList()}
      </div>
    </div>
  );
};

export default CleanerDashboard;

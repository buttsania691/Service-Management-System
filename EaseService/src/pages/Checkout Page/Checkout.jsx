import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import styles from "./Checkout.module.css";

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // ========== BASIC STATE ==========
  const [phone, setPhone] = useState("");
  const [pricingType, setPricingType] = useState("hourly");
  const [quantity, setQuantity] = useState(1);
  const [serviceDescription, setServiceDescription] = useState("");
  const [hourlyDescription, setHourlyDescription] = useState("");
  const [importantNote, setImportantNote] = useState("");
  const [loadingService, setLoadingService] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("Morning");
 const [showPassword, setShowPassword] = useState(false);
 const [showLoginPassword, setShowLoginPassword] = useState(false);
  // Questions & answers
  const [serviceQuestions, setServiceQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [multiQuantities, setMultiQuantities] = useState({});

  // Services data
  const [services, setServices] = useState([]);

  // Time slots
  const formatSlotTime = (slot) =>
    new Date(`1970-01-01T${slot}`).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const morningSlots = ["09:00", "10:00", "11:00", "12:00"];
  const afternoonSlots = ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

  // Service from navigation state
  const selectedService = location.state?.serviceName;
  const servicePrice = Number(location.state?.servicePrice) || 0;
// Mobile summary toggle (only for screens ≤768px)
const [showMobileSummary, setShowMobileSummary] = useState(false);
  // Booking & auth states
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(() =>
    JSON.parse(localStorage.getItem("user"))
  );
  const [paymentMethod, setPaymentMethod] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // User details (for signup)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Booking fields
  const [hours, setHours] = useState("");
  const [activetabs, setActiveTabs] = useState(1);
  const [isLogin, setIsLogin] = useState(1); // 1 = signup, 2 = login
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [frequency, setFrequency] = useState("");
  const [price, setPrice] = useState(0);
  const [errors, setErrors] = useState({});
  const [area, setArea] = useState("");
  const [bookingDone, setBookingDone] = useState(false);
  const [isAreaValid, setIsAreaValid] = useState(false);

  const allowedAreas = [
    "Model Town",
    "Satellite Town",
    "DC Colony",
    "Wapda Town",
    "Garden Town",
    "Master City",
    "Canal View",
  ];

  // ========== ROLE RESTRICTION ==========
  useEffect(() => {
    if (loggedInUser && loggedInUser.role !== "user") {
      alert("Access denied. Only customers can book services.");
      navigate("/");
    }
  }, [loggedInUser, navigate]);

  // ========== HELPER: AREA VALIDATION ==========
  const validateArea = (value) => {
    const normalized = value.trim();
    if (!normalized) {
      setIsAreaValid(false);
      return false;
    }
    const isValid = allowedAreas.some(
      (a) => a.toLowerCase() === normalized.toLowerCase()
    );
    setIsAreaValid(isValid);
    return isValid;
  };

  // ========== FETCH SERVICES LIST ==========
  useEffect(() => {
    axios
      .get("http://localhost:3000/services")
      .then((res) => setServices(res.data.services))
      .catch((err) => console.error(err));
  }, []);

  // ========== PRE-FILL USER DATA IF LOGGED IN ==========
  useEffect(() => {
    if (loggedInUser) {
      setName(loggedInUser.username || "");
      setEmail(loggedInUser.email || "");
      setAddress(loggedInUser.address || "");
      setPhone(loggedInUser.phone || "");
    }
  }, [loggedInUser]);

  // ========== FETCH SERVICE DETAILS (desc, pricing, notes) ==========
  useEffect(() => {
    if (!selectedService) return;
    const fetchServiceDetails = async () => {
      setLoadingService(true);
      try {
        const matched = services.find((s) => s.Name === selectedService);
        if (matched) {
          setServiceDescription(matched.Description);
          setPricingType(matched.pricingType || "hourly");
          setImportantNote(matched.importantNote || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingService(false);
      }
    };
    fetchServiceDetails();
  }, [selectedService, services]);

  // ========== FETCH DYNAMIC QUESTIONS FOR THE SERVICE ==========
  useEffect(() => {
    if (!selectedService) return;
    const fetchQuestions = async () => {
      try {
        const service = services.find((s) => s.Name === selectedService);
        if (service && service._id) {
          const res = await axios.get(
            `http://localhost:3000/api/service-questions/${service._id}`
          );
          setServiceQuestions(res.data);
          const init = {};
          res.data.forEach((q) => {
            if (q.type === "multi") {
              init[q._id] = {};
              q.options.forEach((opt) => {
                init[q._id][opt.text] = 0;
              });
            }
          });
          setMultiQuantities(init);
        } else {
          setServiceQuestions([]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchQuestions();
  }, [selectedService, services]);

  // ========== HELPER: UNIT LABEL (rooms, bathrooms, etc.) ==========
  const getUnitLabel = () => {
    if (!selectedService) return "unit";
    const lower = selectedService.toLowerCase();
    if (lower.includes("bathroom") || lower.includes("bath") || lower.includes("washroom"))
      return "bathroom";
    if (lower.includes("kitchen")) return "kitchen";
    if (lower.includes("room")) return "room";
    if (lower.includes("window")) return "window";
    const firstWord = selectedService.split(" ")[0].toLowerCase();
    return firstWord || "unit";
  };

  // ========== BUILD HOURLY / QUANTITY DESCRIPTION ==========
  useEffect(() => {
    if (!serviceDescription) {
      setHourlyDescription("");
      return;
    }
    let desc = "";
    if (pricingType === "quantity") {
      const qtyNum = Number(quantity) || 1;
      const unitLabel = getUnitLabel();
      const includeMatch = serviceDescription.match(/includes?\s*:/i);
      const includeText = includeMatch
        ? serviceDescription.substring(includeMatch.index + includeMatch[0].length).trim()
        : "";
      desc = `${qtyNum} ${unitLabel}${qtyNum !== 1 ? "s" : ""} – Estimated ${qtyNum} hour${
        qtyNum !== 1 ? "s" : ""
      }`;
      if (includeText) desc += `. Includes: ${includeText}`;
    } else {
      if (!hours) {
        setHourlyDescription("");
        return;
      }
      const includeMatch = serviceDescription.match(/includes?\s*:/i);
      const mappingsText = includeMatch
        ? serviceDescription.substring(0, includeMatch.index)
        : serviceDescription;
      const includeText = includeMatch
        ? serviceDescription.substring(includeMatch.index + includeMatch[0].length).trim()
        : "";
      const mappingPattern = new RegExp(`${hours}\\s*hours?\\s*:?\\s*(.*?)(?=\\d+\\s*hours|$)`, "i");
      const match = mappingsText.match(mappingPattern);
      if (match && match[1]) {
        const mappedText = match[1].trim();
        desc = `${hours} hour${hours !== "1" ? "s" : ""}: ${mappedText}`;
        if (includeText) desc += `. Includes: ${includeText}`;
      } else {
        desc = serviceDescription;
      }
    }
    // Append answers from text/select questions
    const answersText = serviceQuestions
      .map((q) => {
        if (q.type === "text" || q.type === "select") {
          const ans = answers[q._id];
          if (!ans) return "";
          return `${q.question}: ${ans}`;
        }
        return "";
      })
      .filter((t) => t)
      .join("; ");
    // Append multi‑select quantities
    const multiText = serviceQuestions
      .filter((q) => q.type === "multi")
      .map((q) => {
        const qtyMap = multiQuantities[q._id] || {};
        const selected = Object.entries(qtyMap).filter(([_, val]) => val > 0);
        if (selected.length === 0) return "";
        const items = selected.map(([optText, qty]) => `${optText} (${qty})`).join(", ");
        return `${q.question}: ${items}`;
      })
      .filter((t) => t)
      .join("; ");
    const combined = [desc, answersText, multiText].filter((s) => s).join(". ");
    setHourlyDescription(combined);
  }, [serviceDescription, hours, pricingType, quantity, serviceQuestions, answers, multiQuantities]);

  // ========== CALCULATE EXTRA COSTS FROM QUESTIONS ==========
  const calculateOptionsPrice = () => {
    let total = 0;
    for (const q of serviceQuestions) {
      if (q.type === "select") {
        const answer = answers[q._id];
        if (answer) {
          const opt = q.options.find((o) => o.text === answer);
          if (opt) total += opt.price;
        }
      } else if (q.type === "multi") {
        const qtyMap = multiQuantities[q._id] || {};
        for (const opt of q.options) {
          const qty = qtyMap[opt.text] || 0;
          total += opt.price * qty;
        }
      }
    }
    return total;
  };

  // ========== CALCULATE BASE PRICE (hourly or quantity × frequency) ==========
  const calculateBasePrice = (freq, hrs, qty) => {
    const base = Number(servicePrice) || 0;
    if (pricingType === "hourly") {
      const hoursNum = Number(hrs) || 0;
      if (!freq) return base * hoursNum;
      if (freq === "Weekly") return base * hoursNum * 7;
      if (freq === "Monthly") return base * hoursNum * 30;
      return base * hoursNum;
    } else {
      const qtyNum = Number(qty) || 1;
      if (!freq) return base * qtyNum;
      if (freq === "Weekly") return base * qtyNum * 7;
      if (freq === "Monthly") return base * qtyNum * 30;
      return base * qtyNum;
    }
  };

  // ========== UPDATE TOTAL PRICE WHENEVER DEPENDENCIES CHANGE ==========
  useEffect(() => {
    const base = calculateBasePrice(frequency, hours, quantity);
    const extras = calculateOptionsPrice();
    setPrice(base + extras);
  }, [selectedService, servicePrice, frequency, hours, quantity, pricingType, serviceQuestions, answers, multiQuantities]);

  // ========== NAVIGATION HELPERS ==========
  const goBack = () => {
    if (activetabs > 1) setActiveTabs(activetabs - 1);
  };
  const handleFrequency = (value) => setFrequency(value);
  const handleHours = (value) => setHours(value);
  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  // ========== VALIDATE BOOKING DETAILS (Step 1) ==========
  const validateBooking = () => {
    const newErrors = {};
    const normalizedArea = area.trim();
    const isValidArea = allowedAreas.some(
      (a) => a.toLowerCase() === normalizedArea.toLowerCase()
    );
    if (!area) newErrors.area = "Area required";
    else if (!isValidArea)
      newErrors.area = "Service not available in this area. Allowed areas: " + allowedAreas.join(", ");
    if (!frequency) newErrors.frequency = "Frequency required";
    if (pricingType === "hourly" && !hours) newErrors.hours = "Hours required";
    if (!date) newErrors.date = "Date required";
    if (!time) newErrors.time = "Time required";
    for (const q of serviceQuestions) {
      if (q.isRequired) {
        if (q.type === "text" || q.type === "select") {
          const ans = answers[q._id];
          if (!ans) newErrors[`q_${q._id}`] = `Please answer: ${q.question}`;
        } else if (q.type === "multi") {
          const qtyMap = multiQuantities[q._id] || {};
          const hasAny = Object.values(qtyMap).some((v) => v > 0);
          if (!hasAny)
            newErrors[`q_${q._id}`] = `Please select at least one option for: ${q.question}`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ========== VALIDATE USER DETAILS (Step 2) ==========
  const validateDetails = () => {
    const newErrors = {};
    if (isLogin === 1) {
      if (!name) newErrors.name = "Name required";
      if (!email) newErrors.email = "Email required";
      else if (!isValidEmail(email)) newErrors.email = "Invalid email format";
      if (!phone) newErrors.phone = "Phone number required";
      else if (!/^\d{10,15}$/.test(phone))
        newErrors.phone = "Enter valid phone number (10-15 digits)";
      if (!password) newErrors.password = "Password required";
      else if (password.length !== 8) newErrors.password = "Password must be exactly 8 characters long";
      else if (!/[A-Z]/.test(password))
        newErrors.password = "Password must contain at least one uppercase letter (A-Z)";
      else if (!/[a-z]/.test(password))
        newErrors.password = "Password must contain at least one lowercase letter (a-z)";
      else if (!/[0-9]/.test(password))
        newErrors.password = "Password must contain at least one digit (0-9)";
      else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
        newErrors.password = "Password must contain at least one special character";
      if (!address) newErrors.address = "Address required";
    } else {
      if (!loginEmail) newErrors.loginEmail = "Email required";
      else if (!isValidEmail(loginEmail)) newErrors.loginEmail = "Invalid email format";
      if (!loginPassword) newErrors.loginPassword = "Password required";
      else if (loginPassword.length < 8) newErrors.loginPassword = "Password must be at least 8 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ========== GO TO DETAILS STEP IF VALID ==========
  const goToDetails = () => {
    if (validateBooking()) {
      setActiveTabs(2);
    }
  };

  // ========== FORMAT TIME RANGE (start – end) ==========
  const formatTimeRange = () => {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    const format = (t) => {
      let hrs = t.getHours();
      const mins = t.getMinutes().toString().padStart(2, "0");
      const ampm = hrs >= 12 ? "PM" : "AM";
      hrs = hrs % 12 || 12;
      return `${hrs}:${mins} ${ampm}`;
    };
    let durationHours = 0;
    if (pricingType === "hourly") durationHours = Number(hours) || 0;
    else durationHours = Number(quantity) || 0;
    if (durationHours <= 0) return format(start);
    const end = new Date(start);
    end.setHours(start.getHours() + durationHours);
    return `${format(start)} - ${format(end)}`;
  };

  // ========== FORMAT DATE (e.g., Monday, 26th May) ==========
  const formatDate = () => {
    if (!date) return "";
    const d = new Date(date);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const day = d.getDate();
    const getSuffix = (dayNum) => {
      if (dayNum >= 11 && dayNum <= 13) return "th";
      switch (dayNum % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    };
    return `${days[d.getDay()]}, ${day}${getSuffix(day)} ${months[d.getMonth()]}`;
  };

  const getDayName = () => {
    if (!date) return "";
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date(date).getDay()];
  };

  const serviceName = frequency ? `${selectedService} (${frequency})` : selectedService;

  // ========== AUTHENTICATION HANDLERS ==========
  const handleForgotPassword = async () => {
    if (!loginEmail) {
      setAuthError("Please enter your email first");
      return;
    }
    try {
      const response = await axios.post("http://localhost:3000/api/auth/forgot-password", {
        email: loginEmail,
      });
      alert(response.data.message);
    } catch (error) {
      setAuthError(error.response?.data?.message || "Something went wrong");
    }
  };

  const handleSignup = async () => {
    if (!validateDetails()) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await axios.post("http://localhost:3000/api/auth/register", {
        username: name,
        email,
        password,
        phone,
        address,
        role: "user",
      });
      localStorage.setItem("user", JSON.stringify(response.data.user));
      localStorage.setItem("userToken", response.data.token);
      setLoggedInUser(response.data.user);
      setActiveTabs(3);
    } catch (error) {
      setAuthError(error.response?.data?.message || "Signup failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!validateDetails()) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await axios.post("http://localhost:3000/api/auth/login", {
        email: loginEmail,
        password: loginPassword,
      });
      localStorage.setItem("userToken", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      setLoggedInUser(response.data.user);
      setActiveTabs(3);
    } catch (error) {
      setAuthError(error.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  // ========== ONLINE PAYMENT SESSION ==========
  const handleOnlinePayment = async (bookingId) => {
    try {
      const res = await axios.post("http://localhost:3000/create-checkout-session", { bookingId });
      window.location.href = res.data.url;
    } catch (error) {
      setBookingError(error.response?.data?.message || error.response?.data?.error || "Payment session failed");
    }
  };

  // ========== SAVE BOOKING TO BACKEND ==========
  const saveBooking = async () => {
    if (!paymentMethod) {
      setBookingError("Select payment method");
      return;
    }
    if (!loggedInUser) {
      setBookingError("Login or signup first");
      setActiveTabs(2);
      return;
    }
    setBookingLoading(true);
    setBookingError("");
    try {
      let finalHours = hours;
      if (pricingType === "quantity") finalHours = quantity;
      const bookingPayload = {
        userId: loggedInUser?._id || loggedInUser?.id,
        serviceName: selectedService,
        area,
        frequency,
        hours: finalHours,
        quantity: pricingType === "quantity" ? quantity : undefined,
        date,
        formattedDate: formatDate(),
        time,
        timeRange: formatTimeRange(),
        name,
        address,
        price,
        paymentMethod,
        paymentStatus: "Pending",
        answers: answers,
        customDescription: hourlyDescription,
      };
      const response = await axios.post("http://localhost:3000/booking", bookingPayload);
      const booking = response.data.booking;
      if (paymentMethod === "Cash") setBookingDone(true);
      else if (paymentMethod === "Online") await handleOnlinePayment(booking._id);
    } catch (error) {
      setBookingError(error.response?.data?.message || "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  };

  // ========== SUCCESS SCREEN (inline styles kept) ==========
 // ========== SUCCESS SCREEN (now using CSS Modules) ==========
if (bookingDone) {
  return (
    <div className={styles.successScreen}>
      {/* Stepper indicators */}
      <div className={styles.successStepper}>
        <div className={styles.successStep}>
          <div className={styles.successStepCircle}>✓</div>
          <span>Booking</span>
        </div>
        <div className={styles.successStepLine}></div>
        <div className={styles.successStep}>
          <div className={styles.successStepCircle}>✓</div>
          <span>Details</span>
        </div>
        <div className={styles.successStepLine}></div>
        <div className={styles.successStep}>
          <div className={styles.successStepCircle}>✓</div>
          <span>Payment</span>
        </div>
      </div>

      {/* Success content */}
      <div className={styles.successContent}>
        <div className={styles.successEmoji}>🎉</div>
        <h2 className={styles.successTitle}>Thanks, your booking is done!</h2>
        <p className={styles.successMessage}>
          You will receive an email with the confirmation.
        </p>

        {/* Booking summary card */}
        <div className={styles.successCard}>
          <p className={styles.successCardTitle}>{serviceName}</p>
          <p className={styles.successCardDetails}>
            {formatDate()} &nbsp;|&nbsp; {formatTimeRange()}
          </p>
          <p className={styles.successCardPrice}>PKR {price.toLocaleString()}</p>
        </div>

        {/* Action buttons */}
        <button
          className={styles.successDashboardBtn}
          onClick={() => navigate("/user")}
        >
          Go to Dashboard
        </button>
        <button
          className={styles.successAnotherBtn}
          onClick={() => navigate("/")}
        >
          Confirm Another Booking
        </button>
      </div>
    </div>
  );
}

  // ========== MAIN CHECKOUT RENDER ==========
  return (
    <>
      {/* Tab navigation */}
      <div className={styles.body}>
        <div className={styles.tabContainer}>
          <div className={styles.tabs}>
            <div className={`${styles.tabItem} ${activetabs === 1 ? styles.active : ""} ${activetabs > 1 ? styles.completed : ""}`}>
              <span className={styles.counting}>{activetabs > 1 ? "✓" : "1"}</span>
              <span>Booking</span>
            </div>
            <div className={`${styles.tabConnector} ${activetabs >= 2 ? styles.filled : ""}`}></div>
            <div className={`${styles.tabItem} ${activetabs === 2 ? styles.active : ""} ${activetabs > 2 ? styles.completed : ""}`}>
              <span className={styles.counting}>{activetabs > 2 ? "✓" : "2"}</span>
              <span>Details</span>
            </div>
            <div className={`${styles.tabConnector} ${activetabs >= 3 ? styles.filled : ""}`}></div>
            <div className={`${styles.tabItem} ${activetabs === 3 ? styles.active : ""}`}>
              <span className={styles.counting}>3</span>
              <span>Payment</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.checkoutContainer}>
        {bookingError && (
          <div className={styles.bookingErrorBox}>
            <div className={styles.errorIcon}>⚠</div>
            <div>
              <h4>Booking Failed</h4>
              <p>{bookingError}</p>
            </div>
          </div>
        )}

        {/* STEP 1 – BOOKING DETAILS */}
        {activetabs === 1 && (
          <div className={styles.bookingdata}>
            <form>
              <p>Enter Your Area</p>
              <input
                list="areas"
                className={styles.options}
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  validateArea(e.target.value);
                  setErrors((prev) => ({ ...prev, area: "" }));
                }}
                style={{ borderColor: !isAreaValid && area ? "#ef4444" : "" }}
              />
              {errors.area && <p className={styles.error}>{errors.area}</p>}
              {!isAreaValid && area && <p className={styles.error}>Please select a valid area from the list</p>}
              <datalist id="areas">
                {allowedAreas.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>

              <p>How Often do you need your cleaner?</p>
              <select
                className={styles.options}
                value={frequency}
                onChange={(e) => {
                  handleFrequency(e.target.value);
                  setErrors((prev) => ({ ...prev, frequency: "" }));
                }}
              >
                <option value="">Select Frequency</option>
                <option value="Weekly">Weekly</option>
                <option value="Once">Once</option>
                <option value="Monthly">Monthly</option>
              </select>
              {errors.frequency && <p className={styles.error}>{errors.frequency}</p>}

              {pricingType === "hourly" ? (
                <>
                  <p>How many hours do you need?</p>
                  <select
                    className={styles.options}
                    value={hours}
                    onChange={(e) => handleHours(e.target.value)}
                  >
                    <option value="">Select Hours</option>
                    <option value="2">2 Hours</option>
                    <option value="4">4 Hours</option>
                    <option value="6">6 Hours</option>
                    <option value="8">8 Hours</option>
                  </select>
                  {errors.hours && <p className={styles.error}>{errors.hours}</p>}
                </>
              ) : (
                <>
                  <p>Enter Quantity (e.g., number of rooms, items)</p>
                  <input
                    type="number"
                    className={styles.options}
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(parseInt(e.target.value) || 1);
                      setErrors((prev) => ({ ...prev, quantity: "" }));
                    }}
                  />
                  {errors.quantity && <p className={styles.error}>{errors.quantity}</p>}
                </>
              )}

              {/* Dynamic questions */}
              {serviceQuestions.length > 0 && (
                <div className={styles.questionsSection} style={{ marginTop: "20px", padding: "15px", backgroundColor: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                  <p style={{ fontWeight: "bold", marginBottom: "12px" }}>Please answer the following:</p>
                  {serviceQuestions.map((q) => (
                    <div key={q._id} className={styles.questionItem} style={{ marginBottom: "16px", paddingBottom: "8px", borderBottom: "1px solid #e2e8f0" }}>
                      <label style={{ display: "block", marginBottom: "6px", fontWeight: "500" }}>
                        {q.question} {q.isRequired && <span style={{ color: "red" }}>*</span>}
                      </label>
                      {q.type === "text" && (
                        <input
                          type="text"
                          value={answers[q._id] || ""}
                           onChange={(e) => {
  setAnswers({ ...answers, [q._id]: e.target.value });

  setErrors((prev) => ({
    ...prev,
    [`q_${q._id}`]: "",
  }));
}}
                          style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                        />
                      )}
                      {q.type === "select" && (
                        <select
                          value={answers[q._id] || ""}
                           onChange={(e) => {
      setAnswers({ ...answers, [q._id]: e.target.value });

      // Remove "Please answer" error after selecting an option
      setErrors((prev) => ({
        ...prev,
        [`q_${q._id}`]: "",
      }));
    }}
                          style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                        >
                          <option value="">-- Select --</option>
                          {q.options.map((opt) => (
                            <option key={opt.text} value={opt.text}>
                              {opt.text} {opt.price > 0 ? `(+${opt.price} PKR)` : ""}
                            </option>
                          ))}
                        </select>
                      )}
                      {q.type === "multi" && (
                        <div className={styles.multiOptions} style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                          {q.options.map((opt) => {
                            const currentQty = multiQuantities[q._id]?.[opt.text] || 0;
                            return (
                              <div key={opt.text} style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between" }}>
                                <span style={{ flex: 1 }}>{opt.text} (per unit {opt.price} PKR)</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={currentQty}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setMultiQuantities((prev) => ({
                                      ...prev,
                                      [q._id]: {
                                        ...(prev[q._id] || {}),
                                        [opt.text]: val,
                                      },
                                    }));
                                    setErrors((prev) => ({ ...prev, [`q_${q._id}`]: "" }));
                                  }}
                                  style={{ width: "80px", padding: "5px", borderRadius: "6px", border: "1px solid #ccc" }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {errors[`q_${q._id}`] && (
                        <p className={styles.error} style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
                          {errors[`q_${q._id}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p>Select Date</p>
              <input
                type="date"
                className={styles.options}
                min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setErrors((prev) => ({ ...prev, date: "" }));
                }}
              />
              {errors.date && <p className={styles.error}>{errors.date}</p>}

              <div className={styles.timeWrapper}>
                <p>Select Time</p>
                <div className={styles.toggleTabs}>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${selectedPeriod === "Morning" ? styles.activeToggle : ""}`}
                    onClick={() => setSelectedPeriod("Morning")}
                  >
                    🌤 Morning
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${selectedPeriod === "Afternoon" ? styles.activeToggle : ""}`}
                    onClick={() => setSelectedPeriod("Afternoon")}
                  >
                    ☀ Afternoon
                  </button>
                </div>
                <div className={styles.timeSlots}>
                  {(selectedPeriod === "Morning" ? morningSlots : afternoonSlots).map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      className={`${styles.slotBtn} ${time === slot ? styles.activeSlot : ""}`}
                      onClick={() => {
                        setTime(slot);
                        setErrors((prev) => ({ ...prev, time: "" }));
                      }}
                    >
                      {formatSlotTime(slot)}
                    </button>
                  ))}
                </div>
                {errors.time && <p className={styles.error}>{errors.time}</p>}
              </div>

              <div className={styles.btn} onClick={goToDetails}>
                <p>Confirm Booking</p>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2 – USER DETAILS (signup/login) */}
        {activetabs === 2 && (
          <div className={styles.detailsdata}>
            {!loggedInUser && (
              <div className={styles.toggle}>
                <div className={styles.signup} onClick={() => { setIsLogin(1); setErrors({}); setAuthError(""); }}>
                  <p>Signup</p>
                </div>
                <div className={styles.login} onClick={() => { setIsLogin(2); setErrors({}); setAuthError(""); }}>
                  <p>Login</p>
                </div>
              </div>
            )}
            {loggedInUser ? (
              <div className={styles.signupdata}>
                <form>
                  <p>Address</p>
                  <input
                    type="text"
                    className={styles.options}
                    value={address}
                    onChange={(e) => {
  setAddress(e.target.value);
  setErrors((prev) => ({ ...prev, address: "" }));
  setAuthError("");
}}
                  />
                  {errors.address && <p className={styles.error}>{errors.address}</p>}
                  <div className={styles.btnGroup}>
                    <div
                      className={styles.btn}
                      onClick={() => {
                        if (!address.trim()) {
                          setErrors((prev) => ({ ...prev, address: "Address required" }));
                          return;
                        }
                        setErrors((prev) => ({ ...prev, address: "" }));
                        setActiveTabs(3);
                      }}
                    >
                      <p>Continue</p>
                    </div>
                    <div className={styles.btn} onClick={goBack}>
                      <p>Back</p>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              <>
                {isLogin === 1 && (
                  <div className={styles.signupdata}>
                    <form>
                      <p>Enter Your Name</p>
                      <input
                        type="text"
                        className={styles.options}
                        onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: "" })); }}
                        value={name}
                      />
                      {errors.name && <p className={styles.error}>{errors.name}</p>}
                      <p>Enter Your Email</p>
                      <input
                        type="text"
                        className={styles.options}
                        onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: "" })); }}
                        value={email}
                      />
                      {errors.email && <p className={styles.error}>{errors.email}</p>}
                      <p>Enter Your Password</p>

<div style={{ position: "relative", width: "100%" }}>
  <input
    type={showPassword ? "text" : "password"}
    className={styles.options}
    value={password}
    onChange={(e) => {
      setPassword(e.target.value);
      setErrors((prev) => ({ ...prev, password: "" }));
      setAuthError("");
    }}
    style={{
      width: "100%",
      paddingRight: "40px",
      boxSizing: "border-box",
    }}
  />

  <span
    onClick={() => setShowPassword(!showPassword)}
    style={{
      position: "absolute",
      right: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      cursor: "pointer",
      color: "#888",
      display: "flex",
      alignItems: "center",
    }}
  >
    {showPassword ? (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    ) : (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )}
  </span>
</div>

{errors.password && (
  <p className={styles.error}>{errors.password}</p>
)}
                      <p>Enter Your Phone Number</p>
                      <input
                        type="tel"
                        className={styles.options}
                        onChange={(e) => { setPhone(e.target.value); setErrors((prev) => ({ ...prev, phone: "" })); }}
                        value={phone}
                      />
                      {errors.phone && <p className={styles.error}>{errors.phone}</p>}
                      <p>Enter Your Address</p>
                      <input
                        type="text"
                        className={styles.options}
                        value={address || loggedInUser?.address || ""}
                       onChange={(e) => {
  setAddress(e.target.value);
  setErrors((prev) => ({ ...prev, address: "" }));
  setAuthError("");
}}
                      />
                      {errors.address && <p className={styles.error}>{errors.address}</p>}
                      <div className={styles.btnGroup}>
                        <div className={styles.btn} onClick={handleSignup}>
                          <p>{authLoading ? "Signing up..." : "Confirm Details"}</p>
                        </div>
                        <div className={styles.btn} onClick={goBack}>
                          <p>Back</p>
                        </div>
                      </div>
                      {authError && <p className={styles.error}>{authError}</p>}
                    </form>
                  </div>
                )}
                {isLogin === 2 && (
                  <div className={styles.signupdata}>
                    <form>
                      <p>Enter Your Email</p>
                      <input
                        type="text"
                        className={styles.options}
                        value={loginEmail}
                        onChange={(e) => { setLoginEmail(e.target.value); setErrors((prev) => ({ ...prev, loginEmail: "" })); }}
                      />
                      {errors.loginEmail && <p className={styles.error}>{errors.loginEmail}</p>}
                      <p>Enter Your Password</p>

<div style={{ position: "relative", width: "100%" }}>
  <input
    type={showLoginPassword ? "text" : "password"}
    className={styles.options}
    value={loginPassword}
    onChange={(e) => {
      setLoginPassword(e.target.value);
      setErrors((prev) => ({
        ...prev,
        loginPassword: "",
      }));
      setAuthError("");
    }}
    style={{
      width: "100%",
      paddingRight: "40px",
      boxSizing: "border-box",
    }}
  />

  <span
    onClick={() => setShowLoginPassword(!showLoginPassword)}
    style={{
      position: "absolute",
      right: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      cursor: "pointer",
      color: "#888",
      display: "flex",
      alignItems: "center",
    }}
  >
    {showLoginPassword ? (
      // Hide password icon
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    ) : (
      // Show password icon
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )}
  </span>
</div>

{errors.loginPassword && (
  <p className={styles.error}>{errors.loginPassword}</p>
)}
                      <p style={{ color: "blue", cursor: "pointer", marginTop: "10px", fontSize: "14px" }} onClick={handleForgotPassword}>
                        Forgot Password?
                      </p>
                      <div className={styles.btnGroup}>
                        <div className={styles.btn} onClick={handleLogin}>
                          <p>{authLoading ? "Logging in..." : "Confirm Details"}</p>
                        </div>
                        <div className={styles.btn} onClick={goBack}>
                          <p>Back</p>
                        </div>
                      </div>
                      {authError && <p className={styles.error}>{authError}</p>}
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* STEP 3 – PAYMENT */}
        {activetabs === 3 && (
          <div className={styles.paymentdata}>
            <h2>Select Payment Method</h2>
            <div className={styles.paymentBtnGroup}>
              <div className={styles.cashonservice} onClick={() => { setPaymentMethod("Cash"); setBookingError(""); }}>
                <p>💵 Cash on Service</p>
              </div>
              <div className={styles.online} onClick={() => { setPaymentMethod("Online"); setBookingError(""); }}>
                <p>💳 Online Payment</p>
              </div>
            </div>
            <div className={styles.paymentActionGroup}>
              <div className={styles.paymentbtn} onClick={saveBooking}>
                <p>{bookingLoading ? "Processing..." : "Confirm Payment"}</p>
              </div>
              <div className={styles.paymentbtn} onClick={goBack}>
                <p>Back</p>
              </div>
            </div>
          </div>
        )}

        {/* SUMMARY SIDEBAR */}
         {/* ===== BOOKING SUMMARY (DESKTOP) ===== */}
        <div className={`${styles.bookingSummary} ${styles.desktopSummary}`}>
          <div className={styles.Frequencey}>
            <p>Booking Summary</p>
            <div className={styles.data}>
              <ul>
                <li>{frequency ? `${frequency} ${date ? `(${getDayName()})` : ""}` : "Frequency not selected"}</li>
                <li>{formatDate() || "Date not selected"}</li>
                <li>{formatTimeRange() || "Time not selected"}</li>
                <li>{loadingService ? "Loading..." : hourlyDescription || "Service details not available"}</li>
                {importantNote && !loadingService && (
                  <li style={{ color: "red", fontWeight: "bold", marginTop: "8px" }}>
                    {importantNote}
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className={styles.ServiceRow}>
            <p>{serviceName}</p>
            <p>PKR {price.toLocaleString()}</p>
          </div>
          <div className={styles.ServicePrice}>
            <p>PKR {price > 0 ? price.toLocaleString() : servicePrice.toLocaleString()}</p>
          </div>
        </div>

        {/* ===== MOBILE STICKY BOTTOM BAR ===== */}
        <div className={styles.mobileSummaryBar}>
          <div className={styles.mobileSummaryRow} onClick={() => setShowMobileSummary(!showMobileSummary)}>
            <span className={styles.mobileTotalLabel}>Total Amount</span>
            <span className={styles.mobileTotalPrice}>PKR {price.toLocaleString()}</span>
            <span className={`${styles.mobileArrow} ${showMobileSummary ? styles.arrowUp : ''}`}>▼</span>
          </div>
          {showMobileSummary && (
            <div className={styles.mobileSummaryDetails}>
              <div className={styles.Frequencey}>
                <p>Booking Details</p>
                <div className={styles.data}>
                  <ul>
                    <li>{frequency ? `${frequency} ${date ? `(${getDayName()})` : ""}` : "Frequency not selected"}</li>
                    <li>{formatDate() || "Date not selected"}</li>
                    <li>{formatTimeRange() || "Time not selected"}</li>
                    <li>{loadingService ? "Loading..." : hourlyDescription || "Service details not available"}</li>
                    {importantNote && !loadingService && (
                      <li style={{ color: "red", fontWeight: "bold", marginTop: "8px" }}>
                        {importantNote}
                      </li>
                    )}
                  </ul>
                </div>
              </div>
              <div className={styles.ServiceRow}>
                <p>{serviceName}</p>
                <p>PKR {price.toLocaleString()}</p>
              </div>
              <div className={styles.ServicePrice}>
                <p>PKR {price > 0 ? price.toLocaleString() : servicePrice.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Checkout;
   


import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import styles from "./BecomeCleaner.module.css";

const BecomeCleaner = () => {
  const navigate = useNavigate();

  const [services, setServices] = useState([]);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    cleanerType: "",
    cnicNumber: "",
  });

  const [cnicError, setCnicError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailError, setEmailError] = useState("");

  const [cnicFront, setCnicFront] = useState(null);
  const [cnicBack, setCnicBack] = useState(null);
  const [profileImage, setProfileImage] = useState(null);

  const [profileImageError, setProfileImageError] = useState("");
  const [loading, setLoading] = useState(false);

  // ================= SHOW / HIDE PASSWORD =================
  const [showPassword, setShowPassword] = useState(false);

  // ================= FETCH SERVICES =================
  useEffect(() => {
    axios
      .get("http://localhost:3000/services")
      .then((res) => {
        const serviceNames = res.data.services.map((s) => s.Name);

        setServices(serviceNames);

        if (serviceNames.length > 0) {
          setForm((prev) => ({
            ...prev,
            cleanerType: serviceNames[0],
          }));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch services", err);
      });
  }, []);

  // ================= EMAIL VALIDATION =================
  const validateEmail = (email) => {
    const regex = /^[^\s@]+@gmail\.com$/;
    return regex.test(email);
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;

    setForm((prev) => ({
      ...prev,
      email: value,
    }));

    if (value && !validateEmail(value)) {
      setEmailError(
        "Only Gmail addresses are accepted (e.g., example@gmail.com)"
      );
    } else {
      setEmailError("");
    }
  };

  // ================= PASSWORD VALIDATION =================
  const validatePassword = (pwd) => {
    // Empty password par validation message show nahi hoga
  if (pwd === "") {
    return "";
  }
    if (pwd.length !== 8) {
      return "Password must be exactly 8 characters";
    }

    if (!/[A-Z]/.test(pwd)) {
      return "Must contain at least one uppercase letter (A-Z)";
    }

    if (!/[a-z]/.test(pwd)) {
      return "Must contain at least one lowercase letter (a-z)";
    }

    if (!/[0-9]/.test(pwd)) {
      return "Must contain at least one digit (0-9)";
    }

    if (!/[!@#$%^&*()_+\-=]/.test(pwd)) {
      return "Must contain at least one special character (!@#$%^&*)";
    }

    return "";
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;

    setForm((prev) => ({
      ...prev,
      password: value,
    }));

    setPasswordError(validatePassword(value));
  };

  // ================= CNIC VALIDATION =================
  const validateCNIC = (cnic) => {
    const regex = /^\d{5}-\d{7}-\d{1}$|^\d{13}$/;
    return regex.test(cnic);
  };

  const handleCnicChange = (e) => {
    const value = e.target.value;

    setForm((prev) => ({
      ...prev,
      cnicNumber: value,
    }));

    if (!validateCNIC(value) && value !== "") {
      setCnicError(
        "Invalid CNIC format. Use: 12345-1234567-1 or 13 digits"
      );
    } else {
      setCnicError("");
    }
  };

  // ================= SUBMIT =================
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Email validation
    if (!validateEmail(form.email)) {
      setEmailError(
        "Only Gmail addresses are accepted (e.g., example@gmail.com)"
      );
      return;
    }

    // Password validation
    const pwdErr = validatePassword(form.password);
     // Empty password par validation message show nahi hoga

    if (pwdErr) {
      setPasswordError(pwdErr);
      return;
    }

    // CNIC validation
    if (!validateCNIC(form.cnicNumber)) {
      setCnicError(
        "Invalid CNIC format. Use: 12345-1234567-1 or 13 digits"
      );
      return;
    }

    // CNIC front image
    if (!cnicFront) {
      alert("CNIC Front Image is required");
      return;
    }

    // CNIC back image
    if (!cnicBack) {
      alert("CNIC Back Image is required");
      return;
    }

    // Profile image
    if (!profileImage) {
      setProfileImageError("Profile Picture is required");
      return;
    }

    // ================= FORM DATA =================
    const data = new FormData();

    Object.keys(form).forEach((key) => {
      data.append(key, form[key]);
    });

    data.append("cnicFront", cnicFront);
    data.append("cnicBack", cnicBack);
    data.append("profileImage", profileImage);

    setLoading(true);

    try {
      await axios.post(
        "http://localhost:3000/api/cleaner/apply",
        data
      );

      alert(
        "Application submitted! Admin will review and notify you via email."
      );

      navigate("/");
    } catch (err) {
      alert(err.response?.data?.message || "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles["become-cleaner-container"]}>
      <h2 className={styles["become-cleaner-title"]}>
        Register as a Cleaner
      </h2>

      <form
        className={styles["become-cleaner-form"]}
        onSubmit={handleSubmit}
        encType="multipart/form-data"
      >
        {/* ================= USERNAME ================= */}
        <input
          className={styles["become-cleaner-input"]}
          type="text"
          placeholder="Username"
          required
          value={form.username}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              username: e.target.value,
            }))
          }
        />

        {/* ================= EMAIL ================= */}
        <input
          className={styles["become-cleaner-input"]}
          type="text"
          placeholder="Email (e.g., example@gmail.com)"
          required
          value={form.email}
          onChange={handleEmailChange}
        />

        {emailError && (
          <span className={styles["error-message"]}>
            {emailError}
          </span>
        )}

        {/* ================= PASSWORD ================= */}
        <div className={styles["password-wrapper"]}>
          <input
            className={styles["become-cleaner-input"]}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            required
            value={form.password}
            onChange={handlePasswordChange}
          />

          <button
            type="button"
            className={styles["password-toggle"]}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              /* Eye Off Icon */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M6.61 6.61C3.73 8.5 2 12 2 12s3 7 10 7a9.6 9.6 0 0 0 5.39-1.61" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            ) : (
              /* Eye Icon */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {passwordError && (
          <span className={styles["error-message"]}>
            {passwordError}
          </span>
        )}

        {/* ================= PHONE ================= */}
        <input
          className={styles["become-cleaner-input"]}
          type="text"
          placeholder="Phone"
          required
          value={form.phone}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              phone: e.target.value,
            }))
          }
        />

        {/* ================= ADDRESS ================= */}
        <input
          className={styles["become-cleaner-input"]}
          type="text"
          placeholder="Address"
          required
          value={form.address}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              address: e.target.value,
            }))
          }
        />

        {/* ================= CLEANER TYPE ================= */}
        <select
          className={styles["become-cleaner-input"]}
          value={form.cleanerType}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              cleanerType: e.target.value,
            }))
          }
          required
        >
          <option value="" disabled>
            Select Cleaner Type (Service)
          </option>

          {services.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>

        {/* ================= CNIC NUMBER ================= */}
        <input
          className={styles["become-cleaner-input"]}
          type="text"
          placeholder="CNIC Number (e.g., 12345-1234567-1)"
          required
          value={form.cnicNumber}
          onChange={handleCnicChange}
        />

        {cnicError && (
          <span className={styles["error-message"]}>
            {cnicError}
          </span>
        )}

        {/* ================= CNIC FRONT ================= */}
        <label className={styles["become-cleaner-label"]}>
          CNIC Front Image:
        </label>

        <input
          className={styles["become-cleaner-file"]}
          type="file"
          accept="image/*"
          required
          onChange={(e) => setCnicFront(e.target.files[0])}
        />

        {/* ================= CNIC BACK ================= */}
        <label className={styles["become-cleaner-label"]}>
          CNIC Back Image:
        </label>

        <input
          className={styles["become-cleaner-file"]}
          type="file"
          accept="image/*"
          required
          onChange={(e) => setCnicBack(e.target.files[0])}
        />

        {/* ================= PROFILE IMAGE ================= */}
        <label className={styles["become-cleaner-label"]}>
          Profile Picture:
        </label>

        <input
          className={styles["become-cleaner-file"]}
          type="file"
          accept="image/*"
          required
          onChange={(e) => {
            setProfileImage(e.target.files[0]);
            setProfileImageError("");
          }}
        />

        {profileImageError && (
          <span className={styles["error-message"]}>
            {profileImageError}
          </span>
        )}

        {/* ================= SUBMIT BUTTON ================= */}
        <button
          className={styles["become-cleaner-button"]}
          type="submit"
          disabled={
            loading ||
            !!passwordError ||
            !!emailError ||
            !!cnicError
          }
        >
          {loading ? "Submitting..." : "Submit Application"}
        </button>
      </form>
    </div>
  );
};

export default BecomeCleaner;
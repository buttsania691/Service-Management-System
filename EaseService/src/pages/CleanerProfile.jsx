import { useState, useEffect, useRef } from "react";
import axios from "axios";
import styles from "./CleanerProfile.module.css";

const CleanerProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
const [showNewPassword, setShowNewPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Load user from localStorage on mount
  useEffect(() => {
    const logged = JSON.parse(localStorage.getItem("user"));
    setUser(logged);
  }, []);

  // Handle text input changes
  const handleChange = (e) => {
    setUser({
      ...user,
      [e.target.name]: e.target.value,
    });
  };

  // Save profile details
  const saveProfile = async () => {
    setLoading(true);
    try {
      const userId = user?._id || user?.id;
      const response = await axios.put(
        `http://localhost:3000/api/cleaner/${userId}`,
        {
          username: user.username,
          email: user.email,
          phone: user.phone,
          address: user.address,
          cleanerType: user.cleanerType,
        }
      );
      localStorage.setItem("user", JSON.stringify(response.data.updatedCleaner || user));
      alert("Profile updated successfully!");
    } catch (error) {
      console.error(error);
      alert("Error updating profile");
    } finally {
      setLoading(false);
    }
  };

  // Trigger file input when edit icon is clicked
  const handleEditIconClick = (e) => {
    e.stopPropagation(); // prevent any parent click (though none)
    fileInputRef.current.click();
  };

  // Upload profile image
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("profileImage", file);

    setUploading(true);
    try {
      const userId = user?._id || user?.id;
      const response = await axios.put(
        `http://localhost:3000/api/cleaner/${userId}/profile-image`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const updatedUser = { ...user, profileImage: response.data.profileImage };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      alert("Profile picture updated!");
    } catch (error) {
      console.error(error);
      alert("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  // Strong password validation (exactly 8 chars, uppercase, lowercase, digit, special)
  const validateStrongPassword = (password) => {
    if (password.length !== 8) return "Password must be exactly 8 characters long.";
    if (!/[A-Z]/.test(password)) return "Must contain at least one uppercase letter (A-Z).";
    if (!/[a-z]/.test(password)) return "Must contain at least one lowercase letter (a-z).";
    if (!/[0-9]/.test(password)) return "Must contain at least one digit (0-9).";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
      return "Must contain at least one special character (e.g., !@#$%^&*).";
    return null;
  };

  // Change password API call
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
      const userId = user?.id || user?._id;
      await axios.put(`http://localhost:3000/api/users/${userId}/change-password`, {
        currentPassword,
        newPassword,
      });
      setPasswordMessage("✅ Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage(err.response?.data?.message || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>👤 My Profile</h2>

        {/* Profile Image – click only on edit icon to change */}
        <div className={styles.imageWrapper}>
          {user.profileImage ? (
            <img
              src={`http://localhost:3000/${user.profileImage}`}
              alt="profile"
              className={styles.profileImage}
            />
          ) : (
            <div className={styles.placeholderImage}>📷</div>
          )}
          <div className={styles.editIcon} onClick={handleEditIconClick}>
            <i className="fas fa-pencil-alt"></i>
          </div>
          {uploading && <div className={styles.uploadOverlay}>Uploading...</div>}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className={styles.hiddenFileInput}
          accept="image/*"
          onChange={handleFileChange}
        />
        <p className={styles.clickHint}>Click the pencil icon to change profile picture</p>

        {/* Profile fields */}
        <div className={styles.field}>
          <label className={styles.label}>Username</label>
          <input
            name="username"
            value={user.username || ""}
            onChange={handleChange}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            name="email"
            value={user.email || ""}
            onChange={handleChange}
            className={styles.input}
            type="email"
          />
          <small className={styles.note}>Password will remain same if email changed</small>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Phone</label>
          <input
            name="phone"
            value={user.phone || ""}
            onChange={handleChange}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Address</label>
          <input
            name="address"
            value={user.address || ""}
            onChange={handleChange}
            className={styles.input}
          />
        </div>

        <button onClick={saveProfile} className={styles.button} disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </button>

        {/* Password change section */}
        {/* Password change section */}
<div className={styles.passwordSection}>
  <h3 className={styles.passwordTitle}>Change Password</h3>

  {/* Current Password */}
  <div style={{ position: "relative", width: "100%" }}>
    <input
      type={showCurrentPassword ? "text" : "password"}
      placeholder="Current Password"
      value={currentPassword}
      onChange={(e) => setCurrentPassword(e.target.value)}
      className={styles.input}
      style={{
        width: "100%",
        paddingRight: "40px",
        boxSizing: "border-box",
      }}
    />

    <span
      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
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
      {showCurrentPassword ? (
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

  {/* New Password */}
  <div style={{ position: "relative", width: "100%", marginTop: "10px" }}>
    <input
      type={showNewPassword ? "text" : "password"}
      placeholder="New Password (exactly 8 chars, with uppercase, lowercase, digit, special)"
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
      className={styles.input}
      style={{
        width: "100%",
        paddingRight: "40px",
        boxSizing: "border-box",
      }}
    />

    <span
      onClick={() => setShowNewPassword(!showNewPassword)}
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
      {showNewPassword ? (
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

  {/* Confirm New Password */}
  <div style={{ position: "relative", width: "100%", marginTop: "10px" }}>
    <input
      type={showConfirmPassword ? "text" : "password"}
      placeholder="Confirm New Password"
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      className={styles.input}
      style={{
        width: "100%",
        paddingRight: "40px",
        boxSizing: "border-box",
      }}
    />

    <span
      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
      {showConfirmPassword ? (
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

  <button
    onClick={handleChangePassword}
    className={styles.passwordButton}
    disabled={passwordLoading}
  >
    {passwordLoading ? "Updating..." : "Update Password"}
  </button>

  {passwordMessage && (
    <div className={styles.passwordMessage}>
      {passwordMessage}
    </div>
  )}
</div>
      </div>
    </div>
  );
};

export default CleanerProfile;
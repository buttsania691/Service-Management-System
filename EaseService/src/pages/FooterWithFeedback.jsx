import React, { useState, useEffect } from "react";
import axios from "axios";
import StarRating from "./StarRating";
import styles from "./FooterWithFeedback.module.css";

const FooterWithFeedback = ({ userId, onReviewSubmitted }) => {
  const [cleaners, setCleaners] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedCleaner, setSelectedCleaner] = useState("");
  const [selectedBooking, setSelectedBooking] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const isLoggedIn = !!userId;
const handleBookingChange = (e) => {
  setSelectedBooking(e.target.value);
};
useEffect(() => {
    if (!isLoggedIn) return;
    axios
      .get(`http://localhost:3000/booking/${userId}`)
      .then((res) => {
        const allBookings = res.data.bookings || [];
        const completed = allBookings.filter(
          (b) => b.bookingStatus === "Completed" && b.assignedCleaner
        );
        setBookings(completed);

        // Auto-select first booking and its cleaner
        if (completed.length > 0) {
          const first = completed[0];
          setSelectedBooking(first._id);
          const cleanerId = first.assignedCleaner._id || first.assignedCleaner;
          setSelectedCleaner(String(cleanerId));
        }
      })
      .catch((err) => console.log(err));
  }, [userId, isLoggedIn]);

useEffect(() => {
    axios
      .get("http://localhost:3000/cleaners")
      .then((res) => setCleaners(res.data.cleaners))
      .catch((err) => console.log(err));
  }, []);

const handleCleanerChange = (e) => {
  const cleanerId = e.target.value;
  setSelectedCleaner(cleanerId);

  const cleanerBookings = bookings.filter((b) => {
    const id = b.assignedCleaner._id || b.assignedCleaner;
    return String(id) === cleanerId;
  });

  if (cleanerBookings.length > 0) {
    setSelectedBooking(cleanerBookings[0]._id);
  } else {
    setSelectedBooking("");
  }
};

const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCleaner || rating === 0 || !comment.trim()) {
      setMessage("Please select a cleaner, give a rating, and write a comment.");
      setIsSuccess(false);
      return;
    }
    if (!selectedBooking) {
      setMessage("No completed booking found for this cleaner.");
      setIsSuccess(false);
      return;
    }
    try {
      await axios.post("http://localhost:3000/api/reviews", {
        userId,
        cleanerId: selectedCleaner,
        bookingId: selectedBooking,
        rating,
        comment,
      });
      setMessage("Thank you for your feedback!");
      setIsSuccess(true);
      setRating(0);
      setComment("");
      setSelectedCleaner("");
      setSelectedBooking("");
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err) {
      setMessage("Failed to submit review. " + (err.response?.data?.message || ""));
      setIsSuccess(false);
    }
};

  return (
    <footer className={styles.footer}>
      <div className={styles.feedbackSection}>
        <h3>Provide Your Feedback</h3>
        {!isLoggedIn ? (
          <p style={{ textAlign: "center", color: "#ffaa00" }}>
            Please login to leave a review.
          </p>
        ) : bookings.length === 0 ? (
          <p style={{ textAlign: "center", color: "#ffaa00" }}>
            You don't have any completed bookings yet. Once a job is finished, you can review the cleaner.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className={styles.feedbackForm}>

            {/* Cleaner select only */}
            <select
              value={selectedCleaner}
              onChange={handleCleanerChange}
              required
            >
              <option value="">Select Cleaner</option>
              {cleaners
                .filter((c) =>
                  bookings.some((b) => {
                    const id = b.assignedCleaner._id || b.assignedCleaner;
                    return String(id) === String(c._id);
                  })
                )
                .map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.username} ({c.cleanerType})
                  </option>
                ))}
            </select>
             {/* Booking Select */}
<select
  value={selectedBooking}
  onChange={handleBookingChange}
  required
>
  <option value="">Select Booking</option>

  {bookings
    .filter((b) => {
      const id = b.assignedCleaner._id || b.assignedCleaner;
      return String(id) === String(selectedCleaner);
    })
    .map((booking) => (
      <option key={booking._id} value={booking._id}>
        {booking.serviceName} - {booking.formattedDate || booking.date}
      </option>
    ))}
</select>
            <StarRating rating={rating} setRating={setRating} />

            <textarea
              placeholder="Write your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="3"
              required
            />

            <button type="submit">Submit Review</button>

            {message && (
              <p
                className={styles.feedbackMessage}
                style={{ color: isSuccess ? "#16a34a" : "#dc2626" }}
              >
                {message}
              </p>
            )}
          </form>
        )}
      </div>

      <div className={styles.footerGrid}>
        <div>
          <h4>Services</h4>
          <p>Room Cleaning</p>
          <p>kitcen Cleaning</p>
          <p>Bathroom Cleaning</p>
          <p>Garden Cleaning</p>
        </div>
        <div className={styles.footerLinks}>
          <h4>Company</h4>
          <a href="http://localhost:5173/">Service</a>
          <a href="http://localhost:5173/About">About Us</a>
          <a href="http://localhost:5173/HowItWorks">How it works</a>
        </div>
        <div>
          <h4>Contact</h4>
          <p>+92 246550897</p>
          <p>EaseService@gmail.com</p>
        </div>
      </div>
      <p className={styles.copyright}>© EaseService - All Rights Reserved</p>
    </footer>
  );
};

export default FooterWithFeedback;

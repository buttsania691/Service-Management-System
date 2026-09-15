import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import styles from "./PublicReviews.module.css";

// ✅ Socket connection
const socket = io("http://localhost:3000");

const PublicReviews = ({ refreshTrigger }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(() => {
    axios
      .get("http://localhost:3000/api/reviews/public")
      .then((res) => {
        setReviews(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.log(err);
        setLoading(false);
      });
  }, []);

  // Pehli baar + jab bhi refreshTrigger change ho
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews, refreshTrigger]);

  // ✅ Socket se real-time review update — refresh nahi karna
  useEffect(() => {
    socket.on("reviewAdded", () => {
      fetchReviews();
    });

    socket.on("reviewDeleted", () => {
      fetchReviews();
    });

    return () => {
      socket.off("reviewAdded");
      socket.off("reviewDeleted");
    };
  }, [fetchReviews]);

  return (
    <div className={styles.publicReviews}>
      <h2>What Our Customers Say</h2>

      {loading ? (
        <p className={styles.loadingText}>Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className={styles.noReviews}>No reviews yet.</p>
      ) : (
        <div className={styles.reviewsGrid}>
          {reviews.map((rev) => (
            <div key={rev._id} className={styles.reviewCard}>
              <div className={styles.reviewCardHeader}>
                {rev.cleanerId?.profileImage ? (
                  <img
                    src={`http://localhost:3000/${rev.cleanerId.profileImage}`}
                    alt={rev.cleanerId.username}
                    className={styles.cleanerPhoto}
                  />
                ) : (
                  <div className={styles.cleanerPhotoPlaceholder}>🧹</div>
                )}
                <div className={styles.cleanerInfo}>
                  <h4 className={styles.cleanerName}>{rev.cleanerId?.username}</h4>
                  <span className={styles.cleanerType}>{rev.cleanerId?.cleanerType}</span>
                </div>
              </div>
              <div className={styles.rating}>{"★".repeat(rev.rating)}</div>
              <p className={styles.comment}>"{rev.comment}"</p>
              <small className={styles.customerName}>– {rev.userId?.username}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PublicReviews;
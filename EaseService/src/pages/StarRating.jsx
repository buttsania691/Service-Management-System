import React from "react";
import styles from "./StarRating.module.css";

const StarRating = ({ rating, setRating }) => {
  const handleClick = (value) => {
    setRating(value);
  };
  return (
    <div className={styles.starRating}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`${styles.star} ${star <= rating ? styles.filled : ""}`}
          onClick={() => handleClick(star)}
        >
          ★
        </span>
      ))}
    </div>
  );
};

export default StarRating;
import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./HowItWorks.module.css";
import Navbar from "./Navbar";
import FooterWithFeedback from "./FooterWithFeedback";
import PublicReviews from "./PublicReviews";

const HowItWorks = () => {
  const navigate = useNavigate();

  // Get logged-in user from localStorage
  const loggedInUser = JSON.parse(localStorage.getItem("user"));
  const userId = loggedInUser?._id || loggedInUser?.id || null;

  // Array of steps to display in timeline
  const steps = [
    "Choose Service",
    "Go to Checkout",
    "Booking Information",
    "Login / Sign Up",
    "Enter Details",
    "Make Payment",
    "Manage in Dashboard",
  ];

  return (
    <>
      {/* Navbar Component */}
      <Navbar loggedInUser={loggedInUser} />

      {/* Hero Section */}
      <section className={styles.howHero}>
        <h1>How It Works</h1>
        <p>Simple steps to book your service</p>
      </section>

      {/* Timeline / Steps Section */}
      <section className={styles.howContainer}>
        <div className={styles.timeline}>
          {steps.map((step, index) => (
            <div className={styles.timelineItem} key={index}>
              <div className={styles.circle}>{index + 1}</div>
              <div className={styles.content}>
                <h3>{step}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews & Footer */}
      <PublicReviews />
      <FooterWithFeedback userId={userId} />
    </>
  );
};

export default HowItWorks;
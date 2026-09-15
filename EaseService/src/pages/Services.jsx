import React, { useState, useEffect } from "react";
import styles from "./Services.module.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import Navbar from "./Navbar";
import FooterWithFeedback from "./FooterWithFeedback";
import PublicReviews from "./PublicReviews";

const socket = io("http://localhost:3000");

const Services = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0);

  const loggedInUser = JSON.parse(localStorage.getItem("user"));
  const userId = loggedInUser?._id || loggedInUser?.id || null;

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:3000/");
      setServices(res.data.services || []);
      setError(null);
    } catch (err) {
      console.error("API Error:", err);
      setError("Failed to load services. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    socket.on("serviceUpdated", fetchServices);
    socket.on("serviceDeleted", fetchServices);
    return () => {
      socket.off("serviceUpdated", fetchServices);
      socket.off("serviceDeleted", fetchServices);
    };
  }, []);

  const handleReviewSubmitted = () => {
    setReviewRefreshTrigger((prev) => prev + 1);
  };

  return (
    <>
      <Navbar loggedInUser={loggedInUser} />

      {/* ===== HERO SECTION ===== */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay}>
          <div className={styles.heroContent}>
            <h1>Your Trusted Home Services Partner</h1>
            <p>Professional cleaning & maintenance at your doorstep</p>
            <div className={styles.heroButtons}>
              <button onClick={() => navigate("/about")}>About Us</button>
              <button className={styles.outline} onClick={() => navigate("/HowitWorks")}>
                How It Works
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SERVICES SECTION ===== */}
      <section className={styles.servicesSection}>
        <div className={styles.container}>
          <h2>Our Premium Services</h2>

          {loading && (
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner}></div>
              <p>Loading...</p>
            </div>
          )}

          {error && <div className={styles.errorMessage}>{error}</div>}

          {!loading && !error && services.length === 0 && (
            <h2 className={styles.noServices}>No Services Available</h2>
          )}

          {!loading && !error && services.length > 0 && (
            <div className={styles.servicesGrid}>
              {services.map((item) => (
                <div className={styles.card} key={item._id}>
                  <div className={styles.cardIcon}>
                    <i className={`fa-solid ${item.Icons?.trim() || "fa-broom"}`}></i>
                  </div>
                  <h3>{item.Name}</h3>
                  <p className={styles.description}>{item.Description}</p>
                  <p className={styles.price}>
                    Starting from <span>{item.Price} PKR</span>
                  </p>
                  <button
                    onClick={() =>
                      navigate("/Checkout", {
                        state: {
                          serviceName: item.Name,
                          servicePrice: item.Price,
                        },
                      })
                    }
                  >
                    Book Service
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <PublicReviews refreshTrigger={reviewRefreshTrigger} />
      <FooterWithFeedback userId={userId} onReviewSubmitted={handleReviewSubmitted} />
    </>
  );
};

export default Services;
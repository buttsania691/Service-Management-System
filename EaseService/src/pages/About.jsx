import React from "react";
import styles from "./About.module.css";
import Navbar from "./Navbar";
import FooterWithFeedback from "./FooterWithFeedback";
import PublicReviews from "./PublicReviews";

const About = () => {
  // Get logged-in user from localStorage
  const loggedInUser = JSON.parse(localStorage.getItem("user"));
  const userId = loggedInUser?._id || loggedInUser?.id || null;

  // List of 8 services
 const servicesList = [
  { icon: "fas fa-bed", name: "Room Cleaning" },
  { icon: "fas fa-toilet", name: "Bathroom Cleaning" },
  { icon: "fas fa-utensils", name: "Kitchen Cleaning" },
  { icon: "fas fa-bolt", name: "Electrician Services" },
  { icon: "fas fa-tools", name: "Handyman Services" },
  { icon: "fas fa-wrench", name: "Plumber Services" },
  { icon: "fas fa-tshirt", name: "Cloth Washing" },
  { icon: "fas fa-temperature-low", name: "Fridge Cleaning" },
];

  // Why Choose Us features
  const features = [
    { icon: "fas fa-clock", title: "On-Time Service", desc: "Punctual & respectful of your time" },
    { icon: "fas fa-shield-alt", title: "Fully Insured", desc: "Your home is protected" },
    { icon: "fas fa-leaf", title: "Eco-Friendly", desc: "Safe products for your family" },
    { icon: "fas fa-smile", title: "Satisfaction Guaranteed", desc: "We won't leave until you're happy" },
  ];

  // Stats (without earnings)
  const stats = [
    { number: "50+", label: "Expert Cleaners" },
    { number: "98%", label: "Satisfied Customers" },
    { number: "24/7", label: "Support" },
  ];

  return (
    <>
      <Navbar loggedInUser={loggedInUser} />

      {/* ===== HERO / INTRO SECTION ===== */}
      <section className={styles.heroSection}>
        <div className={styles.heroOverlay}>
          <div className={styles.heroContent}>
            <h1>About EaseService</h1>
            <p>Your trusted partner for a cleaner, healthier home</p>
          </div>
        </div>
      </section>

      {/* ===== COMPANY STORY ===== */}
      <section className={styles.storySection}>
        <div className={styles.container}>
          <h2>Our Story</h2>
          <p>
            Founded in 2020, EaseService began with a simple mission: to make professional
            home cleaning accessible, reliable, and hassle-free. What started as a small team
            of passionate cleaners has grown into a trusted network of over 50 certified
            professionals serving hundreds of happy families.
          </p>
          <p>
            We believe a clean home is a happy home. That's why we use only eco-friendly
            products, background-checked cleaners, and offer a 100% satisfaction guarantee
            on every booking.
          </p>
        </div>
      </section>

      {/* ===== MISSION & VISION ===== */}
      <section className={styles.missionVision}>
        <div className={styles.container}>
          <div className={styles.missionCard}>
            <i className="fas fa-bullseye"></i>
            <h3>Our Mission</h3>
            <p>To deliver exceptional cleaning services that give you more time to enjoy what matters most.</p>
          </div>
          <div className={styles.visionCard}>
            <i className="fas fa-eye"></i>
            <h3>Our Vision</h3>
            <p>To become Pakistan's most trusted home services platform, known for quality, integrity, and care.</p>
          </div>
        </div>
      </section>

      {/* ===== STATS SECTION ===== */}
      <section className={styles.statsSection}>
        <div className={styles.container}>
          {stats.map((stat, index) => (
            <div key={index} className={styles.statItem}>
              <h3>{stat.number}</h3>
              <p>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== WHY CHOOSE US ===== */}
      <section className={styles.featuresSection}>
        <div className={styles.container}>
          <h2>Why Choose EaseService?</h2>
          <div className={styles.featuresGrid}>
            {features.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <i className={feature.icon}></i>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SERVICES GRID (8 services) ===== */}
      <section className={styles.servicesSection}>
        <div className={styles.container}>
          <h2>Our Professional Services</h2>
          <div className={styles.servicesContainer}>
            <div className={styles.servicesImage}></div>
            <div className={styles.servicesRightBox}>
              <div className={styles.servicesGrid}>
                {servicesList.map((service, index) => (
                  <div key={index} className={styles.serviceItem}>
                    <i className={service.icon}></i>
                    <p>{service.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicReviews />
      <FooterWithFeedback userId={userId} />
    </>
  );
};

export default About;
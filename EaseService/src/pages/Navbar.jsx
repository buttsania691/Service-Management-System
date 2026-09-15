import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Navbar.module.css";

const Navbar = ({ loggedInUser }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNavigation = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.logo}>EaseService</div>

      {/* Mobile Menu Toggle */}
      <button
        className={styles.menuToggle}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* Navigation Links & Buttons */}
      <div className={`${styles.navContainer} ${menuOpen ? styles.active : ""}`}>
        <button
          className={styles.closeMenu}
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          ✕
        </button>

        <nav className={styles.nav}>
          <a href="/" onClick={(e) => { e.preventDefault(); handleNavigation("/"); }}>
            Services
          </a>
          <a href="/about" onClick={(e) => { e.preventDefault(); handleNavigation("/about"); }}>
            About Us
          </a>
          <a href="/HowItWorks" onClick={(e) => { e.preventDefault(); handleNavigation("/HowItWorks"); }}>
            How It Works
          </a>
        </nav>

        <button
          className={styles.becomeCleanerBtn}
          onClick={() => handleNavigation("/become-cleaner")}
        >
          Become a Cleaner
        </button>

        {loggedInUser ? (
          <button
            className={styles.loginBtn}
            onClick={() => {
              if (loggedInUser.role === "admin") handleNavigation("/admin");
              else if (loggedInUser.role === "cleaner") handleNavigation("/cleaner");
              else handleNavigation("/user");
            }}
          >
            My Account
          </button>
        ) : (
          <button
            className={styles.loginBtn}
            onClick={() => handleNavigation("/login")}
          >
            Login
          </button>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className={styles.menuOverlay} onClick={() => setMenuOpen(false)} />
      )}
    </header>
  );
};

export default Navbar;
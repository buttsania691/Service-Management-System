import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import styles from "./PaymentSuccess.module.css";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasRun = useRef(false);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(5);

  const startRedirect = () => {
    let c = 5;
    setCountdown(c);
    const interval = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(interval);
        navigate("/user");
      }
    }, 1000);
  };

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setMessage("Payment session not found. Please contact support.");
      return;
    }

    const STORAGE_KEY = `payment_result_${sessionId}`;
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      const { savedStatus, savedMessage } = JSON.parse(cached);
      setStatus(savedStatus);
      setMessage(savedMessage);
      if (savedStatus === "success") startRedirect();
      return;
    }

    axios
      .post("http://localhost:3000/verify-payment", { sessionId })
      .then(() => {
        const savedMessage =
          "Your payment was received and your booking has been placed successfully.";
        setStatus("success");
        setMessage(savedMessage);
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ savedStatus: "success", savedMessage })
        );
        startRedirect();
      })
      .catch((error) => {
        const savedMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          "We could not verify your payment. If the amount was deducted, please contact support.";
        setStatus("error");
        setMessage(savedMessage);
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ savedStatus: "error", savedMessage })
        );
      });
  }, [searchParams]);

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>

        {status === "loading" && (
          <>
            <div className={styles.spinner}></div>
            <h2 className={styles.title}>Verifying payment</h2>
            <p className={styles.subtitle}>
              Please wait while we confirm your booking.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className={styles.iconRingSuccess}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 className={styles.title}>Booking confirmed</h2>
            <p className={styles.subtitle}>{message}</p>

            <div className={styles.badge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Payment successful
            </div>

            <hr className={styles.divider} />

            <div className={styles.actions}>
              <button className={styles.btnPrimary} onClick={() => navigate("/user")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Go to dashboard
              </button>
              <button className={styles.btnSecondary} onClick={() => navigate("/user")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                View booking
              </button>
            </div>

            <p className={styles.countdown}>
              Redirecting in <strong>{countdown}</strong> second{countdown !== 1 ? "s" : ""}...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className={styles.iconRingError}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>

            <h2 className={styles.title}>Verification failed</h2>
            <p className={styles.subtitle}>{message}</p>

            <hr className={styles.divider} />

            <div className={styles.actions}>
              <button className={styles.btnPrimary} onClick={() => navigate("/")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Back to home
              </button>
              <button className={styles.btnSecondary} onClick={() => navigate("/user")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Go to dashboard
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default PaymentSuccess;

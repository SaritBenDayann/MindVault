import { useNavigate } from "react-router-dom";
import styles from "./NotFoundPage.module.css";
import logo from "../assets/mindvault-logo.png";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <img src={logo} alt="MindVault Logo" className={styles.logoImage} />
          </div>
          <div className={styles.logoTextContainer}>
            <span className={styles.logoText}>MindVault</span>
            <span className={styles.logoTagline}>Cybersecurity Starts Here</span>
          </div>
        </div>
        <h1 className={styles.title}>404</h1>
        <h2 className={styles.subtitle}>Page Not Found</h2>
        <p className={styles.description}>Sorry, the page you're looking for doesn't exist.</p>
        <button className={styles.button} onClick={() => navigate("/login")}>
          Go to Login
        </button>
      </div>
    </div>
  );
}

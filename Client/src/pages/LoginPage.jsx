import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { loginUser } from "../services/api";
import { generateMasterKey, exportKeyToBase64 } from "../utils/CryptoUtils";
import styles from "./LoginPage.module.css";
import logo from "../assets/mindvault-logo.png";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); 
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
    }
  }, [location.state]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const { token } = await loginUser(email, password);

      const aesKey = await generateMasterKey(password, email);
      const keyBase64 = await exportKeyToBase64(aesKey);
      sessionStorage.setItem("masterKey", keyBase64);
      sessionStorage.setItem("userEmail", email);
      sessionStorage.setItem("authToken", token);

      navigate("/main");
      console.log("Navigating to dashboard...");
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 404) {
        setError("Invalid email or password. Please check your credentials and try again.");
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const demoEmail = "demo@mindvault.com";
      const demoPassword = "DemoPassword123!";

      const { token } = await loginUser(demoEmail, demoPassword);
      const aesKey = await generateMasterKey(demoPassword, demoEmail);
      const keyBase64 = await exportKeyToBase64(aesKey);
      sessionStorage.setItem("masterKey", keyBase64);
      sessionStorage.setItem("userEmail", demoEmail);
      sessionStorage.setItem("authToken", token);
      navigate("/main");
    } catch (err) {
      setError(
        "Demo user not found. Please register demo@mindvault.com once, then use the Demo button."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleLogin}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <img src={logo} alt="MindVault Logo" className={styles.logoImage} />
          </div>
          <div className={styles.logoTextContainer}>
            <span className={styles.logoText}>MindVault</span>
            <span className={styles.logoTagline}>Cybersecurity Starts Here</span>
          </div>
        </div>
        <h2 className={styles.heading}>Login to Your Account</h2>
        {error && <p className={styles.error}>{error}</p>}
        <input
          type="email"
          placeholder="Enter Your Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={styles.input}
        />

        <input
          type="password"
          placeholder="Enter Your Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={styles.input}
        />

        <div className={styles.actionRow}>
            <span className={styles.link} onClick={() => navigate("/forgot-password")}>
                Forgot your password?
            </span>
            <span className={styles.link} onClick={handleLogin}>
                {loading ? "Logging in..." : "Login"}
            </span>
        </div>

        <div className={styles.demoSection}>
          <div className={styles.divider}>
            <span className={styles.dividerText}>or</span>
          </div>
          <button 
            type="button" 
            className={styles.demoButton} 
            onClick={handleDemoLogin}
            disabled={loading}
          >
            DEMO
          </button>
          <p className={styles.demoText}>
            Quick access with demo@mindvault.com
          </p>
        </div>

        <p className={styles.toggleText}>
          Don't have an account?{" "}
          <span className={styles.link} onClick={() => navigate("/register")}>
            Register
          </span>
        </p>

        {<button type="submit" style={{ display: "none" }}></button>}
      </form>
    </div>
  );
}

import { useState } from "react";
import styles from "./RegisterPage.module.css";
import { useNavigate } from "react-router-dom";
import {
  generateMasterKey,
  exportKeyToBase64
} from "../utils/CryptoUtils";
import API from "../services/api";
import logo from "../assets/mindvault-logo.png";
import bcrypt from "bcryptjs";


function generateRandomPassword(length = 32) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    return password;
  }
  
function isValidEmail(email) {
  return email.includes("@");
}
  
function isValidPassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  return regex.test(password);
}
  
export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !accountPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Invalid email - must contain '@'");
      return;
    }
    
    if (!isValidPassword(accountPassword)) {
      setError("Password must contain at least 8 characters, uppercase, lowercase, number, and special character.");
      return;
    }

    setLoading(true);
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(accountPassword, salt);

    try {
      const res = await API.post("/auth/register", {
        email,
        password: hashedPassword,
        salt,
      });

      if (res.status === 201) {
        const randomVaultPassword = generateRandomPassword();
        const key = await generateMasterKey(randomVaultPassword, email);
        const base64Key = await exportKeyToBase64(key);
  

        sessionStorage.setItem("masterKey", base64Key);

        navigate("/login");
      }
    } catch (err) {
        console.log("Registration error:", err.response?.data);
        setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
        <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.logo}>
              <div className={styles.logoIcon}>
                <img src={logo} alt="MindVault Logo" className={styles.logoImage} />
              </div>
              <div className={styles.logoTextContainer}>
                <span className={styles.logoText}>MindVault</span>
                <span className={styles.logoTagline}>Cybersecurity Starts Here</span>
              </div>
            </div>
            <h2 className={styles.heading}>Create Your Account</h2>

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
            placeholder="Enter Your Account Password"
            value={accountPassword}
            onChange={(e) => setAccountPassword(e.target.value)}
            required
            className={styles.input}
            />

            {error && (
              <div className={styles.errorWrapper}>
                <div className={styles.errorBubble}>{error}</div>
              </div>
            )}

            <div className={styles.actionRow}>
                <span className={styles.link} onClick={handleSubmit}>
                    {loading ? "Registering..." : "Register"}
                </span>
            </div>

            <p className={styles.toggleText}>
            Already have an account?{" "}
            <span className={styles.link} onClick={() => navigate("/login")}>
                Login
            </span>
        </p>
    </form>
</div>
  );
}

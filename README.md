# MindVault  
### _Secure Password Manager with Intelligent Breach Detection and Real-Time Monitoring_

MindVault is a **full-stack, end-to-end encrypted password manager** that combines security, intelligence, and usability.  
Built with **React (frontend)** and **Flask (backend)**, it provides users with secure credential storage, real-time breach detection, and machine learning–based tagging for seamless organization.

---

## Key Features

### Security & Encryption
- **AES-GCM client-side encryption**: Passwords are encrypted in the browser before being sent to the server.
- **PBKDF2-based Master Key**: Unique per user, derived from the master password and email.
- **No plaintext storage**: The server never sees or stores unencrypted passwords.
- **JWT Authentication**: Secure login and authorization tokens with 24-hour expiry.
- **bcrypt password hashing** for user credentials.

### Functionality
- **Password Vault** – Add, update, delete, and search encrypted credentials.
- **AI Tagging** – Automatic site categorization using TF-IDF + Logistic Regression trained model.
- **Breach Watch** – Check your passwords against known data breaches using [Have I Been Pwned](https://haveibeenpwned.com/).
- **Dashboard** – Overview of system status, breach statistics, and activity.
- **Audit Logs** – Real-time event monitoring (login, password updates, breach checks, etc.) via Socket.IO.

---

## System Architecture

### Frontend (React)
- Modular **JSX components** and **page routing**.
- State management via session storage.
- Secure communication with Flask backend (Axios + JWT).
- Real-time updates using Socket.IO.
  
### Backend (Flask)
- RESTful API structured via Blueprints (`auth`, `vault`, `breach`, `audit`).
- **MongoDB Atlas** for persistent storage.
- Machine Learning–driven tagging and search (TF-IDF).
- Asynchronous event broadcasting through Socket.IO.
- Integration with **HIBP Pwned Passwords API** for breach detection.

### Machine Learning Layer
- Trained model (Logistic Regression) using TF-IDF text vectorization.
- Automatically classifies sites into contextual tags.
- The model can be seamlessly retrained using train_classifier.py with a custom dataset to enhance classification accuracy and adaptability.
---
## BEYOND THE CODE

MindVault was not built as just another password manager — it was engineered as a **security mindset**.
Every component, from client-side encryption to real-time event streaming, was designed with one principle in mind:  
**"Protect what matters without compromising usability."**

The development process followed a structured and research-driven approach:

### Phase 1 – Foundation
We began by mapping out threat models and user pain points in existing password managers.  
The goal was clear — **create a zero-knowledge, self-contained security system** where sensitive data never leaves the user’s control.

### Phase 2 – Architecture & Design
Using **Flask** for scalability and **React** for responsiveness, we built a two-tier architecture with strict API boundaries.  
AES-GCM was chosen for encryption due to its proven security and performance.  
PBKDF2 was implemented for key derivation to resist brute-force attacks.  
Every request, token, and user action was measured against least-privilege principles.

### Phase 3 – Intelligence Layer
Security alone wasn’t enough — MindVault integrates **machine learning** to make management smarter, not just safer.  
A TF-IDF + Logistic Regression model analyzes website descriptions and auto-tags entries into meaningful categories.  
This allows users to **understand their security landscape** at a glance.

### Phase 4 – Real-Time Experience
Integrating **Socket.IO** transformed the system from static to dynamic — instant breach alerts, live audit trails, and continuous monitoring.  
This ensures users are not just storing data securely, but staying informed the moment something changes.

### Phase 5 – Validation & Testing
Rigorous validation was performed across:
- **Encryption integrity tests** (ensuring deterministic encryption/decryption).
- **API rate-limiting** and **token expiration** checks.
- **Cross-browser performance** to maintain consistent UX under encryption load.
- **Simulated breach environments** for stress-testing breach detection accuracy.

### Phase 6 – Continuous Evolution
MindVault is built for growth.  
Every service and route was modularized for maintainability — allowing future extensions such as **2FA**, **biometric login**, or **cross-device encrypted sync**.

---
## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React.js, Vite, Axios, TailwindCSS |
| Backend | Flask, Flask-SocketIO, PyMongo |
| Database | MongoDB Atlas |
| Security | JWT, bcrypt, AES-GCM, PBKDF2 |
| ML Model | scikit-learn (TF-IDF + Logistic Regression) |
| Breach API | Have I Been Pwned (k-Anonymity API) |

---

## Security Highlights

- **AES-GCM End-to-End Encryption** - All sensitive data encrypted client-side before transmission.  
- **Zero-Knowledge Architecture** - The server never stores or decrypts plaintext credentials.  
- **PBKDF2-based Master Key** - Derived from user email + password with unique static salt.  
- **bcrypt Hashing** - Secures authentication credentials at rest.  
- **JWT Authorization** - Signed tokens (HS256) with 24-hour expiration ensure secure sessions.  
- **Rate-Limited HIBP API Calls** - Prevents external abuse.  
- **Full Audit Trail** - Every login, update, or breach check is logged and timestamped in MongoDB.  

---

## Real-Time Monitoring

- **Flask-SocketIO Integration** - Enables instant bidirectional event streaming.  
- **Live Audit Feed** - User actions broadcast in real time to all connected clients.  
- **Instant Breach Alerts** - Notifications triggered immediately when compromised data is detected.  
- **Dynamic Dashboard Updates** - Breach statistics and activity charts refresh automatically.  
- **Continuous Tracking** - Each action (add, edit, delete) emits a monitored audit event.  

---

## Roadmap

- [ ] **Two-Factor Authentication (2FA)** – Add TOTP-based second-factor verification.  
- [ ] **Encrypted Vault Export / Import** – Allow secure offline backups.  
- [ ] **Dark Mode & Accessibility** – Improve UX and visual comfort.  
- [ ] **Docker Deployment** – Provide ready-to-use Docker Compose configuration.  
- [ ] **Password Generator** – Add advanced generator with entropy scoring.  

---

## License

This project is licensed under the **MIT License**.  
You are free to use, modify, and distribute this software under the same license terms.

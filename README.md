<p align="center">
  <img src="https://github.com/SaritBenDayann/MindVault/blob/main/Client/src/assets/MindVault-logo%20(2).png?raw=true" alt="MindVault Logo" width="300">
</p>

<h1 align="center">MindVault – Secure Password Manager</h1>

---

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
## Beyond The Code

From the very first line of code, **security wasn’t a feature - it was the foundation**.  
MindVault was engineered around a **security-first mindset**, where every architectural decision, API endpoint, and encryption method was shaped by the question:  
**“How can this be made safer without making it harder for the user?”**

The development process evolved through a deliberate sequence - each stage reinforcing security as a principle, not a patch:  
- **Designing the Core:** The project began with defining trust boundaries and zero-knowledge constraints - ensuring that no plaintext data ever touched the backend.  
- **Building the Architecture:** Flask and React were structured in strict isolation, with encrypted communication and authenticated state transitions.  
- **Securing Intelligence:** Even the machine learning components were designed to respect privacy - tagging data without ever exposing its content.  
- **Enabling Real-Time Transparency:** Socket.IO was introduced not just for interactivity, but to **empower users with visibility** - every login, breach check, or vault change is instantly auditable.  
- **Validating Integrity:** Testing wasn’t about finding bugs - it was about proving that the system could be trusted under pressure.  

MindVault’s journey reflects a belief that **security isn’t a layer you add - it’s a culture you build**. 
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
- [ ] **Advanced Cloud Deployment Infrastructure** - Enable fully automated, containerized, and scalable deployment to cloud environments.
- [ ] **Password Generator** – Add advanced generator with entropy scoring.  

---

## License

This project is licensed under the **MIT License**.  
You are free to use, modify, and distribute this software under the same license terms.

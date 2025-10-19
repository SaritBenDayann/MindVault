import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import MainScreen from "./pages/MainScreen";
import AuditLogPage from "./pages/AuditLogPage";
import BreachWatchPage from "./pages/BreachWatchPage";
import "./App.css";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    setIsAuthenticated(!!token);
  }, []);

  const ProtectedRoute = ({ children }) => {
    const token = sessionStorage.getItem("authToken");
    return token ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/main" /> : <Navigate to="/login" />
            }
          />

          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/main" /> : <LoginPage />
            }
          />

          <Route
            path="/register"
            element={
              isAuthenticated ? <Navigate to="/main" /> : <RegisterPage />
            }
          />

          <Route
            path="/main"
            element={
              <ProtectedRoute>
                <MainScreen />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-log"
            element={
              <ProtectedRoute>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/breach-watch"
            element={
              <ProtectedRoute>
                <BreachWatchPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>

      </div>
    </Router>
  );
}
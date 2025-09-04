/* Signup.jsx */
import React, { useState } from "react";
import "./Signup.css";
import googleLogo from "../assets/google.png";
import facebookLogo from "../assets/facebook.png";
import modelImage from "../assets/model1.png";

export default function SignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name || !form.email || !form.password || !form.confirm) {
      setError("Please fill out all fields.");
      return;
    }

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (!form.terms) {
      setError("Please accept the terms and conditions.");
      return;
    }

    // Replace this with real signup flow (API call / Firebase / Supabase, etc.)
    setSuccess("Account created — (demo). You can now log in.");
    console.log("Sign up data:", form);
    // reset form (optional)
    setForm({ name: "", email: "", password: "", confirm: "", terms: false });
  }

  return (
    <div className="login-container">
      <h1 className="logo">FITSENSE</h1>

      <div className="login-form-section">
        <h2 className="login-h2">Create Account</h2>
        <p className="welcome-text">Join Fitsense — create your account to get started</p>

        <form onSubmit={handleSubmit} className="signup-form">
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            name="name"
            className="login-input"
            type="text"
            placeholder="Enter your full name"
            value={form.name}
            onChange={handleChange}
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            className="login-input"
            type="email"
            placeholder="Enter your email"
            value={form.email}
            onChange={handleChange}
          />

          <label htmlFor="password">Password</label>
          <div className="password-wrapper">
            <input
              id="password"
              name="password"
              className="login-input"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
            />
            <span
              className="eye-icon"
              role="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => !s)}
            >
              {showPassword ? "🙈" : "👁"}
            </span>
          </div>

          <label htmlFor="confirm">Confirm Password</label>
          <input
            id="confirm"
            name="confirm"
            className="login-input"
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter your password"
            value={form.confirm}
            onChange={handleChange}
          />

          <div className="terms-row">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              checked={form.terms}
              onChange={handleChange}
            />
            <label htmlFor="terms" className="terms-label">
              I agree to the <u>terms and conditions</u>
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}

          <button className="login-btn" type="submit">
            Sign up
          </button>
        </form>

        <div className="divider">
          <span></span> or Continue With <span></span>
        </div>

        <div className="social-login">
          <button className="social-btn">
            <img src={googleLogo} alt="Google" /> Google
          </button>
          <button className="social-btn">
            <img src={facebookLogo} alt="Facebook" /> Facebook
          </button>
        </div>

        <p className="have-account">
          Already have an account? <a href="/login">Log in</a>
        </p>
      </div>

      <div className="login-image-section">
        <img src={modelImage} alt="Model" className="model-img" />
      </div>
    </div>
  );
}

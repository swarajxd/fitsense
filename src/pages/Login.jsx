import React from "react";
import "./Login.css";
import googleLogo from "../assets/google.png"; // Replace with your image path
import facebookLogo from "../assets/facebook.png"; // Replace with your image path
import modelImage from "../assets/model1.png"; // Replace with your image path

export default function LoginPage() {
  return (
    <div className="login-container">
        <h1 className="logo">FITSENSE</h1>
      {/* Left Side: Form */}
      <div className="login-form-section">
      
        <h2 className="login-h2">Log In</h2>
        <p className="welcome-text">Welcome back! Please enter your details</p>

        <label>Email</label>
        <input className="login-input" type="email" placeholder="Enter your email" />

        <label>Password</label>
        <div className="password-wrapper">
          <input className="login-input" type="password" placeholder="Enter your password" />
          <span className="eye-icon">👁</span>
        </div>

        <p className="forgot-password">forgot password?</p>

        <button className="login-btn">Log in</button>

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
      </div>

      {/* Right Side: Image */}
      <div className="login-image-section">
        <img src={modelImage} alt="Model" className="model-img" />
      </div>
    </div>
  );
}

// src/pages/Signup.jsx
import React, { useEffect, useState } from "react";
import "./Signup.css";
import googleLogo from "../assets/google.png";
import facebookLogo from "../assets/facebook.png";
import modelImage from "../assets/model1.png";
import { useSignUp } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";

export default function SignupPage() {
  const navigate = useNavigate();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
    terms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [socialLoading, setSocialLoading] = useState(null); // Track which social button is loading

  // Runtime check for Clerk configuration
  useEffect(() => {
    const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      console.warn("⚠️ VITE_CLERK_PUBLISHABLE_KEY is missing from environment variables!");
      setError("Authentication service is not properly configured.");
      return;
    }
    
    // Check if using development keys (they start with pk_test_)
    if (publishableKey.startsWith('pk_test_')) {
      console.warn("🔧 Clerk is running with development keys. Make sure to use production keys in production!");
    }
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!isLoaded) {
      setError("Authentication system is not ready yet.");
      return;
    }

    // Form validation
    if (!form.username.trim() || !form.email.trim() || !form.password || !form.confirm) {
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

    try {
      setLoading(true);

      // Create sign-up attempt with Clerk
      const result = await signUp.create({
        emailAddress: form.email.trim(),
        password: form.password,
        username: form.username.trim(),
      });

      console.log("Clerk signUp result:", result);

      if (result.status === "complete") {
        // Sign-up completed immediately (no verification needed)
        await setActive({ session: result.createdSessionId });
        setSuccess("Account created successfully! Redirecting...");
        setTimeout(() => navigate("/discover"), 1500);
      } else if (result.status === "missing_requirements") {
        // Handle email verification requirement
        if (result.unverifiedFields?.includes("email_address")) {
          // Send verification email
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setPendingVerification(true);
          setSuccess("Please check your email for a verification code to complete your account setup.");
        } else {
          setError("Additional information is required to complete sign-up.");
        }
      } else {
        // Other statuses like needs_email_verification
        setSuccess("Sign-up initiated! Please check your email to complete verification.");
        setPendingVerification(true);
      }
    } catch (err) {
      console.error("Sign up error:", err);
      
      // Handle specific Clerk errors
      if (err.errors && err.errors.length > 0) {
        const errorMessages = err.errors.map(error => error.longMessage || error.message).join(", ");
        setError(errorMessages);
      } else {
        setError(err.message || "Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail(e) {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setError("Please enter the verification code.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        setSuccess("Email verified! Account created successfully. Redirecting...");
        setTimeout(() => navigate("/discover"), 1500);
      } else {
        setError("Verification failed. Please check your code and try again.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      if (err.errors && err.errors.length > 0) {
        setError(err.errors[0].longMessage || err.errors[0].message);
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Handle OAuth sign-up with redirect
  async function handleOAuthSignUp(strategy) {
    if (!isLoaded) return;
    
    try {
      setSocialLoading(strategy);
      setError("");
      
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/discover",
        redirectUrlComplete: "/discover",
      });
    } catch (err) {
      console.error(`${strategy} sign up error:`, err);
      setError(err?.errors?.[0]?.message || err?.message || `${strategy} sign up failed`);
      setSocialLoading(null);
    }
  }

  // Alternative: Handle OAuth sign-up with popup
  async function handleOAuthSignUpPopup(strategy) {
    if (!isLoaded) return;
    
    try {
      setSocialLoading(strategy);
      setError("");
      
      const result = await signUp.authenticateWithPopup({
        strategy,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/discover");
      }
    } catch (err) {
      console.error(`${strategy} popup sign up error:`, err);
      setError(err?.errors?.[0]?.message || err?.message || `${strategy} sign up failed`);
    } finally {
      setSocialLoading(null);
    }
  }

  // Show verification form if pending
  if (pendingVerification) {
    return (
      <div className="login-container">
        <h1 className="logo">FITSENSE</h1>

        <div className="login-form-section">
          <h2 className="login-h2">Verify Your Email</h2>
          <p className="welcome-text">We've sent a verification code to {form.email}</p>

          <form onSubmit={handleVerifyEmail} className="signup-form">
            <label htmlFor="verificationCode">Verification Code</label>
            <input
              id="verificationCode"
              name="verificationCode"
              className="login-input"
              type="text"
              placeholder="Enter the 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />

            {error && <p className="form-error">{error}</p>}
            {success && <p className="form-success">{success}</p>}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify Email"}
            </button>
          </form>

          <p className="have-account" style={{ marginTop: '2rem' }}>
            <button 
              onClick={() => setPendingVerification(false)}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'inherit', 
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: 'inherit'
              }}
            >
              Back to Sign Up Form
            </button>
          </p>
        </div>

        <div className="login-image-section">
          <img src={modelImage} alt="Model" className="model-img" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <h1 className="logo">FITSENSE</h1>

      <div className="login-form-section">
        <h2 className="login-h2">Create Account</h2>
        <p className="welcome-text">Join Fitsense — create your account to get started</p>

        {/* Clerk captcha placeholder (Smart CAPTCHA) */}
        <div id="clerk-captcha" style={{ position: "relative", zIndex: 5 }} />

        <form onSubmit={handleSubmit} className="signup-form">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            className="login-input"
            type="text"
            placeholder="Pick a username"
            value={form.username}
            onChange={handleChange}
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            className="login-input"
            type="email"
            placeholder="Enter your email address"
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
            <button
              type="button"
              className="eye-icon"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => !s)}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
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

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div className="divider">
          <span></span> or Continue With <span></span>
        </div>

        <div className="social-login">
          {/* Direct Google OAuth - uses redirect by default */}
          <button 
            className="social-btn" 
            onClick={() => handleOAuthSignUp("oauth_google")}
            disabled={socialLoading !== null}
          >
            <img src={googleLogo} alt="Google" /> 
            {socialLoading === "oauth_google" ? "Connecting..." : "Continue with Google"}
          </button>

          {/* Direct Facebook OAuth - uses redirect by default */}
          

          {/* Alternative: Uncomment these to use popup instead of redirect
          <button 
            className="social-btn" 
            onClick={() => handleOAuthSignUpPopup("oauth_google")}
            disabled={socialLoading !== null}
          >
            <img src={googleLogo} alt="Google" /> 
            {socialLoading === "oauth_google" ? "Connecting..." : "Continue with Google (Popup)"}
          </button>

          <button 
            className="social-btn" 
            onClick={() => handleOAuthSignUpPopup("oauth_facebook")}
            disabled={socialLoading !== null}
          >
            <img src={facebookLogo} alt="Facebook" /> 
            {socialLoading === "oauth_facebook" ? "Connecting..." : "Continue with Facebook (Popup)"}
          </button>
          */}
        </div>

        <p className="have-account">
          Already have an account? <Link className="login-link" to="/login">Log in</Link>
        </p>
      </div>

      <div className="login-image-section">
        <img src={modelImage} alt="Model" className="model-img" />
      </div>
    </div>
  );
}
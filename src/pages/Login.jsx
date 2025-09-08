// src/pages/Login.jsx
import React, { useEffect, useState } from "react";
import "./Login.css";
import googleLogo from "../assets/google.png";
import facebookLogo from "../assets/facebook.png";
import modelImage from "../assets/model1.png";
import { useSignIn, SignInButton, useUser } from "@clerk/clerk-react";
import { useNavigate, Link } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useUser();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // If the user is already signed in (session exists) navigate to discover
  useEffect(() => {
    if (isSignedIn) navigate("/discover");
  }, [isSignedIn, navigate]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!isLoaded) return setError("Auth not ready yet. Try again shortly.");
    if (!form.identifier || !form.password) return setError("Please fill email/username and password.");

    try {
      setLoading(true);
      const attempt = await signIn.create({
        identifier: form.identifier,
        password: form.password,
      });

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        navigate("/discover");
      } else {
        // Example: "needs_second_factor" or "needs_verification"
        setError("Sign-in requires additional verification. Use the modal sign-in if needed.");
      }
    } catch (err) {
      console.error("Sign in error:", err);
      setError(err?.errors?.[0]?.message || err?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <h1 className="logo">FITSENSE</h1>

      <div className="login-form-section">
        <h2 className="login-h2">Log In</h2>
        <p className="welcome-text">Welcome back! Please enter your details</p>

        <label>Email or Username</label>
        <input
          className="login-input"
          type="text"
          name="identifier"
          placeholder="Enter email or username"
          value={form.identifier}
          onChange={handleChange}
        />

        <label>Password</label>
        <div className="password-wrapper">
          <input
            className="login-input"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Enter your password"
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

        <p className="forgot-password"><Link to="/forgot-password">forgot password?</Link></p>

        <button className="login-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "Signing in..." : "Log in"}
        </button>

        {error && <p className="form-error" style={{ marginTop: 10 }}>{error}</p>}

        <div className="divider">
          <span></span> or Continue With <span></span>
        </div>

        <div className="social-login">
          {/* opens Clerk modal where social providers are handled */}
          <SignInButton mode="modal">
            <button className="social-btn">
              <img src={googleLogo} alt="Google" /> Continue with Google
            </button>
          </SignInButton>

          <SignInButton mode="modal">
            <button className="social-btn">
              <img src={facebookLogo} alt="Facebook" /> Continue with Facebook
            </button>
          </SignInButton>
        </div>

        <p className="have-account">Need an account? <Link to="/signup">Sign up</Link></p>
      </div>

      <div className="login-image-section">
        <img src={modelImage} alt="Model" className="model-img" />
      </div>
    </div>
  );
}

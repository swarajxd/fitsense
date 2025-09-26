import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Top section with logo and description */}
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="logo-icon">F</span>
              <span className="logo-text">FITSENSE</span>
            </div>
            <p className="footer-description">
              Experience the best in fashion—exclusive styles and top-quality pieces that make you stand out
            </p>
          </div>
        </div>

        {/* Main footer content */}
        <div className="footer-content">
          <div className="footer-section">
            <h3 className="footer-title">KUWLO</h3>
            <ul className="footer-links">
              <li><a href="#about">About us</a></li>
              <li><a href="#store">Our Store</a></li>
              <li><a href="#career">Career</a></li>
              <li><a href="#reseller">Reseller</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h3 className="footer-title">SUPPORT</h3>
            <ul className="footer-links">
              <li><a href="#contact">Contact us</a></li>
              <li><a href="#return">Return Policy</a></li>
              <li><a href="#guarantee">Product Guarantee</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h3 className="footer-title">SOCIAL MEDIA</h3>
            <ul className="footer-links">
              <li><a href="#instagram">@kuwloagem</a></li>
              <li><a href="#tiktok">@kuwloagem</a></li>
              <li><a href="#facebook">kuwloagem</a></li>
              <li><a href="#phone">(0281) 234 5324</a></li>
            </ul>
          </div>
        </div>

        {/* Large brand text */}
        <div className="footer-brand-large">
          <span>FITSENSEEEEEEEEEEEEEE</span>
        </div>

        {/* Bottom section */}
        <div className="footer-bottom">
          <div className="footer-copyright">
            <span>© 2025 KUWLOAGEM Inc. All rights reserved</span>
          </div>
          <div className="footer-legal">
            <a href="#terms">Terms of Service</a>
            <a href="#privacy">Privacy Policy</a>
            <a href="#cookies">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
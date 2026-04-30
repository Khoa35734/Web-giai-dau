import React from 'react';
import logo from '../images/logo.png';
import '../styles/Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      {/* Top divider glow */}
      <div className="footer-glow-line" />

      <div className="footer-container">

        {/* Brand column */}
        <div className="footer-brand">
          <a href="/" aria-label="Trang chủ">
            <img src={logo} alt="E-Sports Đà Nẵng Logo" className="footer-logo" />
          </a>
          <p className="footer-brand-desc">
            Nền tảng tổ chức &amp; theo dõi giải đấu Esports hàng đầu tại Đà Nẵng.
            Kết nối cộng đồng game thủ — nơi đam mê gặp gỡ chiến thắng.
          </p>
          {/* Social icons */}
          <div className="footer-socials">
            <a href="https://www.facebook.com/svDUTEsports" target="_blank" rel="noopener noreferrer" className="social-btn" aria-label="Facebook">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
            </a>
            <a href="#" className="social-btn" aria-label="YouTube">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#0a0a1a" /></svg>
            </a>
            <a href="#" className="social-btn" aria-label="Discord">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
            </a>
            <a href="#" className="social-btn" aria-label="TikTok">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.29 6.29 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" /></svg>
            </a>
          </div>
        </div>

        {/* Nav links */}
        <div className="footer-col">
          <h4 className="footer-col-title">Điều hướng</h4>
          <ul className="footer-links">
            <li><a href="#">Trang chủ</a></li>
            <li><a href="https://www.facebook.com/svDUTEsports" target="_blank" rel="noopener noreferrer">Fanpage</a></li>
            <li><a href="#">Giới thiệu</a></li>
            <li><a href="#">Giải đấu</a></li>
            <li><a href="#">Đối tác</a></li>
            <li><a href="#">Liên hệ</a></li>
          </ul>
        </div>

        {/* Tournament links */}
        <div className="footer-col">
          <h4 className="footer-col-title">Giải đấu</h4>
          <ul className="footer-links">
            <li><a href="#">Liên Minh Huyền Thoại</a></li>
            <li><a href="#">VALORANT</a></li>
            <li><a href="#">Liên Quân Mobile</a></li>
            <li><a href="#">TFT</a></li>
          </ul>
        </div>

        {/* Contact info */}
        <div className="footer-col">
          <h4 className="footer-col-title">Liên hệ</h4>
          <ul className="footer-contact">
            <li>
              <span className="contact-icon">📍</span>
              <span>54 Nguyễn Lương Bằng, Liên Chiểu Đà Nẵng, Việt Nam</span>
            </li>
            <li>
              <span className="contact-icon">✉️</span>
              <span>43dutesport@gmail.com</span>
            </li>
            <li>
              <span className="contact-icon">📞</span>
              <span>+84 xxx xxx xxx</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <p className="footer-copy">
            &copy; {currentYear} <span className="copy-brand">CLB Thể thao điện tử DUT ESPORTS</span>. Tất cả quyền được bảo lưu.
          </p>
          <div className="footer-bottom-links">
            <a href="#">Chính sách bảo mật</a>
            <span className="separator">|</span>
            <a href="#">Điều khoản sử dụng</a>
            <span className="separator">|</span>
            <a href="#">Cookie</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

import React from 'react';
import '../styles/Header.css';
import logo from '../images/logo.png';

export default function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <a href="/" aria-label="Trang chủ">
            <img src={logo} alt="E-Sports Đà Nẵng Logo" className="logo-img" />
          </a>
        </div>

        <nav className="nav-menu">
          <a href="https://www.facebook.com/svDUTEsports" target="_blank" rel="noopener noreferrer" className="nav-link">FANPAGE</a>
          <a href="#" className="nav-link">GIỚI THIỆU</a>
          <a href="#" className="nav-link">ĐỐI TÁC</a>
          <a href="#" className="nav-link">GIẢI ĐẤU</a>
          <a href="#" className="nav-link">LIÊN HỆ</a>
        </nav>
      </div>
    </header>
  );
}

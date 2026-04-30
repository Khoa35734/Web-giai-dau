import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './components/HomePage'
import TournamentDetail from './components/TournamentDetail'
import Footer from './components/Footer'
import AdminDashboard from './components/admin/AdminDashboard'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang chủ */}
        <Route path="/" element={
          <div className="app">
            <Header />
            <HomePage />
            <Footer />
          </div>
        } />

        {/* Chi tiết giải đấu */}
        <Route path="/tournament/:id" element={
          <div className="app">
            <Header />
            <TournamentDetail />
            <Footer />
          </div>
        } />

        {/* Admin Dashboard - không có header/footer */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
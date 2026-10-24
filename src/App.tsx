import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import StudyMaterials from './pages/StudyMaterials'
import SchoolMaterials from './pages/SchoolMaterials'
import MCQPractice from './pages/MCQPractice'
import MockTests from './pages/MockTests'
import PreviousPapers from './pages/PreviousPapers'
import Login from './pages/Login'
import Register from './pages/Register'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/materials" element={<StudyMaterials />} />
            <Route path="/school-materials" element={<SchoolMaterials />} />
            <Route path="/practice" element={<MCQPractice />} />
            <Route path="/mock-tests" element={<MockTests />} />
            <Route path="/previous-papers" element={<PreviousPapers />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </main>
        <footer className="footer">
          <div className="footer-content">
            <p>© 2026 TNPSC Study Hub. Built with premium UI/UX design.</p>
            <p className="footer-note">Payment integration ready for future implementation</p>
          </div>
        </footer>
      </div>
    </Router>
  )
}

export default App

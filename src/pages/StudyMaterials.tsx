import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, ChevronRight, FileText, Clock } from 'lucide-react'
import './StudyMaterials.css'

const StudyMaterials = () => {
  const [selectedGroup, setSelectedGroup] = useState('group1')

  const groups = [
    { id: 'group1', name: 'TNPSC Group 1' },
    { id: 'group2', name: 'TNPSC Group 2' },
    { id: 'group2a', name: 'TNPSC Group 2A' },
    { id: 'group4', name: 'TNPSC Group 4' },
    { id: 'vao', name: 'VAO' },
  ]

  const subjects = [
    { id: 1, name: 'General Studies', chapters: 12, lessons: 45, time: '25 hrs' },
    { id: 2, name: 'History & Culture of Tamil Nadu', chapters: 8, lessons: 32, time: '18 hrs' },
    { id: 3, name: 'Geography of India & Tamil Nadu', chapters: 10, lessons: 28, time: '16 hrs' },
    { id: 4, name: 'Indian Polity & Constitution', chapters: 7, lessons: 24, time: '15 hrs' },
    { id: 5, name: 'Economy & Development', chapters: 6, lessons: 20, time: '12 hrs' },
    { id: 6, name: 'Science & Technology', chapters: 9, lessons: 26, time: '14 hrs' },
  ]

  return (
    <div className="materials">
      <div className="materials-container">
        <motion.div 
          className="materials-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="materials-title">
            <BookOpen size={32} />
            <span>Study <span className="gradient-text">Materials</span></span>
          </h1>
          <p className="materials-subtitle">
            Comprehensive lesson-wise materials for all TNPSC Group Exams
          </p>
        </motion.div>

        <motion.div 
          className="group-tabs glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {groups.map((group) => (
            <button
              key={group.id}
              className={`group-tab ${selectedGroup === group.id ? 'active' : ''}`}
              onClick={() => setSelectedGroup(group.id)}
            >
              {group.name}
            </button>
          ))}
        </motion.div>

        <div className="subjects-grid">
          {subjects.map((subject, index) => (
            <motion.div
              key={subject.id}
              className="subject-card glass"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              whileHover={{ scale: 1.02, y: -5 }}
            >
              <div className="subject-header">
                <div className="subject-icon">
                  <FileText size={28} />
                </div>
                <h3 className="subject-name">{subject.name}</h3>
              </div>
              <div className="subject-stats">
                <div className="subject-stat">
                  <span className="stat-number">{subject.chapters}</span>
                  <span className="stat-label">Chapters</span>
                </div>
                <div className="subject-stat">
                  <span className="stat-number">{subject.lessons}</span>
                  <span className="stat-label">Lessons</span>
                </div>
                <div className="subject-stat">
                  <Clock size={16} />
                  <span className="stat-label">{subject.time}</span>
                </div>
              </div>
              <button className="subject-btn" onClick={() => window.location.href = '/school-materials'}>
                <span>View Lessons</span>
                <ChevronRight size={18} />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default StudyMaterials

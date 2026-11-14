import { motion } from 'framer-motion'
import StudentAuthForm from '../components/StudentAuthForm'
import './Auth.css'

const Register = () => {
  return (
    <div className="auth">
      <div className="auth-container">
        <motion.div
          className="auth-card glass"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <StudentAuthForm initialMode="register" variant="page" />
        </motion.div>
      </div>
    </div>
  )
}

export default Register

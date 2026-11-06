import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Mail,
  User,
  Phone,
  Lock,
  CreditCard,
  CheckCircle,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import './QuickNewStudentModal.css';

interface QuickNewStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onSuccess?: () => void;
}

const TN_DISTRICTS_LIST = [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
  'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur',
  'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris',
  'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga',
  'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
  'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore',
  'Viluppuram', 'Virudhunagar'
];

export const QuickNewStudentModal: React.FC<QuickNewStudentModalProps> = ({
  isOpen,
  onClose,
  token,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [targetGroup, setTargetGroup] = useState('group4');
  const [district, setDistrict] = useState('Chennai');
  const [city, setCity] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState('free');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdStudent, setCreatedStudent] = useState<{
    fullName: string;
    email: string;
    tempPass: string;
    district: string;
    tier: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await apiFetch('/api/student/admin/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName,
          email,
          mobile,
          password: password.trim() || undefined,
          targetGroup,
          district,
          city: city.trim() || undefined,
          subscriptionTier,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.message || 'Failed to enroll student.');
      }

      setCreatedStudent({
        fullName: json.student.fullName,
        email: json.student.email,
        tempPass: json.student.temporaryPassword,
        district: json.student.district,
        tier: json.student.tier,
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error occurred while creating student.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdStudent) return;
    const text = `TNPSC Study Hub Credentials:\nName: ${createdStudent.fullName}\nEmail: ${createdStudent.email}\nPassword: ${createdStudent.tempPass}\nPortal: https://tnpsc-quiz-1ve1.vercel.app/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetAndClose = () => {
    setFullName('');
    setEmail('');
    setMobile('');
    setPassword('');
    setCreatedStudent(null);
    setError(null);
    onClose();
  };

  return (
    <div className="quick-modal-backdrop" onClick={handleResetAndClose}>
      <div className="quick-modal-panel glass" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="quick-modal-header">
          <div className="modal-title-cluster">
            <div className="modal-icon-badge">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="modal-title">Enroll New Student</h3>
              <p className="modal-subtitle">Direct PostgreSQL Student Registration & Tier Assignment</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={handleResetAndClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Success View */}
        {createdStudent ? (
          <div className="modal-success-view">
            <div className="success-icon-ring">
              <CheckCircle size={32} />
            </div>
            <h4 className="success-title">Student Account Enrolled!</h4>
            <p className="success-desc">
              The student record and credentials have been committed directly to the database.
            </p>

            <div className="credentials-box">
              <div className="cred-row">
                <span className="cred-label">Full Name:</span>
                <span className="cred-val">{createdStudent.fullName}</span>
              </div>
              <div className="cred-row">
                <span className="cred-label">Email ID:</span>
                <span className="cred-val">{createdStudent.email}</span>
              </div>
              <div className="cred-row">
                <span className="cred-label">Temporary Password:</span>
                <span className="cred-val pass-highlight">{createdStudent.tempPass}</span>
              </div>
              <div className="cred-row">
                <span className="cred-label">District & Tier:</span>
                <span className="cred-val">{createdStudent.district} · {createdStudent.tier.toUpperCase()}</span>
              </div>
            </div>

            <div className="success-actions">
              <button
                type="button"
                className={`modal-btn copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopyCredentials}
              >
                <Copy size={15} />
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
              </button>
              <button
                type="button"
                className="modal-btn done-btn"
                onClick={handleResetAndClose}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form className="quick-student-form" onSubmit={handleSubmit}>
            {error && (
              <div className="modal-error-banner">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-grid">
              {/* Full Name */}
              <div className="form-field">
                <label className="field-label">Full Name *</label>
                <div className="input-wrap">
                  <User size={15} className="input-icon" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Anitha Murugan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="form-field">
                <label className="field-label">Email Address *</label>
                <div className="input-wrap">
                  <Mail size={15} className="input-icon" />
                  <input
                    type="email"
                    required
                    placeholder="anitha@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Mobile */}
              <div className="form-field">
                <label className="field-label">Mobile Number (Optional)</label>
                <div className="input-wrap">
                  <Phone size={15} className="input-icon" />
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-field">
                <label className="field-label">Password (Auto-generated if empty)</label>
                <div className="input-wrap">
                  <Lock size={15} className="input-icon" />
                  <input
                    type="text"
                    placeholder="Leave blank for auto-pass"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Target Group */}
              <div className="form-field">
                <label className="field-label">Target TNPSC Group</label>
                <select
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  className="form-select"
                >
                  <option value="group1">TNPSC Group 1 (Executive)</option>
                  <option value="group2">TNPSC Group 2 (Subordinate)</option>
                  <option value="group2a">TNPSC Group 2A (Non-Interview)</option>
                  <option value="group4">TNPSC Group 4 & VAO</option>
                </select>
              </div>

              {/* District */}
              <div className="form-field">
                <label className="field-label">Tamil Nadu District</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="form-select"
                >
                  {TN_DISTRICTS_LIST.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* City / Area */}
              <div className="form-field">
                <label className="field-label">City / Town / Area (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Anna Nagar"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '12px' }}
                />
              </div>

              {/* Subscription Tier */}
              <div className="form-field full-width">
                <label className="field-label">Subscription Tier & Plan</label>
                <div className="tier-pills-selector">
                  {[
                    { id: 'free', label: 'Free Pass (₹0)' },
                    { id: 'monthly', label: 'Monthly (₹199)' },
                    { id: 'quarterly', label: 'Quarterly (₹499)' },
                    { id: 'half_yearly', label: 'Half-Yearly (₹899)' },
                    { id: 'yearly', label: 'Annual Pro (₹1,499)' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`tier-pill-opt ${subscriptionTier === t.id ? 'selected' : ''}`}
                      onClick={() => setSubscriptionTier(t.id)}
                    >
                      <CreditCard size={13} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleResetAndClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-btn submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Registering Student...' : 'Create Student Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

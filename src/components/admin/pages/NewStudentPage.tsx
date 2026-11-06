import React, { useState } from 'react';
import {
  UserPlus,
  Mail,
  User,
  Phone,
  Lock,
  CreditCard,
  CheckCircle,
  Copy,
  AlertCircle,
  Compass,
  MapPin,
  Building,
} from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import './NewStudentPage.css';

interface NewStudentPageProps {
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

export const NewStudentPage: React.FC<NewStudentPageProps> = ({ token, onSuccess }) => {
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

      // Clear form
      setFullName('');
      setEmail('');
      setMobile('');
      setPassword('');
      setCity('');

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error occurred while creating student.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdStudent) return;
    const text = `TNPSC Study Hub Credentials:\nName: ${createdStudent.fullName}\nEmail: ${createdStudent.email}\nPassword: ${createdStudent.tempPass}\nPortal: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="admin-subpage-root">
      {/* Header */}
      <div className="subpage-header-row">
        <div className="subpage-titles">
          <h1 className="subpage-title">New Student Enrollment</h1>
          <p className="subpage-subtitle">
            Directly onboard TNPSC aspirants, generate secure credentials, and allocate subscription access.
          </p>
        </div>
      </div>

      {/* Success Banner */}
      {createdStudent && (
        <div className="enroll-success-box">
          <div className="success-header-line">
            <div className="success-title-wrap">
              <CheckCircle size={18} />
              <span>Student Enrolled Successfully!</span>
            </div>
            <button
              type="button"
              className="credentials-copy-btn"
              onClick={handleCopyCredentials}
            >
              <Copy size={13} />
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
            </button>
          </div>
          <div className="credentials-snippet">
            <div className="cred-item-line">
              <span className="cred-label">Name:</span>
              <span className="cred-val">{createdStudent.fullName}</span>
            </div>
            <div className="cred-item-line">
              <span className="cred-label">Email:</span>
              <span className="cred-val">{createdStudent.email}</span>
            </div>
            <div className="cred-item-line">
              <span className="cred-label">Temporary Password:</span>
              <span className="cred-val">{createdStudent.tempPass}</span>
            </div>
            <div className="cred-item-line">
              <span className="cred-label">District:</span>
              <span className="cred-val">{createdStudent.district}</span>
            </div>
            <div className="cred-item-line">
              <span className="cred-label">Tier:</span>
              <span className="cred-val">{createdStudent.tier}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="subpage-error-alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* Enrollment Form */}
      <form onSubmit={handleSubmit} className="enroll-form-card">
        <div className="form-grid-layout">
          {/* Full Name */}
          <div className="form-group-item">
            <label>Full Name *</label>
            <div className="form-input-with-icon">
              <User size={15} />
              <input
                type="text"
                required
                placeholder="e.g. K. Annamalai"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-group-item">
            <label>Email Address *</label>
            <div className="form-input-with-icon">
              <Mail size={15} />
              <input
                type="email"
                required
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div className="form-group-item">
            <label>Mobile Number (Optional)</label>
            <div className="form-input-with-icon">
              <Phone size={15} />
              <input
                type="tel"
                placeholder="10-digit mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>
          </div>

          {/* Target Group */}
          <div className="form-group-item">
            <label>Target TNPSC Exam Group *</label>
            <div className="form-input-with-icon">
              <Compass size={15} />
              <select
                className="subpage-native-select"
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
              >
                <option value="group1">Group 1 (Prelims & Mains)</option>
                <option value="group2">Group 2 / 2A (Combined)</option>
                <option value="group4">Group 4 & VAO</option>
              </select>
            </div>
          </div>

          {/* District Dropdown (38 TN Districts) */}
          <div className="form-group-item">
            <label>District (Tamil Nadu) *</label>
            <div className="form-input-with-icon">
              <MapPin size={15} />
              <select
                className="subpage-native-select"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {TN_DISTRICTS_LIST.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* City / Taluk */}
          <div className="form-group-item">
            <label>City / Taluk (Optional)</label>
            <div className="form-input-with-icon">
              <Building size={15} />
              <input
                type="text"
                placeholder="e.g. Tambaram / Thiruverumbur"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          {/* Subscription Tier */}
          <div className="form-group-item">
            <label>Subscription Tier *</label>
            <div className="form-input-with-icon">
              <CreditCard size={15} />
              <select
                className="subpage-native-select"
                value={subscriptionTier}
                onChange={(e) => setSubscriptionTier(e.target.value)}
              >
                <option value="free">Free Access</option>
                <option value="pro_monthly">Monthly Pass (₹199)</option>
                <option value="pro_quarterly">Quarterly Pass (₹499)</option>
                <option value="pro_half_yearly">Half-Yearly Pass (₹899)</option>
                <option value="pro_yearly">Yearly Pass (₹1,499)</option>
              </select>
            </div>
          </div>

          {/* Password */}
          <div className="form-group-item">
            <label>Password (Leave blank to auto-generate)</label>
            <div className="form-input-with-icon">
              <Lock size={15} />
              <input
                type="password"
                placeholder="Leave blank for secure auto-generated password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <span className="form-helper-note">If left blank, a random 10-char passcode will be generated.</span>
          </div>
        </div>

        <div className="form-submit-row">
          <button
            type="submit"
            className="enroll-submit-btn"
            disabled={isSubmitting}
          >
            <UserPlus size={16} />
            <span>{isSubmitting ? 'Enrolling Student...' : 'Create & Enroll Student'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};


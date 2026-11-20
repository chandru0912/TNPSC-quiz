import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Crown } from 'lucide-react';
import './SubscriptionButton.css';

export interface SubscriptionButtonProps {
  variant?: 'header' | 'sidebar';
  onClick?: () => void;
  className?: string;
}

export const SubscriptionButton: React.FC<SubscriptionButtonProps> = ({
  variant = 'header',
  onClick,
  className = '',
}) => {
  const location = useLocation();
  const isActive = location.pathname.toLowerCase().startsWith('/dashboard/subscription');

  return (
    <Link
      to="/dashboard/subscription"
      className={`tnpsc-sub-btn tnpsc-sub-btn--${variant} ${isActive ? 'active' : ''} ${className}`.trim()}
      onClick={onClick}
      aria-label="Subscription"
      aria-current={isActive ? 'page' : undefined}
      title="View TNPSC Study Hub Subscription Plans"
    >
      <Crown
        size={variant === 'sidebar' ? 17 : 15}
        className="tnpsc-sub-btn-crown"
        aria-hidden="true"
      />
      <span className="tnpsc-sub-btn-text">Subscription</span>
    </Link>
  );
};

export default SubscriptionButton;

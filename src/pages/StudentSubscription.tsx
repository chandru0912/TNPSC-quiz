import React from 'react';
import { SubscriptionPlansSection } from '../components/SubscriptionPlansSection';

const StudentSubscription: React.FC = () => {
  return (
    <div style={{ width: '100%', paddingBottom: '2rem' }}>
      <SubscriptionPlansSection isDedicatedPage={true} />
    </div>
  );
};

export default StudentSubscription;

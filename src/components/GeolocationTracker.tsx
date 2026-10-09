import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeolocation } from '../hooks/useGeolocation';

const GeolocationTracker: React.FC = () => {
  const { profile } = useAuth();
  useGeolocation(profile);

  return null; // This component doesn't render anything, it just runs the hook
};

export default GeolocationTracker;

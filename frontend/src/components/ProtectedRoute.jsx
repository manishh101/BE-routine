import React from 'react';
import { Navigate } from 'react-router-dom';
import { Result, Button } from 'antd';
import useAuthStore from '../contexts/authStore';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, token } = useAuthStore();

  // If admin access is required but user is not logged in
  if (requireAdmin && !token) {
    return (
      <Result
        status="403"
        title="Admin Access Required"
        subTitle="Please log in as an administrator to access this page."
        extra={
          <Button type="primary" href="/admin/login">
            Go to Admin Login
          </Button>
        }
      />
    );
  }

  // If admin access is required but user is not an admin
  if (requireAdmin && token && user?.role !== 'admin') {
    return (
      <Result
        status="403"
        title="Insufficient Permissions"
        subTitle="You don't have permission to access this page. Admin access required."
        extra={
          <Button type="primary" href="/dashboard">
            Go to Dashboard
          </Button>
        }
      />
    );
  }

  // Render the protected component
  return children;
};

export default ProtectedRoute;

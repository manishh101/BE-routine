import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Alert, Typography, Layout as AntLayout, Row, Col, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, ScheduleOutlined } from '@ant-design/icons';
import useAuthStore from '../contexts/authStore';

const { Title, Text } = Typography;
const { Content } = AntLayout;

const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    clearError();
    const success = await login(values.email, values.password);
    if (success) {
      navigate('/admin'); // Redirect to admin panel after login
    }
  };

  return (
    <AntLayout style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decorative elements */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '800px',
        height: '800px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '50%',
        transform: 'rotate(45deg)'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-10%',
        width: '600px',
        height: '600px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '50%'
      }} />
      
      <Content style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '24px',
        position: 'relative',
        zIndex: 1
      }}>
        <Card 
          style={{ 
            width: '100%', 
            maxWidth: '420px', 
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}
          styles={{ body: { padding: '40px' } }}
          className="fade-in"
        >
          <Row justify="center" style={{ marginBottom: '32px' }}>
            <Col>
              <Space direction="vertical" align="center" size="large">
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 20px rgba(102, 126, 234, 0.3)'
                }}>
                  <ScheduleOutlined style={{ fontSize: '40px', color: 'white' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Title level={2} style={{ 
                    margin: 0, 
                    color: '#1f2937',
                    fontWeight: 700,
                    letterSpacing: '-0.02em'
                  }}>
                    Admin Portal
                  </Title>
                  <Text style={{ 
                    color: '#6b7280', 
                    fontSize: '16px',
                    fontWeight: 400
                  }}>
                    Sign in to manage the system
                  </Text>
                </div>
              </Space>
            </Col>
          </Row>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={clearError}
              style={{ 
                marginBottom: '24px',
                borderRadius: '12px',
                border: '1px solid #fecaca',
                background: '#fef2f2'
              }}
            />
          )}

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="email"
              label={<Text strong style={{ color: '#374151' }}>Email Address</Text>}
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: 'rgba(0,0,0,.25)' }} />}
                placeholder="e.g. admin@example.com"
                style={{ 
                  borderRadius: '12px',
                  border: '1px solid #d1d5db',
                  padding: '12px 16px',
                  fontSize: '16px'
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<Text strong style={{ color: '#374151' }}>Password</Text>}
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />}
                placeholder="Enter your password"
                style={{ 
                  borderRadius: '12px',
                  border: '1px solid #d1d5db',
                  padding: '12px 16px',
                  fontSize: '16px'
                }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: '24px' }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                icon={<LoginOutlined />}
                block
                style={{ 
                  height: '50px', 
                  fontSize: '16px', 
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text style={{ color: '#6b7280' }}>
              <Link 
                to="/" 
                style={{ 
                  color: '#667eea', 
                  fontWeight: 500,
                  textDecoration: 'none'
                }}
              >
                ← Back to Public View
              </Link>
            </Text>
          </div>
        </Card>
      </Content>
    </AntLayout>
  );
};

export default Login;
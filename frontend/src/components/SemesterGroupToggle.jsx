import React from 'react';
import { Radio, Space, Card, Typography, Tooltip } from 'antd';
import { FilterOutlined, CalendarOutlined } from '@ant-design/icons';
import { useSemesterGroup, getSemesterGroupLabel } from '../contexts/SemesterGroupContext';

const { Text } = Typography;

const SemesterGroupToggle = ({ 
  size = 'default', 
  showLabel = true, 
  showDescription = true,
  style = {},
  cardStyle = false,
  orientation = 'horizontal' // 'horizontal' or 'vertical'
}) => {
  const { semesterGroup, setSemesterGroup } = useSemesterGroup();

  const radioOptions = [
    {
      value: 'odd',
      label: 'Odd',
      description: 'Show classes from odd semesters (1, 3, 5, 7)'
    },
    {
      value: 'even',
      label: 'Even',
      description: 'Show classes from even semesters (2, 4, 6, 8)'
    }
  ];

  const radioGroup = (
    <Radio.Group
      value={semesterGroup}
      onChange={(e) => setSemesterGroup(e.target.value)}
      size={size}
      optionType="button"
      buttonStyle="solid"
    >
      <Space direction={orientation === 'vertical' ? 'vertical' : 'horizontal'}>
        {radioOptions.map(option => (
          <Tooltip key={option.value} title={option.description} placement="top">
            <Radio.Button value={option.value}>
              {option.label}
            </Radio.Button>
          </Tooltip>
        ))}
      </Space>
    </Radio.Group>
  );

  const content = (
    <Space 
      direction={orientation === 'vertical' ? 'vertical' : 'horizontal'} 
      align="center"
      style={style}
    >
      {showLabel && (
        <Space align="center">
          <FilterOutlined style={{ color: '#1890ff' }} />
          <Text strong>Semester Group:</Text>
        </Space>
      )}
      {radioGroup}
      {showDescription && (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {getSemesterGroupLabel(semesterGroup)}
        </Text>
      )}
    </Space>
  );

  if (cardStyle) {
    return (
      <Card 
        size="small"
        style={{ 
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          ...style
        }}
      >
        {content}
      </Card>
    );
  }

  return content;
};

export default SemesterGroupToggle;

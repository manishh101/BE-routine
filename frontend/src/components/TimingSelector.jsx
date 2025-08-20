import React from 'react';
import { Card, Radio, Alert, Space } from 'antd';
import { ClockCircleOutlined, SunOutlined, CloudOutlined } from '@ant-design/icons';
import { isEvenSemesterGroup } from '../contexts/SemesterGroupContext';

const TimingSelector = ({ 
  semester, 
  selectedTiming, 
  onTimingChange, 
  showInfo = false,
  style = {} 
}) => {
  const semesterNum = parseInt(semester);
  const isEvenGroup = isEvenSemesterGroup(semesterNum);
  const isMultiSemester = semester === 'Multi';

  // Show for even semester groups or multi-semester contexts
  if (!isEvenGroup && !isMultiSemester) {
    return null;
  }

  return (
    <Card 
      size="small" 
      style={{ backgroundColor: '#fafafa', ...style }}
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: '500', fontSize: '14px' }}>
            Timing Selection {isMultiSemester ? 'for Even Semester Classes' : `for Semester ${semester}`}
          </span>
        </div>
        
        <Radio.Group 
          value={selectedTiming} 
          onChange={(e) => onTimingChange(e.target.value)}
          size="small"
        >
          <Radio.Button value="summer" style={{ marginRight: '8px' }}>
            <Space size="small">
              <SunOutlined />
              Summer Timing
            </Space>
          </Radio.Button>
          <Radio.Button value="winter">
            <Space size="small">
              <CloudOutlined />
              Winter Timing
            </Space>
          </Radio.Button>
        </Radio.Group>

        {showInfo && (
          <Alert
            message={
              selectedTiming === 'winter' 
                ? `Winter Timing: Shorter class periods (45 min) with shorter breaks (30 min)${isMultiSemester ? ' - affects even semester classes only' : ''}`
                : `Summer Timing: Standard class periods (50 min) with regular breaks${isMultiSemester ? ' - default for all classes' : ''}`
            }
            type="info"
            showIcon
            style={{ 
              fontSize: '12px',
              padding: '6px 12px',
              marginTop: '8px'
            }}
          />
        )}
      </Space>
    </Card>
  );
};

export default TimingSelector;

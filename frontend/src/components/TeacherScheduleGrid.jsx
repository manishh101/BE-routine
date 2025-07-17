import React, { useMemo } from 'react';
import { Table, Tag, Space, Typography, Empty } from 'antd';
import { ClockCircleOutlined, BookOutlined, HomeOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * Teacher Schedule Grid Component
 * Displays teacher schedule in a table format similar to routine grid
 * Includes spanned class merging logic similar to RoutineGrid
 */
const TeacherScheduleGrid = ({ schedule, teacherInfo }) => {
  const timeSlots = schedule.timeSlots || [];
  const routine = schedule.routine || {};

  // Days of the week
  const days = [
    { key: '0', label: 'Sunday' },
    { key: '1', label: 'Monday' },
    { key: '2', label: 'Tuesday' },
    { key: '3', label: 'Wednesday' },
    { key: '4', label: 'Thursday' },
    { key: '5', label: 'Friday' },
    { key: '6', label: 'Saturday' }
  ];

  // Calculate colspan for spanned classes
  const calculateColSpan = (classData, dayData, slotIndex) => {
    // If not part of a span group, return 1 (normal cell)
    if (!classData?.spanId) return 1;
    
    // If it's part of a span group but not the master, 
    // return 1 but we'll style it differently
    if (classData.spanId && !classData.spanMaster) return 1;
    
    // For the span master, calculate the total span length
    const spanGroup = Object.values(dayData || {}).filter(
      slot => slot?.spanId && slot.spanId === classData.spanId
    );
    
    return spanGroup.length;
  };

  // Render class cell with spanned class support
  const renderClassCell = (classInfo, dayKey, timeSlotId) => {
    if (!classInfo) {
      return (
        <div style={{ 
          height: '60px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#d9d9d9',
          fontSize: '12px'
        }}>
          Free
        </div>
      );
    }

    // Check if this is a spanned class
    const isSpanMaster = classInfo?.spanMaster === true;
    const isPartOfSpan = classInfo?.spanId != null;
    
    // If this is part of a span but not the master, it should be hidden
    if (isPartOfSpan && !isSpanMaster) {
      return null; // This cell will be merged with the span master
    }

    // Calculate span width for display
    const dayData = routine[dayKey] || {};
    const spanLength = isSpanMaster ? calculateColSpan(classInfo, dayData, timeSlotId) : 1;
    
    // Use subtle background for better consistency with routine grid
    const getSpanBackground = (length) => {
      if (length === 1) return '#fff';
      return '#f5f5f5'; // Light gray for multi-period classes
    };

    return (
      <div style={{ 
        padding: '8px',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        background: getSpanBackground(spanLength),
        minHeight: '60px',
        position: 'relative'
      }}>
        {/* Remove period indicators for cleaner look */}
        
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          {/* Subject */}
          <div style={{ 
            fontWeight: 'bold', 
            color: '#262626',
            fontSize: '11px',
            lineHeight: '1.2'
          }}>
            <BookOutlined style={{ marginRight: 4 }} />
            {classInfo.subjectName}
          </div>

          {/* Program & Section with proper formatting */}
          <div style={{ fontSize: '10px', color: '#666' }}>
            {classInfo.programSemesterSection || `${classInfo.programCode}-${classInfo.semester}-${classInfo.section}`}
            {classInfo.classType && (
              <Tag size="small" color="default" style={{ marginLeft: 4, fontSize: '9px' }}>
                {classInfo.classType}
              </Tag>
            )}
          </div>

          {/* Room */}
          {classInfo.roomName && (
            <div style={{ fontSize: '10px', color: '#fa8c16' }}>
              <HomeOutlined style={{ marginRight: 2 }} />
              {classInfo.roomName}
            </div>
          )}
        </Space>
      </div>
    );
  };

  // Create table columns - one for time, one for each day
  const columns = [
    {
      title: 'Time',
      dataIndex: 'time',
      key: 'time',
      fixed: 'left',
      width: 120,
      render: (time) => (
        <div style={{ 
          textAlign: 'center', 
          fontWeight: 'bold',
          color: '#262626',
          fontSize: '12px'
        }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {time}
        </div>
      )
    },
    ...days.map(day => ({
      title: day.label,
      dataIndex: day.key,
      key: day.key,
      width: 180,
      render: (classInfo, record) => {
        return renderClassCell(classInfo, day.key, record.key);
      }
    }))
  ];

  // Transform data for table with spanned class support
  const tableData = useMemo(() => {
    return timeSlots.map(timeSlot => {
      const row = {
        key: timeSlot._id,
        time: `${timeSlot.startTime} - ${timeSlot.endTime}`
      };

      // Add class data for each day
      days.forEach(day => {
        const dayRoutine = routine[day.key] || {};
        const classInfo = dayRoutine[timeSlot._id];
        
        // Only include the class if it's not part of a span or if it's the span master
        if (!classInfo || !classInfo.spanId || classInfo.spanMaster) {
          row[day.key] = classInfo;
        } else {
          // For non-master span members, we don't include them in the table data
          // This effectively hides them from the table rendering
          row[day.key] = null;
        }
      });

      return row;
    });
  }, [timeSlots, routine, days]);

  if (!timeSlots.length) {
    return (
      <Empty 
        description="No time slots configured"
        style={{ padding: '40px' }}
      />
    );
  }

  return (
    <div className="teacher-schedule-grid">
      <style jsx>{`
        .teacher-schedule-grid .ant-table-thead > tr > th {
          background: #fafafa !important;
          color: #262626 !important;
          font-weight: bold !important;
          text-align: center !important;
          border: 1px solid #d9d9d9 !important;
        }
        
        .teacher-schedule-grid .ant-table-tbody > tr > td {
          padding: 8px !important;
          border: 1px solid #f0f0f0 !important;
          vertical-align: top !important;
        }
        
        .teacher-schedule-grid .ant-table-tbody > tr:nth-child(even) {
          background-color: #fafafa;
        }
        
        .teacher-schedule-grid .ant-table-tbody > tr:hover {
          background-color: #f5f5f5 !important;
        }
        
        .teacher-schedule-grid .ant-table {
          border: 1px solid #d9d9d9;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .teacher-schedule-grid .ant-table-container {
          border-radius: 8px;
        }
      `}</style>
      
      <Table
        columns={columns}
        dataSource={tableData}
        pagination={false}
        scroll={{ x: 1000 }}
        size="small"
        bordered
        style={{ 
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      />
      
      {/* Legend */}
      <div style={{ 
        marginTop: '16px', 
        padding: '12px',
        background: '#fafafa',
        borderRadius: '6px',
        border: '1px solid #d9d9d9'
      }}>
        <Space wrap>
          <Text strong style={{ fontSize: '12px', color: '#666' }}>Legend:</Text>
          <Space size={4}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              background: '#fff',
              border: '1px solid #d9d9d9',
              borderRadius: '2px'
            }} />
            <Text style={{ fontSize: '11px' }}>Single Period</Text>
          </Space>
          <Space size={4}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              background: '#f5f5f5',
              border: '1px solid #d9d9d9',
              borderRadius: '2px'
            }} />
            <Text style={{ fontSize: '11px' }}>Multi-Period Class</Text>
          </Space>
          <Space size={4}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              background: 'white',
              border: '1px solid #d9d9d9',
              borderRadius: '2px'
            }} />
            <Text style={{ fontSize: '11px' }}>Free Period</Text>
          </Space>
        </Space>
      </div>
    </div>
  );
};

export default TeacherScheduleGrid;

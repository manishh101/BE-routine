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
    // Handle both single slot objects and arrays of slots
    const spanGroup = Object.values(dayData || {}).flatMap(slotData => {
      if (Array.isArray(slotData)) {
        return slotData.filter(slot => slot?.spanId && slot.spanId === classData.spanId);
      } else if (slotData?.spanId && slotData.spanId === classData.spanId) {
        return [slotData];
      }
      return [];
    });
    
    return spanGroup.length;
  };

  // Render class cell with spanned class support
  const renderClassCell = (classInfo, dayKey, timeSlotId, record) => {
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

    // Check if there are multiple classes in this slot
    const allClasses = record[`${dayKey}_all`];
    const hasMultipleClasses = Array.isArray(allClasses) && allClasses.length > 1;

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
        {/* Multiple classes indicator */}
        {hasMultipleClasses && (
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: '#1890ff',
            color: 'white',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}>
            {allClasses.length}
          </div>
        )}
        
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          {/* Subject */}
          <div style={{ 
            fontWeight: 'bold', 
            color: '#262626',
            fontSize: '13px', /* Increased from 11px to 13px */
            lineHeight: '1.2'
          }}>
            <BookOutlined style={{ marginRight: 4 }} />
            {classInfo.subjectName}
          </div>

          {/* Program & Section with proper formatting */}
          <div style={{ fontSize: '12px', color: '#666' }}> {/* Increased from 10px to 12px */}
            {classInfo.programSemesterSection || `${classInfo.programCode}-${classInfo.semester}-${classInfo.section}`}
            {classInfo.classType && (
              <Tag size="small" color="default" style={{ marginLeft: 4, fontSize: '11px' }}> {/* Increased from 9px to 11px */}
                {classInfo.classType}
              </Tag>
            )}
          </div>

          {/* Room */}
          {classInfo.roomName && (
            <div style={{ fontSize: '12px', color: '#fa8c16' }}> {/* Increased from 10px to 12px */}
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
        return renderClassCell(classInfo, day.key, record.key, record);
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
        const slotData = dayRoutine[timeSlot._id];
        
        // Handle both single slot objects and arrays of slots
        if (Array.isArray(slotData)) {
          // For arrays, we want to display all classes
          // For now, we'll use the first non-span member or span master for main display
          // TODO: Consider enhancing UI to show multiple classes in one cell
          const mainClass = slotData.find(slot => 
            !slot?.spanId || slot?.spanMaster
          ) || slotData[0];
          
          // Store both the main class and the full array for potential future use
          row[day.key] = mainClass;
          row[`${day.key}_all`] = slotData; // Store all classes for reference
        } else {
          row[day.key] = slotData;
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
          <Text strong style={{ fontSize: '14px', color: '#666' }}>Legend:</Text> {/* Increased from 12px to 14px */}
          <Space size={4}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              background: '#fff',
              border: '1px solid #d9d9d9',
              borderRadius: '2px'
            }} />
            <Text style={{ fontSize: '13px' }}>Single Period</Text> {/* Increased from 11px to 13px */}
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

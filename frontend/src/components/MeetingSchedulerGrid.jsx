import React from 'react';
import { Card, Typography, Tag, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const MeetingSchedulerGrid = ({ searchResults, includeDays, selectedTeachers, allTeachers }) => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const slotsPerDay = 7; // 0-6 slots per day
  const slotLabels = [
    '8:00-8:50', '8:50-9:40', '9:40-10:30', '10:45-11:35', 
    '11:35-12:25', '12:25-1:15', '1:15-2:05'
  ];
  
  // Filter days based on includeDays selection
  const filteredDayNames = dayNames.filter((_, index) => includeDays.includes(index));
  
  // Get meeting grid from search results
  const meetingGrid = searchResults?.data?.meetingGrid || {};

  if (!searchResults || !meetingGrid) {
    return (
      <Card>
        <Text>No search results available. Please search for teacher availability.</Text>
      </Card>
    );
  }

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <CheckCircleOutlined />
          Meeting Availability Grid
          <Tag color="green">Available</Tag>
          <Tag color="red">Unavailable (with teacher codes)</Tag>
        </div>
      }
    >
      <div className="routine-grid" style={{ overflowX: 'auto', marginTop: '7px', WebkitOverflowScrolling: 'touch' }}>
        <table className="routine-grid-table" style={{ 
          width: '100%', 
          borderCollapse: 'separate',
          borderSpacing: '0',
          minWidth: '1400px', // Increased from 1000px
          tableLayout: 'fixed',
          border: '2px solid #666666',
          backgroundColor: '#ffffff'
        }}>
          <thead>
            <tr>
              <th className="day-time-header" style={{ 
                padding: '16px', // Increased from 12px
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: '#c0c0c0',
                backgroundColor: '#ffffff',
                fontWeight: '600',
                textAlign: 'center',
                width: '180px', // Increased from 150px
                minWidth: '180px',
                maxWidth: '180px',
                fontSize: '14px', // Increased from 13px
                color: '#333',
                position: 'sticky',
                left: 0,
                top: 0,
                zIndex: 25,
              }}>
                <div style={{ fontWeight: '600', fontSize: '14px' }}> {/* Increased from 13px */}
                  Days / Time
                </div>
              </th>
              {Array.from({ length: slotsPerDay }, (_, slotIndex) => (
                <th 
                  key={`header-${slotIndex}`}
                  className="time-slot-header" 
                  style={{ 
                    padding: '16px 12px', // Increased padding
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#c0c0c0',
                    backgroundColor: '#ffffff',
                    fontWeight: '600',
                    textAlign: 'center',
                    width: `calc((100% - 180px) / ${slotsPerDay})`, // Updated for new day column width
                    minWidth: '180px', // Increased from 140px
                    fontSize: '13px', // Increased from 12px
                    color: '#333',
                    position: 'sticky',
                    top: 0,
                    zIndex: 15
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '3px' // Increased from 2px
                  }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#333' }}> {/* Increased from 12px */}
                      {slotLabels[slotIndex]}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}> {/* Increased from 11px */}
                      Slot {slotIndex + 1}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredDayNames.map((dayName, filteredIndex) => {
              const dayIndex = dayNames.indexOf(dayName);
              return (
                <tr key={dayIndex} className="day-row">
                  <td className="day-cell" style={{ 
                    padding: '16px',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#c0c0c0',
                    backgroundColor: '#ffffff',
                    fontWeight: '600',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    width: '180px',
                    minWidth: '180px',
                    maxWidth: '180px',
                    fontSize: '14px',
                    color: '#333',
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                  }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#333' }}>
                      {dayName}
                    </div>
                  </td>
                  {Array.from({ length: slotsPerDay }, (_, slotIndex) => {
                    const slotData = meetingGrid[dayIndex]?.[slotIndex];
                    const isAvailable = slotData?.isAvailableForMeeting || false;
                    const unavailableTeachers = slotData?.unavailableTeachers || [];
                    const availableTeachers = slotData?.availableTeachers || [];
                    
                    return (
                      <td 
                        key={`${dayIndex}-${slotIndex}`} 
                        className={`routine-cell ${isAvailable ? 'available-slot' : 'unavailable-slot'}`}
                        style={{ 
                          padding: '0', 
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: '#c0c0c0',
                          verticalAlign: 'top',
                          backgroundColor: isAvailable ? '#f6ffed' : '#fff2f0',
                          height: '110px',
                          minWidth: '180px',
                          position: 'relative',
                          cursor: 'pointer'
                        }}
                      >
                        <Tooltip
                          title={
                            isAvailable ? 
                              `All ${selectedTeachers.length} teachers available for ${slotLabels[slotIndex]}` :
                              unavailableTeachers.length > 0 ? (
                                <div>
                                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                    {unavailableTeachers.length}/{selectedTeachers.length} teachers unavailable
                                  </div>
                                  {unavailableTeachers.map((teacher, idx) => (
                                    <div key={idx} style={{ marginBottom: '2px' }}>
                                      <strong>{teacher.teacherShortName || teacher.teacherName}:</strong> 
                                      {teacher.subject ? ` ${teacher.subject} (${teacher.classType || 'L'})` : ' Busy'}
                                      {teacher.program && ` - ${teacher.programCode} S${teacher.semester}`}
                                      {teacher.section && ` ${teacher.section}`}
                                    </div>
                                  ))}
                                  {availableTeachers.length > 0 && (
                                    <div style={{ marginTop: '4px', color: '#52c41a' }}>
                                      Available: {availableTeachers.map(t => t.teacherShortName || t.teacherName).join(', ')}
                                    </div>
                                  )}
                                </div>
                              ) : 
                              `No data available for ${slotLabels[slotIndex]}`
                          }
                        >
                          <div style={{ 
                            padding: '12px',
                            height: '100%', 
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}>
                            {isAvailable ? (
                              <CheckCircleOutlined 
                                style={{ 
                                  color: '#52c41a', 
                                  fontSize: '24px'
                                }} 
                              />
                            ) : unavailableTeachers.length > 0 ? (
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '3px',
                                width: '100%'
                              }}>
                                {unavailableTeachers.slice(0, 3).map((teacher, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      fontSize: '11px',
                                      color: '#ff4d4f',
                                      textAlign: 'center',
                                      fontWeight: '600',
                                      lineHeight: '1.2',
                                      backgroundColor: '#fff1f0',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid #ffccc7',
                                      maxWidth: '100%',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {teacher.teacherShortName || teacher.teacherName}
                                  </div>
                                ))}
                                {unavailableTeachers.length > 3 && (
                                  <div style={{ 
                                    fontSize: '10px', 
                                    color: '#ff4d4f',
                                    fontWeight: '500',
                                    backgroundColor: '#fff1f0',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid #ffccc7'
                                  }}>
                                    +{unavailableTeachers.length - 3} more
                                  </div>
                                )}
                                <div style={{ 
                                  fontSize: '10px', 
                                  color: slotData?.conflictLevel === 'full' ? '#cf1322' : '#fa8c16',
                                  fontWeight: '500',
                                  marginTop: '2px'
                                }}>
                                  {slotData?.conflictLevel === 'full' ? 'All Busy' : 'Some Busy'}
                                </div>
                              </div>
                            ) : (
                              <CloseCircleOutlined 
                                style={{ 
                                  color: '#ff4d4f', 
                                  fontSize: '20px'
                                }} 
                              />
                            )}
                          </div>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      
    </Card>
  );
};

export default MeetingSchedulerGrid;

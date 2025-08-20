import { timeSlotsAPI } from './api';
import { isEvenSemesterGroup } from '../contexts/SemesterGroupContext';

export const timingService = {
  // Get time slots with appropriate timing context
  async getTimeSlotsForContext(programCode, semester, section, timingType = 'summer') {
    try {
      const response = await timeSlotsAPI.getTimeSlots({
        programCode,
        semester,
        section,
        includeGlobal: 'true'
      });
      
      // Transform the time slots based on timing type and context
      if (response.data?.data) {
        const timeSlots = response.data.data.map(slot => {
          // For even semester groups, check if winter timing should be applied
          if (semester && isEvenSemesterGroup(parseInt(semester)) && 
              timingType === 'winter' && 
              slot.winterTiming && slot.winterTiming.startTime && slot.winterTiming.endTime) {
            return {
              ...slot,
              // Use winter timing
              displayStartTime: slot.winterTiming.startTime,
              displayEndTime: slot.winterTiming.endTime,
              displayDuration: slot.winterTiming.duration,
              timingType: 'winter',
              originalTiming: {
                startTime: slot.startTime,
                endTime: slot.endTime,
                duration: slot.duration
              }
            };
          } else {
            return {
              ...slot,
              // Use summer/default timing
              displayStartTime: slot.startTime,
              displayEndTime: slot.endTime,
              displayDuration: slot.duration,
              timingType: 'summer',
              ...(slot.winterTiming && slot.winterTiming.startTime && slot.winterTiming.endTime && {
                alternateTiming: {
                  startTime: slot.winterTiming.startTime,
                  endTime: slot.winterTiming.endTime,
                  duration: slot.winterTiming.duration,
                  type: 'winter'
                }
              })
            };
          }
        });
        
        return {
          ...response,
          data: {
            ...response.data,
            data: timeSlots
          }
        };
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching time slots with timing context:', error);
      throw error;
    }
  },

  // Get display time range based on timing type
  getDisplayTimeRange(timeSlot, timingType = 'summer') {
    if (timingType === 'winter' && timeSlot.winterTiming && timeSlot.winterTiming.startTime && timeSlot.winterTiming.endTime) {
      return `${timeSlot.winterTiming.startTime} - ${timeSlot.winterTiming.endTime}`;
    }
    return `${timeSlot.startTime} - ${timeSlot.endTime}`;
  },

  // Get display duration based on timing type
  getDisplayDuration(timeSlot, timingType = 'summer') {
    if (timingType === 'winter' && timeSlot.winterTiming && timeSlot.winterTiming.duration) {
      return timeSlot.winterTiming.duration;
    }
    return timeSlot.duration;
  },

  // Check if a time slot has winter timing configured
  hasWinterTiming(timeSlot) {
    return !!(timeSlot.winterTiming && timeSlot.winterTiming.startTime && timeSlot.winterTiming.endTime);
  }
};

export default timingService;

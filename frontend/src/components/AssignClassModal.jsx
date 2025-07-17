import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  Row,
  Col,
  Tag,
  Card,
  Spin,
  message,
  App,
  Divider,
  Checkbox
} from 'antd';
import {
  BookOutlined,
  UserOutlined,
  HomeOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  GroupOutlined,
  SwapOutlined,
  DeleteOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  programSemestersAPI,
  teachersAPI,
  roomsAPI,
  routinesAPI,
  subjectsAPI,
  timeSlotsAPI,
  programsAPI
} from '../services/api';
import { 
  normalizeTimeSlotId, 
  findTimeSlotById 
} from '../utils/timeSlotUtils';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const AssignClassModal = ({
  visible,
  onCancel,
  onSave,
  onClear,
  programCode,
  semester,
  section,
  dayIndex,
  slotIndex,
  timeSlots,
  existingClass,
  loading
}) => {
  const [form] = Form.useForm();
  const [conflicts, setConflicts] = useState([]);
  const [checking, setChecking] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [currentClassType, setCurrentClassType] = useState(null);
  const [labGroupType, setLabGroupType] = useState(null);
  const [isAlternativeWeek, setIsAlternativeWeek] = useState(false);
  const [groupATeachers, setGroupATeachers] = useState([]);
  const [groupBTeachers, setGroupBTeachers] = useState([]);
  const [groupASubject, setGroupASubject] = useState(null);
  const [groupBSubject, setGroupBSubject] = useState(null);
  const [groupARoom, setGroupARoom] = useState(null);
  const [groupBRoom, setGroupBRoom] = useState(null);
  const [isMultiPeriod, setIsMultiPeriod] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);
  
  // Elective management states for 7th and 8th semester
  const [isElectiveClass, setIsElectiveClass] = useState(false);
  const [electiveNumber, setElectiveNumber] = useState(1);
  const [electiveType, setElectiveType] = useState('TECHNICAL');
  const [targetSections, setTargetSections] = useState(['AB', 'CD']);

  // Check if current semester is eligible for electives (7th or 8th)
  const isElectiveSemester = semester === 7 || semester === 8;

  // Use App.useApp for proper context support in modals
  const { modal } = App.useApp();

  // Helper function to get display label for lab group type
  const getLabDisplayLabel = (groupType, isAlternativeWeek = false) => {
    const sectionLabGroups = getSectionLabGroups();
    
    switch (groupType) {
      case 'groupA':
        return isAlternativeWeek ? `${sectionLabGroups.groupA} (Alt Week)` : sectionLabGroups.groupA;
      case 'groupB':
        return isAlternativeWeek ? `${sectionLabGroups.groupB} (Alt Week)` : sectionLabGroups.groupB;
      case 'bothGroups':
        return isAlternativeWeek ? `${sectionLabGroups.groupA} & ${sectionLabGroups.groupB} (Alt Week)` : `${sectionLabGroups.groupA} & ${sectionLabGroups.groupB}`;
      default:
        return '';
    }
  };

  // Helper function to get section-appropriate lab groups
  const getSectionLabGroups = () => {
    if (section === 'CD') {
      return {
        groupA: 'Group C',
        groupB: 'Group D',
        both: 'Both Group C and D'
      };
    }
    // Default to AB groups
    return {
      groupA: 'Group A',
      groupB: 'Group B',
      both: 'Both Group A and B'
    };
  };

  // Day names in English only
  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday'
  ];

  // Fetch time slots if not provided
  const {
    data: timeSlotsData,
    isLoading: timeSlotsLoading
  } = useQuery({
    queryKey: ['timeSlots'],
    queryFn: () => timeSlotsAPI.getTimeSlots(),
    enabled: visible && (!timeSlots || timeSlots.length === 0),
  });

  // Use provided timeSlots or fetched ones
  const availableTimeSlots = timeSlots && timeSlots.length > 0 ? timeSlots :
                             (Array.isArray(timeSlotsData) ? timeSlotsData : (timeSlotsData?.data || []));

  // Find the selected time slot using the centralized utility
  const selectedTimeSlot = findTimeSlotById(availableTimeSlots, slotIndex) ||
                           { startTime: 'Unknown', endTime: 'Time', label: `Slot ${slotIndex}` };

  // Fetch subjects for this program-semester
  const {
    data: subjectsData,
    isLoading: subjectsLoading,
    error: subjectsError
  } = useQuery({
    queryKey: ['programSemesterSubjects', programCode, semester],
    queryFn: () => {
      return subjectsAPI.getSubjectsByProgramAndSemester(programCode, semester);
    },
    enabled: !!(programCode && semester && visible),
  });

  // Fetch all teachers
  const {
    data: teachersData,
    isLoading: teachersLoading
  } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => teachersAPI.getTeachers(),
    enabled: visible,
  });

  // Fetch all rooms
  const {
    data: roomsData,
    isLoading: roomsLoading
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsAPI.getRooms(),
    enabled: visible,
  });

  const subjects = Array.isArray(subjectsData?.data) ? subjectsData.data : [];
  const teachers = Array.isArray(teachersData?.data) ? teachersData.data : [];
  const rooms = Array.isArray(roomsData?.data?.data) ? roomsData.data.data :
               Array.isArray(roomsData?.data) ? roomsData.data : [];

  // Filter teachers based on availability and class type
  const filterTeachersBasedOnClassType = useCallback(async (classType) => {
    if (teachers.length === 0) return;

    setCurrentClassType(classType);

    // For break classes, no teacher filtering needed
    if (classType === 'BREAK') {
      setFilteredTeachers([]);
      return;
    }

    // For Lecture, Tutorial, and Practical classes, check availability.
    // The UI will handle whether to disable the option (for L/T) or just show a tag (for P).
    setChecking(true);
    try {
      const availabilityChecks = teachers.map(async (teacher) => {
        try {
          const response = await routinesAPI.checkTeacherAvailability(teacher._id, dayIndex, slotIndex);
          const availabilityData = response.data?.data || response.data;
          return {
            ...teacher,
            isAvailable: availabilityData.isAvailable,
            conflictDetails: availabilityData.conflict,
            reason: availabilityData.isAvailable ? 'Available' : 'Busy in this slot'
          };
        } catch (error) {
          console.warn(`Error checking availability for teacher ${teacher.fullName}:`, error);
          return {
            ...teacher,
            isAvailable: true, // Assume available on error
            reason: 'Could not verify (assumed available)'
          };
        }
      });

      const teacherAvailability = await Promise.all(availabilityChecks);
      setFilteredTeachers(teacherAvailability);

    } catch (error) {
      console.error('Error checking teacher availability:', error);
      // Fallback to showing all teachers if availability check fails
      setFilteredTeachers(teachers.map(teacher => ({
        ...teacher,
        isAvailable: true,
        reason: 'Availability check failed'
      })));
    }
    setChecking(false);
  }, [teachers, dayIndex, slotIndex]);

  // Handle elective class toggle
  const handleElectiveToggle = (checked) => {
    setIsElectiveClass(checked);
    
    if (checked) {
      // Reset to elective-specific defaults
      const defaultElectiveNumber = semester === 7 ? 1 : 1; // Default to first elective
      setElectiveNumber(defaultElectiveNumber);
      setElectiveType('TECHNICAL');
      
      form.setFieldsValue({
        subjectId: undefined,
        electiveNumber: defaultElectiveNumber,
        electiveType: 'TECHNICAL',
        targetSections: ['AB', 'CD']
      });
      setTargetSections(['AB', 'CD']);
    } else {
      // Reset elective-specific fields
      form.setFieldsValue({
        electiveNumber: undefined,
        electiveType: undefined,
        targetSections: undefined
      });
    }
  };

  // Update filtered teachers when teachers data changes or modal opens
  useEffect(() => {
    if (visible && teachers.length > 0) {
      if (currentClassType) {
        filterTeachersBasedOnClassType(currentClassType);
      } else {
        // Initially show all teachers until class type is selected
        setFilteredTeachers(teachers.map(teacher => ({
          ...teacher,
          isAvailable: true,
          reason: 'Select class type to check availability'
        })));
      }
    }
  }, [visible, teachers.length, currentClassType, dayIndex, slotIndex, filterTeachersBasedOnClassType]); // Using teachers.length and function ref

  // Set form values when editing existing class
  useEffect(() => {
    if (existingClass && visible) {
      const isMultiPeriodClass = existingClass.isMultiPeriod || existingClass.slotIndexes?.length > 1;
      setIsMultiPeriod(isMultiPeriodClass);

      let convertedSlots = [slotIndex];
      if (existingClass.slotIndexes && existingClass.slotIndexes.length > 0) {
        convertedSlots = existingClass.slotIndexes.map(slotId => normalizeTimeSlotId(slotId));
      }
      setSelectedSlots(convertedSlots);

      form.setFieldsValue({
        subjectId: existingClass.subjectId,
        teacherIds: existingClass.teacherIds || [],
        roomId: existingClass.roomId,
        classType: existingClass.classType,
        labGroupType: existingClass.labGroupType || undefined,
        notes: existingClass.notes || '',
        isMultiPeriod: isMultiPeriodClass,
        selectedSlots: convertedSlots
      });
      setCurrentClassType(existingClass.classType);

      // Handle elective class editing
      if (existingClass.isElectiveClass && isElectiveSemester) {
        setIsElectiveClass(true);
        setElectiveNumber(existingClass.electiveNumber || existingClass.electiveInfo?.electiveNumber || 1);
        setElectiveType(existingClass.electiveType || existingClass.electiveInfo?.electiveType || 'TECHNICAL');
        setTargetSections(existingClass.targetSections || existingClass.displayInSections || ['AB', 'CD']);
        
        form.setFieldsValue({
          electiveNumber: existingClass.electiveNumber || existingClass.electiveInfo?.electiveNumber || 1,
          electiveType: existingClass.electiveType || existingClass.electiveInfo?.electiveType || 'TECHNICAL',
          targetSections: existingClass.targetSections || existingClass.displayInSections || ['AB', 'CD']
        });
      }        if (existingClass.classType === 'P' && existingClass.labGroupType) {
          setLabGroupType(existingClass.labGroupType);
          setIsAlternativeWeek(existingClass.isAlternativeWeek || false);

          if (existingClass.labGroupType === 'bothGroups') {
            setGroupATeachers(existingClass.groupATeachers || []);
            setGroupBTeachers(existingClass.groupBTeachers || []);
            setGroupASubject(existingClass.groupASubject || null);
            setGroupBSubject(existingClass.groupBSubject || null);
            setGroupARoom(existingClass.groupARoom || null);
            setGroupBRoom(existingClass.groupBRoom || null);
            form.setFieldsValue({
              groupATeachers: existingClass.groupATeachers || [],
              groupBTeachers: existingClass.groupBTeachers || [],
              groupASubject: existingClass.groupASubject || undefined,
              groupBSubject: existingClass.groupBSubject || undefined,
              groupARoom: existingClass.groupARoom || undefined,
              groupBRoom: existingClass.groupBRoom || undefined,
              isAlternativeWeek: existingClass.isAlternativeWeek || false
            });
          } else {
            form.setFieldsValue({
              isAlternativeWeek: existingClass.isAlternativeWeek || false
            });
          }
        }
      if (existingClass.classType && teachers.length > 0) {
        filterTeachersBasedOnClassType(existingClass.classType);
      }
    } else if (visible && teachers.length > 0) {
      form.resetFields();
      setCurrentClassType(null);
      setLabGroupType(null);
      setIsAlternativeWeek(false);
      setGroupATeachers([]);
      setGroupBTeachers([]);
      setGroupASubject(null);
      setGroupBSubject(null);
      setGroupARoom(null);
      setGroupBRoom(null);
      setIsMultiPeriod(false);
      setSelectedSlots([slotIndex]);
      
      // Reset elective fields
      setIsElectiveClass(false);
      setElectiveNumber(1);
      setElectiveType('TECHNICAL');
      setTargetSections(['AB', 'CD']);
      
      setFilteredTeachers(teachers.map(teacher => ({
        ...teacher,
        isAvailable: true,
        reason: 'Select class type to check availability'
      })));
    }
  }, [existingClass, visible, teachers.length, filterTeachersBasedOnClassType, form, slotIndex]);

  // Check for conflicts when form values change
  const checkAllConflicts = async (values) => {
    if (!values.teacherIds?.length && !values.roomId) {
      setConflicts([]);
      return;
    };

    setChecking(true);
    try {
      const conflictChecks = [];

      const slotsToCheck = (values.isMultiPeriod || isMultiPeriod) && selectedSlots?.length > 0
        ? selectedSlots
        : [slotIndex];

      if (values.teacherIds?.length > 0) {
        for (const teacherId of values.teacherIds) {
          for (const currentSlotId of slotsToCheck) {
            const normalizedSlotId = normalizeTimeSlotId(currentSlotId);
            conflictChecks.push(
              routinesAPI.checkTeacherAvailability(teacherId, dayIndex, normalizedSlotId)
                .then(response => ({
                  type: 'teacher', id: teacherId, slotIndex: normalizedSlotId,
                  name: teachers.find(t => t._id === teacherId)?.fullName || 'Unknown Teacher',
                  available: response.data.data.isAvailable, conflictDetails: response.data.data.conflict
                }))
                .catch(() => ({ type: 'teacher', id: teacherId, slotIndex: normalizedSlotId, name: '...', available: true }))
            );
          }
        }
      }

      if (values.roomId) {
        for (const currentSlotId of slotsToCheck) {
          const normalizedSlotId = normalizeTimeSlotId(currentSlotId);
          conflictChecks.push(
            routinesAPI.checkRoomAvailability(values.roomId, dayIndex, normalizedSlotId)
              .then(response => ({
                type: 'room', id: values.roomId, slotIndex: normalizedSlotId,
                name: rooms.find(r => r._id === values.roomId)?.name || 'Unknown Room',
                available: response.data.data.isAvailable, conflictDetails: response.data.data.conflict
              }))
              .catch(() => ({ type: 'room', id: values.roomId, slotIndex: normalizedSlotId, name: '...', available: true }))
          );
        }
      }

      const results = await Promise.all(conflictChecks);
      const conflictMap = new Map();
      results.filter(result => !result.available).forEach(result => {
        const key = `${result.type}-${result.id}`;
        if (!conflictMap.has(key)) {
          conflictMap.set(key, { ...result, conflictedSlots: [result.slotIndex] });
        } else {
          conflictMap.get(key).conflictedSlots.push(result.slotIndex);
        }
      });
      
      const newConflicts = Array.from(conflictMap.values()).map(conflict => {
        const slotLabels = conflict.conflictedSlots.map(slotId => findTimeSlotById(availableTimeSlots, slotId)?.label || 'Unknown Slot');
        return {
          ...conflict,
          slotInfo: slotLabels.join(', ')
        }
      });
      setConflicts(newConflicts);

      const unavailableTeacherIds = Array.from(new Set(results.filter(r => r.type === 'teacher' && !r.available).map(r => r.id)));
      setAvailableTeachers(teachers.map(teacher => ({ ...teacher, isAvailable: !unavailableTeacherIds.includes(teacher._id) })));

      const unavailableRoomIds = Array.from(new Set(results.filter(r => r.type === 'room' && !r.available).map(r => r.id)));
      setAvailableRooms(rooms.map(room => ({ ...room, isAvailable: !unavailableRoomIds.includes(room._id) })));

    } catch (error) {
      console.error('Error checking conflicts:', error);
    }
    setChecking(false);
  };

  // Enhanced form validation
  const validateForm = (values) => {
    const errors = [];
    if (!values.classType) errors.push('Class type is required');
    
    // Skip most validation for BREAK class types
    if (values.classType === 'BREAK') return errors;

    // Elective class validation for 7th and 8th semester
    if (isElectiveClass && isElectiveSemester) {
      if (!values.electiveNumber) errors.push('Elective number is required');
      if (!values.electiveType) errors.push('Elective type is required');
      if (!values.targetSections || values.targetSections.length === 0) {
        errors.push('Target sections are required for elective classes');
      }
      // Validate elective number based on semester
      if (semester === 7 && values.electiveNumber !== 1) {
        errors.push('7th semester only has one elective');
      }
      if (semester === 8 && ![1, 2].includes(values.electiveNumber)) {
        errors.push('8th semester has Elective I and Elective II only');
      }
    }

    if (values.classType === 'P' && !values.labGroupType) errors.push('Lab group type is required for practical classes');

    if (values.classType === 'P' && values.labGroupType === 'bothGroups') {
      if (!values.groupASubject) errors.push('Group A subject is required');
      if (!values.groupBSubject) errors.push('Group B subject is required');
      if (!values.groupATeachers?.length) errors.push('At least one teacher must be selected for Group A');
      if (!values.groupBTeachers?.length) errors.push('At least one teacher must be selected for Group B');
      if (!values.groupARoom) errors.push('Room is required for Group A');
      if (!values.groupBRoom) errors.push('Room is required for Group B');
    } else {
      if (!values.subjectId) errors.push('Subject is required');
      // For lab classes (P), teachers and room are required regardless of lab group type
      if (values.classType === 'P') {
        if (!values.teacherIds?.length) errors.push('At least one teacher must be selected for lab class');
        if (!values.roomId) errors.push('Room is required for lab class');
      } else if (values.classType !== 'BREAK') {
        // For lecture and tutorial classes
        if (!values.teacherIds?.length) errors.push('At least one teacher must be selected');
      }
    }

    // Room validation (only for non-BREAK classes that haven't already been validated above)
    if (!values.roomId && values.classType !== 'BREAK' && values.classType !== 'P') {
      errors.push('Room is required');
    }

    // *** FIXED: Multi-period validation logic ***
    if (values.isMultiPeriod || isMultiPeriod) {
      if (!selectedSlots || selectedSlots.length < 2) {
        errors.push('Multi-period classes must span at least 2 consecutive time slots');
      } else {
        const selectedIndices = selectedSlots
          .map(slotId => availableTimeSlots.findIndex(s => normalizeTimeSlotId(s._id) === normalizeTimeSlotId(slotId)))
          .filter(index => index !== -1);

        if (selectedIndices.length !== selectedSlots.length) {
          errors.push('One or more selected time slots are invalid.');
        } else {
          selectedIndices.sort((a, b) => a - b);
          let isConsecutive = true;
          for (let i = 1; i < selectedIndices.length; i++) {
            if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
              isConsecutive = false;
              break;
            }
          }
          if (!isConsecutive) {
            errors.push('Multi-period classes must use consecutive time slots');
          }
        }
      }
    }
    return errors;
  };

  const handleFormChange = (changedValues, allValues) => {
    if (changedValues.classType !== undefined) {
      filterTeachersBasedOnClassType(changedValues.classType);
      if (changedValues.classType !== currentClassType) {
        form.setFieldsValue({ teacherIds: [] });
        if (changedValues.classType !== 'P') {
          setLabGroupType(null);
          form.setFieldsValue({ labGroupType: undefined });
        }
      }
    }

    if (changedValues.labGroupType !== undefined) {
      setLabGroupType(changedValues.labGroupType);
      form.setFieldsValue({ teacherIds: [] });
      if (changedValues.labGroupType !== 'bothGroups') {
        setGroupATeachers([]); setGroupBTeachers([]);
        setGroupASubject(null); setGroupBSubject(null);
        setGroupARoom(null); setGroupBRoom(null);
        form.setFieldsValue({ groupATeachers: [], groupBTeachers: [], groupASubject: undefined, groupBSubject: undefined, groupARoom: undefined, groupBRoom: undefined });
      }
    }

    if (changedValues.isAlternativeWeek !== undefined) {
      setIsAlternativeWeek(changedValues.isAlternativeWeek);
    }

    if (changedValues.groupATeachers !== undefined) setGroupATeachers(changedValues.groupATeachers);
    if (changedValues.groupBTeachers !== undefined) setGroupBTeachers(changedValues.groupBTeachers);
    if (changedValues.groupASubject !== undefined) setGroupASubject(changedValues.groupASubject);
    if (changedValues.groupBSubject !== undefined) setGroupBSubject(changedValues.groupBSubject);
    if (changedValues.groupARoom !== undefined) setGroupARoom(changedValues.groupARoom);
    if (changedValues.groupBRoom !== undefined) setGroupBRoom(changedValues.groupBRoom);
    
    const timeoutId = setTimeout(() => {
      checkAllConflicts(allValues);
    }, 500);
    return () => clearTimeout(timeoutId);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const validationErrors = validateForm(values);
      if (validationErrors.length > 0) {
        message.error(validationErrors.join(', '));
        return;
      }
      
      // Simplified slot handling - just pass the slot IDs directly
      const baseClassData = {
        ...values,
        isMultiPeriod,
        slotIndexes: isMultiPeriod ? selectedSlots : [slotIndex]
      };

      // Handle elective classes for 7th and 8th semester
      if (isElectiveClass && isElectiveSemester) {
        const electiveLabel = semester === 7 ? 'Elective' : 
                             values.electiveNumber === 1 ? 'Elective I' : 'Elective II';
        
        try {
          // First, get the program ID from program code
          const programsResponse = await programsAPI.getPrograms();
          const program = programsResponse.data?.find(p => p.code === programCode);
          
          if (!program) {
            message.error(`Program with code ${programCode} not found`);
            return;
          }

          // Prepare elective class data with proper backend format
          const electiveClassData = {
            // Required backend fields
            programId: program._id,
            semester: semester,
            subjectId: values.subjectId,
            dayIndex: dayIndex,
            slotIndex: isMultiPeriod && selectedSlots.length > 0 ? 
                      parseInt(normalizeTimeSlotId(selectedSlots[0])) : 
                      parseInt(normalizeTimeSlotId(slotIndex)),
            teacherIds: values.teacherIds || [],
            roomId: values.roomId,
            classType: values.classType,
            
            // Multi-period support for electives
            isMultiPeriod: isMultiPeriod,
            slotIndexes: isMultiPeriod ? selectedSlots.map(s => parseInt(normalizeTimeSlotId(s))) : [parseInt(normalizeTimeSlotId(slotIndex))],
            
            // Elective-specific fields
            electiveNumber: values.electiveNumber,
            electiveType: values.electiveType || 'TECHNICAL', // Use form value or default
            
            // Student enrollment (required by backend)
            studentEnrollment: {
              total: 60, // Default combined enrollment
              fromAB: 30,
              fromCD: 30
            },
            
            // Additional fields for frontend compatibility
            programCode: programCode,
            targetSections: values.targetSections || ['AB', 'CD'],
            displayInSections: values.targetSections || ['AB', 'CD'],
            crossSectionScheduling: true,
            electiveLabel: electiveLabel,
            displayName: `${electiveLabel} - ${subjects.find(s => s.subjectId === values.subjectId)?.subjectName_display || 'Unknown Subject'}`,
            specialMarker: 'ELECTIVE_CROSS_SECTION',
            notes: values.notes || ''
          };
          
          console.log('Scheduling elective class with data:', electiveClassData);
          
          // Use the appropriate elective scheduling endpoint based on whether it's multi-period
          let response;
          if (isMultiPeriod) {
            response = await routinesAPI.scheduleElectiveClassSpanned(electiveClassData);
          } else {
            response = await routinesAPI.scheduleElectiveClass(electiveClassData);
          }
          
          if (response.data?.success) {
            const periodText = isMultiPeriod ? 'multi-period' : '';
            message.success(`${electiveLabel} ${periodText} class scheduled successfully for both sections!`);
            
            // Handle the new response structure with electiveSlots array
            const responseData = response.data.data;
            const electiveSlots = responseData.electiveSlots || [];
            const electiveInfo = responseData.electiveInfo || {};
            
            // Pass the response data to parent component  
            onSave({
              ...electiveClassData,
              electiveSlots: electiveSlots,
              electiveInfo: electiveInfo,
              _id: electiveSlots[0]?._id, // Use first slot's ID for compatibility
              spanId: responseData.spanId, // Add spanId for multi-period classes
              isElectiveClass: true,
              classCategory: 'ELECTIVE',
              crossSectionScheduled: true,
              sectionsScheduled: ['AB', 'CD'],
              isMultiPeriod: isMultiPeriod
            });
          } else {
            throw new Error(response.data?.message || 'Failed to schedule elective class');
          }
          return;
          
        } catch (error) {
          console.error('Error scheduling elective class:', error);
          const errorMessage = error.response?.data?.message || 
                              error.response?.data?.errors?.[0]?.msg ||
                              error.message ||
                              'Failed to schedule elective class';
          message.error(`Failed to schedule ${electiveLabel} class: ${errorMessage}`);
          return;
        }
      }

      if (currentClassType === 'P') {
        // Map frontend labGroupType to backend labGroup format
        const mapLabGroupType = (groupType) => {
          // Map section-based lab groups to backend values
          if (section === 'CD') {
            switch (groupType) {
              case 'groupA': return 'C'; // Group A for CD section = Group C
              case 'groupB': return 'D'; // Group B for CD section = Group D
              case 'bothGroups': return 'ALL';
              default: return 'ALL';
            }
          } else {
            // Default AB section mapping
            switch (groupType) {
              case 'groupA': return 'A';
              case 'groupB': return 'B'; 
              case 'bothGroups': return 'ALL';
              default: return 'ALL';
            }
          }
        };

        const labClassData = {
          ...baseClassData, 
          labGroup: mapLabGroupType(labGroupType), // Use backend field name
          isAlternativeWeek: isAlternativeWeek,
          displayLabel: getLabDisplayLabel(labGroupType, isAlternativeWeek)
        };
        
        console.log('🚀 Lab class data being sent:', labClassData);
        if (labGroupType === 'bothGroups') {
          labClassData.groupATeachers = groupATeachers; labClassData.groupBTeachers = groupBTeachers;
          labClassData.groupASubject = groupASubject; labClassData.groupBSubject = groupBSubject;
          labClassData.groupARoom = groupARoom; labClassData.groupBRoom = groupBRoom;
          labClassData.isAlternativeWeek = isAlternativeWeek;
        } else {
          labClassData.isAlternativeWeek = isAlternativeWeek;
        }
        onSave(labClassData);
        return;
      }
      
      if (currentClassType === 'BREAK') {
        onSave({ ...baseClassData, subjectId: null, subjectName: 'Break', teacherIds: [], roomId: null, roomName: 'Break' });
        return;
      }
      
      const hasConflicts = conflicts.length > 0;
      if (hasConflicts) {
        modal.confirm({
          title: 'Scheduling Conflicts Detected',
          width: 600,
          content: (
            <div>
              <p>One or more selected teachers or rooms have a scheduling conflict. Are you sure you want to proceed?</p>
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fff2f0', borderRadius: '6px' }}>
                <strong>Conflict Details:</strong>
                {conflicts.map((conflict, index) => (
                  <div key={index} style={{ marginTop: '8px', fontSize: '13px' }}>
                    <strong>{conflict.name}</strong> is already assigned in <strong>{conflict.slotInfo}</strong>
                    {conflict.conflictDetails && (
                      <div style={{ marginLeft: '12px', color: '#666' }}>
                        → {conflict.conflictDetails.programCode} - Sem {conflict.conflictDetails.semester} - Sec {conflict.conflictDetails.section}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ),
          okText: 'Proceed Anyway', cancelText: 'Cancel', okType: 'danger',
          onOk: () => onSave(baseClassData)
        });
      } else {
        onSave(baseClassData);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      if (error.errorFields) message.error(`Please fix the validation errors.`);
      else message.error('Please fill in all required fields correctly.');
    }
  };

  const renderConflictAlert = () => {
    if (conflicts.length === 0) return null;
    return (
      <Alert
        message="Scheduling Conflicts Detected"
        description={
          <div>
            {conflicts.map((conflict, index) => (
              <div key={index} style={{ marginBottom: '8px' }}>
                <Tag color="red">{conflict.type}</Tag>
                <strong>{conflict.name}</strong> is already assigned in <strong>{conflict.slotInfo}</strong>.
              </div>
            ))}
          </div>
        }
        type="warning" showIcon style={{ marginBottom: '16px' }}
      />
    );
  };

  return (
    <Modal
      title={<Space><ClockCircleOutlined /><span>{existingClass ? 'Edit' : 'Assign'} Class - {dayNames[dayIndex]} {selectedTimeSlot?.label}</span></Space>}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>Cancel</Button>,
        existingClass && (<Button key="clear" danger onClick={() => onClear && onClear(dayIndex, slotIndex)} icon={<DeleteOutlined />}>Clear Class</Button>),
        <Button key="save" type="primary" loading={loading || checking} onClick={handleSubmit} icon={conflicts.length > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}>
          {conflicts.length > 0 ? 'Save with Conflicts' : 'Save Class'}
        </Button>
      ]}
      width={800}
      destroyOnClose // Changed from destroyOnHidden for better state reset
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card size="small" style={{ backgroundColor: '#f9f9f9' }}>
          <Row gutter={16}>
            <Col span={8}><Text strong>Program:</Text> {programCode}</Col>
            <Col span={8}><Text strong>Semester:</Text> {semester}</Col>
            <Col span={8}><Text strong>Section:</Text> {section}</Col>
          </Row>
          <Row gutter={16} style={{ marginTop: '8px' }}>
            <Col span={12}><Text strong>Day:</Text> {dayNames[dayIndex]}</Col>
            <Col span={12}><Text strong>Time:</Text> {selectedTimeSlot?.startTime} - {selectedTimeSlot?.endTime}</Col>
          </Row>
        </Card>

        {renderConflictAlert()}

        <Form form={form} layout="vertical" onValuesChange={handleFormChange}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="classType" label="Class Type" rules={[{ required: true, message: 'Please select class type' }]}>
                <Select placeholder="Select class type" onChange={(value) => {
                  if (value === 'BREAK') {
                    setIsMultiPeriod(false);
                    form.setFieldsValue({ isMultiPeriod: false, selectedSlots: [slotIndex] });
                  }
                }}>
                  <Option value="L"><Tag color="blue">Lecture</Tag></Option>
                  <Option value="P"><Tag color="green">Practical/Lab</Tag></Option>
                  <Option value="T"><Tag color="orange">Tutorial</Tag></Option>
                  <Option value="BREAK"><Tag color="volcano">Break</Tag></Option>
                </Select>
              </Form.Item>
              
              {/* Elective Class Toggle for 7th and 8th Semester */}
              {isElectiveSemester && currentClassType && currentClassType !== 'BREAK' && (
                <Form.Item style={{ marginBottom: '12px' }}>
                  <Checkbox 
                    checked={isElectiveClass} 
                    onChange={(e) => handleElectiveToggle(e.target.checked)}
                  >
                    <Text strong style={{ color: '#722ed1' }}>
                      {semester === 7 ? 'Elective Class' : 'Elective I/II Class'} (Cross-Section)
                    </Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {semester === 7 
                        ? 'Schedule elective for both AB and CD sections'
                        : 'Schedule Elective I or II for both AB and CD sections'
                      }
                    </Text>
                  </Checkbox>
                </Form.Item>
              )}

              {/* Elective-specific fields */}
              {isElectiveClass && isElectiveSemester && (
                <Card 
                  title={
                    <Space>
                      <BranchesOutlined style={{ color: '#722ed1' }} />
                      <Text strong style={{ color: '#722ed1' }}>
                        Elective Configuration - Semester {semester}
                      </Text>
                      <Tag color="purple">Cross-Section</Tag>
                    </Space>
                  } 
                  size="small" 
                  style={{ marginBottom: '16px', borderColor: '#722ed1' }}
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item 
                        name="electiveNumber" 
                        label="Elective Number"
                        rules={[{ required: true, message: 'Please select elective number' }]}
                      >
                        <Select 
                          placeholder="Select elective"
                          value={electiveNumber}
                          onChange={setElectiveNumber}
                        >
                          {semester === 7 ? (
                            <Option value={1}>
                              <Tag color="blue">Elective</Tag>
                            </Option>
                          ) : (
                            <>
                              <Option value={1}>
                                <Tag color="blue">Elective I</Tag>
                              </Option>
                              <Option value={2}>
                                <Tag color="green">Elective II</Tag>
                              </Option>
                            </>
                          )}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item 
                        name="electiveType" 
                        label="Elective Type"
                        rules={[{ required: true, message: 'Please select elective type' }]}
                      >
                        <Select 
                          placeholder="Select type"
                          value={electiveType}
                          onChange={setElectiveType}
                        >
                          <Option value="TECHNICAL">
                            <Tag color="blue">Technical</Tag>
                          </Option>
                          <Option value="MANAGEMENT">
                            <Tag color="green">Management</Tag>
                          </Option>
                          <Option value="OPEN">
                            <Tag color="orange">Open</Tag>
                          </Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item 
                        name="targetSections" 
                        label="Target Sections"
                        rules={[{ required: true, message: 'Please select target sections' }]}
                      >
                        <Select 
                          mode="multiple"
                          placeholder="Select sections"
                          value={targetSections}
                          onChange={setTargetSections}
                        >
                          <Option value="AB">
                            <Tag color="cyan">Section AB</Tag>
                          </Option>
                          <Option value="CD">
                            <Tag color="purple">Section CD</Tag>
                          </Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Alert 
                    message="Cross-Section Elective" 
                    description={`This ${semester === 7 ? 'elective' : `elective ${electiveNumber === 1 ? 'I' : 'II'}`} (${electiveType}) class will appear in both selected sections' routines at the same time slot.`}
                    type="info" 
                    showIcon 
                    style={{ marginTop: '12px' }}
                  />
                </Card>
              )}
              
              {currentClassType === 'P' && (
                <>
                  <Form.Item name="labGroupType" label="Lab Group Type" rules={[{ required: true, message: 'Please select lab group type' }]}>
                    <Select placeholder="Select lab group type">
                      <Option value="groupA"><Tag color="cyan">Only {getSectionLabGroups().groupA}</Tag></Option>
                      <Option value="groupB"><Tag color="purple">Only {getSectionLabGroups().groupB}</Tag></Option>
                      <Option value="bothGroups"><Tag color="magenta">{getSectionLabGroups().both}</Tag></Option>
                    </Select>
                  </Form.Item>
                  
                  {labGroupType && (
                    <Form.Item name="isAlternativeWeek" valuePropName="checked" style={{ marginBottom: '12px' }}>
                      <Checkbox 
                        checked={isAlternativeWeek} 
                        onChange={(e) => setIsAlternativeWeek(e.target.checked)}
                      >
                        <Text strong>Alternative Week</Text>
                      </Checkbox>
                    </Form.Item>
                  )}
                </>
              )}
              
              {currentClassType && currentClassType !== 'BREAK' && (
                <Form.Item style={{ marginBottom: '12px' }}>
                  <Space align="center">
                    <Checkbox checked={isMultiPeriod} onChange={(e) => {
                      const checked = e.target.checked;
                      setIsMultiPeriod(checked);
                      if (checked) {
                        const currentIndex = availableTimeSlots.findIndex(s => normalizeTimeSlotId(s._id) === normalizeTimeSlotId(slotIndex));
                        if (currentIndex >= 0 && currentIndex + 1 < availableTimeSlots.length) {
                          setSelectedSlots([normalizeTimeSlotId(availableTimeSlots[currentIndex]._id), normalizeTimeSlotId(availableTimeSlots[currentIndex + 1]._id)]);
                        } else {
                          setSelectedSlots([normalizeTimeSlotId(slotIndex)]);
                        }
                      } else {
                        setSelectedSlots([normalizeTimeSlotId(slotIndex)]);
                      }
                    }}>
                      <Text strong>Multi-Period Class</Text>
                    </Checkbox>
                    {isMultiPeriod && (
                      <Select mode="multiple" size="small" placeholder="Select periods" value={selectedSlots}
                        onChange={(slots) => setSelectedSlots([...slots].sort((a, b) => availableTimeSlots.findIndex(s => normalizeTimeSlotId(s._id) === a) - availableTimeSlots.findIndex(s => normalizeTimeSlotId(s._id) === b)))}
                        style={{ minWidth: '200px' }} maxTagCount={3}>
                        {availableTimeSlots.map(slot => (<Option key={slot._id} value={normalizeTimeSlotId(slot._id)}>{slot.label}</Option>))}
                      </Select>
                    )}
                  </Space>
                </Form.Item>
              )}
            </Col>
          </Row>

          {currentClassType === 'BREAK' && <Alert message="This slot will be marked as a break period." type="info" showIcon />}
          
          {currentClassType === 'P' && labGroupType === 'bothGroups' && (
            <>
              <Divider>{isAlternativeWeek ? `${getSectionLabGroups().groupA} (Alt Week)` : getSectionLabGroups().groupA}</Divider>
              {/* Group A fields... */}
              <Row gutter={16}>
                <Col span={8}><Form.Item name="groupASubject" label="Subject" rules={[{ required: true }]}><Select placeholder="Select subject" loading={subjectsLoading} showSearch>{subjects.map(s => <Option key={`ga-${s.subjectId}`} value={s.subjectId}>{s.subjectName_display}</Option>)}</Select></Form.Item></Col>
                <Col span={8}><Form.Item name="groupATeachers" label="Teacher(s)" rules={[{ required: true }]}><Select mode="multiple" placeholder="Select teachers" loading={teachersLoading} showSearch>{filteredTeachers.map(t => <Option key={`ga-${t._id}`} value={t._id}>{t.fullName}</Option>)}</Select></Form.Item></Col>
                <Col span={8}><Form.Item name="groupARoom" label="Room" rules={[{ required: true }]}><Select placeholder="Select room" loading={roomsLoading} showSearch>{rooms.map(r => <Option key={`ga-${r._id}`} value={r._id}>{r.name}</Option>)}</Select></Form.Item></Col>
              </Row>
              <Divider>{isAlternativeWeek ? `${getSectionLabGroups().groupB} (Alt Week)` : getSectionLabGroups().groupB}</Divider>
              {/* Group B fields... */}
               <Row gutter={16}>
                <Col span={8}><Form.Item name="groupBSubject" label="Subject" rules={[{ required: true }]}><Select placeholder="Select subject" loading={subjectsLoading} showSearch>{subjects.map(s => <Option key={`gb-${s.subjectId}`} value={s.subjectId}>{s.subjectName_display}</Option>)}</Select></Form.Item></Col>
                <Col span={8}><Form.Item name="groupBTeachers" label="Teacher(s)" rules={[{ required: true }]}><Select mode="multiple" placeholder="Select teachers" loading={teachersLoading} showSearch>{filteredTeachers.map(t => <Option key={`gb-${t._id}`} value={t._id}>{t.fullName}</Option>)}</Select></Form.Item></Col>
                <Col span={8}><Form.Item name="groupBRoom" label="Room" rules={[{ required: true }]}><Select placeholder="Select room" loading={roomsLoading} showSearch>{rooms.map(r => <Option key={`gb-${r._id}`} value={r._id}>{r.name}</Option>)}</Select></Form.Item></Col>
              </Row>
            </>
          )}


          

          {currentClassType && currentClassType !== 'BREAK' && !(currentClassType === 'P' && labGroupType === 'bothGroups') && (
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="subjectId" label="Subject" rules={[{ required: true }]}>
                  <Select 
                    placeholder={isElectiveClass ? "Select elective subject" : "Select subject"} 
                    loading={subjectsLoading} 
                    showSearch
                  >
                    {subjects.map(s => (
                      <Option 
                        key={s.subjectId} 
                        value={s.subjectId}
                      >
                        <Space>
                          {isElectiveClass && (
                            <Tag color="purple">
                              {semester === 7 ? `Elective (${electiveType})` : 
                               `Elective ${electiveNumber === 1 ? 'I' : 'II'} (${electiveType})`}
                            </Tag>
                          )}
                          {s.subjectName_display}
                          {isElectiveClass && (
                            <Tag color="gold" size="small">Cross-Section</Tag>
                          )}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="teacherIds" label="Teacher(s)" rules={[{ required: true }]}>
                  <Select mode="multiple" placeholder="Select teacher(s)" loading={teachersLoading || checking} showSearch maxTagCount="responsive">
                    {filteredTeachers.map(teacher => (
                      <Option key={teacher._id} value={teacher._id} disabled={currentClassType !== 'P' && !teacher.isAvailable}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{teacher.fullName} ({teacher.shortName})</span>
                          {teacher.isAvailable ? <Tag color="green">Free</Tag> : <Tag color="red">Busy</Tag>}
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="roomId" label="Room" rules={[{ required: true }]}>
                  <Select placeholder="Select room" loading={roomsLoading} showSearch>
                    {(availableRooms.length > 0 ? availableRooms : rooms).map(room => (
                      <Option key={room._id} value={room._id} disabled={room.isAvailable === false}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{room.name}</span>
                          {room.isAvailable === false ? <Tag color="red">Busy</Tag> : room.isAvailable === true ? <Tag color="green">Free</Tag> : null}
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          <Form.Item name="notes" label="Notes (Optional)"><TextArea placeholder="Additional notes..." rows={2} /></Form.Item>
        </Form>
        {checking && <div style={{ textAlign: 'center' }}><Spin tip="Checking for conflicts..." /></div>}
      </Space>
    </Modal>
  );
};

export default AssignClassModal;
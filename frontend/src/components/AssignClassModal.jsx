import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  programsAPI,
  academicCalendarAPI
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
  
  // Enhanced search states
  const [teacherSearchText, setTeacherSearchText] = useState('');
  const [roomSearchText, setRoomSearchText] = useState('');
  const [filteredTeachersForSearch, setFilteredTeachersForSearch] = useState([]);
  const [filteredRoomsForSearch, setFilteredRoomsForSearch] = useState([]);
  
  // Elective management states for 7th and 8th semester
  const [isElectiveClass, setIsElectiveClass] = useState(false);
  const [electiveNumber, setElectiveNumber] = useState(1);
  const [electiveType, setElectiveType] = useState('TECHNICAL');
  
  // Lab group management - same configuration for both groups option
  const [useSameConfigForBothGroups, setUseSameConfigForBothGroups] = useState(false);
  
  // Ref to track if teachers have been initialized to prevent infinite loops
  const teachersInitializedRef = useRef(false);
  const [targetSections, setTargetSections] = useState(['AB', 'CD']);
  
  // Multiple subjects for electives
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [subjectTeacherPairs, setSubjectTeacherPairs] = useState([]);

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

  // Debug subjects data structure
  if (subjects.length > 0) {
    console.log('🔍 Subjects data sample:', {
      total: subjects.length,
      firstSubject: subjects[0],
      subjectStructure: Object.keys(subjects[0] || {}),
      programCode
    });
  }

  // Function to check if a subject is an elective based on program and subject code
  const isElectiveSubject = useCallback((subjectCode, programCode, semester) => {
    if (!subjectCode) {
      console.log('🔍 isElectiveSubject: Missing subject code', { subjectCode, programCode });
      return false;
    }
    
    const code = subjectCode;
    console.log('🔍 isElectiveSubject checking:', { code, programCode, semester });
    
    if (programCode === 'BEI') {
      // BEI electives based on actual database data:
      // Semester 7: CT725-XX (e.g., CT725-01, CT725-02, etc.)
      // Semester 8: CT765-XX, CT785-XX (e.g., CT765-01, CT785-01, etc.)
      const isElective = /^(CT725-\d+|CT765-\d+|CT785-\d+|EX725-\d+|EX765-\d+|EX785-\d+|EE785-\d+)$/.test(code);
      console.log('🔍 BEI pattern check:', { code, isElective, pattern: 'CT725-XX|CT765-XX|CT785-XX|EX725-XX|EX765-XX|EX785-XX|EE785-XX' });
      return isElective;
    } else if (programCode === 'BCT') {
      // BCT electives based on actual database data:
      // Semester 7: CT759-CT764, EX759-EX763
      // Semester 8: CT801-CT805, CT821-CT826, EX801-EX803, EX821-EX822, EE821
      const isElective = /^(CT(759|76[0-4]|80[1-5]|82[1-6])|EX(759|76[0-3]|80[1-3]|82[1-2])|EE821)$/.test(code);
      console.log('🔍 BCT pattern check:', { code, isElective, pattern: 'CT(759|76[0-4]|80[1-5]|82[1-6])|EX(759|76[0-3]|80[1-3]|82[1-2])|EE821' });
      return isElective;
    }
    
    console.log('🔍 No program match:', { programCode });
    return false;
  }, []);

  // Function to get filtered subjects for elective mode
  const getFilteredSubjects = useCallback(() => {
    console.log('🔍 getFilteredSubjects called:', {
      isElectiveClass,
      programCode,
      semester,
      totalSubjects: subjects.length,
      sampleSubject: subjects[0]
    });

    if (!isElectiveClass) {
      // Normal mode: show only core subjects (exclude electives)
      const coreSubjects = subjects.filter(subject => {
        const subjectCode = subject.code || subject.subjectCode;
        const isElective = isElectiveSubject(subjectCode, programCode, semester);
        console.log(`Subject ${subjectCode}: ${isElective ? 'ELECTIVE (excluded)' : 'CORE (included)'}`);
        return !isElective;
      });
      console.log('🔍 Core subjects filtered:', {
        original: subjects.length,
        filtered: coreSubjects.length,
        removed: subjects.length - coreSubjects.length
      });
      return coreSubjects;
    } else {
      // Elective mode: show only elective subjects
      const electiveSubjects = subjects.filter(subject => {
        const subjectCode = subject.code || subject.subjectCode;
        const isElective = isElectiveSubject(subjectCode, programCode, semester);
        return isElective;
      });
      console.log('🔍 Elective subjects filtered:', {
        original: subjects.length,
        filtered: electiveSubjects.length
      });
      return electiveSubjects;
    }
  }, [subjects, isElectiveClass, isElectiveSubject, programCode, semester]);

  // Search filter functions
  const filterTeachersBySearch = useCallback((teachers, searchText) => {
    if (!searchText.trim()) return teachers;
    
    const searchTerm = searchText.toLowerCase().trim();
    return teachers.filter(teacher => 
      teacher.fullName?.toLowerCase().includes(searchTerm) ||
      teacher.shortName?.toLowerCase().includes(searchTerm)
    );
  }, []);

  const filterRoomsBySearch = useCallback((rooms, searchText) => {
    if (!searchText.trim()) return rooms;
    
    const searchTerm = searchText.toLowerCase().trim();
    return rooms.filter(room => 
      room.name?.toLowerCase().includes(searchTerm) ||
      room.code?.toLowerCase().includes(searchTerm) ||
      room.building?.toLowerCase().includes(searchTerm)
    );
  }, []);

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
          const response = await routinesAPI.checkTeacherAvailability(teacher._id, dayIndex, slotIndex, semester);
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
  }, [teachers, dayIndex, slotIndex, semester]);

  // Filter rooms based on availability
  const filterRoomsBasedOnAvailability = useCallback(async () => {
    if (rooms.length === 0) return;

    setChecking(true);
    try {
      const availabilityChecks = rooms.map(async (room) => {
        try {
          const response = await routinesAPI.checkRoomAvailability(room._id, dayIndex, slotIndex, semester);
          const availabilityData = response.data?.data || response.data;
          return {
            ...room,
            isAvailable: availabilityData.isAvailable,
            conflictDetails: availabilityData.conflict,
            reason: availabilityData.isAvailable ? 'Available' : 'Occupied in this slot'
          };
        } catch (error) {
          console.warn(`Error checking availability for room ${room.name}:`, error);
          return {
            ...room,
            isAvailable: true, // Assume available on error
            reason: 'Could not verify (assumed available)'
          };
        }
      });

      const roomAvailability = await Promise.all(availabilityChecks);
      setAvailableRooms(roomAvailability);

    } catch (error) {
      console.error('Error checking room availability:', error);
      // Fallback to showing all rooms if availability check fails
      setAvailableRooms(rooms.map(room => ({
        ...room,
        isAvailable: true,
        reason: 'Availability check failed'
      })));
    }
    setChecking(false);
  }, [rooms, dayIndex, slotIndex, semester]);

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
      
      // Trigger teacher availability check for elective classes
      // Don't set a default class type - let user choose
      if (currentClassType) {
        // Re-filter teachers with current class type
        filterTeachersBasedOnClassType(currentClassType);
      }
    } else {
      // Reset elective-specific fields
      form.setFieldsValue({
        electiveNumber: undefined,
        electiveType: undefined,
        targetSections: undefined
      });
      
      // Re-filter teachers when leaving elective mode
      if (currentClassType) {
        filterTeachersBasedOnClassType(currentClassType);
      }
    }
  };

  // Helper functions for multiple subject management in electives
  const handleAddSubject = (subjectId) => {
    const subject = subjects.find(s => s.subjectId === subjectId);
    if (subject && !selectedSubjects.find(s => s.subjectId === subjectId)) {
      const newSubject = {
        subjectId: subject.subjectId,
        subjectName: subject.subjectName_display,
        subjectCode: subject.subjectCode_display || subject.subjectName_display.split(' ').map(w => w[0]).join('').toUpperCase()
      };
      setSelectedSubjects(prev => [...prev, newSubject]);
      setSubjectTeacherPairs(prev => [...prev, { subject: newSubject, teacherId: null, roomId: null }]);
    }
  };

  const handleRemoveSubject = (subjectId) => {
    setSelectedSubjects(prev => prev.filter(s => s.subjectId !== subjectId));
    setSubjectTeacherPairs(prev => prev.filter(p => p.subject.subjectId !== subjectId));
  };

  const handleTeacherChange = (subjectId, teacherId) => {
    setSubjectTeacherPairs(prev => prev.map(pair => 
      pair.subject.subjectId === subjectId 
        ? { ...pair, teacherId }
        : pair
    ));
  };

  const handleRoomChange = (subjectId, roomId) => {
    setSubjectTeacherPairs(prev => prev.map(pair => 
      pair.subject.subjectId === subjectId 
        ? { ...pair, roomId }
        : pair
    ));
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
  }, [visible, teachers.length, currentClassType, dayIndex, slotIndex]); // Removed filterTeachersBasedOnClassType from dependencies

  // Update room availability when modal opens or relevant parameters change
  useEffect(() => {
    if (visible && rooms.length > 0) {
      filterRoomsBasedOnAvailability();
    }
  }, [visible, rooms.length, dayIndex, slotIndex, filterRoomsBasedOnAvailability]);

  // Update filtered teachers when search text or filteredTeachers changes
  useEffect(() => {
    const searchFiltered = filterTeachersBySearch(filteredTeachers, teacherSearchText);
    setFilteredTeachersForSearch(searchFiltered);
  }, [filteredTeachers, teacherSearchText, filterTeachersBySearch]);

  // Ensure teacher availability is checked when elective mode is toggled
  useEffect(() => {
    if (visible && teachers.length > 0 && isElectiveClass) {
      // For elective classes, ensure teachers are available
      if (!teachersInitializedRef.current) {
        teachersInitializedRef.current = true;
        filterTeachersBasedOnClassType(currentClassType || 'L');
      }
    } else if (!visible) {
      // Reset the ref when modal closes
      teachersInitializedRef.current = false;
    }
  }, [visible, teachers.length, isElectiveClass, currentClassType]); // Removed filterTeachersBasedOnClassType from dependencies

  // Update filtered rooms when search text or rooms data changes
  useEffect(() => {
    const roomsToFilter = availableRooms.length > 0 ? availableRooms : rooms;
    const searchFiltered = roomsToFilter.filter(room => 
      room.name?.toLowerCase().includes(roomSearchText.toLowerCase()) ||
      room.roomName?.toLowerCase().includes(roomSearchText.toLowerCase())
    );
    setFilteredRoomsForSearch(searchFiltered);
  }, [rooms, availableRooms, roomSearchText]);

  // Reset search states when modal visibility changes
  useEffect(() => {
    if (!visible) {
      setTeacherSearchText('');
      setRoomSearchText('');
    }
  }, [visible]);

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
            
            // Check if same configuration was used for both groups
            const isSameSubject = existingClass.groupASubject && 
                                  existingClass.groupBSubject && 
                                  existingClass.groupASubject === existingClass.groupBSubject;
            const isSameTeachers = existingClass.groupATeachers && 
                                   existingClass.groupBTeachers &&
                                   JSON.stringify(existingClass.groupATeachers.sort()) === JSON.stringify(existingClass.groupBTeachers.sort());
            const isSameRoom = existingClass.groupARoom && 
                               existingClass.groupBRoom && 
                               existingClass.groupARoom === existingClass.groupBRoom;
            
            const isSameConfig = isSameSubject && isSameTeachers && isSameRoom;
            setUseSameConfigForBothGroups(isSameConfig);
            
            form.setFieldsValue({
              groupATeachers: existingClass.groupATeachers || [],
              groupBTeachers: existingClass.groupBTeachers || [],
              groupASubject: existingClass.groupASubject || undefined,
              groupBSubject: existingClass.groupBSubject || undefined,
              groupARoom: existingClass.groupARoom || undefined,
              groupBRoom: existingClass.groupBRoom || undefined,
              isAlternativeWeek: existingClass.isAlternativeWeek || false,
              // If same config is detected, also populate standard fields
              ...(isSameConfig && {
                subjectId: existingClass.groupASubject,
                teacherIds: existingClass.groupATeachers,
                roomId: existingClass.groupARoom
              })
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
      setUseSameConfigForBothGroups(false);
      setIsMultiPeriod(false);
      setSelectedSlots([slotIndex]);
      
      // Reset elective fields
      setIsElectiveClass(false);
      setElectiveNumber(1);
      setElectiveType('TECHNICAL');
      setTargetSections(['AB', 'CD']);
      setSelectedSubjects([]);
      setSubjectTeacherPairs([]);
      
      setFilteredTeachers(teachers.map(teacher => ({
        ...teacher,
        isAvailable: true,
        reason: 'Select class type to check availability'
      })));
    }
  }, [existingClass, visible, teachers.length, form, slotIndex]); // Removed filterTeachersBasedOnClassType from dependencies

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
              routinesAPI.checkTeacherAvailability(teacherId, dayIndex, normalizedSlotId, semester)
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
            routinesAPI.checkRoomAvailability(values.roomId, dayIndex, normalizedSlotId, semester)
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
    console.log('🚀 ValidateForm called with values:', values);
    console.log('🚀 isElectiveClass:', isElectiveClass);
    console.log('🚀 isElectiveSemester:', isElectiveSemester);
    console.log('🚀 selectedSubjects:', selectedSubjects);
    console.log('🚀 subjectTeacherPairs:', subjectTeacherPairs);
    console.log('🚀 values.teacherIds:', values.teacherIds);
    console.log('🚀 values.classType:', values.classType);
    
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

    if (values.classType === 'P' && !isElectiveClass && !values.labGroupType) errors.push('Lab group type is required for practical classes');

    if (values.classType === 'P' && values.labGroupType === 'bothGroups') {
      if (useSameConfigForBothGroups) {
        // When using same config, only check Group A fields and use them for both
        if (!values.groupASubject) errors.push('Subject is required for lab class');
        if (!values.groupATeachers?.length) errors.push('At least one teacher must be selected');
        if (!values.groupARoom) errors.push('Room is required');
      } else {
        // When using different configs, check both groups
        if (!values.groupASubject) errors.push('Group A subject is required');
        if (!values.groupBSubject) errors.push('Group B subject is required');
        if (!values.groupATeachers?.length) errors.push('At least one teacher must be selected for Group A');
        if (!values.groupBTeachers?.length) errors.push('At least one teacher must be selected for Group B');
        if (!values.groupARoom) errors.push('Room is required for Group A');
        if (!values.groupBRoom) errors.push('Room is required for Group B');
      }
    } else {
      // Handle validation for multiple subjects in electives
      if (isElectiveClass && selectedSubjects.length > 0) {
        console.log('🔍 Validating elective class...');
        console.log('🔍 selectedSubjects:', selectedSubjects);
        console.log('🔍 subjectTeacherPairs:', subjectTeacherPairs);
        
        if (selectedSubjects.length === 0) {
          errors.push('At least one subject is required for elective class');
        }
        if (subjectTeacherPairs.some(pair => !pair.teacherId)) {
          console.log('❌ Some subjects missing teachers');
          errors.push('All elective subjects must have assigned teachers');
        }
        
        // For rooms, all subjects must have rooms assigned
        if (subjectTeacherPairs.some(pair => !pair.roomId)) {
          console.log('❌ Some subjects missing rooms');
          errors.push('All elective subjects must have rooms assigned');
        }
        
        if (selectedSubjects.length !== subjectTeacherPairs.filter(pair => pair.teacherId).length) {
          console.log('❌ Teacher count mismatch');
          errors.push('All elective subjects must have assigned teachers');
        }
      } else if (!values.subjectId) {
        errors.push('Subject is required');
      }
      
      // For lab classes (P), teachers and room are required regardless of lab group type
      if (values.classType === 'P' && !isElectiveClass) {
        if (!values.teacherIds?.length) errors.push('At least one teacher must be selected for lab class');
        if (!values.roomId) errors.push('Room is required for lab class');
      } else if (values.classType !== 'BREAK' && !(isElectiveClass && selectedSubjects.length > 0)) {
        // For lecture and tutorial classes (but not elective classes with multiple subjects)
        if (!values.teacherIds?.length) errors.push('At least one teacher must be selected');
      }
    }

    // Room validation (only for non-BREAK classes that haven't already been validated above)
    if (values.classType !== 'BREAK' && values.classType !== 'P' && !isElectiveClass) {
      if (!values.roomId) {
        errors.push('Room is required');
      }
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

    if (changedValues.groupATeachers !== undefined) {
      setGroupATeachers(changedValues.groupATeachers);
      // If same config is enabled, automatically update Group B teachers and standard field
      if (useSameConfigForBothGroups) {
        form.setFieldsValue({ 
          groupBTeachers: changedValues.groupATeachers,
          teacherIds: changedValues.groupATeachers // Also update standard field
        });
        setGroupBTeachers(changedValues.groupATeachers);
      }
    }
    if (changedValues.groupBTeachers !== undefined) setGroupBTeachers(changedValues.groupBTeachers);
    if (changedValues.groupASubject !== undefined) {
      setGroupASubject(changedValues.groupASubject);
      // If same config is enabled, automatically update Group B subject and standard field
      if (useSameConfigForBothGroups) {
        form.setFieldsValue({ 
          groupBSubject: changedValues.groupASubject,
          subjectId: changedValues.groupASubject // Also update standard field
        });
        setGroupBSubject(changedValues.groupASubject);
      }
    }
    if (changedValues.groupBSubject !== undefined) setGroupBSubject(changedValues.groupBSubject);
    if (changedValues.groupARoom !== undefined) {
      setGroupARoom(changedValues.groupARoom);
      // If same config is enabled, automatically update Group B room and standard field
      if (useSameConfigForBothGroups) {
        form.setFieldsValue({ 
          groupBRoom: changedValues.groupARoom,
          roomId: changedValues.groupARoom // Also update standard field
        });
        setGroupBRoom(changedValues.groupARoom);
      }
    }
    if (changedValues.groupBRoom !== undefined) setGroupBRoom(changedValues.groupBRoom);
    
    const timeoutId = setTimeout(() => {
      checkAllConflicts(allValues);
    }, 500);
    return () => clearTimeout(timeoutId);
  };

  const handleSubmit = async () => {
    console.log('🚀 HandleSubmit called!');
    console.log('🚀 isElectiveClass:', isElectiveClass);
    console.log('🚀 isElectiveSemester:', isElectiveSemester);
    console.log('🚀 semester:', semester);
    try {
      const values = await form.validateFields();
      console.log('🚀 Form values:', values);
      const validationErrors = validateForm(values);
      console.log('🚀 Validation errors:', validationErrors);
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

          // Get current academic year
          const academicYearResponse = await academicCalendarAPI.getCurrentAcademicCalendar();
          const currentAcademicYear = academicYearResponse.data;
          
          if (!currentAcademicYear) {
            message.error('No current academic year found');
            return;
          }

          // Prepare elective class data with proper backend format
          const electiveClassData = {
            // Required backend fields
            programId: program._id,
            academicYearId: currentAcademicYear._id,
            semester: semester,
            section: section,
            dayIndex: dayIndex,
            slotIndex: isMultiPeriod && selectedSlots.length > 0 ? 
                      parseInt(normalizeTimeSlotId(selectedSlots[0])) : 
                      parseInt(normalizeTimeSlotId(slotIndex)),
            roomId: subjectTeacherPairs.length > 0 ? subjectTeacherPairs[0].roomId : values.roomId,
            classType: values.classType,
            
            // Multi-period support for electives
            isMultiPeriod: isMultiPeriod,
            slotIndexes: isMultiPeriod ? selectedSlots.map(s => parseInt(normalizeTimeSlotId(s))) : [parseInt(normalizeTimeSlotId(slotIndex))],
            
            // Handle multiple subjects for electives
            ...(selectedSubjects.length > 0 && subjectTeacherPairs.length > 0 ? {
              // Multiple subjects mode
              subjects: subjectTeacherPairs.map(pair => ({
                subjectId: pair.subject.subjectId,
                teacherId: pair.teacherId,
                roomId: pair.roomId
              })),
              subjectIds: subjectTeacherPairs.map(pair => pair.subject.subjectId),
              teacherIds: subjectTeacherPairs.map(pair => pair.teacherId).filter(Boolean),
              roomIds: subjectTeacherPairs.map(pair => pair.roomId).filter(Boolean)
            } : {
              // Single subject mode (fallback)
              subjectId: values.subjectId,
              teacherIds: values.teacherIds || [],
              roomId: subjectTeacherPairs.length > 0 ? subjectTeacherPairs[0].roomId : null
            }),
            
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
            displayName: selectedSubjects.length > 0 ? 
              `${electiveLabel} - ${selectedSubjects.map(s => s.subjectCode).join(', ')}` :
              `${electiveLabel} - ${subjects.find(s => s.subjectId === values.subjectId)?.subjectName_display || 'Unknown Subject'}`,
            specialMarker: 'ELECTIVE_CROSS_SECTION',
            notes: values.notes || '',
            isMultipleElectives: selectedSubjects.length > 1
          };
          
          console.log('Scheduling elective class with data:', electiveClassData);
          
          // Use the appropriate elective scheduling endpoint
          let response;
          if (selectedSubjects.length > 0) {
            // Multiple subjects - use createMultipleElectiveClass regardless of multi-period
            // This endpoint needs to be enhanced to handle multi-period
            response = await routinesAPI.createMultipleElectiveClass(electiveClassData);
          } else if (isMultiPeriod) {
            // Single subject multi-period
            response = await routinesAPI.scheduleElectiveClassSpanned(electiveClassData);
          } else {
            // Single subject single period
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
          labClassData.groupATeachers = groupATeachers; 
          labClassData.groupBTeachers = useSameConfigForBothGroups ? groupATeachers : groupBTeachers;
          labClassData.groupASubject = groupASubject; 
          // Use same config for Group B if the option is enabled
          labClassData.groupBSubject = useSameConfigForBothGroups ? groupASubject : groupBSubject;
          labClassData.groupARoom = groupARoom; 
          labClassData.groupBRoom = useSameConfigForBothGroups ? groupARoom : groupBRoom;
          labClassData.isAlternativeWeek = isAlternativeWeek;
          labClassData.useSameConfigForBothGroups = useSameConfigForBothGroups;
          
          // For backend validation, also set the standard fields when using same config
          if (useSameConfigForBothGroups) {
            labClassData.subjectId = groupASubject;
            labClassData.teacherIds = groupATeachers;
            labClassData.roomId = groupARoom;
          }
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
              
              {currentClassType === 'P' && !isElectiveClass && (
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
              {/* Hidden fields for backend validation when using same configuration */}
              <Form.Item name="subjectId" style={{ display: 'none' }}>
                <Input type="hidden" />
              </Form.Item>
              <Form.Item name="teacherIds" style={{ display: 'none' }}>
                <Input type="hidden" />
              </Form.Item>
              <Form.Item name="roomId" style={{ display: 'none' }}>
                <Input type="hidden" />
              </Form.Item>
              
              <Form.Item style={{ marginBottom: '12px' }}>
                <Checkbox 
                  checked={useSameConfigForBothGroups} 
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseSameConfigForBothGroups(checked);
                    if (checked) {
                      // When enabling same config, copy Group A values to Group B
                      const groupASubjectValue = form.getFieldValue('groupASubject');
                      const groupATeachersValue = form.getFieldValue('groupATeachers');
                      const groupARoomValue = form.getFieldValue('groupARoom');
                      
                      if (groupASubjectValue) {
                        form.setFieldsValue({ 
                          groupBSubject: groupASubjectValue,
                          subjectId: groupASubjectValue // Also set standard field for backend validation
                        });
                        setGroupBSubject(groupASubjectValue);
                      }
                      if (groupATeachersValue) {
                        form.setFieldsValue({ 
                          groupBTeachers: groupATeachersValue,
                          teacherIds: groupATeachersValue // Also set standard field for backend validation
                        });
                        setGroupBTeachers(groupATeachersValue);
                      }
                      if (groupARoomValue) {
                        form.setFieldsValue({ 
                          groupBRoom: groupARoomValue,
                          roomId: groupARoomValue // Also set standard field for backend validation
                        });
                        setGroupBRoom(groupARoomValue);
                      }
                    }
                  }}
                >
                  <Text strong>Use same subject, teachers, and room for both groups</Text>
                </Checkbox>
                {useSameConfigForBothGroups && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                    <Text type="secondary">
                      Both groups will use identical lab configuration. Perfect for alternating lab sessions 
                      where the same instructors and equipment serve both groups on different weeks.
                    </Text>
                  </div>
                )}
              </Form.Item>
              
              <Divider>{isAlternativeWeek ? `${getSectionLabGroups().groupA} (Alt Week)` : getSectionLabGroups().groupA}</Divider>
              {/* Group A fields... */}
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item 
                    name="groupASubject" 
                    label={useSameConfigForBothGroups ? "Subject (For Both Groups)" : "Subject"} 
                    rules={[{ required: true }]}
                  >
                    <Select 
                      key={`subject-dropdown-ga-${isElectiveClass}-${subjects.length}`}
                      placeholder="Select subject" 
                      loading={subjectsLoading} 
                      showSearch
                    >
                      {getFilteredSubjects().map(s => <Option key={`ga-${s.subjectId}`} value={s.subjectId}>{s.subjectName_display}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item 
                    name="groupATeachers" 
                    label={useSameConfigForBothGroups ? "Teacher(s) (For Both Groups)" : "Teacher(s)"} 
                    rules={[{ required: true }]}
                  >
                    <Select 
                      mode="multiple" 
                      placeholder="Search and select teachers..." 
                      loading={teachersLoading} 
                      showSearch
                      filterOption={(input, option) => {
                        const teacher = filteredTeachers.find(t => t._id === option.value);
                        if (!teacher) return false;
                        const searchTerm = input.toLowerCase();
                        return teacher.fullName?.toLowerCase().includes(searchTerm) ||
                               teacher.shortName?.toLowerCase().includes(searchTerm);
                      }}
                    >
                      {/* ...existing teacher options... */}
                      {filteredTeachers.map(t => (
                        <Option key={`ga-${t._id}`} value={t._id}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div>{t.fullName}</div>
                                <div style={{ fontSize: '11px', color: '#666' }}>Code: {t.shortName}</div>
                              </div>
                              {!t.isAvailable && <Tag color="red" size="small">Busy</Tag>}
                            </div>
                            {!t.isAvailable && t.conflictDetails && (
                              <div style={{ 
                                fontSize: '10px', 
                                color: '#ff4d4f', 
                                backgroundColor: '#fff2f0', 
                                padding: '2px 4px', 
                                borderRadius: '3px',
                                border: '1px solid #ffccc7'
                              }}>
                                {t.conflictDetails.subjectName || 'Unknown'} 
                                {t.conflictDetails.roomName && ` in ${t.conflictDetails.roomName}`}
                                {t.conflictDetails.programCode && ` (${t.conflictDetails.programCode}`}
                                {t.conflictDetails.semester && ` S${t.conflictDetails.semester}`}
                                {t.conflictDetails.section && ` ${t.conflictDetails.section}`}
                                {t.conflictDetails.programCode && ')'}
                              </div>
                            )}
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item 
                    name="groupARoom" 
                    label={useSameConfigForBothGroups ? "Room (For Both Groups)" : "Room"} 
                    rules={[{ required: true }]}
                  >
                    <Select 
                      placeholder="Search and select room..." 
                      loading={roomsLoading} 
                      showSearch
                      filterOption={(input, option) => {
                        const room = rooms.find(r => r._id === option.value);
                        if (!room) return false;
                        const searchTerm = input.toLowerCase();
                        return room.name?.toLowerCase().includes(searchTerm) ||
                               room.code?.toLowerCase().includes(searchTerm);
                      }}
                    >
                      {/* ...existing room options... */}
                      {rooms.map(r => (
                        <Option key={`ga-${r._id}`} value={r._id}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div>{r.name}</div>
                                {r.code && <div style={{ fontSize: '11px', color: '#666' }}>Code: {r.code}</div>}
                              </div>
                              {r.isAvailable === false && <Tag color="red" size="small">Busy</Tag>}
                            </div>
                            {r.isAvailable === false && r.conflictDetails && (
                              <div style={{ 
                                fontSize: '10px', 
                                color: '#ff4d4f', 
                                backgroundColor: '#fff2f0', 
                                padding: '2px 4px', 
                                borderRadius: '3px',
                                border: '1px solid #ffccc7'
                              }}>
                                Occupied: {r.conflictDetails.subjectName || 'Unknown'}
                                {r.conflictDetails.programCode && ` (${r.conflictDetails.programCode}`}
                                {r.conflictDetails.semester && ` S${r.conflictDetails.semester}`}
                                {r.conflictDetails.section && ` ${r.conflictDetails.section}`}
                                {r.conflictDetails.programCode && ')'}
                              </div>
                            )}
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Divider>{isAlternativeWeek ? `${getSectionLabGroups().groupB} (Alt Week)` : getSectionLabGroups().groupB}</Divider>
              {/* Group B fields... */}
               <Row gutter={16}>
                <Col span={8}>
                  <Form.Item 
                    name="groupBSubject" 
                    label={useSameConfigForBothGroups ? "Subject (Same as Group A)" : "Subject"} 
                    rules={[{ required: !useSameConfigForBothGroups }]}
                  >
                    <Select 
                      key={`subject-dropdown-gb-${isElectiveClass}-${subjects.length}`}
                      placeholder={useSameConfigForBothGroups ? "Same subject as Group A" : "Select subject"} 
                      loading={subjectsLoading} 
                      showSearch
                      disabled={useSameConfigForBothGroups}
                    >
                      {getFilteredSubjects().map(s => <Option key={`gb-${s.subjectId}`} value={s.subjectId}>{s.subjectName_display}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item 
                    name="groupBTeachers" 
                    label={useSameConfigForBothGroups ? "Teacher(s) (Same as Group A)" : "Teacher(s)"} 
                    rules={[{ required: !useSameConfigForBothGroups }]}
                  >
                    <Select 
                      mode="multiple" 
                      placeholder={useSameConfigForBothGroups ? "Same teachers as Group A" : "Search and select teachers..."} 
                      loading={teachersLoading} 
                      showSearch
                      disabled={useSameConfigForBothGroups}
                      filterOption={(input, option) => {
                        const teacher = filteredTeachers.find(t => t._id === option.value);
                        if (!teacher) return false;
                        const searchTerm = input.toLowerCase();
                        return teacher.fullName?.toLowerCase().includes(searchTerm) ||
                               teacher.shortName?.toLowerCase().includes(searchTerm);
                      }}
                    >
                      {/* ...existing teacher options... */}
                      {filteredTeachers.map(t => (
                        <Option key={`gb-${t._id}`} value={t._id}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div>{t.fullName}</div>
                                <div style={{ fontSize: '11px', color: '#666' }}>Code: {t.shortName}</div>
                              </div>
                              {!t.isAvailable && <Tag color="red" size="small">Busy</Tag>}
                            </div>
                            {!t.isAvailable && t.conflictDetails && (
                              <div style={{ 
                                fontSize: '10px', 
                                color: '#ff4d4f', 
                                backgroundColor: '#fff2f0', 
                                padding: '2px 4px', 
                                borderRadius: '3px',
                                border: '1px solid #ffccc7'
                              }}>
                                {t.conflictDetails.subjectName || 'Unknown'} 
                                {t.conflictDetails.roomName && ` in ${t.conflictDetails.roomName}`}
                                {t.conflictDetails.programCode && ` (${t.conflictDetails.programCode}`}
                                {t.conflictDetails.semester && ` S${t.conflictDetails.semester}`}
                                {t.conflictDetails.section && ` ${t.conflictDetails.section}`}
                                {t.conflictDetails.programCode && ')'}
                              </div>
                            )}
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item 
                    name="groupBRoom" 
                    label={useSameConfigForBothGroups ? "Room (Same as Group A)" : "Room"} 
                    rules={[{ required: !useSameConfigForBothGroups }]}
                  >
                    <Select 
                      placeholder={useSameConfigForBothGroups ? "Same room as Group A" : "Search and select room..."} 
                      loading={roomsLoading} 
                      showSearch
                      disabled={useSameConfigForBothGroups}
                      filterOption={(input, option) => {
                        const room = rooms.find(r => r._id === option.value);
                        if (!room) return false;
                        const searchTerm = input.toLowerCase();
                        return room.name?.toLowerCase().includes(searchTerm) ||
                               room.code?.toLowerCase().includes(searchTerm);
                      }}
                    >
                      {/* ...existing room options... */}
                      {rooms.map(r => (
                        <Option key={`gb-${r._id}`} value={r._id}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div>{r.name}</div>
                                {r.code && <div style={{ fontSize: '11px', color: '#666' }}>Code: {r.code}</div>}
                              </div>
                              {r.isAvailable === false && <Tag color="red" size="small">Busy</Tag>}
                            </div>
                            {r.isAvailable === false && r.conflictDetails && (
                              <div style={{ 
                                fontSize: '10px', 
                                color: '#ff4d4f', 
                                backgroundColor: '#fff2f0', 
                                padding: '2px 4px', 
                                borderRadius: '3px',
                                border: '1px solid #ffccc7'
                              }}>
                                Occupied: {r.conflictDetails.subjectName || 'Unknown'}
                                {r.conflictDetails.programCode && ` (${r.conflictDetails.programCode}`}
                                {r.conflictDetails.semester && ` S${r.conflictDetails.semester}`}
                                {r.conflictDetails.section && ` ${r.conflictDetails.section}`}
                                {r.conflictDetails.programCode && ')'}
                              </div>
                            )}
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              
              {useSameConfigForBothGroups && (
                <Alert 
                  message="Same Configuration for Both Groups" 
                  description={`Both ${getSectionLabGroups().groupA} and ${getSectionLabGroups().groupB} will use identical lab configuration (same subject, teachers, and room). Perfect for alternating lab sessions where groups share all resources.`}
                  type="info" 
                  showIcon 
                  style={{ marginTop: '12px' }}
                />
              )}
            </>
          )}


          

          {currentClassType && currentClassType !== 'BREAK' && !(currentClassType === 'P' && labGroupType === 'bothGroups') && (
            <>
              {isElectiveClass ? (
                // Multiple subjects interface for elective classes
                <div>
                  <Row gutter={16}>
                    <Col span={24}>
                      <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>
                        Add Elective Subjects
                      </label>
                      <Select 
                        placeholder="Select a subject to add" 
                        loading={subjectsLoading} 
                        showSearch
                        style={{ width: '100%' }}
                        value={null}
                        onChange={handleAddSubject}
                      >
                        {getFilteredSubjects()
                          .filter(s => !selectedSubjects.find(selected => selected.subjectId === s.subjectId))
                          .map(s => (
                          <Option key={s.subjectId} value={s.subjectId}>
                            <Space>
                              <Tag color="purple">
                                {semester === 7 ? `Elective (${electiveType})` : 
                                 `Elective ${electiveNumber === 1 ? 'I' : 'II'} (${electiveType})`}
                              </Tag>
                              {s.subjectName_display}
                              <Tag color="gold" size="small">Cross-Section</Tag>
                            </Space>
                          </Option>
                        ))}
                      </Select>
                    </Col>
                  </Row>
                  
                  {selectedSubjects.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <label style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>
                        Selected Subjects and Teachers ({selectedSubjects.length})
                      </label>
                      <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', padding: '12px' }}>
                        {selectedSubjects.map((subject, index) => {
                          const pair = subjectTeacherPairs.find(p => p.subject.subjectId === subject.subjectId);
                          return (
                            <div key={subject.subjectId} style={{ 
                              marginBottom: index < selectedSubjects.length - 1 ? '12px' : '0',
                              padding: '8px',
                              border: '1px solid #f0f0f0',
                              borderRadius: '4px',
                              backgroundColor: '#fafafa'
                            }}>
                              <Row gutter={16} align="middle">
                                <Col span={6}>
                                  <div>
                                    <div style={{ fontWeight: 'bold' }}>{subject.subjectCode}</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>{subject.subjectName}</div>
                                  </div>
                                </Col>
                                <Col span={8}>
                                  <Select
                                    placeholder="Select teacher"
                                    style={{ width: '100%' }}
                                    value={pair?.teacherId}
                                    onChange={(teacherId) => handleTeacherChange(subject.subjectId, teacherId)}
                                    showSearch
                                    loading={teachersLoading || checking}
                                    filterOption={(input, option) => {
                                      const teacher = (filteredTeachers && filteredTeachers.length > 0 ? filteredTeachers : teachers || []).find(t => t._id === option.value);
                                      if (!teacher) return false;
                                      const searchTerm = input.toLowerCase();
                                      return teacher.fullName?.toLowerCase().includes(searchTerm) ||
                                             teacher.shortName?.toLowerCase().includes(searchTerm);
                                    }}
                                  >
                                    {(filteredTeachers && filteredTeachers.length > 0 ? filteredTeachers : teachers || []).map(teacher => (
                                      <Option key={teacher._id} value={teacher._id} disabled={!teacher.isAvailable && teacher.isAvailable !== undefined}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                              <div style={{ fontWeight: 500 }}>{teacher.fullName}</div>
                                              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                                Code: {teacher.shortName}
                                              </div>
                                            </div>
                                            <div style={{ marginLeft: '8px' }}>
                                              {teacher.isAvailable !== undefined ? (
                                                teacher.isAvailable ? <Tag color="green">Free</Tag> : <Tag color="red">Busy</Tag>
                                              ) : (
                                                <Tag color="default">Check</Tag>
                                              )}
                                            </div>
                                          </div>
                                          {!teacher.isAvailable && teacher.conflictDetails && (
                                            <div style={{ 
                                              fontSize: '10px', 
                                              color: '#ff4d4f', 
                                              backgroundColor: '#fff2f0', 
                                              padding: '2px 4px', 
                                              borderRadius: '3px',
                                              border: '1px solid #ffccc7',
                                              marginTop: '2px'
                                            }}>
                                              {teacher.conflictDetails.subjectName || 'Unknown Subject'} 
                                              {teacher.conflictDetails.roomName && ` in ${teacher.conflictDetails.roomName}`}
                                              {teacher.conflictDetails.programCode && ` (${teacher.conflictDetails.programCode}`}
                                              {teacher.conflictDetails.semester && ` S${teacher.conflictDetails.semester}`}
                                              {teacher.conflictDetails.section && ` ${teacher.conflictDetails.section}`}
                                              {teacher.conflictDetails.programCode && ')'}
                                            </div>
                                          )}
                                        </div>
                                      </Option>
                                    ))}
                                  </Select>
                                </Col>
                                <Col span={8}>
                                  <Select
                                    placeholder="Select room"
                                    style={{ width: '100%' }}
                                    value={pair?.roomId}
                                    onChange={(roomId) => handleRoomChange(subject.subjectId, roomId)}
                                    showSearch
                                    loading={roomsLoading}
                                    filterOption={(input, option) => {
                                      const room = availableRooms.find(r => r._id === option.value);
                                      if (!room) return false;
                                      const searchTerm = input.toLowerCase();
                                      return room.name?.toLowerCase().includes(searchTerm) ||
                                             room.code?.toLowerCase().includes(searchTerm);
                                    }}
                                  >
                                    {availableRooms.map(room => (
                                      <Option key={room._id} value={room._id} disabled={room.isAvailable === false}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                              <div style={{ fontWeight: 500 }}>{room.name}</div>
                                              {room.code && (
                                                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                                  Code: {room.code}
                                                  {room.building && ` • Building: ${room.building}`}
                                                  {room.floor && ` • Floor: ${room.floor}`}
                                                </div>
                                              )}
                                            </div>
                                            <div style={{ marginLeft: '8px' }}>
                                              {room.isAvailable === false ? <Tag color="red">Busy</Tag> : room.isAvailable === true ? <Tag color="green">Free</Tag> : null}
                                            </div>
                                          </div>
                                          {room.isAvailable === false && room.conflictDetails && (
                                            <div style={{ 
                                              fontSize: '10px', 
                                              color: '#ff4d4f', 
                                              backgroundColor: '#fff2f0', 
                                              padding: '2px 4px', 
                                              borderRadius: '3px',
                                              border: '1px solid #ffccc7',
                                              marginTop: '2px'
                                            }}>
                                              Occupied: {room.conflictDetails.subjectName || 'Unknown Class'}
                                              {room.conflictDetails.programCode && room.conflictDetails.semester && room.conflictDetails.section && 
                                                ` (${room.conflictDetails.programCode} S${room.conflictDetails.semester} Sec ${room.conflictDetails.section})`
                                              }
                                            </div>
                                          )}
                                        </div>
                                      </Option>
                                    ))}
                                  </Select>
                                </Col>
                                <Col span={2}>
                                  <Button 
                                    type="link" 
                                    danger 
                                    onClick={() => handleRemoveSubject(subject.subjectId)}
                                    style={{ padding: 0 }}
                                  >
                                    ×
                                  </Button>
                                </Col>
                              </Row>
                            </div>
                          );
                        })}
                      </div>
                      
                      {selectedSubjects.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                          💡 Subject-teacher order will be maintained in the routine display
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // Single subject interface for non-elective classes
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="subjectId" label="Subject" rules={[{ required: true }]}>
                      <Select 
                        key={`subject-dropdown-${isElectiveClass}-${subjects.length}`}
                        placeholder="Select subject" 
                        loading={subjectsLoading} 
                        showSearch
                        onDropdownVisibleChange={(open) => {
                          if (open) {
                            const filtered = getFilteredSubjects();
                            console.log('🔍 Dropdown opened with filtered subjects:', {
                              count: filtered.length,
                              isElectiveClass,
                              subjects: filtered.slice(0, 5).map(s => ({ code: s.subjectCode, name: s.subjectName_display }))
                            });
                          }
                        }}
                      >
                        {getFilteredSubjects().map(s => (
                          <Option key={s.subjectId} value={s.subjectId}>
                            {s.subjectName_display}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              )}
              

              
              {!isElectiveClass && (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="teacherIds" label="Teacher(s)" rules={[{ required: true }]}>
                      <Select 
                        mode="multiple" 
                        placeholder="Search and select teacher(s)..." 
                        loading={teachersLoading || checking} 
                        showSearch
                        searchValue={teacherSearchText}
                        onSearch={setTeacherSearchText}
                        filterOption={false}
                        maxTagCount="responsive"
                    notFoundContent={teacherSearchText ? "No teachers found matching your search" : "No teachers available"}
                  >
                    {filteredTeachersForSearch.map(teacher => (
                      <Option key={teacher._id} value={teacher._id} disabled={currentClassType !== 'P' && !teacher.isAvailable}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500 }}>{teacher.fullName}</div>
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                                Code: {teacher.shortName}
                              </div>
                            </div>
                            <div style={{ marginLeft: '8px' }}>
                              {teacher.isAvailable ? <Tag color="green">Free</Tag> : <Tag color="red">Busy</Tag>}
                            </div>
                          </div>
                          {!teacher.isAvailable && teacher.conflictDetails && (
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#ff4d4f', 
                              backgroundColor: '#fff2f0', 
                              padding: '4px 6px', 
                              borderRadius: '4px',
                              border: '1px solid #ffccc7',
                              marginTop: '4px'
                            }}>
                              {teacher.conflictDetails.subjectName || 'Unknown Subject'} 
                              {teacher.conflictDetails.roomName && ` in ${teacher.conflictDetails.roomName}`}
                              {teacher.conflictDetails.programCode && ` (${teacher.conflictDetails.programCode}`}
                              {teacher.conflictDetails.semester && ` Sem ${teacher.conflictDetails.semester}`}
                              {teacher.conflictDetails.section && ` Sec ${teacher.conflictDetails.section}`}
                              {teacher.conflictDetails.programCode && ')'}
                            </div>
                          )}
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="roomId" label="Room" rules={[{ required: true }]}>
                  <Select 
                    placeholder="Search and select room..." 
                    loading={roomsLoading} 
                    showSearch
                    searchValue={roomSearchText}
                    onSearch={setRoomSearchText}
                    filterOption={false}
                    notFoundContent={roomSearchText ? "No rooms found matching your search" : "No rooms available"}
                  >
                    {filteredRoomsForSearch.map(room => (
                      <Option key={room._id} value={room._id} disabled={room.isAvailable === false}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500 }}>{room.name}</div>
                              {room.code && (
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                                  Code: {room.code}
                                  {room.building && ` • Building: ${room.building}`}
                                  {room.floor && ` • Floor: ${room.floor}`}
                                </div>
                              )}
                            </div>
                            <div style={{ marginLeft: '8px' }}>
                              {room.isAvailable === false ? <Tag color="red">Busy</Tag> : room.isAvailable === true ? <Tag color="green">Free</Tag> : null}
                            </div>
                          </div>
                          {room.isAvailable === false && room.conflictDetails && (
                            <div style={{ 
                              fontSize: '10px', 
                              color: '#ff4d4f', 
                              backgroundColor: '#fff2f0', 
                              padding: '4px 6px', 
                              borderRadius: '4px',
                              border: '1px solid #ffccc7',
                              marginTop: '4px'
                            }}>
                              Occupied: {room.conflictDetails.subjectName || 'Unknown Class'}
                              {room.conflictDetails.programCode && ` (${room.conflictDetails.programCode}`}
                              {room.conflictDetails.semester && ` S${room.conflictDetails.semester}`}
                              {room.conflictDetails.section && ` Sec ${room.conflictDetails.section}`}
                              {room.conflictDetails.programCode && ')'}
                            </div>
                          )}
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
              )}
            </>
          )}

          <Form.Item name="notes" label="Notes (Optional)"><TextArea placeholder="Additional notes..." rows={2} /></Form.Item>
        </Form>
        {checking && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin>
              <div style={{ padding: '20px' }}>Checking for conflicts...</div>
            </Spin>
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default AssignClassModal;
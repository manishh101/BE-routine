/**
 * Demo page showcasing the new clean Excel integration
 */

import React, { useState } from 'react';
import { Card, Select, Space, Typography, Divider, Alert } from 'antd';
import ExcelActions from '../components/ExcelActions';
import RoutineGrid from '../components/RoutineGrid';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const ExcelDemo = () => {
  const [selectedProgram, setSelectedProgram] = useState('BCT');
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [selectedSection, setSelectedSection] = useState('A');

  const programs = [
    { code: 'BCT', name: 'Bachelor in Computer Technology' },
    { code: 'BEX', name: 'Bachelor in Electronics' },
    { code: 'BCE', name: 'Bachelor in Civil Engineering' }
  ];

  const semesters = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const sections = ['A', 'B', 'C'];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        
        {/* Header */}
        <Card>
          <Title level={2}>🔄 Excel Import/Export Integration Demo</Title>
          <Paragraph>
            This demo showcases the new clean architecture for Excel operations in the routine management system.
            The functionality is now modular, reusable, and follows best practices.
          </Paragraph>
          
          <Alert
            message="Clean Architecture Features"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
                <li><strong>Separation of Concerns:</strong> Excel logic is separated from UI components</li>
                <li><strong>Reusable Components:</strong> ExcelActions can be used anywhere in the app</li>
                <li><strong>Custom Hooks:</strong> useExcelOperations hook handles all Excel operations</li>
                <li><strong>Error Handling:</strong> Comprehensive error messages and validation</li>
                <li><strong>Permission Control:</strong> Import restricted to admin users</li>
                <li><strong>File Validation:</strong> Type and size validation before processing</li>
              </ul>
            }
            type="info"
            showIcon
          />
        </Card>

        {/* Selection Controls */}
        <Card title="📚 Select Program, Semester & Section">
          <Space size="large">
            <div>
              <Text strong>Program:</Text>
              <br />
              <Select
                value={selectedProgram}
                onChange={setSelectedProgram}
                style={{ width: 200, marginTop: 4 }}
              >
                {programs.map(program => (
                  <Option key={program.code} value={program.code}>
                    {program.code} - {program.name}
                  </Option>
                ))}
              </Select>
            </div>
            
            <div>
              <Text strong>Semester:</Text>
              <br />
              <Select
                value={selectedSemester}
                onChange={setSelectedSemester}
                style={{ width: 120, marginTop: 4 }}
              >
                {semesters.map(sem => (
                  <Option key={sem} value={sem}>Semester {sem}</Option>
                ))}
              </Select>
            </div>
            
            <div>
              <Text strong>Section:</Text>
              <br />
              <Select
                value={selectedSection}
                onChange={setSelectedSection}
                style={{ width: 120, marginTop: 4 }}
              >
                {sections.map(section => (
                  <Option key={section} value={section}>Section {section}</Option>
                ))}
              </Select>
            </div>
          </Space>
        </Card>

        {/* Standalone Excel Actions Demo */}
        <Card title="🔧 Standalone Excel Actions Component">
          <Paragraph>
            The <Text code>ExcelActions</Text> component can be used independently anywhere in the application:
          </Paragraph>
          
          <div style={{ 
            background: '#f5f5f5', 
            padding: '16px', 
            borderRadius: '8px',
            border: '1px dashed #d9d9d9'
          }}>
            <Space direction="vertical" size="small">
              <Text strong>Admin View (Import + Export):</Text>
              <ExcelActions
                programCode={selectedProgram}
                semester={selectedSemester}
                section={selectedSection}
                allowImport={true}
                allowExport={true}
                size="default"
              />
              
              <Divider style={{ margin: '12px 0' }} />
              
              <Text strong>Regular User View (Export Only):</Text>
              <ExcelActions
                programCode={selectedProgram}
                semester={selectedSemester}
                section={selectedSection}
                allowImport={false}
                allowExport={true}
                size="small"
              />
              
              <Divider style={{ margin: '12px 0' }} />
              
              <Text strong>Demo Mode (Disabled):</Text>
              <ExcelActions
                programCode={selectedProgram}
                semester={selectedSemester}
                section={selectedSection}
                allowImport={true}
                allowExport={true}
                demoMode={true}
                size="small"
              />
            </Space>
          </div>
        </Card>

        {/* Integrated Routine Grid */}
        <Card title="📋 Integrated Routine Grid with Excel Actions">
          <Paragraph>
            The routine grid now automatically includes Excel functionality based on user permissions:
          </Paragraph>
          
          <RoutineGrid
            programCode={selectedProgram}
            semester={selectedSemester}
            section={selectedSection}
            isEditable={true} // Admin view - shows import button
            demoMode={false}
          />
        </Card>

        {/* Technical Details */}
        <Card title="⚙️ Technical Implementation">
          <Space direction="vertical" size="medium">
            <div>
              <Title level={4}>File Structure:</Title>
              <pre style={{ 
                background: '#f6f8fa', 
                padding: '12px', 
                borderRadius: '6px',
                fontSize: '12px'
              }}>
{`frontend/src/
├── components/
│   ├── ExcelActions.jsx          # Clean Excel UI component
│   └── RoutineGrid.jsx           # Updated to use ExcelActions
├── hooks/
│   └── useExcelOperations.js     # Custom hook for Excel logic
└── services/
    └── excelService.js           # Service layer for Excel operations`}
              </pre>
            </div>
            
            <div>
              <Title level={4}>Key Benefits:</Title>
              <ul>
                <li><strong>Modular Design:</strong> Excel functionality is self-contained</li>
                <li><strong>Type Safety:</strong> Proper TypeScript-like prop validation</li>
                <li><strong>Error Boundaries:</strong> Graceful error handling throughout</li>
                <li><strong>Performance:</strong> Optimized with React.memo and useMemo</li>
                <li><strong>Accessibility:</strong> Proper ARIA labels and keyboard navigation</li>
                <li><strong>Testability:</strong> Easy to unit test individual components</li>
              </ul>
            </div>
          </Space>
        </Card>

      </Space>
    </div>
  );
};

export default ExcelDemo;

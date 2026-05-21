# Master Report Dashboard

## Overview
The Master Report Dashboard provides comprehensive analytics and visualizations for graduate data across all batches, centers, and courses.

## Features

### 1. Summary Statistics Cards
- **Total Graduates**: Overall count of all graduates
- **Male/Female Breakdown**: Gender-wise distribution
- **Total Batches**: Number of training batches
- **Total Centers**: Number of training centers
- **Total Courses**: Number of courses offered

### 2. Visualizations

#### Batch-wise Graduates (Bar Chart)
- Shows total number of graduates per batch
- Helps identify high-performing batches
- Interactive tooltips for detailed information

#### Gender Distribution (Pie Chart)
- Visual representation of male vs female graduates
- Displays both count and percentage
- Color-coded: Blue for Male, Pink for Female

#### Course-wise Gender Distribution (Bar Chart)
- Compares courses by gender breakdown
- Shows male, female, and total counts per course
- Helps identify gender trends in different courses

### 3. Data Tables

#### Center & Course-wise Graduate Breakdown
Detailed table showing:
- Center name
- Course name
- Male count
- Female count
- Total graduates
- Sorted by total (highest to lowest)

#### Course Summary Table
Aggregate data by course:
- Course name
- Gender breakdown (Male/Female)
- Total graduates per course
- Percentage of total graduates

## Data Source

The dashboard fetches data from the `getExamAssessmentAll` API endpoint, which returns:
- All graduates with **total_score ≥ 60**
- Final exam assessments only (`ea_type: "FINAL"`)
- Complete student, batch, center, and course information

## Backend Logic
- Graduation eligibility: **total_score ≥ 60**
- Scores above 60 are considered as 60 (pass threshold)
- Only FINAL exam type assessments are included

## Usage

### Integration
The Master Report Dashboard is integrated into the ExamAssessmentTable component:
1. Navigate to the "Final Exam" section
2. Click on the "Master Report" tab
3. The dashboard will load and display all graduate analytics

### Tab Navigation
- **Final Exam List**: Shows all final exam assessments
- **Graduates**: Filtered list of passing students
- **Master Report**: Comprehensive analytics dashboard (this component)

## Technical Details

### Dependencies
- **Recharts**: For all chart visualizations
- **Shadcn UI**: Card and Table components
- **React**: State management and component lifecycle
- **Axios**: API data fetching

### Component Structure
```tsx
MasterReportDashboard
├── Summary Statistics (6 cards)
├── Charts Section
│   ├── Batch-wise Bar Chart
│   └── Gender Distribution Pie Chart
├── Course Gender Distribution Bar Chart
└── Data Tables
    ├── Center & Course Breakdown
    └── Course Summary
```

### Data Processing
The component processes raw graduate data to generate:
1. Batch-wise aggregations
2. Course-wise gender counts
3. Center-course combinations
4. Gender distribution statistics

### Performance
- Efficient data processing with Map objects
- Single API call on component mount
- Memoized calculations
- Responsive charts (adapts to screen size)

## Future Enhancements
- Export to PDF/Excel functionality
- Date range filtering
- District-wise breakdown
- Score distribution analysis
- Comparison across time periods
- Real-time data updates

## Troubleshooting

### No Data Displayed
- Verify the API endpoint is accessible
- Check if there are graduates with score ≥ 60
- Ensure authentication token is valid

### Charts Not Rendering
- Verify Recharts is installed: `npm list recharts`
- Check browser console for errors
- Ensure responsive container has proper height

### Performance Issues
- Consider implementing pagination for large datasets
- Add loading states for better UX
- Implement data caching strategies

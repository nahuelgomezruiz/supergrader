# Cross-Project Unified Report

## Overview

The Cross-Project Unified Report feature generates a comprehensive Excel file that consolidates evaluation statistics from all evaluated assignments (hw_linkedlists, proj_gerp, etc.) into a single, easy-to-analyze document. This eliminates the need to open individual files to understand overall evaluation performance.

## What Gets Generated

### 📄 **Single Excel File**
- **Filename**: `CROSS_PROJECT_UNIFIED_evaluation.xlsx`
- **Location**: Generated in the main output directory alongside individual project reports
- **Content**: 4 comprehensive worksheets with different analysis perspectives

## Worksheets Included

### 1. 📊 **OVERVIEW_SUMMARY**
**Main dashboard with key statistics for each assignment**

| Project | Assignment | Students Evaluated | Total Rubric Items | Accuracy Rate | Avg Confidence | Checkbox Items | Radio Items |
|---------|------------|-------------------|-------------------|---------------|----------------|----------------|-------------|
| hw_linkedlists | section_01_grading | 15 | 8 | 87.5% | 82.3% | 6 | 2 |
| proj_gerp | section_01_grading | 12 | 12 | 91.2% | 85.7% | 8 | 4 |

**Features:**
- ✅ **Color-coded accuracy**: Green (≥90%), Blue (≥80%), Yellow (≥70%), Red (<70%)
- 📊 **Totals/Averages row** at the bottom
- 📈 **Comprehensive metrics** for quick performance assessment

### 2. 🔍 **DETAILED_STATISTICS**
**Per-rubric-item breakdown with granular analysis**

| Project | Assignment | Rubric Item | Type | Points | Matches | False Positives | False Negatives | Accuracy | Avg Confidence |
|---------|------------|-------------|------|--------|---------|----------------|----------------|----------|----------------|
| hw_linkedlists | section_01 | Functionality works correctly... | CHECKBOX | 3.0 | 12 | 2 | 1 | 80.0% | 78.5% |

**Features:**
- 🎯 **Individual rubric item performance**
- ⚖️ **False positive/negative tracking**
- 📋 **Truncated descriptions** for readability (50 chars + "...")
- 🌈 **Color-coded accuracy** for quick identification of problem areas

### 3. 📈 **PROJECT_COMPARISON**
**High-level comparison between different projects**

| Project | Total Assignments | Total Students | Total Rubric Items | Overall Accuracy | Avg Confidence | Best Assignment | Worst Assignment | Notes |
|---------|------------------|----------------|-------------------|------------------|----------------|----------------|-----------------|-------|
| hw_linkedlists | 3 | 45 | 24 | 88.3% | 81.2% | section_03_grading | section_01_grading | Good performance; High confidence |

**Features:**
- 🏆 **Best/worst assignment identification**
- 📝 **Automated performance notes**
- 📊 **Project-level aggregation**
- 🔍 **Confidence level assessment**

### 4. 🎯 **RUBRIC_TYPE_ANALYSIS**
**Separated analysis for checkbox vs radio button items**

**Checkbox Items:**
| Project | Assignment | Accuracy | Avg Confidence | Total Items | Performance |
|---------|------------|----------|----------------|-------------|-------------|
| proj_gerp | section_01 | 92.1% | 87.3% | 8 | Excellent |

**Radio Items:**
| Project | Assignment | Accuracy | Avg Confidence | Total Items | Performance |
|---------|------------|----------|----------------|-------------|-------------|
| proj_gerp | section_01 | 89.5% | 83.2% | 4 | Good |

**Features:**
- 🔲 **Checkbox performance analysis**
- 🔘 **Radio button performance analysis** 
- 📊 **Type-specific insights**
- 🎯 **Performance categorization**: Excellent (≥90%), Good (≥80%), Fair (≥70%), Poor (<70%)

## How to Access

### 🖥️ **Via GUI (Recommended)**
1. Open the evaluation GUI: `python evaluation_gui.py`
2. Select assignments you want to evaluate
3. **Important**: Choose **"Concurrent"** processing mode
4. Run the evaluation
5. The unified report will be automatically generated at the end

### 💻 **Via Command Line**
```bash
cd evaluation
python evaluation_dashboard.py --concurrent --num-students 20
```

### 📍 **File Location**
The report will be saved in your output directory as:
```
output/
├── run_20241201_143022/
│   ├── hw_linkedlists_UNIFIED_evaluation.xlsx    # Individual project
│   ├── proj_gerp_UNIFIED_evaluation.xlsx         # Individual project  
│   └── CROSS_PROJECT_UNIFIED_evaluation.xlsx     # ← CROSS-PROJECT REPORT
```

## Key Benefits

### 🎯 **Consolidated Overview**
- **Single file** contains all assignment statistics
- **No need** to open multiple Excel files
- **Quick identification** of trends and patterns

### 📊 **Comprehensive Analysis**
- **4 different perspectives** on the same data
- **Color-coded performance** for visual analysis
- **Automatic categorization** and notes

### ⚡ **Efficiency Gains**
- **Instant comparison** between assignments
- **Easy identification** of problematic rubric items
- **Clear performance trends** across projects

### 🔍 **Detailed Insights**
- **Rubric item level** analysis
- **Type-specific performance** (checkbox vs radio)
- **False positive/negative tracking**

## Color Coding System

### 🎨 **Accuracy Performance**
- 🟢 **Green (≥90%)**: Excellent performance
- 🔵 **Blue (≥80%)**: Good performance  
- 🟡 **Yellow (≥70%)**: Fair performance
- 🔴 **Red (<70%)**: Needs improvement

### 📝 **Performance Categories**
- **Excellent**: ≥90% accuracy
- **Good**: 80-89% accuracy
- **Fair**: 70-79% accuracy
- **Poor**: <70% accuracy

## Sample Analysis Workflow

### 1. 📋 **Start with OVERVIEW_SUMMARY**
- Identify which assignments have lowest accuracy
- Check if any projects consistently underperform
- Look for patterns in confidence scores

### 2. 🔍 **Drill down to DETAILED_STATISTICS**
- Find specific rubric items causing problems
- Identify patterns in false positives/negatives
- Focus improvement efforts on lowest-performing items

### 3. 📈 **Review PROJECT_COMPARISON**
- Compare performance across different course modules
- Identify best practices from high-performing assignments
- Plan targeted improvements for underperforming areas

### 4. 🎯 **Analyze RUBRIC_TYPE_ANALYSIS**
- Compare AI performance on checkbox vs radio items
- Adjust rubric design based on type-specific performance
- Optimize question formats for better AI accuracy

## Technical Implementation

### 🏗️ **Architecture**
- **Class**: `CrossProjectUnifiedReportGenerator`
- **Location**: `evaluation/evaluation_dashboard.py`
- **Dependencies**: `openpyxl`, `pathlib`, existing evaluation infrastructure

### 🔄 **Data Flow**
1. Individual evaluations completed for each project
2. Cross-project data aggregated from all evaluation results
3. Four worksheet analysis performed
4. Excel file generated with formatted output

### 📊 **Data Sources**
- **Human grades**: From CSV files in `eval-data/*/grades/`
- **AI evaluations**: From backend API responses
- **Rubric items**: From generated rubric text files
- **Student data**: From evaluation processing

## Availability

### ✅ **Available In:**
- **Concurrent processing mode** (GUI and command line)
- **All evaluation runs** with multiple projects

### ❌ **Not Available In:**
- **Sequential processing mode** (legacy mode)
- **Single project evaluations**

### 📝 **Note for Sequential Mode Users**
When using sequential processing, the GUI will display:
```
📝 Note: Cross-project unified reports are only generated in concurrent processing mode.
   To get comprehensive statistics across all assignments, please use concurrent mode.
```

## Performance Considerations

### 📈 **Generation Time**
- **Minimal overhead**: Generated after all individual reports
- **Memory efficient**: Processes aggregated data, not raw submissions
- **Fast Excel writing**: Uses optimized openpyxl operations

### 💾 **File Size**
- **Typical size**: 100-500KB depending on number of assignments
- **Compressed format**: Excel's native compression
- **Optimized layouts**: Efficient data representation

## Troubleshooting

### 🔧 **Common Issues**

**Report not generated:**
- ✅ Ensure you're using **concurrent processing mode**
- ✅ Check that **multiple projects** were evaluated
- ✅ Verify output directory permissions

**Missing data in report:**
- ✅ Confirm all individual project evaluations completed successfully
- ✅ Check for errors in evaluation logs
- ✅ Ensure rubric files are properly formatted

**Excel file won't open:**
- ✅ Check file permissions in output directory
- ✅ Ensure Excel/compatible software is available
- ✅ Verify file wasn't corrupted during generation

### 📋 **Verification Steps**
1. **Check console output** for report generation confirmation
2. **Verify file exists** in output directory
3. **Open file** and check all 4 worksheets are present
4. **Validate data** matches individual project reports

## Future Enhancements

### 🚀 **Potential Additions**
- **Time series analysis** for tracking improvement over time
- **Student-level aggregation** across assignments
- **Automated recommendations** based on performance patterns
- **Export to other formats** (PDF, CSV) 
- **Interactive dashboards** with filtering capabilities

### 🔧 **Configuration Options**
- **Customizable thresholds** for performance categories
- **Selectable worksheets** to include/exclude
- **Custom color schemes** for different use cases
- **Additional statistical measures** (standard deviation, etc.)

## Summary

The Cross-Project Unified Report provides a powerful, comprehensive view of AI evaluation performance across all assignments. With four specialized worksheets, color-coded performance indicators, and detailed statistical analysis, it enables instructors and administrators to:

- **Quickly assess** overall system performance
- **Identify areas** needing improvement  
- **Compare performance** across different assignments
- **Make data-driven decisions** about rubric design and AI tuning

This feature transforms individual evaluation results into actionable insights for continuous improvement of the automated grading system! 🎯 
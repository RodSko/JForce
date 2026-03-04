import React, { useState } from 'react';

const GenerateReport = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [exportFormat, setExportFormat] = useState('PDF');

    const handleGenerateReport = () => {
        // Logic for generating report will go here
        alert(`Generating report from ${startDate} to ${endDate} in ${exportFormat} format!`);
    };

    return (
        <div>
            <h1>Generate Report</h1>
            <label>
                Start Date:
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
            </label>
            <label>
                End Date:
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />
            </label>
            <label>
                Export Format:
                <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                >
                    <option value="PDF">PDF</option>
                    <option value="Excel">Excel</option>
                    <option value="CSV">CSV</option>
                </select>
            </label>
            <button onClick={handleGenerateReport}>Generate Report</button>
        </div>
    );
};

export default GenerateReport;
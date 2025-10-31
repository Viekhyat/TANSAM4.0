import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChartRenderer from "../ui/ChartRenderer.jsx";

const BACKEND_URL = "http://localhost:8085"; // change if backend runs elsewhere

const chartTypes = [
  { value: "line", label: "Line", description: "Track trends across time" },
  { value: "bar", label: "Bar", description: "Compare values side-by-side" },
  { value: "area", label: "Area", description: "Emphasize cumulative totals" },
  { value: "pie", label: "Pie", description: "Show proportional breakdown" },
  { value: "scatter", label: "Scatter", description: "Show correlation between variables" }
];

export default function DynamicVisualizePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  
  const [chartType, setChartType] = useState("line");
  const [dataSource, setDataSource] = useState("");
  const [dataFields, setDataFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState({
    xField: "",
    yField: ""
  });
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartTitle, setChartTitle] = useState("New Dynamic Visualization");
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/connections`);
        const data = await response.json();
        if (data.success) {
          setConnections(data.connections);
          if (data.connections.length > 0 && !dataSource) {
            setDataSource(data.connections[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching connections:", err);
      }
    };
    
    fetchConnections();
  }, []);

  useEffect(() => {
    // If editing, fetch the existing chart configuration
    if (isEditing) {
      const fetchChartConfig = async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/api/charts/${id}`);
          const data = await response.json();
          if (data.success) {
            setChartTitle(data.chart.title);
            setChartType(data.chart.type);
            setDataSource(data.chart.dataSource);
            setSelectedFields({
              xField: data.chart.xField,
              yField: data.chart.yField
            });
          }
        } catch (err) {
          console.error("Error fetching chart config:", err);
          setError("Failed to load chart configuration.");
        }
      };
      
      fetchChartConfig();
    }
  }, [id, isEditing]);

  useEffect(() => {
    if (!dataSource) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch data from the selected connection
        const response = await fetch(`${BACKEND_URL}/api/data/${dataSource}`);
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          // Flatten the data if it's nested in tables
          let flatData = data.data;
          if (data.data[0].rows) {
            flatData = data.data.flatMap(table => table.rows);
          }
          
          // Extract field names from the first data item
          if (flatData.length > 0) {
            const fields = Object.keys(flatData[0]);
            setDataFields(fields);
            
            // Set default selected fields if not already set
            if (!selectedFields.xField || !selectedFields.yField) {
              setSelectedFields({
                xField: fields.find(f => f.toLowerCase().includes('date') || f.toLowerCase().includes('time')) || fields[0],
                yField: fields.find(f => f.toLowerCase().includes('value') || f.toLowerCase().includes('count')) || fields[1] || fields[0]
              });
            }
            
            setPreviewData(flatData);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
        setLoading(false);
      }
    };
    
    fetchData();
  }, [dataSource]);

  const handleSave = async () => {
    if (!chartTitle || !chartType || !dataSource || !selectedFields.xField || !selectedFields.yField) {
      setError("Please fill in all required fields.");
      return;
    }
    
    try {
      const chartConfig = {
        title: chartTitle,
        type: chartType,
        dataSource,
        xField: selectedFields.xField,
        yField: selectedFields.yField
      };
      
      const url = isEditing 
        ? `${BACKEND_URL}/api/charts/${id}` 
        : `${BACKEND_URL}/api/charts`;
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chartConfig)
      });
      
      const data = await response.json();
      
      if (data.success) {
        navigate("/dynamic-dashboard");
      } else {
        setError(data.error || "Failed to save chart.");
      }
    } catch (err) {
      console.error("Error saving chart:", err);
      setError("Failed to save chart. Please try again.");
    }
  };

  const handleCancel = () => {
    navigate("/dynamic-dashboard");
  };

  const transformedData = previewData.map(item => ({
    x: item[selectedFields.xField],
    y: item[selectedFields.yField]
  }));

  return (
    <div className="flex w-full flex-col gap-6 px-4 pb-10 pt-2 md:px-6 lg:px-8">
      <section className="sticky top-[84px] z-30 glass-panel sticky-edge rounded-2xl p-4 md:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dynamic Visualization</h1>
            <p className="text-xs text-slate-500 dark:text-slate-300">Create real-time visualizations from dynamic data sources.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
              Live Preview
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <section className="glass-panel rounded-2xl p-4 shadow-xl transition-colors md:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Chart Configuration</h2>
          
          <div className="space-y-4">
            {/* Chart Title */}
            <div>
              <label htmlFor="chart-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Chart Title
              </label>
              <input
                type="text"
                id="chart-title"
                value={chartTitle}
                onChange={(e) => setChartTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="Enter chart title"
              />
            </div>
            
            {/* Chart Type */}
            <div>
              <label htmlFor="chart-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Chart Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {chartTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setChartType(type.value)}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center text-xs transition ${
                      chartType === type.value
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-300"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <span className="font-medium">{type.label}</span>
                    <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{type.description}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Data Source */}
            <div>
              <label htmlFor="data-source" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Data Source
              </label>
              <select
                id="data-source"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select a data source</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* X-Axis Field */}
            <div>
              <label htmlFor="x-field" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                X-Axis Field
              </label>
              <select
                id="x-field"
                value={selectedFields.xField}
                onChange={(e) => setSelectedFields({ ...selectedFields, xField: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                disabled={dataFields.length === 0}
              >
                <option value="">Select X-Axis field</option>
                {dataFields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Y-Axis Field */}
            <div>
              <label htmlFor="y-field" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Y-Axis Field
              </label>
              <select
                id="y-field"
                value={selectedFields.yField}
                onChange={(e) => setSelectedFields({ ...selectedFields, yField: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                disabled={dataFields.length === 0}
              >
                <option value="">Select Y-Axis field</option>
                {dataFields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={handleCancel}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                {isEditing ? "Update Chart" : "Create Chart"}
              </button>
            </div>
          </div>
        </section>
        
        {/* Preview Panel */}
        <section className="glass-panel rounded-2xl p-4 shadow-xl transition-colors md:p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Chart Preview</h2>
          
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500 mx-auto"></div>
                <p className="text-slate-500 dark:text-slate-400">Loading data...</p>
              </div>
            </div>
          ) : previewData.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <p className="text-slate-500 dark:text-slate-400">No data available. Please select a data source.</p>
              </div>
            </div>
          ) : (
            <div className="h-96">
              <ChartRenderer
                chart={{ 
                  chartType: chartType,
                  title: chartTitle
                }}
                data={transformedData}
              />
            </div>
          )}
          
          {/* Data Sample */}
          {previewData.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Data Sample</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead>
                    <tr>
                      {dataFields.slice(0, 5).map((field) => (
                        <th
                          key={field}
                          className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                        >
                          {field}
                        </th>
                      ))}
                      {dataFields.length > 5 && (
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          ...
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {previewData.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        {dataFields.slice(0, 5).map((field) => (
                          <td
                            key={`${rowIndex}-${field}`}
                            className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]"
                          >
                            {row[field] !== null && row[field] !== undefined ? String(row[field]) : "null"}
                          </td>
                        ))}
                        {dataFields.length > 5 && (
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">...</td>
                        )}
                      </tr>
                    ))}
                    {previewData.length > 5 && (
                      <tr>
                        <td
                          colSpan={Math.min(dataFields.length, 6)}
                          className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 text-center"
                        >
                          {previewData.length - 5} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
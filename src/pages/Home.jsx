import { Link } from "react-router-dom";
import { useAuth } from "../providers/AuthContext.jsx";

export default function Home() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center px-4">
      {/* Hero Section */}
      <div className="mx-auto max-w-5xl text-center mb-16">
        <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-100 mb-6">
          Welcome to <span className="text-brand-500">DATANAUT</span>
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-8">
          Transform your raw data into powerful visualizations and actionable insights with our intuitive data analysis platform.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {!user ? (
            <Link to="/login" className="rounded-full bg-brand-500 px-8 py-3 text-white font-semibold hover:bg-brand-600 transition-colors shadow-lg hover:shadow-xl">
              Get Started
            </Link>
          ) : (
            <Link to="/dashboard" className="rounded-full bg-brand-500 px-8 py-3 text-white font-semibold hover:bg-brand-600 transition-colors shadow-lg hover:shadow-xl">
              Go to Dashboard
            </Link>
          )}
          <Link to="/data" className="rounded-full border-2 border-slate-300 px-8 py-3 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            Explore Data
          </Link>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Data Visualization</h3>
          <p className="text-slate-600 dark:text-slate-300">Create beautiful, interactive charts and graphs from your data with just a few clicks.</p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Real-time Analysis</h3>
          <p className="text-slate-600 dark:text-slate-300">Instantly analyze your data and get valuable insights without complex setup or configuration.</p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Customizable Dashboards</h3>
          <p className="text-slate-600 dark:text-slate-300">Build personalized dashboards to monitor your key metrics and share insights with your team.</p>
        </div>
      </div>
      
      {/* CTA Section */}
      <div className="w-full max-w-4xl bg-gradient-to-r from-brand-500 to-brand-600 rounded-2xl p-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-4">Ready to transform your data?</h2>
        <p className="mb-6 max-w-2xl mx-auto">Join thousands of data professionals who use DATANAUT to unlock the power of their data.</p>
        <Link to={user ? "/dashboard" : "/login"} className="inline-block rounded-full bg-white px-8 py-3 font-semibold text-brand-600 hover:bg-slate-100 transition-colors">
          {user ? "Go to Dashboard" : "Get Started Now"}
        </Link>
      </div>
    </div>
  );
}
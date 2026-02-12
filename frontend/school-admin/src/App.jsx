import React from "react";
import AppRoutes from "./routes/AppRoutes";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";



 export default function App() {
      return <AppRoutes />;
function App() {
  return (
    <ThemeProvider>
    
  

      <AppRoutes />
    </ThemeProvider>
  );
}
 }


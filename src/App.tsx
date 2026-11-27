import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Navbar from "./components/Navbar";
import MatchPage from "./pages/MatchPage";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="min-h-screen bg-canvas text-slate-900">
        <Navbar />
        <Routes>
          {/* The demo opens straight on Live Matching; there is no separate landing page. */}
          <Route path="/" element={<Navigate to="/match" replace />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="*" element={<Navigate to="/match" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { Landing } from "./screens/Landing";
import { Status } from "./screens/Status";
import { Edit } from "./screens/Edit";
import { Skip } from "./screens/Skip";
import { Reconnect } from "./screens/Reconnect";
import { NotFound } from "./screens/NotFound";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/status" element={<Status />} />
        <Route path="/edit/:eventId" element={<Edit />} />
        <Route path="/skip/:eventId" element={<Skip />} />
        <Route path="/reconnect" element={<Reconnect />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  </StrictMode>
);

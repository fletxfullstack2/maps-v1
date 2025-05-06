import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import App from "./App.tsx";
import "leaflet/dist/leaflet.css";

createRoot(document.getElementById("root")!).render(
  <div style={{ height: "100%" }}>
    <App
      start={[4.711296, -74.072017]}
      end={[10.96403, -74.796524]}
      vehicleLocation={[7.280758, -73.561948]}
      isRouting={true}
    />
  </div>
);

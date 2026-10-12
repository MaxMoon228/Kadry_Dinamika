import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BootScreen } from "./components/BootScreen";
import { bootstrapDataSource } from "./data";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(<BootScreen />);

bootstrapDataSource()
  .then(() =>
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  )
  .catch((e: unknown) => root.render(<BootScreen error={e instanceof Error ? e.message : String(e)} />));

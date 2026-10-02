import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";
import "../app/game-art.css";
import "../app/table-polish.css";
createRoot(document.getElementById("root")!).render(<Home />);
